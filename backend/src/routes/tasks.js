const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Meeting = require('../models/Meeting');
const Notification = require('../models/Notification');
const User = require('../models/User');

const isObjectId = (val) => mongoose.Types.ObjectId.isValid(val) && /^[0-9a-fA-F]{24}$/.test(String(val));
const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

// Helper to notify user without duplicates
async function notifyUser(userId, title, message, type = 'task_assigned', linkId = '') {
  try {
    if (!userId) return;
    const exists = await Notification.findOne({
      user: userId,
      type,
      linkId: String(linkId)
    });
    if (!exists) {
      await Notification.create({
        user: userId,
        title,
        message,
        type,
        linkType: 'task',
        linkId: String(linkId),
        read: false
      });
    }
  } catch (err) {
    console.error('Task notification error:', err.message);
  }
}

// GET /api/tasks — all tasks accessible to user with filters & sorting
router.get('/', auth, async (req, res) => {
  try {
    const { status, priority, mine, search, sortBy } = req.query;
    const meetings = await Meeting.find({})
      .populate('tasks.assignee', 'name email avatar role');

    let allTasks = [];
    meetings.forEach(m => {
      (m.tasks || []).forEach(t => {
        allTasks.push({
          ...t.toObject(),
          meetingId: m._id,
          meetingTitle: m.title,
          meetingDate: m.date
        });
      });
    });

    if (mine === 'true') {
      allTasks = allTasks.filter(t => t.assignee && (t.assignee._id ? t.assignee._id.toString() : t.assignee.toString()) === req.user.id);
    }
    if (status && status !== 'All') {
      allTasks = allTasks.filter(t => t.status === status);
    }
    if (priority && priority !== 'All') {
      allTasks = allTasks.filter(t => t.priority === priority);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      allTasks = allTasks.filter(t =>
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.assigneeName && t.assigneeName.toLowerCase().includes(q)) ||
        (t.meetingTitle && t.meetingTitle.toLowerCase().includes(q))
      );
    }

    // Sorting
    const priorityRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    if (sortBy === 'priority') {
      allTasks.sort((a, b) => (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0));
    } else if (sortBy === 'deadline') {
      allTasks.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
    } else {
      // Default: overdue first, then deadline
      const now = new Date();
      allTasks.sort((a, b) => {
        const aOver = a.status !== 'Completed' && a.deadline && new Date(a.deadline) < now;
        const bOver = b.status !== 'Completed' && b.deadline && new Date(b.deadline) < now;
        if (aOver && !bOver) return -1;
        if (!aOver && bOver) return 1;
        return (new Date(a.deadline || '9999-12-31')) - (new Date(b.deadline || '9999-12-31'));
      });
    }

    res.json(allTasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:meetingId — add task to meeting
router.post('/:meetingId', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.meetingId)) return res.status(400).json({ error: 'Invalid meeting ID' });
    const meeting = await Meeting.findById(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const { description, assignee, deadline, status, priority, notes, progress } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Task description is required' });
    }

    let finalAssigneeId = req.user.id;
    let finalAssigneeName = req.user.name || 'Team Member';

    if (assignee) {
      if (isObjectId(assignee)) {
        const user = await User.findById(assignee);
        if (user) {
          finalAssigneeId = user._id;
          finalAssigneeName = user.name;
        }
      } else {
        const user = await User.findOne({ name: new RegExp(`^${escapeRegex(assignee)}$`, 'i') });
        if (user) {
          finalAssigneeId = user._id;
          finalAssigneeName = user.name;
        } else {
          finalAssigneeName = assignee;
        }
      }
    }

    const newTask = {
      description: description.trim(),
      assignee: finalAssigneeId,
      assigneeName: finalAssigneeName,
      deadline: deadline ? new Date(deadline) : null,
      status: status || 'Open',
      priority: priority || 'Medium',
      notes: notes || '',
      progress: progress !== undefined ? Number(progress) : 0,
      completedAt: status === 'Completed' ? new Date() : null,
      history: [{
        action: 'Task created',
        by: req.user.name || 'User',
        at: new Date(),
        details: `Assigned to ${finalAssigneeName} with priority ${priority || 'Medium'}`
      }]
    };

    meeting.tasks.push(newTask);
    meeting.history.push({
      action: 'Task Added',
      by: req.user.name || 'User',
      at: new Date(),
      details: description.trim()
    });
    await meeting.save();

    const createdTask = meeting.tasks[meeting.tasks.length - 1];

    // Send notification if assigned to someone else
    if (finalAssigneeId && finalAssigneeId.toString() !== req.user.id.toString()) {
      await notifyUser(
        finalAssigneeId,
        'New Task Assigned',
        `You were assigned: "${description.trim()}" in "${meeting.title}"`,
        'task_assigned',
        createdTask._id.toString()
      );
    }

    res.status(201).json(createdTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:meetingId/:taskId — update task status / priority / fields
router.patch('/:meetingId/:taskId', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.meetingId) || !isObjectId(req.params.taskId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const meeting = await Meeting.findById(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const task = meeting.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const previousStatus = task.status;
    const previousAssignee = task.assignee ? task.assignee.toString() : '';

    if (req.body.status && req.body.status !== previousStatus) {
      task.status = req.body.status;
      if (req.body.status === 'Completed') {
        task.completedAt = new Date();
        task.progress = 100;
      } else if (previousStatus === 'Completed') {
        task.completedAt = null;
      }
      task.history.push({
        action: `Status changed to ${req.body.status}`,
        by: req.user.name || 'User',
        at: new Date(),
        details: `Updated from ${previousStatus}`
      });
    }

    if (req.body.assignee) {
      let newAssigneeId = null;
      let newAssigneeName = '';

      if (isObjectId(req.body.assignee)) {
        const u = await User.findById(req.body.assignee);
        if (u) {
          newAssigneeId = u._id;
          newAssigneeName = u.name;
        }
      } else {
        const u = await User.findOne({ name: new RegExp(`^${escapeRegex(req.body.assignee)}$`, 'i') });
        if (u) {
          newAssigneeId = u._id;
          newAssigneeName = u.name;
        } else {
          newAssigneeName = req.body.assignee;
        }
      }

      if (newAssigneeId && newAssigneeId.toString() !== previousAssignee) {
        task.assignee = newAssigneeId;
        task.assigneeName = newAssigneeName;
        task.history.push({
          action: 'Task Reassigned',
          by: req.user.name || 'User',
          at: new Date(),
          details: `Assigned to ${task.assigneeName}`
        });

        if (newAssigneeId.toString() !== req.user.id.toString()) {
          await notifyUser(
            newAssigneeId,
            'Task Reassigned To You',
            `You were assigned "${task.description}" in "${meeting.title}"`,
            'task_assigned',
            task._id.toString()
          );
        }
      }
    }

    if (req.body.priority) task.priority = req.body.priority;
    if (req.body.description) task.description = req.body.description.trim();
    if (req.body.deadline !== undefined) task.deadline = req.body.deadline ? new Date(req.body.deadline) : null;
    if (req.body.notes !== undefined) task.notes = req.body.notes;
    if (req.body.progress !== undefined) task.progress = Number(req.body.progress);

    await meeting.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:meetingId/:taskId
router.delete('/:meetingId/:taskId', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.meetingId) || !isObjectId(req.params.taskId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const meeting = await Meeting.findById(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const task = meeting.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const desc = task.description;
    meeting.tasks.pull({ _id: req.params.taskId });
    meeting.history.push({
      action: 'Task Deleted',
      by: req.user.name || 'User',
      at: new Date(),
      details: desc
    });
    await meeting.save();
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
