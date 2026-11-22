const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const past = (d) => { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt; };
const future = (d) => { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt; };
const oid = () => new mongoose.Types.ObjectId();

async function seedDatabase(connection) {
  const db = connection.db;
  const userCount = await db.collection('users').countDocuments();
  if (userCount > 0) {
    console.log(`Database already contains ${userCount} users, skipping auto-seed.`);
    return;
  }

  console.log('Seeding initial data into database...');

  const passwordHash = await bcrypt.hash('password123', 10);
  const usersResult = await db.collection('users').insertMany([
    { name: 'Pranita', email: 'pranita@meetrix.dev', password: passwordHash, avatar: '', role: 'Lead Architect', department: 'Engineering', createdAt: new Date(), updatedAt: new Date() },
    { name: 'Gargi',   email: 'gargi@meetrix.dev',   password: passwordHash, avatar: '', role: 'Product Designer', department: 'Design', createdAt: new Date(), updatedAt: new Date() },
    { name: 'Riya',    email: 'riya@meetrix.dev',     password: passwordHash, avatar: '', role: 'QA Lead', department: 'Engineering', createdAt: new Date(), updatedAt: new Date() },
    { name: 'Arjun',   email: 'arjun@meetrix.dev',    password: passwordHash, avatar: '', role: 'Technical Writer', department: 'Product', createdAt: new Date(), updatedAt: new Date() },
    { name: 'Siddharth', email: 'siddharth@meetrix.dev', password: passwordHash, avatar: '', role: 'Database Engineer', department: 'Infrastructure', createdAt: new Date(), updatedAt: new Date() },
  ]);

  const [pranita, gargi, riya, arjun, siddharth] = Object.values(usersResult.insertedIds);
  console.log('Users seeded:', Object.keys(usersResult.insertedIds).length);

  await db.collection('meetings').insertMany([
    {
      title: 'Meetrix Hackathon Kickoff',
      date: past(5),
      status: 'Completed',
      type: 'Team Standup',
      recurring: 'Weekly',
      pinned: true,
      agenda: 'Topic: Tech stack selection\nTopic: Role division\nTopic: Timeline & milestones',
      attendees: [pranita, gargi, riya, arjun],
      attendeeNames: ['Pranita', 'Gargi', 'Riya', 'Arjun'],
      attendance: [
        { user: pranita, name: 'Pranita', status: 'Present' },
        { user: gargi, name: 'Gargi', status: 'Present' },
        { user: riya, name: 'Riya', status: 'Present' },
        { user: arjun, name: 'Arjun', status: 'Late', notes: 'Joined 5 mins late' }
      ],
      decisions: [
        'Pranita leads backend, Gargi handles UI, Riya does testing, Arjun manages docs.',
        'Tech stack: Node.js + Express + MongoDB Atlas + React.',
        'First demo checkpoint in 2 weeks.',
      ],
      tasks: [
        { _id: oid(), description: 'Set up Express project structure and API routes', assignee: pranita, assigneeName: 'Pranita', deadline: past(1), status: 'Completed', priority: 'High', progress: 100, completedAt: past(1), notes: 'Completed ahead of schedule.', createdAt: past(5), updatedAt: past(1) },
        { _id: oid(), description: 'Design wireframes for dashboard UI', assignee: gargi, assigneeName: 'Gargi', deadline: future(2), status: 'In Progress', priority: 'Critical', progress: 60, notes: 'Figma mockups in review.', createdAt: past(5), updatedAt: past(2) },
        { _id: oid(), description: 'Write test cases for login and task flows', assignee: riya, assigneeName: 'Riya', deadline: past(2), status: 'Open', priority: 'High', progress: 20, notes: 'Blocked on staging auth config.', createdAt: past(5), updatedAt: past(5) },
        { _id: oid(), description: 'Create project README and contribution guide', assignee: arjun, assigneeName: 'Arjun', deadline: future(4), status: 'Open', priority: 'Medium', progress: 10, notes: 'Drafting structure.', createdAt: past(5), updatedAt: past(5) },
      ],
      insights: [
        { topic: 'Tech stack selection', author: pranita, authorName: 'Pranita', text: 'Node.js with Express is fast to set up and MongoDB gives us zero infra management needed for high agility.', createdAt: past(5), updatedAt: past(5) },
        { topic: 'Tech stack selection', author: gargi, authorName: 'Gargi', text: 'React with Vite is the fastest iteration loop. Component reuse will save hours once the design system is up.', createdAt: past(5), updatedAt: past(5) },
        { topic: 'Tech stack selection', author: riya, authorName: 'Riya', text: 'Mongoose schemas make testing predictable. We should define the Meeting and Task models early.', createdAt: past(5), updatedAt: past(5) },
        { topic: 'Tech stack selection', author: arjun, authorName: 'Arjun', text: 'Agreed on MongoDB. Document model fits our meeting data perfectly — nested tasks and insights inside a meeting document makes sense.', createdAt: past(5), updatedAt: past(5) },
        { topic: 'Role division', author: pranita, authorName: 'Pranita', text: 'I can handle Express + Mongoose integration. Suggest 15-min standups daily so nobody gets blocked.', createdAt: past(5), updatedAt: past(5) },
        { topic: 'Role division', author: gargi, authorName: 'Gargi', text: 'I will build the UI in parallel. We need to define the REST API contract first so I can mock endpoints.', createdAt: past(5), updatedAt: past(5) },
        { topic: 'Role division', author: arjun, authorName: 'Arjun', text: 'Documentation is always neglected in hackathons. I will write the README progressively as features land.', createdAt: past(5), updatedAt: past(5) },
        { topic: 'Timeline & milestones', author: riya, authorName: 'Riya', text: 'Two weeks is tight. Core flow in week 1, polish and testing in week 2.', createdAt: past(5), updatedAt: past(5) },
        { topic: 'Timeline & milestones', author: pranita, authorName: 'Pranita', text: 'Working demo at day 7 even if rough. Evaluators value a working product over a concept.', createdAt: past(5), updatedAt: past(5) },
      ],
      comments: [
        {
          author: gargi,
          authorName: 'Gargi',
          text: '@Pranita I have uploaded the color tokens for dark mode and responsive breakpoints.',
          createdAt: past(4),
          replies: [
            { author: pranita, authorName: 'Pranita', text: 'Looks great! Incorporating into the style theme.', createdAt: past(4) }
          ]
        }
      ],
      attachments: [
        { name: 'Architecture_Diagram_v1.pdf', url: '#', type: 'PDF', size: '1.2 MB' },
        { name: 'Figma_Specs_Link', url: 'https://figma.com', type: 'Link', size: '—' }
      ],
      notes: 'Everyone agreed on the 2-week checkpoint. Daily 15-min check-ins scheduled.',
      aiSummary: null,
      history: [
        { action: 'Meeting scheduled', by: 'Pranita', at: past(5), details: 'Weekly kickoff initialized' }
      ],
      createdBy: pranita,
      createdAt: past(5),
      updatedAt: past(5),
    },
    {
      title: 'Database Design Review',
      date: past(3),
      status: 'Completed',
      type: 'Project Planning',
      recurring: 'None',
      pinned: false,
      agenda: 'Topic: MongoDB schema design\nTopic: Indexing strategy\nTopic: Submission deadline plan',
      attendees: [pranita, gargi, siddharth],
      attendeeNames: ['Pranita', 'Gargi', 'Siddharth'],
      attendance: [
        { user: pranita, name: 'Pranita', status: 'Present' },
        { user: gargi, name: 'Gargi', status: 'Present' },
        { user: siddharth, name: 'Siddharth', status: 'Present' }
      ],
      decisions: [
        'Use embedded documents for tasks and insights inside Meeting schema.',
        'Add compound indexes on meeting date and assignee fields.',
        'Schema documentation submitted by end of week.',
      ],
      tasks: [
        { _id: oid(), description: 'Finalize Mongoose schemas and push to repo', assignee: pranita, assigneeName: 'Pranita', deadline: past(1), status: 'Completed', priority: 'Critical', progress: 100, completedAt: past(1), notes: 'Pushed to main branch.', createdAt: past(3), updatedAt: past(1) },
        { _id: oid(), description: 'Document all collection schemas with field descriptions', assignee: gargi, assigneeName: 'Gargi', deadline: future(1), status: 'In Progress', priority: 'Medium', progress: 75, notes: 'ER diagram generated.', createdAt: past(3), updatedAt: past(1) },
        { _id: oid(), description: 'Submit schema design to faculty portal', assignee: siddharth, assigneeName: 'Siddharth', deadline: past(3), status: 'Open', priority: 'High', progress: 0, notes: 'Requires final review before submission.', createdAt: past(3), updatedAt: past(3) },
      ],
      insights: [
        { topic: 'MongoDB schema design', author: pranita, authorName: 'Pranita', text: 'Embedding tasks inside meetings is the right call — we always query tasks in the context of a meeting. No need for a separate collection.', createdAt: past(3), updatedAt: past(3) },
        { topic: 'MongoDB schema design', author: gargi, authorName: 'Gargi', text: 'We should add a participants collection separately so user profiles can be reused across meetings without duplication.', createdAt: past(3), updatedAt: past(3) },
        { topic: 'Indexing strategy', author: siddharth, authorName: 'Siddharth', text: 'Index on createdAt descending for the meetings list. Compound index on assignee + status for the tasks dashboard query.', createdAt: past(3), updatedAt: past(3) },
      ],
      comments: [
        {
          author: siddharth,
          authorName: 'Siddharth',
          text: '@Pranita Compound indexes tested successfully with 10k mock documents — query times under 2ms.',
          createdAt: past(2),
          replies: []
        }
      ],
      attachments: [],
      notes: 'NoSQL document model was confirmed as superior to normalized relational for this data model.',
      aiSummary: null,
      history: [{ action: 'Meeting completed', by: 'Pranita', at: past(3), details: 'Schema agreed upon' }],
      createdBy: pranita,
      createdAt: past(3),
      updatedAt: past(3),
    },
    {
      title: 'Frontend Architecture Planning',
      date: past(1),
      status: 'Completed',
      type: 'Sprint Review',
      recurring: 'None',
      pinned: false,
      agenda: 'Topic: React component structure\nTopic: State management approach\nTopic: API integration layer',
      attendees: [pranita, riya],
      attendeeNames: ['Pranita', 'Riya'],
      attendance: [
        { user: pranita, name: 'Pranita', status: 'Present' },
        { user: riya, name: 'Riya', status: 'Present' }
      ],
      decisions: [
        'Use Zustand for state management — lightweight and no boilerplate.',
        'Axios with interceptors for all API calls.',
        'Feature-based folder structure in src/.',
      ],
      tasks: [
        { _id: oid(), description: 'Set up Zustand store with meeting and task slices', assignee: pranita, assigneeName: 'Pranita', deadline: future(3), status: 'In Progress', priority: 'High', progress: 50, notes: 'Base store initialized.', createdAt: past(1), updatedAt: past(1) },
        { _id: oid(), description: 'Build reusable MeetingCard and TaskTable components', assignee: riya, assigneeName: 'Riya', deadline: future(6), status: 'Open', priority: 'Medium', progress: 0, notes: 'Component contracts drafted.', createdAt: past(1), updatedAt: past(1) },
        { _id: oid(), description: 'Configure Axios instance with base URL and auth headers', assignee: pranita, assigneeName: 'Pranita', deadline: future(7), status: 'Open', priority: 'Low', progress: 0, notes: 'Pending staging domain.', createdAt: past(1), updatedAt: past(1) },
      ],
      insights: [
        { topic: 'React component structure', author: pranita, authorName: 'Pranita', text: 'Feature-based structure keeps meeting-related components, hooks, and API calls co-located. Much easier to navigate than type-based.', createdAt: past(1), updatedAt: past(1) },
        { topic: 'React component structure', author: riya, authorName: 'Riya', text: 'We need a shared components folder for things like Avatar, Badge, and Modal that are used across features.', createdAt: past(1), updatedAt: past(1) },
        { topic: 'State management approach', author: pranita, authorName: 'Pranita', text: 'Zustand beats Redux for this scale. We get a simple store with no provider setup and native TypeScript support.', createdAt: past(1), updatedAt: past(1) },
        { topic: 'API integration layer', author: riya, authorName: 'Riya', text: 'Axios interceptors can handle token refresh and error toasts globally. Much better than try-catch in every component.', createdAt: past(1), updatedAt: past(1) },
      ],
      comments: [],
      attachments: [],
      notes: 'Zustand selected unanimously over Redux Toolkit.',
      aiSummary: null,
      history: [{ action: 'Meeting completed', by: 'Pranita', at: past(1), details: 'Front-end state agreed' }],
      createdBy: pranita,
      createdAt: past(1),
      updatedAt: past(1),
    },
    {
      title: 'Sprint 2 Planning & UI Review',
      date: future(3),
      status: 'Upcoming',
      type: 'Sprint Review',
      recurring: 'Weekly',
      pinned: true,
      agenda: 'Topic: UI polish & Kanban board\nTopic: Notification workflows\nTopic: Performance profiling',
      attendees: [pranita, gargi, riya, arjun, siddharth],
      attendeeNames: ['Pranita', 'Gargi', 'Riya', 'Arjun', 'Siddharth'],
      attendance: [
        { user: pranita, name: 'Pranita', status: 'Present' },
        { user: gargi, name: 'Gargi', status: 'Present' },
        { user: riya, name: 'Riya', status: 'Present' },
        { user: arjun, name: 'Arjun', status: 'Present' },
        { user: siddharth, name: 'Siddharth', status: 'Present' }
      ],
      decisions: [
        'Release candidate RC1 ready before demo day.',
        'Kanban task board becomes default view for sprint execution.'
      ],
      tasks: [
        { _id: oid(), description: 'Review responsive layout on mobile viewports', assignee: gargi, assigneeName: 'Gargi', deadline: future(4), status: 'Open', priority: 'High', progress: 0, notes: '', createdAt: new Date(), updatedAt: new Date() },
        { _id: oid(), description: 'Smoke test notification triggers across browsers', assignee: riya, assigneeName: 'Riya', deadline: future(5), status: 'Open', priority: 'Critical', progress: 0, notes: '', createdAt: new Date(), updatedAt: new Date() }
      ],
      insights: [
        { topic: 'UI polish & Kanban board', author: gargi, authorName: 'Gargi', text: 'Smooth drag-and-drop or single-click status transitions will make daily standups 2x faster.', createdAt: new Date(), updatedAt: new Date() }
      ],
      comments: [],
      attachments: [],
      notes: 'Upcoming sprint sync — bring initial performance metrics.',
      aiSummary: null,
      history: [{ action: 'Meeting scheduled', by: 'Pranita', at: new Date(), details: 'Upcoming sprint planned' }],
      createdBy: pranita,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ]);

  // Seed sample notifications
  await db.collection('notifications').insertMany([
    {
      user: pranita,
      userName: 'Pranita',
      title: 'New Meeting Scheduled',
      message: 'Pranita scheduled "Sprint 2 Planning & UI Review"',
      type: 'meeting_scheduled',
      linkType: 'meeting',
      linkId: '',
      read: false,
      createdAt: new Date()
    },
    {
      user: gargi,
      userName: 'Gargi',
      title: 'New Task Assigned',
      message: 'You were assigned: "Review responsive layout on mobile viewports"',
      type: 'task_assigned',
      linkType: 'task',
      linkId: '',
      read: false,
      createdAt: new Date()
    },
    {
      user: riya,
      userName: 'Riya',
      title: 'Task Overdue Alert',
      message: '"Write test cases for login and task flows" is overdue!',
      type: 'task_overdue',
      linkType: 'task',
      linkId: '',
      read: false,
      createdAt: past(2)
    },
    {
      user: pranita,
      userName: 'Pranita',
      title: 'Discussion Mention',
      message: 'Gargi mentioned you in "Meetrix Hackathon Kickoff"',
      type: 'mention',
      linkType: 'meeting',
      linkId: '',
      read: false,
      createdAt: past(4)
    }
  ]);

  console.log('Seeded enriched meetings & initial notifications.');
  console.log('Default password for seeded users: password123');
}

module.exports = { seedDatabase };
