const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');
const Meeting = require('../models/Meeting');

// GET /api/notifications — list notifications for current user with automated deduplicated deadline checks
router.get('/', auth, async (req, res) => {
  try {
    const now = new Date();
    const inTwoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const userMeetings = await Meeting.find({
      $or: [{ attendees: req.user.id }, { 'tasks.assignee': req.user.id }]
    });

    for (const m of userMeetings) {
      for (const t of (m.tasks || [])) {
        if (t.assignee && t.assignee.toString() === req.user.id && t.status !== 'Completed' && t.deadline) {
          const d = new Date(t.deadline);
          // Check if overdue
          if (d < now) {
            const exists = await Notification.findOne({
              user: req.user.id,
              type: 'task_overdue',
              linkId: t._id.toString()
            });
            if (!exists) {
              await Notification.create({
                user: req.user.id,
                title: 'Task Overdue Alert',
                message: `"${t.description}" in "${m.title}" is overdue!`,
                type: 'task_overdue',
                linkType: 'task',
                linkId: t._id.toString(),
                read: false
              });
            }
          } else if (d <= inTwoDays) {
            // Approaching deadline
            const exists = await Notification.findOne({
              user: req.user.id,
              type: 'task_deadline',
              linkId: t._id.toString()
            });
            if (!exists) {
              await Notification.create({
                user: req.user.id,
                title: 'Upcoming Task Deadline',
                message: `"${t.description}" is due on ${d.toLocaleDateString()}`,
                type: 'task_deadline',
                linkType: 'task',
                linkId: t._id.toString(),
                read: false
              });
            }
          }
        }
      }
    }

    const notifs = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = await Notification.countDocuments({ user: req.user.id, read: false });

    res.json({ notifications: notifs, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read — mark single as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read-all — mark all as read
router.post('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
