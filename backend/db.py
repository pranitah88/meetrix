import sqlite3
import json
import secrets
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from config import DB_PATH
from auth_utils import hash_password

def new_id() -> str:
    """Generate a 24-character hexadecimal ObjectId compatible with MongoDB style."""
    return secrets.token_hex(12)

def iso_now() -> str:
    return datetime.utcnow().isoformat() + "Z"

def dt_past(days: int) -> str:
    return (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"

def dt_future(days: int) -> str:
    return (datetime.utcnow() + timedelta(days=days)).isoformat() + "Z"

class Database:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None
        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        if self._conn is None or self.db_path == ":memory:":
            conn = sqlite3.connect(self.db_path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            if self.db_path == ":memory:":
                self._conn = conn
            return conn
        return sqlite3.connect(self.db_path, check_same_thread=False)

    def init_db(self):
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                name TEXT,
                data TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS meetings (
                id TEXT PRIMARY KEY,
                title TEXT,
                status TEXT,
                date TEXT,
                data TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                recipient TEXT,
                type TEXT,
                read INTEGER DEFAULT 0,
                data TEXT
            )
        """)
        conn.commit()
        if self.db_path != ":memory:":
            conn.close()

    # ─────────────────────────────────────────────────────────────
    # User Operations
    # ─────────────────────────────────────────────────────────────

    def find_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("SELECT data FROM users WHERE LOWER(email) = LOWER(?)", (email.strip(),))
        row = cur.fetchone()
        if self.db_path != ":memory:":
            conn.close()
        return json.loads(row["data"]) if row else None

    def find_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("SELECT data FROM users WHERE id = ?", (user_id,))
        row = cur.fetchone()
        if self.db_path != ":memory:":
            conn.close()
        return json.loads(row["data"]) if row else None

    def find_user_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("SELECT data FROM users WHERE LOWER(name) = LOWER(?)", (name.strip(),))
        row = cur.fetchone()
        if self.db_path != ":memory:":
            conn.close()
        return json.loads(row["data"]) if row else None

    def get_all_users(self) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("SELECT data FROM users ORDER BY name ASC")
        rows = cur.fetchall()
        if self.db_path != ":memory:":
            conn.close()
        return [json.loads(r["data"]) for r in rows]

    def insert_user(self, user_doc: Dict[str, Any]) -> Dict[str, Any]:
        if "_id" not in user_doc:
            user_doc["_id"] = new_id()
        user_doc.setdefault("createdAt", iso_now())
        user_doc.setdefault("updatedAt", iso_now())

        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO users (id, email, name, data) VALUES (?, ?, ?, ?)",
            (user_doc["_id"], user_doc["email"].lower(), user_doc["name"], json.dumps(user_doc))
        )
        conn.commit()
        if self.db_path != ":memory:":
            conn.close()
        return user_doc

    # ─────────────────────────────────────────────────────────────
    # Meeting Operations
    # ─────────────────────────────────────────────────────────────

    def get_all_meetings(self) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("SELECT data FROM meetings ORDER BY date DESC")
        rows = cur.fetchall()
        if self.db_path != ":memory:":
            conn.close()
        return [json.loads(r["data"]) for r in rows]

    def find_meeting_by_id(self, meeting_id: str) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("SELECT data FROM meetings WHERE id = ?", (meeting_id,))
        row = cur.fetchone()
        if self.db_path != ":memory:":
            conn.close()
        return json.loads(row["data"]) if row else None

    def insert_meeting(self, meeting_doc: Dict[str, Any]) -> Dict[str, Any]:
        if "_id" not in meeting_doc:
            meeting_doc["_id"] = new_id()
        meeting_doc.setdefault("createdAt", iso_now())
        meeting_doc.setdefault("updatedAt", iso_now())

        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO meetings (id, title, status, date, data) VALUES (?, ?, ?, ?, ?)",
            (
                meeting_doc["_id"],
                meeting_doc.get("title", ""),
                meeting_doc.get("status", "Upcoming"),
                meeting_doc.get("date", iso_now()),
                json.dumps(meeting_doc)
            )
        )
        conn.commit()
        if self.db_path != ":memory:":
            conn.close()
        return meeting_doc

    def update_meeting(self, meeting_doc: Dict[str, Any]) -> Dict[str, Any]:
        meeting_doc["updatedAt"] = iso_now()
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE meetings SET title = ?, status = ?, date = ?, data = ? WHERE id = ?",
            (
                meeting_doc.get("title", ""),
                meeting_doc.get("status", "Upcoming"),
                meeting_doc.get("date", iso_now()),
                json.dumps(meeting_doc),
                meeting_doc["_id"]
            )
        )
        conn.commit()
        if self.db_path != ":memory:":
            conn.close()
        return meeting_doc

    def delete_meeting(self, meeting_id: str) -> bool:
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM meetings WHERE id = ?", (meeting_id,))
        deleted = cur.rowcount > 0
        conn.commit()
        if self.db_path != ":memory:":
            conn.close()
        return deleted

    # ─────────────────────────────────────────────────────────────
    # Notification Operations
    # ─────────────────────────────────────────────────────────────

    def get_notifications_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("SELECT data FROM notifications WHERE recipient = ? ORDER BY id DESC", (user_id,))
        rows = cur.fetchall()
        if self.db_path != ":memory:":
            conn.close()
        return [json.loads(r["data"]) for r in rows]

    def find_notification(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        # query can contain recipient, type, linkId
        notifs = self.get_notifications_for_user(query.get("recipient", ""))
        for n in notifs:
            match = True
            for k, v in query.items():
                if n.get(k) != v:
                    match = False
                    break
            if match:
                return n
        return None

    def insert_notification(self, notif_doc: Dict[str, Any]) -> Dict[str, Any]:
        if "_id" not in notif_doc:
            notif_doc["_id"] = new_id()
        notif_doc.setdefault("read", False)
        notif_doc.setdefault("createdAt", iso_now())

        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO notifications (id, recipient, type, read, data) VALUES (?, ?, ?, ?, ?)",
            (
                notif_doc["_id"],
                notif_doc["recipient"],
                notif_doc.get("type", "general"),
                1 if notif_doc["read"] else 0,
                json.dumps(notif_doc)
            )
        )
        conn.commit()
        if self.db_path != ":memory:":
            conn.close()
        return notif_doc

    def mark_notification_read(self, notif_id: str) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("SELECT data FROM notifications WHERE id = ?", (notif_id,))
        row = cur.fetchone()
        if not row:
            if self.db_path != ":memory:":
                conn.close()
            return None

        doc = json.loads(row["data"])
        doc["read"] = True
        cur.execute("UPDATE notifications SET read = 1, data = ? WHERE id = ?", (json.dumps(doc), notif_id))
        conn.commit()
        if self.db_path != ":memory:":
            conn.close()
        return doc

    def mark_all_notifications_read(self, user_id: str) -> int:
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, data FROM notifications WHERE recipient = ? AND read = 0", (user_id,))
        rows = cur.fetchall()
        count = 0
        for r in rows:
            doc = json.loads(r["data"])
            doc["read"] = True
            cur.execute("UPDATE notifications SET read = 1, data = ? WHERE id = ?", (json.dumps(doc), r["id"]))
            count += 1
        conn.commit()
        if self.db_path != ":memory:":
            conn.close()
        return count

    # ─────────────────────────────────────────────────────────────
    # Seeding Initial Data
    # ─────────────────────────────────────────────────────────────

    def clear_all_data(self):
        """Truncate all tables."""
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM users")
        cur.execute("DELETE FROM meetings")
        cur.execute("DELETE FROM notifications")
        conn.commit()
        if self.db_path != ":memory:":
            conn.close()

    def reset_and_seed(self):
        self.clear_all_data()
        self.seed_initial_data(force=True)

    def seed_initial_data(self, force: bool = False):
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as cnt FROM users")
        cnt = cur.fetchone()["cnt"]
        if self.db_path != ":memory:":
            conn.close()

        if cnt > 0 and not force:
            return  # Already seeded

        print("Seeding initial data into SQLite database...")
        password_hash = hash_password("password123")

        pranita_id = new_id()
        gargi_id = new_id()
        riya_id = new_id()
        arjun_id = new_id()
        siddharth_id = new_id()

        users = [
            {"_id": pranita_id, "name": "Pranita", "email": "pranita@meetrix.dev", "password": password_hash, "role": "Lead Architect", "department": "Engineering"},
            {"_id": gargi_id,   "name": "Gargi",   "email": "gargi@meetrix.dev",   "password": password_hash, "role": "Product Designer", "department": "Design"},
            {"_id": riya_id,    "name": "Riya",    "email": "riya@meetrix.dev",    "password": password_hash, "role": "QA Lead", "department": "Engineering"},
            {"_id": arjun_id,   "name": "Arjun",   "email": "arjun@meetrix.dev",   "password": password_hash, "role": "Technical Writer", "department": "Product"},
            {"_id": siddharth_id, "name": "Siddharth", "email": "siddharth@meetrix.dev", "password": password_hash, "role": "Database Engineer", "department": "Infrastructure"},
        ]

        for u in users:
            self.insert_user(u)

        # Initial Meetings
        m1 = {
            "_id": new_id(),
            "title": "Meetrix Hackathon Kickoff",
            "date": dt_past(5),
            "status": "Completed",
            "type": "Team Standup",
            "recurring": "Weekly",
            "pinned": True,
            "agenda": "Topic: Tech stack selection\nTopic: Role division\nTopic: Timeline & milestones",
            "attendees": [pranita_id, gargi_id, riya_id, arjun_id],
            "attendeeNames": ["Pranita", "Gargi", "Riya", "Arjun"],
            "attendance": [
                {"user": pranita_id, "name": "Pranita", "status": "Present"},
                {"user": gargi_id, "name": "Gargi", "status": "Present"},
                {"user": riya_id, "name": "Riya", "status": "Present"},
                {"user": arjun_id, "name": "Arjun", "status": "Late", "notes": "Joined 5 mins late"}
            ],
            "decisions": [
                "Pranita leads backend, Gargi handles UI, Riya does testing, Arjun manages docs.",
                "Tech stack: Node.js + Express + React + Python FastAPI.",
                "First demo checkpoint in 2 weeks."
            ],
            "tasks": [
                {"_id": new_id(), "description": "Set up project structure and API routes", "assignee": pranita_id, "assigneeName": "Pranita", "deadline": dt_past(1), "status": "Completed", "priority": "High", "progress": 100, "completedAt": dt_past(1), "notes": "Completed ahead of schedule.", "createdAt": dt_past(5), "updatedAt": dt_past(1)},
                {"_id": new_id(), "description": "Design wireframes for dashboard UI", "assignee": gargi_id, "assigneeName": "Gargi", "deadline": dt_future(2), "status": "In Progress", "priority": "Critical", "progress": 60, "notes": "Figma mockups in review.", "createdAt": dt_past(5), "updatedAt": dt_past(2)},
                {"_id": new_id(), "description": "Write test cases for login and task flows", "assignee": riya_id, "assigneeName": "Riya", "deadline": dt_past(2), "status": "Open", "priority": "High", "progress": 20, "notes": "Blocked on staging auth config.", "createdAt": dt_past(5), "updatedAt": dt_past(5)},
                {"_id": new_id(), "description": "Create project README and contribution guide", "assignee": arjun_id, "assigneeName": "Arjun", "deadline": dt_future(4), "status": "Open", "priority": "Medium", "progress": 10, "notes": "Drafting structure.", "createdAt": dt_past(5), "updatedAt": dt_past(5)}
            ],
            "insights": [
                {"_id": new_id(), "topic": "Tech stack selection", "author": pranita_id, "authorName": "Pranita", "text": "Python FastAPI is blazingly fast, modern, and provides self-documenting Swagger UI.", "createdAt": dt_past(5), "updatedAt": dt_past(5)},
                {"_id": new_id(), "topic": "Tech stack selection", "author": gargi_id, "authorName": "Gargi", "text": "React with clean styling is the fastest iteration loop. Component reuse will save hours once the design system is up.", "createdAt": dt_past(5), "updatedAt": dt_past(5)},
                {"_id": new_id(), "topic": "Tech stack selection", "author": riya_id, "authorName": "Riya", "text": "Automated audit test suites make testing predictable.", "createdAt": dt_past(5), "updatedAt": dt_past(5)},
                {"_id": new_id(), "topic": "Tech stack selection", "author": arjun_id, "authorName": "Arjun", "text": "Agreed on Python. Zero setup overhead and standard JSON endpoints fit our meeting data perfectly.", "createdAt": dt_past(5), "updatedAt": dt_past(5)},
                {"_id": new_id(), "topic": "Role division", "author": pranita_id, "authorName": "Pranita", "text": "I can handle API integration. Suggest 15-min standups daily so nobody gets blocked.", "createdAt": dt_past(5), "updatedAt": dt_past(5)},
                {"_id": new_id(), "topic": "Timeline & milestones", "author": riya_id, "authorName": "Riya", "text": "Two weeks is tight. Core flow in week 1, polish and testing in week 2.", "createdAt": dt_past(5), "updatedAt": dt_past(5)}
            ],
            "comments": [
                {
                    "_id": new_id(),
                    "author": gargi_id,
                    "authorName": "Gargi",
                    "text": "@Pranita I have uploaded the color tokens for dark mode and responsive breakpoints.",
                    "createdAt": dt_past(4),
                    "replies": [
                        {"author": pranita_id, "authorName": "Pranita", "text": "Looks great! Incorporating into the style theme.", "createdAt": dt_past(4)}
                    ]
                }
            ],
            "notes": "Everyone agreed on the 2-week checkpoint. Daily 15-min check-ins scheduled.",
            "history": [
                {"action": "Meeting scheduled", "by": "Pranita", "at": dt_past(5), "details": "Weekly kickoff initialized"}
            ],
            "createdBy": pranita_id,
            "createdAt": dt_past(5),
            "updatedAt": dt_past(5)
        }

        m2 = {
            "_id": new_id(),
            "title": "Database Design Review",
            "date": dt_past(3),
            "status": "Completed",
            "type": "Project Planning",
            "recurring": "None",
            "pinned": False,
            "agenda": "Topic: Database schema design\nTopic: Indexing strategy\nTopic: Submission deadline plan",
            "attendees": [pranita_id, gargi_id, siddharth_id],
            "attendeeNames": ["Pranita", "Gargi", "Siddharth"],
            "attendance": [
                {"user": pranita_id, "name": "Pranita", "status": "Present"},
                {"user": gargi_id, "name": "Gargi", "status": "Present"},
                {"user": siddharth_id, "name": "Siddharth", "status": "Present"}
            ],
            "decisions": [
                "Use embedded documents for tasks and insights inside Meeting schema.",
                "Compound indexing on meeting date and assignee fields.",
                "Schema documentation submitted by end of week."
            ],
            "tasks": [
                {"_id": new_id(), "description": "Finalize database schemas and push to repo", "assignee": pranita_id, "assigneeName": "Pranita", "deadline": dt_past(1), "status": "Completed", "priority": "Critical", "progress": 100, "completedAt": dt_past(1), "notes": "Pushed to main branch.", "createdAt": dt_past(3), "updatedAt": dt_past(1)},
                {"_id": new_id(), "description": "Document all collection schemas with field descriptions", "assignee": gargi_id, "assigneeName": "Gargi", "deadline": dt_future(1), "status": "In Progress", "priority": "Medium", "progress": 75, "notes": "ER diagram generated.", "createdAt": dt_past(3), "updatedAt": dt_past(1)},
                {"_id": new_id(), "description": "Submit schema design to faculty portal", "assignee": siddharth_id, "assigneeName": "Siddharth", "deadline": dt_past(3), "status": "Open", "priority": "High", "progress": 0, "notes": "Requires final review before submission.", "createdAt": dt_past(3), "updatedAt": dt_past(3)}
            ],
            "insights": [
                {"_id": new_id(), "topic": "Database schema design", "author": pranita_id, "authorName": "Pranita", "text": "Embedding tasks inside meetings is the right call for context.", "createdAt": dt_past(3), "updatedAt": dt_past(3)},
                {"_id": new_id(), "topic": "Indexing strategy", "author": siddharth_id, "authorName": "Siddharth", "text": "Index on date descending for meeting list. Compound index on assignee + status for task dashboard.", "createdAt": dt_past(3), "updatedAt": dt_past(3)}
            ],
            "comments": [
                {
                    "_id": new_id(),
                    "author": siddharth_id,
                    "authorName": "Siddharth",
                    "text": "@Pranita Compound indexes tested successfully with 10k mock documents.",
                    "createdAt": dt_past(2),
                    "replies": []
                }
            ],
            "notes": "Data model confirmed as solid and robust.",
            "history": [{"action": "Meeting completed", "by": "Pranita", "at": dt_past(3), "details": "Schema agreed upon"}],
            "createdBy": pranita_id,
            "createdAt": dt_past(3),
            "updatedAt": dt_past(3)
        }

        m3 = {
            "_id": new_id(),
            "title": "Frontend Architecture Planning",
            "date": dt_past(1),
            "status": "Completed",
            "type": "Sprint Review",
            "recurring": "None",
            "pinned": False,
            "agenda": "Topic: Component structure\nTopic: State management approach\nTopic: API integration layer",
            "attendees": [pranita_id, riya_id],
            "attendeeNames": ["Pranita", "Riya"],
            "attendance": [
                {"user": pranita_id, "name": "Pranita", "status": "Present"},
                {"user": riya_id, "name": "Riya", "status": "Present"}
            ],
            "decisions": [
                "Unified single-page interface with responsive drawer.",
                "Central state store with local storage sync."
            ],
            "tasks": [
                {"_id": new_id(), "description": "Build Kanban board component", "assignee": pranita_id, "assigneeName": "Pranita", "deadline": dt_past(1), "status": "Completed", "priority": "High", "progress": 100, "completedAt": dt_past(1), "notes": "Completed and responsive.", "createdAt": dt_past(1), "updatedAt": dt_past(1)}
            ],
            "insights": [],
            "comments": [],
            "notes": "UI and state architecture planned cleanly.",
            "history": [{"action": "Meeting scheduled", "by": "Pranita", "at": dt_past(1), "details": "Initial plan"}],
            "createdBy": pranita_id,
            "createdAt": dt_past(1),
            "updatedAt": dt_past(1)
        }

        m4 = {
            "_id": new_id(),
            "title": "Sprint 2 Planning & Review",
            "date": dt_future(2),
            "status": "Upcoming",
            "type": "Project Planning",
            "recurring": "Weekly",
            "pinned": False,
            "agenda": "Topic: Review Sprint 1 milestones\nTopic: Plan upcoming AI integrations",
            "attendees": [pranita_id, gargi_id, riya_id, arjun_id, siddharth_id],
            "attendeeNames": ["Pranita", "Gargi", "Riya", "Arjun", "Siddharth"],
            "attendance": [],
            "decisions": [],
            "tasks": [
                {"_id": new_id(), "description": "Prepare Sprint 2 demo slides", "assignee": arjun_id, "assigneeName": "Arjun", "deadline": dt_future(2), "status": "Open", "priority": "Medium", "progress": 0, "notes": "Drafting slides.", "createdAt": dt_past(1), "updatedAt": dt_past(1)}
            ],
            "insights": [],
            "comments": [],
            "notes": "Upcoming sprint planning session.",
            "history": [{"action": "Meeting scheduled", "by": "Pranita", "at": dt_past(1), "details": "Scheduled for future"}],
            "createdBy": pranita_id,
            "createdAt": dt_past(1),
            "updatedAt": dt_past(1)
        }

        self.insert_meeting(m1)
        self.insert_meeting(m2)
        self.insert_meeting(m3)
        self.insert_meeting(m4)

        print("Database seeded successfully with 5 users and 4 meetings.")

# Singleton instance
db = Database()
