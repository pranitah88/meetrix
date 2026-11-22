const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Meeting = require('../models/Meeting');

const isObjectId = (val) => mongoose.Types.ObjectId.isValid(val) && /^[0-9a-fA-F]{24}$/.test(String(val));

// GET /api/users/me — current user info
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users — list all team members
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find({}).select('name email avatar role department');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id/profile — detailed productivity profile
router.get('/:id/profile', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid user ID format' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = new Date();
    const meetings = await Meeting.find({ attendees: user._id });

    let assignedTasks = [];
    let completedCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;
    let decisionsContributed = 0;

    meetings.forEach(m => {
      (m.tasks || []).forEach(t => {
        if (t.assignee && t.assignee.toString() === user._id.toString()) {
          assignedTasks.push({
            ...t.toObject(),
            meetingId: m._id,
            meetingTitle: m.title
          });
          if (t.status === 'Completed') completedCount++;
          else {
            pendingCount++;
            if (t.deadline && new Date(t.deadline) < now) overdueCount++;
          }
        }
      });

      // Insights/decisions
      (m.insights || []).forEach(i => {
        if (i.author && i.author.toString() === user._id.toString()) {
          decisionsContributed++;
        }
      });
    });

    res.json({
      user,
      stats: {
        meetingsAttended: meetings.length,
        totalTasks: assignedTasks.length,
        completedTasks: completedCount,
        pendingTasks: pendingCount,
        overdueTasks: overdueCount,
        decisionsContributed,
        completionRate: assignedTasks.length ? Math.round((completedCount / assignedTasks.length) * 100) : 0
      },
      recentTasks: assignedTasks.slice(0, 10)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/me — update profile
router.patch('/me', auth, async (req, res) => {
  try {
    const allowed = ['name', 'avatar', 'role', 'department'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
