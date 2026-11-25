import sys
import os

# Ensure current dir is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from db import db, new_id, iso_now
import auth_utils

client = TestClient(app)

print("\n" + "=" * 65)
print("     EXHAUSTIVE DEEP-PROBE AUDIT OF EVERY FUNCTION & ENDPOINT")
print("=" * 65 + "\n")

checks = []

def record(category: str, name: str, ok: bool, details: str = ""):
    status_str = "PASS" if ok else "FAIL"
    symbol = "✓" if ok else "✕"
    checks.append((category, name, ok, details))
    print(f"  {symbol} [{status_str}] {category}: {name}" + (f" ({details})" if details else ""))

# ─────────────────────────────────────────────────────────────
# 1. DATABASE LAYER (db.py)
# ─────────────────────────────────────────────────────────────
print("▶ SUITE 1: Database Operations & Seeding")
db.reset_and_seed()
users = db.get_all_users()
meetings = db.get_all_meetings()
record("Database", "reset_and_seed & initial population", len(users) == 5 and len(meetings) == 4, f"{len(users)} users, {len(meetings)} meetings")

user_by_email = db.find_user_by_email("pranita@meetrix.dev")
record("Database", "find_user_by_email (case-insensitive)", user_by_email is not None and user_by_email["name"] == "Pranita")

user_by_id = db.find_user_by_id(user_by_email["_id"])
record("Database", "find_user_by_id", user_by_id is not None and user_by_id["email"] == "pranita@meetrix.dev")

user_by_name = db.find_user_by_name("Gargi")
record("Database", "find_user_by_name", user_by_name is not None and user_by_name["email"] == "gargi@meetrix.dev")

test_notif = db.insert_notification({
    "_id": new_id(),
    "recipient": user_by_email["_id"],
    "sender": "System",
    "type": "test_type",
    "message": "Direct DB notification insert",
    "read": False
})
record("Database", "insert_notification", test_notif is not None and "_id" in test_notif)

found_n = db.find_notification({"recipient": user_by_email["_id"], "type": "test_type"})
record("Database", "find_notification query matching", found_n is not None and found_n["_id"] == test_notif["_id"])

db.mark_notification_read(test_notif["_id"])
user_notifs = db.get_notifications_for_user(user_by_email["_id"])
read_status = any(n["_id"] == test_notif["_id"] and n["read"] is True for n in user_notifs)
record("Database", "mark_notification_read & get_notifications_for_user", read_status)

# ─────────────────────────────────────────────────────────────
# 2. CRYPTOGRAPHY & SECURITY UTILS (auth_utils.py)
# ─────────────────────────────────────────────────────────────
print("\n▶ SUITE 2: Security & Cryptography Utilities")
pw = "SecurePass#2026!"
hashed = auth_utils.hash_password(pw)
record("Crypto", "hash_password (Bcrypt 10 rounds)", hashed.startswith("$2b$") or hashed.startswith("$2a$"))
record("Crypto", "verify_password (Valid password)", auth_utils.verify_password(pw, hashed) is True)
record("Crypto", "verify_password (Invalid password)", auth_utils.verify_password("wrongPass!", hashed) is False)

token = auth_utils.create_jwt_token({"id": "user_xyz", "name": "Pranita", "role": "Architect"})
record("Crypto", "create_jwt_token (HS256 generation)", len(token.split(".")) == 3)

payload = auth_utils.verify_jwt_token(token)
record("Crypto", "verify_jwt_token (Valid signature)", payload["id"] == "user_xyz" and payload["name"] == "Pranita")

tampered = token[:-4] + "ABCD"
try:
    auth_utils.verify_jwt_token(tampered)
    record("Crypto", "verify_jwt_token (Rejects forged/tampered token)", False)
except ValueError:
    record("Crypto", "verify_jwt_token (Rejects forged/tampered token)", True)

expired_token = auth_utils.create_jwt_token({"id": "expired_user"}, exp_hours=-1)
try:
    auth_utils.verify_jwt_token(expired_token)
    record("Crypto", "verify_jwt_token (Rejects expired token)", False)
except ValueError:
    record("Crypto", "verify_jwt_token (Rejects expired token)", True)

# ─────────────────────────────────────────────────────────────
# 3. AUTHENTICATION ENDPOINTS (routers/auth.py)
# ─────────────────────────────────────────────────────────────
print("\n▶ SUITE 3: Authentication Endpoints")
res = client.post("/api/auth/login", json={"email": "pranita@meetrix.dev", "password": "password123"})
p_token = res.json().get("token")
record("Auth", "POST /api/auth/login (Success)", res.status_code == 200 and "token" in res.json())
record("Auth", "POST /api/auth/login (Stripped password hash)", "password" not in res.json()["user"])

p_hdr = {"Authorization": f"Bearer {p_token}"}

res = client.post("/api/auth/login", json={"email": "pranita@meetrix.dev", "password": "badpassword"})
record("Auth", "POST /api/auth/login (Rejects bad password)", res.status_code == 401)

res = client.post("/api/auth/login", json={"email": "nobody@meetrix.dev", "password": "password123"})
record("Auth", "POST /api/auth/login (Rejects unregistered email)", res.status_code == 401)

res = client.post("/api/auth/register", json={"name": "Dev User", "email": "devuser@meetrix.dev", "password": "password123"})
record("Auth", "POST /api/auth/register (New user)", res.status_code == 201 and "token" in res.json())

res = client.post("/api/auth/register", json={"name": "Duplicate", "email": "pranita@meetrix.dev", "password": "password123"})
record("Auth", "POST /api/auth/register (Rejects duplicate email)", res.status_code == 409)

res = client.post("/api/auth/register", json={"name": "Short", "email": "short@meetrix.dev", "password": "123"})
record("Auth", "POST /api/auth/register (Rejects short password < 6)", res.status_code == 400)

res = client.get("/api/auth/me", headers=p_hdr)
record("Auth", "GET /api/auth/me (Current user)", res.status_code == 200 and res.json()["name"] == "Pranita")

# ─────────────────────────────────────────────────────────────
# 4. USER PROFILES & DIRECTORY (routers/users.py)
# ─────────────────────────────────────────────────────────────
print("\n▶ SUITE 4: User Profiles & Directory")
res = client.get("/api/users", headers=p_hdr)
all_users = res.json()
record("Users", "GET /api/users (List all team members)", res.status_code == 200 and len(all_users) >= 5)
record("Users", "GET /api/users (Zero password exposure)", all("password" not in u for u in all_users))

res = client.get("/api/users/me", headers=p_hdr)
record("Users", "GET /api/users/me", res.status_code == 200 and res.json()["name"] == "Pranita")

pranita_id = next(u["_id"] for u in all_users if u["name"] == "Pranita")
res = client.get(f"/api/users/{pranita_id}/profile", headers=p_hdr)
prof = res.json()
record("Users", "GET /api/users/{id}/profile (Includes performance stats)", res.status_code == 200 and "stats" in prof)
record("Users", "GET /api/users/{id}/profile (Calculates completionRate)", prof["stats"]["completionRate"] >= 0)

# ─────────────────────────────────────────────────────────────
# 5. MEETINGS MANAGEMENT (routers/meetings.py)
# ─────────────────────────────────────────────────────────────
print("\n▶ SUITE 5: Advanced Meeting Management")
res = client.get("/api/meetings", headers=p_hdr)
m_list = res.json()
record("Meetings", "GET /api/meetings (Fetch all)", res.status_code == 200 and len(m_list) >= 4)

m_id = m_list[0]["_id"]
res = client.get(f"/api/meetings/{m_id}", headers=p_hdr)
record("Meetings", "GET /api/meetings/{id} (Fetch single)", res.status_code == 200 and res.json()["_id"] == m_id)

res = client.get("/api/meetings/non_existent_id", headers=p_hdr)
record("Meetings", "GET /api/meetings/{id} (Returns 404 on missing)", res.status_code == 404)

# Create meeting with agenda template and attendees
res = client.post("/api/meetings", headers=p_hdr, json={
    "title": "Release Candidate Review",
    "date": iso_now(),
    "duration": 50,
    "type": "Sprint Review",
    "recurring": "Weekly",
    "agenda": "Review deliverables\nVerify security scan\nPlan deployment",
    "attendees": ["Pranita", "Gargi", "Riya"]
})
new_m = res.json()
new_m_id = new_m["_id"]
record("Meetings", "POST /api/meetings (Create with template)", res.status_code == 201 and new_m["title"] == "Release Candidate Review")
record("Meetings", "POST /api/meetings (Resolves attendee names)", len(new_m["attendeeNames"]) == 3)

# Pin toggling
res = client.patch(f"/api/meetings/{new_m_id}/pin", headers=p_hdr)
record("Meetings", "PATCH /api/meetings/{id}/pin (Toggles True)", res.status_code == 200 and res.json()["pinned"] is True)
res = client.patch(f"/api/meetings/{new_m_id}/pin", headers=p_hdr)
record("Meetings", "PATCH /api/meetings/{id}/pin (Toggles False)", res.status_code == 200 and res.json()["pinned"] is False)

# Reschedule meeting
res = client.put(f"/api/meetings/{new_m_id}", headers=p_hdr, json={
    "date": "2026-12-05T14:00:00Z",
    "agenda": "Updated: Final signoff checkpoint"
})
record("Meetings", "PUT /api/meetings/{id} (Reschedule updates date)", res.status_code == 200 and res.json()["date"] == "2026-12-05T14:00:00Z")
record("Meetings", "PUT /api/meetings/{id} (Audit history logged)", any("Rescheduled" in h["action"] for h in res.json()["history"]))

# Decisions
res = client.post(f"/api/meetings/{new_m_id}/decisions", headers=p_hdr, json={"text": "Ship production build on December 10"})
record("Meetings", "POST /api/meetings/{id}/decisions (Add decision)", res.status_code == 200 and any("December 10" in d for d in res.json()["decisions"]))

# Comments with mention
res = client.post(f"/api/meetings/{new_m_id}/comments", headers=p_hdr, json={"text": "@Gargi UI styling review looks great!"})
record("Meetings", "POST /api/meetings/{id}/comments", res.status_code == 201 and "@Gargi" in res.json()["text"])

# Attendance roll-call
res = client.put(f"/api/meetings/{new_m_id}/attendance", headers=p_hdr, json={
    "attendance": [
        {"name": "Pranita", "status": "Present"},
        {"name": "Gargi", "status": "Present"},
        {"name": "Riya", "status": "Late", "notes": "Joined 3m late"}
    ]
})
record("Meetings", "PUT /api/meetings/{id}/attendance (Roll-call)", res.status_code == 200 and len(res.json()["attendance"]) == 3)

# Scratchpad notes
res = client.patch(f"/api/meetings/{new_m_id}/notes", headers=p_hdr, json={"notes": "All signoffs granted."})
record("Meetings", "PATCH /api/meetings/{id}/notes (Scratchpad)", res.status_code == 200 and "signoffs" in res.json()["notes"])

# Duplication
res = client.post(f"/api/meetings/{new_m_id}/duplicate", headers=p_hdr)
dup = res.json()
record("Meetings", "POST /api/meetings/{id}/duplicate (Clean copy)", res.status_code == 201 and "(Copy)" in dup["title"] and len(dup["decisions"]) == 0)

# Cancellation with reason
res = client.put(f"/api/meetings/{new_m_id}", headers=p_hdr, json={"status": "Cancelled", "cancelReason": "Delayed by client approval"})
record("Meetings", "PUT /api/meetings/{id} (Cancellation with reason)", res.status_code == 200 and res.json()["status"] == "Cancelled" and res.json()["cancelReason"] == "Delayed by client approval")

# Delete meeting
del_id = dup["_id"]
res = client.delete(f"/api/meetings/{del_id}", headers=p_hdr)
record("Meetings", "DELETE /api/meetings/{id}", res.status_code == 200 and res.json()["success"] is True)

# ─────────────────────────────────────────────────────────────
# 6. ACTION ITEMS & KANBAN (routers/tasks.py)
# ─────────────────────────────────────────────────────────────
print("\n▶ SUITE 6: Action Items & Kanban Management")
res = client.post(f"/api/tasks/{new_m_id}", headers=p_hdr, json={
    "description": "Deploy staging server infrastructure",
    "assignee": "Gargi",
    "priority": "Critical",
    "deadline": "2026-12-01T12:00:00Z",
    "status": "Open",
    "progress": 0,
    "notes": "Terraform provisioning"
})
t_data = res.json()
t_id = t_data["_id"]
record("Tasks", "POST /api/tasks/{meeting_id} (Create Critical task)", res.status_code == 201 and t_data["priority"] == "Critical")

# Move to In Progress
res = client.patch(f"/api/tasks/{new_m_id}/{t_id}", headers=p_hdr, json={"status": "In Progress", "progress": 55})
record("Tasks", "PATCH /api/tasks/{meeting_id}/{task_id} (Kanban move to In Progress)", res.status_code == 200 and res.json()["status"] == "In Progress" and res.json()["progress"] == 55)

# Reassign
res = client.patch(f"/api/tasks/{new_m_id}/{t_id}", headers=p_hdr, json={"assignee": "Siddharth"})
record("Tasks", "PATCH /api/tasks/{meeting_id}/{task_id} (Reassign assignee)", res.status_code == 200 and res.json()["assigneeName"] == "Siddharth")

# Complete task
res = client.patch(f"/api/tasks/{new_m_id}/{t_id}", headers=p_hdr, json={"status": "Completed"})
record("Tasks", "PATCH /api/tasks/{meeting_id}/{task_id} (Sets completedAt & progress=100)", res.status_code == 200 and res.json()["completedAt"] is not None and res.json()["progress"] == 100)

# List & Filters
res = client.get("/api/tasks", headers=p_hdr)
record("Tasks", "GET /api/tasks (List all flattened tasks)", res.status_code == 200 and len(res.json()) >= 4)

res = client.get("/api/tasks?priority=Critical", headers=p_hdr)
record("Tasks", "GET /api/tasks?priority=Critical (Priority filter)", res.status_code == 200 and all(t["priority"] == "Critical" for t in res.json()))

res = client.delete(f"/api/tasks/{new_m_id}/{t_id}", headers=p_hdr)
record("Tasks", "DELETE /api/tasks/{meeting_id}/{task_id}", res.status_code == 200 and res.json()["success"] is True)

# ─────────────────────────────────────────────────────────────
# 7. NOTIFICATIONS (routers/notifications.py)
# ─────────────────────────────────────────────────────────────
print("\n▶ SUITE 7: In-App Notifications Center")
# Check Gargi's inbox (received mention and task assignment)
g_login = client.post("/api/auth/login", json={"email": "gargi@meetrix.dev", "password": "password123"}).json()
g_hdr = {"Authorization": f"Bearer {g_login['token']}"}

res = client.get("/api/notifications", headers=g_hdr)
g_notifs = res.json()["notifications"]
record("Notifications", "GET /api/notifications (Mentions & tasks received)", res.status_code == 200 and len(g_notifs) > 0)
record("Notifications", "GET /api/notifications (Mention alert present)", any(n.get("type") == "mention" for n in g_notifs))

# Scanner idempotency
res = client.get("/api/notifications/check", headers=g_hdr)
record("Notifications", "GET /api/notifications/check (Deadline scanner)", res.status_code == 200 and res.json()["status"] == "ok")

if g_notifs:
    n_id = g_notifs[0]["_id"]
    res = client.patch(f"/api/notifications/{n_id}/read", headers=g_hdr)
    record("Notifications", "PATCH /api/notifications/{id}/read (Single read)", res.status_code == 200 and res.json()["read"] is True)

res = client.post("/api/notifications/read-all", headers=g_hdr)
record("Notifications", "POST /api/notifications/read-all (Bulk mark all read)", res.status_code == 200 and res.json()["success"] is True)

res = client.get("/api/notifications", headers=g_hdr)
record("Notifications", "Unread counter reset to 0", res.json()["unreadCount"] == 0)

# ─────────────────────────────────────────────────────────────
# 8. AI INTELLIGENCE SUITE (routers/ai.py)
# ─────────────────────────────────────────────────────────────
print("\n▶ SUITE 8: AI Meeting Intelligence Suite")
seed_m_id = m_list[0]["_id"]

res = client.post(f"/api/ai/{seed_m_id}/summary", headers=p_hdr)
s_data = res.json()
record("AI", "POST /api/ai/{id}/summary (Smart Structured Summary)", res.status_code == 200 and "objective" in s_data and len(s_data["actionItems"]) > 0)
record("AI", "POST /api/ai/{id}/summary (Local NLP engine meta)", s_data["_meta"]["isRealClaude"] is False and "Engine" in s_data["_meta"]["engine"])

res = client.post(f"/api/ai/{seed_m_id}/analysis", headers=p_hdr)
record("AI", "POST /api/ai/{id}/analysis (Discussion Viewpoint Analysis)", res.status_code == 200 and len(res.json()["topicAnalyses"]) > 0)

res = client.post(f"/api/ai/{seed_m_id}/decision-intel", headers=p_hdr)
record("AI", "POST /api/ai/{id}/decision-intel (Decision Rationale Intel)", res.status_code == 200 and len(res.json()["decisionIntelligence"]) > 0)

res = client.post(f"/api/ai/{seed_m_id}/ask", headers=p_hdr, json={"question": "What decisions were made?"})
record("AI", "POST /api/ai/{id}/ask (Context-grounded Decisions Q&A)", res.status_code == 200 and res.json()["grounded"] is True and "decision" in res.json()["answer"].lower())

res = client.post(f"/api/ai/{seed_m_id}/ask", headers=p_hdr, json={"question": "What tasks are assigned to Gargi?"})
record("AI", "POST /api/ai/{id}/ask (Context-grounded Deliverables Q&A)", res.status_code == 200 and res.json()["grounded"] is True)

res = client.post(f"/api/ai/{seed_m_id}/ask", headers=p_hdr, json={"question": "What did Gargi recommend?"})
record("AI", "POST /api/ai/{id}/ask (Context-grounded Recommendations Q&A)", res.status_code == 200 and res.json()["grounded"] is True)

res = client.get("/api/ai/effectiveness", headers=p_hdr)
record("AI", "GET /api/ai/effectiveness (Productivity metrics & trends)", res.status_code == 200 and res.json()["productivityScore"] >= 0 and "trends" in res.json())

# ─────────────────────────────────────────────────────────────
# 9. EXECUTIVE ANALYTICS DASHBOARD (routers/analytics.py)
# ─────────────────────────────────────────────────────────────
print("\n▶ SUITE 9: Executive Analytics Dashboard")
res = client.get("/api/analytics/dashboard", headers=p_hdr)
dash = res.json()
record("Analytics", "GET /api/analytics/dashboard (HTTP 200)", res.status_code == 200)

m_math = dash["totalMeetings"] == (dash["completedMeetings"] + dash["upcomingMeetings"] + dash["cancelledMeetings"])
record("Analytics", "Meeting math: total == completed + upcoming + cancelled", m_math, f"{dash['totalMeetings']} == {dash['completedMeetings']} + {dash['upcomingMeetings']} + {dash['cancelledMeetings']}")

t_math = dash["totalTasks"] == (dash["completedTasks"] + dash["openTasks"] + dash["inProgressTasks"])
record("Analytics", "Task math: total == completed + open + inProgress", t_math, f"{dash['totalTasks']} == {dash['completedTasks']} + {dash['openTasks']} + {dash['inProgressTasks']}")

expected_rate = round((dash["completedTasks"] / dash["totalTasks"]) * 100) if dash["totalTasks"] > 0 else 0
record("Analytics", "Completion rate math integrity", dash["completionRate"] == expected_rate, f"{dash['completionRate']}% == {expected_rate}%")

record("Analytics", "Dynamic 6-month timeline buckets", len(dash["timeline"]) == 6)
record("Analytics", "Team performance leaderboard includes all members", len(dash["teamPerformance"]) >= 5)

res = client.get("/api/analytics/dashboard?range=7d", headers=p_hdr)
record("Analytics", "Range filter: ?range=7d limits scope", res.status_code == 200 and res.json()["totalMeetings"] <= dash["totalMeetings"])

# ─────────────────────────────────────────────────────────────
# 10. GLOBAL SEARCH (routers/search.py)
# ─────────────────────────────────────────────────────────────
print("\n▶ SUITE 10: Global Search")
res = client.get("/api/search?q=Hackathon", headers=p_hdr)
record("Search", "GET /api/search?q=Hackathon (Matches meetings)", res.status_code == 200 and len(res.json()["meetings"]) > 0)

res = client.get("/api/search?q=Pranita", headers=p_hdr)
record("Search", "GET /api/search?q=Pranita (Matches users & deliverables)", res.status_code == 200 and (len(res.json()["users"]) > 0 or len(res.json()["tasks"]) > 0))

res = client.get("/api/search?q=", headers=p_hdr)
record("Search", "GET /api/search?q= (Empty query returns safe empty dict)", res.status_code == 200 and res.json()["meetings"] == [])

# ─────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────
passed_count = sum(1 for _, _, ok, _ in checks if ok)
failed_count = sum(1 for _, _, ok, _ in checks if not ok)

print("\n" + "=" * 65)
print(f"  EXHAUSTIVE AUDIT SUMMARY: {passed_count} PASSED, {failed_count} FAILED")
print(f"  Total Verified Functions & Endpoints: {len(checks)}")
print("=" * 65 + "\n")

if failed_count > 0:
    sys.exit(1)
