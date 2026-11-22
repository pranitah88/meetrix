const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Meeting = require('../models/Meeting');
const Notification = require('../models/Notification');
const User = require('../models/User');

const isObjectId = (val) => mongoose.Types.ObjectId.isValid(val) && /^[0-9a-fA-F]{24}$/.test(String(val));
const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

// Helper to create notifications without duplicates
async function notifyUsers({ userIds, title, message, type, linkType = 'meeting', linkId = '' }) {
  try {
    if (!userIds || !userIds.length) return;
    for (const uid of userIds) {
      const query = {
        user: uid,
        type,
        linkId: String(linkId)
      };
      if (type === 'decision_logged' || type === 'mention') {
        query.message = message;
      }
      const exists = await Notification.findOne(query);
      if (!exists) {
        await Notification.create({
          user: uid,
          title,
          message,
          type,
          linkType,
          linkId: String(linkId),
          read: false
        });
      }
    }
  } catch (err) {
    console.error('Notification error:', err.message);
  }
}

// Helper to schedule next occurrence for recurring meetings
async function checkScheduleNextRecurring(meeting, currentUserId, currentUserName) {
  if (!meeting.recurring || meeting.recurring === 'None') return;

  const curDate = new Date(meeting.date);
  let nextDate = new Date(curDate);

  if (meeting.recurring === 'Daily') {
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (meeting.recurring === 'Weekly') {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (meeting.recurring === 'Monthly') {
    nextDate.setMonth(nextDate.getMonth() + 1);
  }

  // Prevent duplicate: check if a recurring instance within 12 hours of nextDate exists
  const startRange = new Date(nextDate.getTime() - 12 * 60 * 60 * 1000);
  const endRange = new Date(nextDate.getTime() + 12 * 60 * 60 * 1000);

  const existing = await Meeting.findOne({
    title: meeting.title,
    recurring: meeting.recurring,
    date: { $gte: startRange, $lte: endRange }
  });

  if (!existing) {
    const nextMeeting = await Meeting.create({
      title: meeting.title,
      date: nextDate,
      status: 'Upcoming',
      type: meeting.type,
      recurring: meeting.recurring,
      agenda: meeting.agenda,
      attendees: meeting.attendees,
      attendeeNames: meeting.attendeeNames,
      attendance: meeting.attendance,
      decisions: [],
      tasks: [],
      insights: [],
      comments: [],
      history: [{
        action: 'Recurring session scheduled',
        by: currentUserName || 'System',
        at: new Date(),
        details: `Auto-scheduled based on ${meeting.recurring} cadence`
      }],
      createdBy: currentUserId,
    });

    console.log(`Auto-scheduled next recurring meeting: "${nextMeeting.title}" on ${nextDate.toISOString().split('T')[0]}`);
  }
}

// GET /api/meetings
router.get('/', auth, async (req, res) => {
  try {
    const { status, type, search, pinned, dateFrom, dateTo } = req.query;
    const query = {};

    // In a collaborative team platform, users can access team meetings
    // If specific filter required, can be added
    if (status && status !== 'All') {
      query.status = status;
    }
    if (type && type !== 'All') {
      query.type = type;
    }
    if (pinned === 'true') {
      query.pinned = true;
    }
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) query.date.$lte = new Date(dateTo);
    }
    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { title: searchRegex },
        { agenda: searchRegex },
        { decisions: searchRegex },
        { attendeeNames: searchRegex }
      ];
    }

    const meetings = await Meeting.find(query)
      .populate('attendees', 'name email avatar role department')
      .populate('tasks.assignee', 'name email avatar')
      .sort({ pinned: -1, date: -1 });

    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meetings/:id
router.get('/:id', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid meeting ID format' });
    }

    const meeting = await Meeting.findById(req.params.id)
      .populate('attendees', 'name email avatar role department')
      .populate('tasks.assignee', 'name email avatar')
      .populate('insights.author', 'name email avatar')
      .populate('comments.author', 'name email avatar')
      .populate('comments.replies.author', 'name email avatar');

    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meetings
router.post('/', auth, async (req, res) => {
  try {
    const { title, date, agenda, attendees, type, recurring, status } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Meeting title is required' });
    }

    // Resolve attendee IDs whether passed as IDs or Names
    let resolvedAttendeeIds = [];
    let resolvedAttendeeNames = [];

    const rawAttendees = Array.isArray(attendees) ? attendees : (typeof attendees === 'string' ? attendees.split(',').map(s=>s.trim()).filter(Boolean) : []);

    if (rawAttendees.length) {
      const ids = rawAttendees.filter(isObjectId);
      const names = rawAttendees.filter(x => !isObjectId(x));

      const foundUsers = await User.find({
        $or: [
          { _id: { $in: ids } },
          { name: { $in: names.map(n => new RegExp(`^${n}$`, 'i')) } }
        ]
      });

      resolvedAttendeeIds = foundUsers.map(u => u._id);
      resolvedAttendeeNames = foundUsers.map(u => u.name);
    }

    // Ensure current user is in attendees
    if (!resolvedAttendeeIds.some(id => id.toString() === req.user.id.toString())) {
      resolvedAttendeeIds.push(req.user.id);
      resolvedAttendeeNames.push(req.user.name || 'Team Member');
    }

    const attendance = resolvedAttendeeNames.map(name => ({
      name,
      status: 'Present',
      notes: ''
    }));

    const meeting = await Meeting.create({
      title: title.trim(),
      date: date ? new Date(date) : new Date(),
      agenda: agenda || '',
      attendees: resolvedAttendeeIds,
      attendeeNames: resolvedAttendeeNames,
      type: type || 'General Discussion',
      recurring: recurring || 'None',
      status: status || 'Upcoming',
      decisions: [],
      tasks: [],
      insights: [],
      comments: [],
      attendance,
      history: [{ action: 'Meeting scheduled', by: req.user.name || 'User', at: new Date(), details: 'Initial scheduling' }],
      createdBy: req.user.id,
    });

    // Notify other attendees
    const notifyIds = resolvedAttendeeIds.filter(id => id.toString() !== req.user.id.toString());
    await notifyUsers({
      userIds: notifyIds,
      title: 'New Meeting Scheduled',
      message: `${req.user.name || 'A team member'} scheduled "${title}"`,
      type: 'meeting_scheduled',
      linkId: meeting._id.toString()
    });

    res.status(201).json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/meetings/:id
router.put('/:id', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid meeting ID format' });

    const existing = await Meeting.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Meeting not found' });

    const updates = { ...req.body };
    const historyActions = [];

    // Check rescheduling
    if (updates.date && new Date(updates.date).getTime() !== new Date(existing.date).getTime()) {
      historyActions.push({
        action: 'Meeting Rescheduled',
        by: req.user.name || 'User',
        at: new Date(),
        details: `Rescheduled to ${new Date(updates.date).toLocaleDateString()}`
      });
      await notifyUsers({
        userIds: existing.attendees.filter(id => id.toString() !== req.user.id.toString()),
        title: 'Meeting Rescheduled',
        message: `"${existing.title}" rescheduled to ${new Date(updates.date).toLocaleDateString()}`,
        type: 'meeting_rescheduled',
        linkId: existing._id.toString()
      });
    }

    // Check status changes
    if (updates.status && updates.status !== existing.status) {
      historyActions.push({
        action: `Status changed to ${updates.status}`,
        by: req.user.name || 'User',
        at: new Date(),
        details: updates.cancelReason ? `Reason: ${updates.cancelReason}` : ''
      });

      if (updates.status === 'Cancelled') {
        await notifyUsers({
          userIds: existing.attendees.filter(id => id.toString() !== req.user.id.toString()),
          title: 'Meeting Cancelled',
          message: `"${existing.title}" was cancelled${updates.cancelReason ? ': ' + updates.cancelReason : ''}`,
          type: 'meeting_cancelled',
          linkId: existing._id.toString()
        });
      }

      // Check recurring meeting completion trigger
      if (updates.status === 'Completed' && existing.recurring && existing.recurring !== 'None') {
        await checkScheduleNextRecurring(existing, req.user.id, req.user.name);
      }
    }

    if (historyActions.length) {
      existing.history.push(...historyActions);
    }

    Object.assign(existing, updates);
    await existing.save();

    res.json(existing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/meetings/:id/pin
router.patch('/:id/pin', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid meeting ID' });
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    meeting.pinned = !meeting.pinned;
    await meeting.save();
    res.json({ pinned: meeting.pinned, message: meeting.pinned ? 'Meeting pinned' : 'Meeting unpinned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meetings/:id/duplicate
router.post('/:id/duplicate', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid meeting ID' });
    const orig = await Meeting.findById(req.params.id);
    if (!orig) return res.status(404).json({ error: 'Meeting not found' });

    const dup = await Meeting.create({
      title: `${orig.title} (Copy)`,
      date: new Date(),
      status: 'Upcoming',
      agenda: orig.agenda,
      type: orig.type,
      recurring: orig.recurring,
      attendees: orig.attendees,
      attendeeNames: orig.attendeeNames,
      attendance: orig.attendance,
      decisions: [],
      tasks: [],
      insights: [],
      comments: [],
      history: [{ action: 'Meeting duplicated', by: req.user.name || 'User', at: new Date(), details: `Cloned from "${orig.title}"` }],
      createdBy: req.user.id,
    });

    res.status(201).json(dup);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/meetings/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid meeting ID' });
    const deleted = await Meeting.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Meeting not found' });
    res.json({ message: 'Meeting deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meetings/:id/decisions
router.post('/:id/decisions', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid meeting ID' });
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Decision text is required' });

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    meeting.decisions.push(text.trim());
    meeting.history.push({
      action: 'Decision Recorded',
      by: req.user.name || 'User',
      at: new Date(),
      details: text.trim()
    });
    await meeting.save();

    await notifyUsers({
      userIds: meeting.attendees.filter(id => id.toString() !== req.user.id.toString()),
      title: 'New Decision Recorded',
      message: `In "${meeting.title}": ${text.trim().slice(0, 80)}`,
      type: 'decision_logged',
      linkId: meeting._id.toString()
    });

    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/meetings/:id/attendance
router.put('/:id/attendance', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid meeting ID' });
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    meeting.attendance = req.body.attendance || [];
    await meeting.save();
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meetings/:id/comments
router.post('/:id/comments', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid meeting ID' });
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text required' });

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const comment = {
      author: req.user.id,
      authorName: req.user.name || 'Team Member',
      text: text.trim(),
      replies: [],
      createdAt: new Date()
    };
    meeting.comments.push(comment);
    await meeting.save();

    // Check for @mentions
    const mentions = text.match(/@(\w+)/g) || [];
    if (mentions.length) {
      const names = mentions.map(m => m.slice(1).toLowerCase());
      const mentionedUsers = await User.find({ name: { $in: names.map(n => new RegExp(`^${n}$`, 'i')) } });
      const userIds = mentionedUsers.map(u => u._id).filter(id => id.toString() !== req.user.id.toString());
      await notifyUsers({
        userIds,
        title: 'You were mentioned in a discussion',
        message: `${req.user.name || 'Someone'} mentioned you in "${meeting.title}"`,
        type: 'mention',
        linkId: meeting._id.toString()
      });
    }

    res.status(201).json(meeting.comments[meeting.comments.length - 1]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/meetings/:id/notes
router.patch('/:id/notes', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid meeting ID' });
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    meeting.notes = req.body.notes || '';
    await meeting.save();
    res.json({ notes: meeting.notes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/meetings/:id/ai-summary
router.patch('/:id/ai-summary', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid meeting ID' });
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      { aiSummary: req.body.aiSummary, aiAnalysis: req.body.aiAnalysis || null },
      { new: true }
    );
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
