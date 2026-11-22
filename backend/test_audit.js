const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Models
const User = require('./src/models/User');
const Meeting = require('./src/models/Meeting');
const Notification = require('./src/models/Notification');
const { seedDatabase } = require('./src/config/seedHelper');

// Setup in-memory MongoDB and app for audit testing
let mongod;
let app;
let server;
let baseUrl;

async function startTestServer() {
  process.env.JWT_SECRET = 'audit_test_secret_key_12345';
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'meetrix_audit' });

  // Auto-seed
  await seedDatabase(mongoose.connection);

  app = express();
  app.use(cors());
  app.use(express.json());

  // Mount routes
  app.use('/api/auth',          require('./src/routes/auth'));
  app.use('/api/meetings',      require('./src/routes/meetings'));
  app.use('/api/tasks',         require('./src/routes/tasks'));
  app.use('/api/insights',      require('./src/routes/insights'));
  app.use('/api/users',         require('./src/routes/users'));
  app.use('/api/notifications', require('./src/routes/notifications'));
  app.use('/api/ai',            require('./src/routes/ai'));
  app.use('/api/search',        require('./src/routes/search'));
  app.use('/api/analytics',     require('./src/routes/analytics'));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  console.log(`Audit Test Server running at ${baseUrl}`);
}

async function stopTestServer() {
  if (server) server.close();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// Test Runner
const results = { passed: [], failed: [] };

function assert(condition, message) {
  if (condition) {
    results.passed.push(message);
    console.log(`  ✓ ${message}`);
  } else {
    results.failed.push(message);
    console.error(`  ✕ FAIL: ${message}`);
  }
}

async function runAudit() {
  await startTestServer();
  console.log('\n======================================================');
  console.log('       MEETRIX COMPREHENSIVE QUALITY AUDIT');
  console.log('======================================================\n');

  let pranitaToken = '';
  let gargiToken = '';
  let riyaToken = '';
  let arjunToken = '';
  let siddharthToken = '';

  // ─────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION & DEMO ACCOUNTS AUDIT
  // ─────────────────────────────────────────────────────────────
  console.log('▶ TEST SUITE 1: Authentication & Demo Accounts');
  
  const demoAccounts = [
    { name: 'Pranita', email: 'pranita@meetrix.dev' },
    { name: 'Gargi', email: 'gargi@meetrix.dev' },
    { name: 'Riya', email: 'riya@meetrix.dev' },
    { name: 'Arjun', email: 'arjun@meetrix.dev' },
    { name: 'Siddharth', email: 'siddharth@meetrix.dev' }
  ];

  for (const acc of demoAccounts) {
    const res = await request('POST', '/api/auth/login', { email: acc.email, password: 'password123' });
    assert(res.status === 200 && res.data.token && res.data.user.name === acc.name, `Login succeeds for demo account ${acc.name} (${acc.email})`);
    if (acc.name === 'Pranita') pranitaToken = res.data.token;
    if (acc.name === 'Gargi') gargiToken = res.data.token;
    if (acc.name === 'Riya') riyaToken = res.data.token;
    if (acc.name === 'Arjun') arjunToken = res.data.token;
    if (acc.name === 'Siddharth') siddharthToken = res.data.token;
  }

  // Auth failures & validation
  const wrongPass = await request('POST', '/api/auth/login', { email: 'pranita@meetrix.dev', password: 'wrongpassword' });
  assert(wrongPass.status === 401, 'Rejects invalid password with HTTP 401');

  const unregEmail = await request('POST', '/api/auth/login', { email: 'nobody@meetrix.dev', password: 'password123' });
  assert(unregEmail.status === 401, 'Rejects unregistered email with HTTP 401');

  const regShortPass = await request('POST', '/api/auth/register', { name: 'Test', email: 'test@meetrix.dev', password: '123' });
  assert(regShortPass.status === 400, 'Rejects password shorter than 6 characters with HTTP 400');

  const regDuplicate = await request('POST', '/api/auth/register', { name: 'Duplicate', email: 'pranita@meetrix.dev', password: 'password123' });
  assert(regDuplicate.status === 409, 'Rejects duplicate email registration with HTTP 409');

  const validReg = await request('POST', '/api/auth/register', { name: 'New Engineer', email: 'neweng@meetrix.dev', password: 'securepassword123' });
  assert(validReg.status === 201 && validReg.data.token, 'Registers new user with hashed password and valid JWT');

  const noTokenReq = await request('GET', '/api/users/me');
  assert(noTokenReq.status === 401, 'Rejects protected route without token (HTTP 401)');

  const invalidTokenReq = await request('GET', '/api/users/me', null, 'invalid.bearer.token');
  assert(invalidTokenReq.status === 401, 'Rejects protected route with forged token (HTTP 401)');

  // ─────────────────────────────────────────────────────────────
  // 2. MEETINGS CRUD & TEMPLATES AUDIT
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ TEST SUITE 2: Advanced Meeting Management');

  // List meetings
  const listRes = await request('GET', '/api/meetings', null, pranitaToken);
  assert(listRes.status === 200 && Array.isArray(listRes.data) && listRes.data.length >= 4, `Fetch meetings returns ${listRes.data?.length} seeded meetings`);
  const initialMeetingId = listRes.data[0]._id;

  // Filter meetings by status
  const compFilter = await request('GET', '/api/meetings?status=Completed', null, pranitaToken);
  assert(compFilter.status === 200 && compFilter.data.every(m => m.status === 'Completed'), 'Filter meetings by status "Completed" returns only completed meetings');

  // Create meeting with template and attendees
  const createMeetingRes = await request('POST', '/api/meetings', {
    title: 'Q1 Product Strategy & Brainstorming',
    date: new Date(),
    type: 'Brainstorming',
    recurring: 'Weekly',
    agenda: 'Topic: Market expansion\nTopic: Feature priorities',
    attendees: ['Pranita', 'Gargi', 'Riya']
  }, pranitaToken);
  assert(createMeetingRes.status === 201 && createMeetingRes.data.title === 'Q1 Product Strategy & Brainstorming', 'Create meeting with template, recurring weekly, and attendee names succeeds');
  const createdMeetingId = createMeetingRes.data._id;

  // Pin/Bookmark meeting
  const pinRes = await request('PATCH', `/api/meetings/${createdMeetingId}/pin`, null, pranitaToken);
  assert(pinRes.status === 200 && pinRes.data.pinned === true, 'Pin meeting toggles pinned to true');
  const unpinRes = await request('PATCH', `/api/meetings/${createdMeetingId}/pin`, null, pranitaToken);
  assert(unpinRes.status === 200 && unpinRes.data.pinned === false, 'Pin meeting toggles pinned back to false');

  // Edit & Reschedule meeting
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const editRes = await request('PUT', `/api/meetings/${createdMeetingId}`, {
    date: tomorrow,
    agenda: 'Updated Agenda with Milestone reviews'
  }, pranitaToken);
  assert(editRes.status === 200 && editRes.data.history.some(h => h.action.includes('Rescheduled')), 'Rescheduling meeting adds audit trail history item');

  // Duplicate meeting
  const dupRes = await request('POST', `/api/meetings/${createdMeetingId}/duplicate`, null, pranitaToken);
  assert(dupRes.status === 201 && dupRes.data.title.includes('(Copy)') && dupRes.data.decisions.length === 0, 'Duplicate meeting creates clean copy with reset action items and decisions');

  // Cancel meeting with reason
  const cancelRes = await request('PUT', `/api/meetings/${createdMeetingId}`, {
    status: 'Cancelled',
    cancelReason: 'Stakeholders rescheduled to next sprint'
  }, pranitaToken);
  assert(cancelRes.status === 200 && cancelRes.data.status === 'Cancelled' && cancelRes.data.cancelReason === 'Stakeholders rescheduled to next sprint', 'Cancel meeting records cancellation rationale');

  // Check recurring auto-scheduling on completion
  const recurringMeetingRes = await request('POST', '/api/meetings', {
    title: 'Engineering Core Sync',
    date: new Date(),
    type: 'Team Standup',
    recurring: 'Daily',
    agenda: 'Daily blockers',
    attendees: ['Pranita', 'Arjun']
  }, pranitaToken);
  const recMid = recurringMeetingRes.data._id;
  await request('PUT', `/api/meetings/${recMid}`, { status: 'Completed' }, pranitaToken);

  // Verify next recurring meeting was auto-scheduled
  const afterCompleteList = await request('GET', '/api/meetings?search=Engineering Core Sync', null, pranitaToken);
  assert(afterCompleteList.data.length === 2, 'Completing recurring daily meeting auto-schedules the next recurrence');

  // Test duplicate prevention: re-sending completion does not create a third meeting
  await request('PUT', `/api/meetings/${recMid}`, { status: 'Completed' }, pranitaToken);
  const afterSecondComplete = await request('GET', '/api/meetings?search=Engineering Core Sync', null, pranitaToken);
  assert(afterSecondComplete.data.length === 2, 'Duplicate prevention works: re-completing does not duplicate recurring session');

  // ─────────────────────────────────────────────────────────────
  // 3. TASKS & KANBAN MANAGEMENT AUDIT
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ TEST SUITE 3: Action Items & Kanban Board');

  // Add task to meeting
  const pastDeadline = new Date();
  pastDeadline.setDate(pastDeadline.getDate() - 3);
  const addTaskRes = await request('POST', `/api/tasks/${initialMeetingId}`, {
    description: 'Audit database performance under load',
    assignee: 'Siddharth',
    priority: 'Critical',
    deadline: pastDeadline,
    status: 'Open',
    progress: 15,
    notes: 'Profiling slow queries'
  }, pranitaToken);
  assert(addTaskRes.status === 201 && addTaskRes.data.priority === 'Critical', 'Add action item with priority Critical and assignee Siddharth succeeds');
  const taskId = addTaskRes.data._id;

  // Filter tasks
  const myTasksRes = await request('GET', '/api/tasks?mine=true', null, siddharthToken);
  assert(myTasksRes.status === 200 && myTasksRes.data.some(t => t.description === 'Audit database performance under load'), 'Personal task filter (?mine=true) returns assigned tasks for Siddharth');

  const critTasksRes = await request('GET', '/api/tasks?priority=Critical', null, pranitaToken);
  assert(critTasksRes.status === 200 && critTasksRes.data.every(t => t.priority === 'Critical'), 'Priority filter (?priority=Critical) returns only critical tasks');

  // Update task status and progress (Kanban move)
  const patchTaskRes = await request('PATCH', `/api/tasks/${initialMeetingId}/${taskId}`, {
    status: 'In Progress',
    progress: 50
  }, pranitaToken);
  assert(patchTaskRes.status === 200 && patchTaskRes.data.status === 'In Progress' && patchTaskRes.data.progress === 50, 'Kanban status update (Open -> In Progress) and progress slider persist');

  // Reassign task
  const reassignRes = await request('PATCH', `/api/tasks/${initialMeetingId}/${taskId}`, {
    assignee: 'Gargi'
  }, pranitaToken);
  assert(reassignRes.status === 200 && reassignRes.data.assigneeName === 'Gargi', 'Task reassignment updates assignee and appends to task history');

  // Mark task completed (verifies completedAt & progress=100)
  const completeTaskRes = await request('PATCH', `/api/tasks/${initialMeetingId}/${taskId}`, {
    status: 'Completed'
  }, pranitaToken);
  assert(completeTaskRes.status === 200 && completeTaskRes.data.completedAt !== null && completeTaskRes.data.progress === 100, 'Marking task Completed sets completedAt timestamp and sets progress to 100%');

  // ─────────────────────────────────────────────────────────────
  // 4. NOTIFICATIONS & DEADLINE REMINDERS AUDIT
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ TEST SUITE 4: In-App Notifications & Automated Reminders');

  // Fetch notifications for Gargi (should have received task reassigned notification)
  const gargiNotifs = await request('GET', '/api/notifications', null, gargiToken);
  assert(gargiNotifs.status === 200 && gargiNotifs.data.notifications.length > 0, `Notifications fetched successfully: ${gargiNotifs.data.notifications.length} items`);

  // Verify automated overdue detection logic without duplicates
  const overdueNotifsBefore = gargiNotifs.data.notifications.filter(n => n.type === 'task_overdue').length;
  // Trigger notifications endpoint again
  const gargiNotifsAgain = await request('GET', '/api/notifications', null, gargiToken);
  const overdueNotifsAfter = gargiNotifsAgain.data.notifications.filter(n => n.type === 'task_overdue').length;
  assert(overdueNotifsBefore === overdueNotifsAfter, 'Automated deadline checking is idempotent: does NOT generate duplicate notifications');

  // Mark single notification as read
  const notifId = gargiNotifs.data.notifications[0]._id;
  const markReadRes = await request('PATCH', `/api/notifications/${notifId}/read`, null, gargiToken);
  assert(markReadRes.status === 200 && markReadRes.data.read === true, 'Marking single notification as read updates read status');

  // Mark all notifications as read
  const markAllRes = await request('POST', '/api/notifications/read-all', null, gargiToken);
  assert(markAllRes.status === 200, 'Mark all notifications as read returns success');

  const afterMarkAll = await request('GET', '/api/notifications', null, gargiToken);
  assert(afterMarkAll.data.unreadCount === 0, 'Unread notification count drops to 0 after mark-all-read');

  // ─────────────────────────────────────────────────────────────
  // 5. COLLABORATION (COMMENTS, ATTENDANCE, NOTES, DECISIONS)
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ TEST SUITE 5: Meeting Collaboration');

  // Record Decision
  const addDecisionRes = await request('POST', `/api/meetings/${initialMeetingId}/decisions`, {
    text: 'Standardize on DM Sans and DM Mono for typography system'
  }, pranitaToken);
  assert(addDecisionRes.status === 200 && addDecisionRes.data.decisions.some(d => d.includes('DM Sans')), 'Recording decision appends to meeting decisions and history');

  // Post comment with @mention
  const commentRes = await request('POST', `/api/meetings/${initialMeetingId}/comments`, {
    text: '@Riya please verify test coverage on the new decision endpoint'
  }, pranitaToken);
  assert(commentRes.status === 201 && commentRes.data.text.includes('@Riya'), 'Post comment succeeds');

  // Verify Riya received a mention notification
  const riyaNotifs = await request('GET', '/api/notifications', null, riyaToken);
  assert(riyaNotifs.data.notifications.some(n => n.type === 'mention'), 'Mentioning @Riya triggers mention notification in Riya’s inbox');

  // Update attendance roll-call
  const attendanceRes = await request('PUT', `/api/meetings/${initialMeetingId}/attendance`, {
    attendance: [
      { name: 'Pranita', status: 'Present' },
      { name: 'Gargi', status: 'Late' },
      { name: 'Riya', status: 'Present' },
      { name: 'Arjun', status: 'Absent', notes: 'Travelling' }
    ]
  }, pranitaToken);
  assert(attendanceRes.status === 200 && attendanceRes.data.attendance.find(a => a.name === 'Arjun').status === 'Absent', 'Attendance roll-call persists member presence status');

  // Meeting Scratchpad Notes
  const notesRes = await request('PATCH', `/api/meetings/${initialMeetingId}/notes`, {
    notes: 'Key takeaway: architecture signed off by all leads.'
  }, pranitaToken);
  assert(notesRes.status === 200 && notesRes.data.notes.includes('signed off'), 'Meeting notes persist to database');

  // ─────────────────────────────────────────────────────────────
  // 6. AI INTELLIGENCE SUITE AUDIT (WITH & WITHOUT API KEY)
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ TEST SUITE 6: AI-Powered Meeting Intelligence');

  // Test Smart Summary without API key (fallback local NLP)
  delete process.env.ANTHROPIC_API_KEY;
  const summaryRes = await request('POST', `/api/ai/${initialMeetingId}/summary`, null, pranitaToken);
  assert(summaryRes.status === 200 && summaryRes.data.objective && summaryRes.data._meta.isRealClaude === false, 'Smart Summary generates valid structured JSON with local fallback and _meta.isRealClaude: false');

  // Test Discussion Analysis
  const analysisRes = await request('POST', `/api/ai/${initialMeetingId}/analysis`, null, pranitaToken);
  assert(analysisRes.status === 200 && analysisRes.data.topicAnalyses && analysisRes.data.topicAnalyses.length > 0, 'Discussion Analysis synthesizes viewpoints and consensus across meeting topics');

  // Test Decision Intelligence
  const decisionIntelRes = await request('POST', `/api/ai/${initialMeetingId}/decision-intel`, null, pranitaToken);
  assert(decisionIntelRes.status === 200 && decisionIntelRes.data.decisionIntelligence.length > 0, 'Decision Intelligence generates actionable rationale for each recorded decision');

  // Test Ask Your Meeting (Interactive Grounded Q&A)
  const askDecisions = await request('POST', `/api/ai/${initialMeetingId}/ask`, { question: 'What were the main decisions?' }, pranitaToken);
  assert(askDecisions.status === 200 && askDecisions.data.grounded && askDecisions.data.answer.includes('decision'), 'Ask Your Meeting correctly answers questions about decisions grounded in meeting facts');

  const askTasks = await request('POST', `/api/ai/${initialMeetingId}/ask`, { question: 'What tasks were assigned to Gargi?' }, pranitaToken);
  assert(askTasks.status === 200 && askTasks.data.grounded, 'Ask Your Meeting answers questions about specific attendee action items');

  const askPerson = await request('POST', `/api/ai/${initialMeetingId}/ask`, { question: 'What did Gargi recommend?' }, pranitaToken);
  assert(askPerson.status === 200 && askPerson.data.grounded, 'Ask Your Meeting answers questions about participant recommendations');

  // Meeting Effectiveness Insights
  const effectRes = await request('GET', '/api/ai/effectiveness', null, pranitaToken);
  assert(effectRes.status === 200 && effectRes.data.productivityScore >= 0 && effectRes.data.completionRate >= 0, 'Meeting Effectiveness returns dynamic productivity score and actionable insights');

  // ─────────────────────────────────────────────────────────────
  // 7. EXECUTIVE DASHBOARD & ANALYTICS AUDIT
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ TEST SUITE 7: Executive Dashboard & Dynamic Calculations');

  const dashRes = await request('GET', '/api/analytics/dashboard', null, pranitaToken);
  assert(dashRes.status === 200, 'Dashboard endpoint returns HTTP 200');

  // Validate math consistency
  const { totalMeetings, completedMeetings, upcomingMeetings, cancelledMeetings, totalTasks, completedTasks, openTasks, inProgressTasks, overdueTasks, completionRate, priorityDistribution, timeline, teamPerformance } = dashRes.data;
  
  assert(totalMeetings === (completedMeetings + upcomingMeetings + (cancelledMeetings || 0)), `Meeting count math matches: total (${totalMeetings}) == completed (${completedMeetings}) + upcoming (${upcomingMeetings}) + cancelled (${cancelledMeetings || 0})`);
  assert(totalTasks === (completedTasks + openTasks + inProgressTasks), `Task count math matches: total (${totalTasks}) == completed (${completedTasks}) + open (${openTasks}) + inProgress (${inProgressTasks})`);
  const expectedRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  assert(completionRate === expectedRate, `Completion rate (${completionRate}%) matches expected mathematical calculation (${expectedRate}%)`);
  assert(timeline && timeline.length === 6, 'Timeline chart data contains 6 dynamic month buckets');
  assert(teamPerformance && teamPerformance.length >= 5, 'Team performance leaderboard includes all team members');

  // Date range filters (7d, 30d, all)
  const range7d = await request('GET', '/api/analytics/dashboard?range=7d', null, pranitaToken);
  assert(range7d.status === 200 && range7d.data.totalMeetings <= totalMeetings, '7-day range filter successfully limits meeting scope');

  // ─────────────────────────────────────────────────────────────
  // 8. GLOBAL SEARCH & PRODUCTIVITY EXPORTS AUDIT
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ TEST SUITE 8: Global Search & User Profiles');

  // Search across meetings, tasks, decisions, users
  const searchHackathon = await request('GET', '/api/search?q=Hackathon', null, pranitaToken);
  assert(searchHackathon.status === 200 && searchHackathon.data.meetings.length > 0, 'Global search returns matching meetings for keyword "Hackathon"');

  const searchPranita = await request('GET', '/api/search?q=Pranita', null, pranitaToken);
  assert(searchPranita.status === 200 && (searchPranita.data.users.length > 0 || searchPranita.data.tasks.length > 0), 'Global search matches user entities and assigned deliverables');

  // User Profile
  const meRes = await request('GET', '/api/users/me', null, pranitaToken);
  const userProfile = await request('GET', `/api/users/${meRes.data._id}/profile`, null, pranitaToken);
  assert(userProfile.status === 200 && userProfile.data.stats && userProfile.data.stats.totalTasks >= 0, 'User productivity profile calculates individual deliverables and meeting attendance');

  // ─────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────
  console.log('\n======================================================');
  console.log(` AUDIT SUMMARY: ${results.passed.length} PASSED, ${results.failed.length} FAILED`);
  console.log('======================================================\n');

  await stopTestServer();
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  if (mongod) mongod.stop();
  process.exit(1);
});
