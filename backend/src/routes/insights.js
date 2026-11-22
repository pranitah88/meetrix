const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Meeting = require('../models/Meeting');
const User = require('../models/User');

const isObjectId = (val) => mongoose.Types.ObjectId.isValid(val) && /^[0-9a-fA-F]{24}$/.test(String(val));

// POST /api/insights/:meetingId — add/update insight
router.post('/:meetingId', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.meetingId)) return res.status(400).json({ error: 'Invalid meeting ID' });
    const { topic, text, author } = req.body;
    if (!topic || !topic.trim() || !text || !text.trim()) {
      return res.status(400).json({ error: 'Topic and text are required' });
    }

    const meeting = await Meeting.findById(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    let authorId = req.user.id;
    let authorName = req.user.name || 'Team Member';

    if (author) {
      if (isObjectId(author)) {
        const u = await User.findById(author);
        if (u) {
          authorId = u._id;
          authorName = u.name;
        }
      } else {
        const u = await User.findOne({ name: new RegExp(`^${author}$`, 'i') });
        if (u) {
          authorId = u._id;
          authorName = u.name;
        } else {
          authorName = author;
        }
      }
    }

    // Remove existing insight for same author+topic, then push new one
    meeting.insights = meeting.insights.filter(
      i => !(i.topic.toLowerCase() === topic.trim().toLowerCase() && i.author.toString() === authorId.toString())
    );

    meeting.insights.push({
      topic: topic.trim(),
      text: text.trim(),
      author: authorId,
      authorName
    });

    meeting.aiSummary = null; // Invalidate cached summary
    meeting.aiAnalysis = null;
    await meeting.save();

    res.status(201).json(meeting.insights[meeting.insights.length - 1]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/insights/:meetingId/:insightId
router.delete('/:meetingId/:insightId', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.meetingId) || !isObjectId(req.params.insightId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const meeting = await Meeting.findById(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const ins = meeting.insights.id(req.params.insightId);
    if (!ins) return res.status(404).json({ error: 'Insight not found' });

    meeting.insights.pull({ _id: req.params.insightId });
    meeting.aiSummary = null;
    meeting.aiAnalysis = null;
    await meeting.save();
    res.json({ message: 'Insight deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
