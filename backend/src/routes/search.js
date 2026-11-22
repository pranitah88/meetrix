const router = require('express').Router();
const auth = require('../middleware/auth');
const Meeting = require('../models/Meeting');
const User = require('../models/User');

const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

// GET /api/search?q=keyword
router.get('/', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json({ meetings: [], tasks: [], decisions: [], users: [] });
    }

    const regex = new RegExp(escapeRegex(q.trim()), 'i');

    const meetings = await Meeting.find({
      $or: [
        { title: regex },
        { agenda: regex },
        { 'insights.topic': regex },
        { 'insights.text': regex },
        { 'comments.text': regex }
      ]
    }).select('title date status type attendees').limit(10);

    const allMeetings = await Meeting.find({});
    const matchedTasks = [];
    const matchedDecisions = [];

    allMeetings.forEach(m => {
      (m.tasks || []).forEach(t => {
        if (regex.test(t.description) || (t.notes && regex.test(t.notes)) || regex.test(t.assigneeName)) {
          matchedTasks.push({
            ...t.toObject(),
            meetingId: m._id,
            meetingTitle: m.title
          });
        }
      });

      (m.decisions || []).forEach(d => {
        if (regex.test(d)) {
          matchedDecisions.push({
            text: d,
            meetingId: m._id,
            meetingTitle: m.title,
            meetingDate: m.date
          });
        }
      });
    });

    const users = await User.find({
      $or: [{ name: regex }, { email: regex }, { role: regex }]
    }).select('name email avatar role department').limit(5);

    res.json({
      meetings,
      tasks: matchedTasks.slice(0, 15),
      decisions: matchedDecisions.slice(0, 15),
      users
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

