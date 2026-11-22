const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName:  { type: String, default: '' },
  title:     { type: String, required: true },
  message:   { type: String, required: true },
  type:      {
    type: String,
    enum: ['task_assigned', 'task_deadline', 'task_overdue', 'meeting_scheduled', 'meeting_rescheduled', 'meeting_cancelled', 'decision_logged', 'mention', 'general'],
    default: 'general'
  },
  linkType:  { type: String, enum: ['meeting', 'task'], default: 'meeting' },
  linkId:    { type: String, default: '' },
  read:      { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

