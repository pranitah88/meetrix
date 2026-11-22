const mongoose = require('mongoose');

const taskHistorySchema = new mongoose.Schema({
  action:  { type: String, required: true },
  by:      { type: String, default: 'System' },
  at:      { type: Date, default: Date.now },
  details: { type: String, default: '' }
}, { _id: false });

const taskSchema = new mongoose.Schema({
  description:  { type: String, required: true, trim: true },
  assignee:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assigneeName: { type: String, default: '' },
  deadline:     { type: Date },
  status:       { type: String, enum: ['Open', 'In Progress', 'Completed'], default: 'Open' },
  priority:     { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  notes:        { type: String, default: '' },
  progress:     { type: Number, min: 0, max: 100, default: 0 },
  completedAt:  { type: Date, default: null },
  history:      [taskHistorySchema],
}, { timestamps: true });

const insightSchema = new mongoose.Schema({
  topic:      { type: String, required: true, trim: true },
  author:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, default: '' },
  text:       { type: String, required: true, trim: true },
}, { timestamps: true });

const commentReplySchema = new mongoose.Schema({
  author:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String, required: true },
  text:       { type: String, required: true },
  createdAt:  { type: Date, default: Date.now }
});

const commentSchema = new mongoose.Schema({
  author:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String, required: true },
  text:       { type: String, required: true },
  replies:    [commentReplySchema],
  createdAt:  { type: Date, default: Date.now }
});

const attendanceSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name:   { type: String, required: true },
  status: { type: String, enum: ['Present', 'Absent', 'Late'], default: 'Present' },
  notes:  { type: String, default: '' }
}, { _id: false });

const attachmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url:  { type: String, required: true },
  type: { type: String, default: 'link' },
  size: { type: String, default: '—' }
});

const activityHistorySchema = new mongoose.Schema({
  action:  { type: String, required: true },
  by:      { type: String, default: 'System' },
  at:      { type: Date, default: Date.now },
  details: { type: String, default: '' }
}, { _id: false });

const meetingSchema = new mongoose.Schema({
  title:         { type: String, required: true, trim: true },
  date:          { type: Date,   required: true },
  status:        { type: String, enum: ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'], default: 'Completed' },
  cancelReason:  { type: String, default: '' },
  type:          { type: String, enum: ['Team Standup', 'Project Planning', 'Sprint Review', 'Brainstorming', 'General Discussion'], default: 'General Discussion' },
  recurring:     { type: String, enum: ['None', 'Daily', 'Weekly', 'Monthly'], default: 'None' },
  pinned:        { type: Boolean, default: false },
  agenda:        { type: String, trim: true, default: '' },
  attendees:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  attendeeNames: [{ type: String }],
  attendance:    [attendanceSchema],
  decisions:     [{ type: String, trim: true }],
  tasks:         [taskSchema],
  insights:      [insightSchema],
  comments:      [commentSchema],
  attachments:   [attachmentSchema],
  notes:         { type: String, default: '' },
  aiSummary:     { type: String, default: null },
  aiAnalysis:    { type: mongoose.Schema.Types.Mixed, default: null },
  history:       [activityHistorySchema],
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

meetingSchema.index({ date: -1 });
meetingSchema.index({ status: 1 });
meetingSchema.index({ pinned: 1 });
meetingSchema.index({ 'tasks.assignee': 1, 'tasks.status': 1 });
meetingSchema.index({ 'tasks.priority': 1 });

module.exports = mongoose.model('Meeting', meetingSchema);
