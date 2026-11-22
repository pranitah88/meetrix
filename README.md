# Meetrix — Meeting Intelligence & Team Productivity Platform

A production-grade, full-stack meeting intelligence platform designed to transform discussions into decisions, decisions into action items, and action items into measurable outcomes.

**Stack:** Vanilla JS / React Store · Node.js · Express · MongoDB (In-Memory + Atlas) · Anthropic Claude AI

---

## Features & Key Capabilities

### 1. Advanced Meeting Management
* **Meeting Templates:** Instant agenda scaffolding for *Team Standup*, *Project Planning*, *Sprint Review*, *Brainstorming*, and *General Discussion*.
* **Status Lifecycle:** Transition meetings across `Upcoming`, `Ongoing`, `Completed`, and `Cancelled` (with required cancellation rationale).
* **Recurring Cadence:** Schedule one-time or repeating syncs (`Daily`, `Weekly`, `Monthly`).
* **Meeting Operations:** 1-click meeting duplication, pin/bookmarking favorites, and rescheduling.
* **Audit Trail:** Chronological activity history tracking scheduling, modifications, cancellations, and additions.

### 2. Smart Action Item Management & Kanban Board
* **Deliverable Priorities:** Classify tasks as `Low`, `Medium`, `High`, or `Critical` with visual cues.
* **Progress Tracking:** Slider-based 0–100% completion metrics with inline progress bars.
* **Kanban Task Board:** Interactive 3-column workflow (`Open` → `In Progress` → `Completed`) with 1-click status transitions.
* **Personal Accountability:** Dedicated "My Tasks" view filtered to the active user, with visual overdue flags.
* **CSV Export:** Download all team deliverables as clean, formatted spreadsheets.

### 3. In-App Notifications & Deadlines
* **Live Notification Bell:** Unread counter with dropdown drawer for urgent alerts.
* **Automated Reminders:** Triggers alerts for approaching deadlines (within 48 hours) and overdue tasks.
* **Event Notifications:** Notifies team members of task assignments, reassignments, meeting schedule changes, and recorded decisions.

### 4. Meeting Collaboration
* **Threaded Discussions:** In-meeting comment threads with `@mention` highlights.
* **Roll Call Attendance:** Track member attendance (`Present`, `Late`, `Absent`) and measure individual session participation.
* **Shared Scratchpad:** Collaborative meeting notes with instant browser persistence.

### 5. AI Meeting Intelligence Suite
* **Smart Structured Summary:** Synthesizes objective, key discussion points, finalized decisions, notable disagreements, and recommended next steps.
* **Discussion Analysis:** Analyzes participant insights for consensus opinions and divergent views.
* **Decision Intelligence:** Formulates clear rationales explaining why specific decisions were made.
* **"Ask Your Meeting" Assistant:** Context-grounded Q&A assistant answering questions strictly from meeting records without hallucinations.
* **Zero Cost / Zero Setup:** Uses local intelligent NLP synthesis out of the box; securely connects to Claude API when `ANTHROPIC_API_KEY` is supplied.

### 6. Executive Analytics & Dashboard
* **Productivity Index:** Aggregated team score based on completion rate, decision density, and follow-through.
* **Interactive SVG Visualizations:** Velocity timeline over months and task priority breakdown.
* **Team Performance Leaderboard:** Workload distribution and delivery rate across team members.

---

## Project Structure

```
meetrix/
│
├── frontend/                        # Frontend client
│   ├── public/
│   │   └── index.html               ★ Main Meetrix application
│   ├── src/
│   │   ├── api.js                   Axios instance with JWT interceptors
│   │   └── store/
│   │       ├── authStore.js         Zustand authentication state
│   │       └── meetingStore.js      Zustand meeting & notification state
│   ├── .env.example
│   └── package.json
│
├── backend/                         # Node.js + Express REST API
│   ├── src/
│   │   ├── server.js                Express app entry point & static file server
│   │   ├── config/
│   │   │   ├── db.js                MongoDB connection (In-Memory fallback + Atlas)
│   │   │   └── seedHelper.js        Auto-seed logic for users & meetings
│   │   ├── middleware/
│   │   │   └── auth.js              JWT verification middleware
│   │   ├── models/
│   │   │   ├── Meeting.js           Meeting schema (embedded tasks, insights, comments)
│   │   │   ├── Notification.js      Notification schema
│   │   │   └── User.js              User schema with bcrypt password hashing
│   │   └── routes/
│   │       ├── auth.js              POST /api/auth/register | /login
│   │       ├── meetings.js          CRUD /api/meetings (reschedule, cancel, duplicate, comments)
│   │       ├── tasks.js             CRUD /api/tasks (priority, status, progress, history)
│   │       ├── insights.js          CRUD /api/insights
│   │       ├── notifications.js     GET /api/notifications | PATCH /read | POST /read-all
│   │       ├── ai.js                POST /api/ai/:id/(summary | analysis | decision-intel | ask)
│   │       ├── search.js            GET /api/search?q=query
│   │       ├── analytics.js         GET /api/analytics/dashboard
│   │       └── users.js             GET /api/users/me | GET /api/users/:id/profile
│   ├── .env.example
│   └── package.json
│
├── database/                        # Database migrations & seeds
│   └── seeds/
│       └── seed.js                  Manual seed script
│
├── .gitignore
└── README.md
```

---

## Quickstart

### Start the Application (1 Command)

```bash
cd meetrix/backend
npm start
```

Open your browser to:
👉 **`http://localhost:5000`**

*Both the Meetrix interface and the Express API run together with pre-loaded team profiles and meetings.*

---

## Demo Credentials & Security Policy

> [!NOTE]
> The seeded accounts and default credentials below are provided strictly for local development, hackathon judging, and academic viva demonstrations. Never use demo passwords in production environments.

All demo accounts use the default password **`password123`**:

| Name | Email | Role | Department | Default View |
| :--- | :--- | :--- | :--- | :--- |
| **Pranita** | `pranita@meetrix.dev` | Lead Architect | Engineering | Executive Overview |
| **Gargi** | `gargi@meetrix.dev` | Product Designer | Design | Kanban Board & UI |
| **Riya** | `riya@meetrix.dev` | QA Lead | Engineering | My Deliverables |
| **Arjun** | `arjun@meetrix.dev` | Technical Writer | Product | Meeting Documentation |
| **Siddharth** | `siddharth@meetrix.dev` | Database Engineer | Infrastructure | Schema & Index Metrics |

### Security Measures Implemented:
* **Password Hashing**: Passwords are encrypted with `bcryptjs` (10 salt rounds) before database storage.
* **Sensitive Data Scrubbing**: User schemas implement a custom `.toJSON()` method that permanently strips `password` fields from API responses.
* **Input Sanitization**: User-supplied search queries are sanitized against regex injection using `escapeRegex()`.
* **Safe AI Integration**: Server-side Claude API requests keep API keys protected on the backend; keys are never transmitted to frontend clients.

---

## Database Architecture & Persistence

Meetrix supports dual database modes:

### 1. In-Memory Mode (Zero-Setup Evaluation)
* If `MONGO_URI` in `backend/.env` is omitted or empty, Meetrix automatically downloads and spins up an isolated, embedded MongoDB instance using `mongodb-memory-server`.
* **Persistence Behavior**: All changes persist across client page refreshes because the frontend automatically syncs changes between the REST API and browser `localStorage`.
* **Limitation**: When the Node.js backend server process terminates, the temporary in-memory database is reset. On the next boot, initial demo meetings and users are re-seeded automatically.

### 2. Production Mode (MongoDB Atlas / Persistent Cluster)
* To persist data indefinitely across server restarts, supply a standard MongoDB connection string in `backend/.env`:
  ```env
  MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/meetrix?retryWrites=true&w=majority
  ```
* In production mode, all session notes, action items, attendance logs, and discussion threads are permanently committed to your cloud cluster.

---

## Presentation & Viva Reference Guide

When presenting Meetrix to evaluators or faculty, key design decisions to highlight include:

1. **Embedded vs. Referenced Document Schema**:
   * *Meeting Schema* embeds `tasks`, `insights`, `decisions`, and `attendance` directly inside the meeting document because these entities are always queried and mutated in the context of a meeting. This minimizes database roundtrips and optimizes read performance.
   * *User Schema* is maintained as an independent referenced collection so profiles, roles, and avatar metadata can be reused across meetings without duplication.

2. **Dual-Mode AI Intelligence Architecture**:
   * If `ANTHROPIC_API_KEY` is present, Meetrix connects securely to Anthropic's Claude 3.5 Sonnet to synthesize discussion consensus and structured summaries.
   * If `ANTHROPIC_API_KEY` is absent, Meetrix automatically engages its deterministic local NLP synthesis engine. Evaluators get complete, structured meeting summaries, rationales, and context-grounded Q&A with zero external API costs or service dependencies. Every AI response includes a transparent `_meta` object stating the engine used.

3. **Idempotent Notification Reminders**:
   * Automated deadline detection runs on notification polling, checking for tasks due within 48 hours or overdue. Unique compound indices and query deduplication guarantee that reminders are never duplicated regardless of how many times a user refreshes or polls.

4. **Automated Verification Suite**:
   * The application includes a self-contained test suite with 55 automated assertions covering auth, meetings, tasks, notifications, AI synthesis, and analytics:
     ```bash
     npm run audit
     ```

---

## REST API Specification

### Meetings (`/api/meetings`)
* `GET /api/meetings` — List meetings with filters (`status`, `type`, `pinned`, `search`)
* `GET /api/meetings/:id` — Full meeting detail
* `POST /api/meetings` — Schedule new meeting
* `PUT /api/meetings/:id` — Reschedule or update meeting
* `PATCH /api/meetings/:id/pin` — Toggle pin/bookmark
* `POST /api/meetings/:id/duplicate` — Clone meeting
* `POST /api/meetings/:id/decisions` — Record decision
* `PUT /api/meetings/:id/attendance` — Update attendance roll call
* `POST /api/meetings/:id/comments` — Post discussion comment with `@mention`

### Tasks (`/api/tasks`)
* `GET /api/tasks` — List all action items with sorting & filters
* `POST /api/tasks/:meetingId` — Add task with priority, assignee, deadline
* `PATCH /api/tasks/:meetingId/:taskId` — Update status, progress, or priority
* `DELETE /api/tasks/:meetingId/:taskId` — Remove task

### AI Intelligence (`/api/ai`)
* `POST /api/ai/:meetingId/summary` — Generate structured smart summary
* `POST /api/ai/:meetingId/analysis` — Discussion synthesis & consensus
* `POST /api/ai/:meetingId/decision-intel` — Explanatory decision intelligence
* `POST /api/ai/:meetingId/ask` — Context-grounded "Ask Your Meeting" assistant
* `GET /api/ai/effectiveness` — Team-wide productivity score & metrics

### Notifications (`/api/notifications`)
* `GET /api/notifications` — Fetch user notifications & unread count
* `PATCH /api/notifications/:id/read` — Mark notification as read
* `POST /api/notifications/read-all` — Mark all notifications as read

### Search & Analytics
* `GET /api/search?q=query` — Global search across meetings, tasks, decisions
* `GET /api/analytics/dashboard` — Aggregated dashboard statistics & chart metrics
