# Meetrix — Meeting Intelligence & Team Productivity Platform

A production-grade, full-stack meeting intelligence platform designed to transform discussions into decisions, decisions into action items, and action items into measurable outcomes.

**Stack:**
- **Backend:** Python 3.13 · FastAPI · Pydantic · SQLite Document Engine · Uvicorn · Interactive Swagger `/docs`
- **Frontend:** Responsive Single-Page Application · 3-Column Kanban Board · Context-Grounded AI Q&A · Dynamic Executive Analytics
- **AI Intelligence:** Context-Grounded Local NLP Synthesis (Zero Setup / Zero Cost) + Optional Anthropic Claude 3.5 Sonnet Integration

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
│   │   └── index.html               ★ Main Meetrix single-page web app
│   ├── src/
│   │   ├── api.js                   API configuration
│   │   └── store/
│   │       ├── authStore.js         Authentication state
│   │       └── meetingStore.js      Meeting & notification state
│   └── package.json
│
├── backend/                         # ★ Python FastAPI Backend
│   ├── main.py                      FastAPI app & static frontend mount
│   ├── run.py                       One-click runner (port 5000)
│   ├── config.py                    Environment settings & configuration
│   ├── auth_utils.py                Pure-Python HS256 JWT & bcrypt security
│   ├── db.py                        SQLite document store & auto-seeder
│   ├── test_audit.py                Comprehensive 55-test automated audit suite
│   ├── requirements.txt             Python dependencies
│   └── routers/
│       ├── auth.py                  Login, register, me
│       ├── meetings.py              Meetings CRUD, recurring, cancel, duplicate, comments
│       ├── tasks.py                 Action items & Kanban management
│       ├── notifications.py         In-app notification center & deadline monitor
│       ├── ai.py                    Smart summary, analysis, decision intel & Q&A
│       ├── analytics.py             Executive dashboard & timeline analytics
│       ├── search.py                Global search
│       └── users.py                 User profiles & productivity stats
│
├── .gitignore
└── README.md
```

---

## Quickstart

### 1. Start Meetrix (1 Command)

```bash
cd meetrix/backend
python run.py
```

Open your browser to:
- 👉 **Web Application:** `http://localhost:5000`
- 👉 **Interactive Swagger API Docs:** `http://localhost:5000/docs`
- 👉 **ReDoc API Reference:** `http://localhost:5000/redoc`

*Both the frontend application and the Python FastAPI backend are served together on port 5000 with pre-seeded demo accounts and sample meetings.*

### 2. Run the Comprehensive Quality Audit (55/55 Tests Passing)

```bash
cd meetrix/backend
python test_audit.py
```

- **Web Application:** `http://localhost:5000`
- **Run Node.js Automated Audit (55/55 Tests):**
  ```bash
  npm run audit
  ```

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
* **Password Hashing**: Passwords are encrypted with standard `bcrypt` (10 salt rounds) before database storage.
* **Sensitive Data Scrubbing**: User serializers permanently strip `password` hashes from API response payloads.
* **Pure Python JWT**: Standard-compliant HS256 JWT tokens using cryptographic primitives (`hmac`, `hashlib`, `base64`) with configurable expiration.
* **Safe AI Integration**: Server-side Claude API requests keep API keys protected on the backend; keys are never transmitted to frontend clients.

---

## Database Architecture & Persistence

Meetrix uses a local, high-performance **SQLite Document Engine** (`backend/meetrix.db`):
* **Zero-Setup Out of the Box**: No external database daemon (like MongoDB or PostgreSQL) is required. Everything runs locally and immediately.
* **Automatic Seeding**: Seeds the 5 demo accounts and sample meetings on the very first startup.
* **Persistent Storage**: Changes (meetings created, Kanban moves, comments, attendance, notes) automatically persist across server restarts in `backend/meetrix.db`.
* **Clean Git Integration**: Database binary files (`*.db`) are ignored in `.gitignore`, keeping version control lightweight and secure.

---

## Presentation & Viva Reference Guide

When presenting Meetrix to evaluators or faculty, key design decisions to highlight include:

1. **Modern Python FastAPI Framework**:
   * Blazingly fast asynchronous execution with type validation powered by Pydantic.
   * Auto-generated interactive Swagger UI at `/docs` and ReDoc at `/redoc` for live endpoint testing during presentations.

2. **Dual-Mode AI Intelligence Architecture**:
   * If `ANTHROPIC_API_KEY` is present, Meetrix connects securely to Anthropic's Claude 3.5 Sonnet to synthesize discussion consensus and structured summaries.
   * If `ANTHROPIC_API_KEY` is absent, Meetrix automatically engages its deterministic local NLP synthesis engine. Evaluators get complete, structured meeting summaries, rationales, and context-grounded Q&A with zero external API costs or service dependencies. Every AI response includes a transparent `_meta` object stating the engine used.

3. **Idempotent Notification Reminders**:
   * Automated deadline detection runs on notification polling, checking for tasks due within 48 hours or overdue. Deduplication logic guarantees that reminders are never duplicated regardless of how many times a user refreshes or polls.

4. **Automated Verification Suite**:
   * The application includes a self-contained test suite with 55 automated assertions covering auth, meetings, tasks, notifications, AI synthesis, and analytics:
     ```bash
     cd backend
     python test_audit.py
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
