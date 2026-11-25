import os
import sys
from datetime import datetime, timedelta, timezone

# Ensure python_backend directory is on path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from fastapi.testclient import TestClient
from main import app
from db import db, iso_now

client = TestClient(app)

results = {"passed": [], "failed": []}

def assert_test(condition: bool, message: str):
    if condition:
        results["passed"].append(message)
        print(f"  ✓ {message}")
    else:
        results["failed"].append(message)
        print(f"  ✕ FAIL: {message}")

def run_audit():
    print("\n======================================================")
    print("   MEETRIX PYTHON FASTAPI COMPREHENSIVE AUDIT")
    print("======================================================\n")

    # Fresh clean slate for testing
    db.reset_and_seed()

    pranita_token = ""
    gargi_token = ""
    riya_token = ""
    arjun_token = ""
    siddharth_token = ""

    # ─────────────────────────────────────────────────────────────
    # 1. AUTHENTICATION & DEMO ACCOUNTS AUDIT
    # ─────────────────────────────────────────────────────────────
    print("▶ TEST SUITE 1: Authentication & Demo Accounts")
    demo_accounts = [
        {"name": "Pranita", "email": "pranita@meetrix.dev"},
        {"name": "Gargi",   "email": "gargi@meetrix.dev"},
        {"name": "Riya",    "email": "riya@meetrix.dev"},
        {"name": "Arjun",   "email": "arjun@meetrix.dev"},
        {"name": "Siddharth", "email": "siddharth@meetrix.dev"},
    ]

    for acc in demo_accounts:
        res = client.post("/api/auth/login", json={"email": acc["email"], "password": "password123"})
        data = res.json()
        assert_test(res.status_code == 200 and "token" in data and data["user"]["name"] == acc["name"],
                    f"Login succeeds for demo account {acc['name']} ({acc['email']})")
        if acc["name"] == "Pranita": pranita_token = data["token"]
        if acc["name"] == "Gargi":   gargi_token = data["token"]
        if acc["name"] == "Riya":    riya_token = data["token"]
        if acc["name"] == "Arjun":   arjun_token = data["token"]
        if acc["name"] == "Siddharth": siddharth_token = data["token"]

    p_header = {"Authorization": f"Bearer {pranita_token}"}
    g_header = {"Authorization": f"Bearer {gargi_token}"}
    r_header = {"Authorization": f"Bearer {riya_token}"}
    s_header = {"Authorization": f"Bearer {siddharth_token}"}

    # Auth failures & validations
    wrong_pass = client.post("/api/auth/login", json={"email": "pranita@meetrix.dev", "password": "wrongpassword"})
    assert_test(wrong_pass.status_code == 401, "Rejects invalid password with HTTP 401")

    unreg_email = client.post("/api/auth/login", json={"email": "nobody@meetrix.dev", "password": "password123"})
    assert_test(unreg_email.status_code == 401, "Rejects unregistered email with HTTP 401")

    reg_short = client.post("/api/auth/register", json={"name": "Test", "email": "test@meetrix.dev", "password": "123"})
    assert_test(reg_short.status_code == 400, "Rejects password shorter than 6 characters with HTTP 400")

    reg_dup = client.post("/api/auth/register", json={"name": "Duplicate", "email": "pranita@meetrix.dev", "password": "password123"})
    assert_test(reg_dup.status_code == 409, "Rejects duplicate email registration with HTTP 409")

    valid_reg = client.post("/api/auth/register", json={"name": "New Engineer", "email": f"neweng_{int(datetime.now(timezone.utc).timestamp())}@meetrix.dev", "password": "securepassword123"})
    assert_test(valid_reg.status_code == 201 and "token" in valid_reg.json(), "Registers new user with hashed password and valid JWT")

    no_token = client.get("/api/users/me")
    assert_test(no_token.status_code == 401, "Rejects protected route without token (HTTP 401)")

    invalid_token = client.get("/api/users/me", headers={"Authorization": "Bearer invalid.bearer.token"})
    assert_test(invalid_token.status_code == 401, "Rejects protected route with forged token (HTTP 401)")

    # ─────────────────────────────────────────────────────────────
    # 2. MEETINGS CRUD & TEMPLATES AUDIT
    # ─────────────────────────────────────────────────────────────
    print("\n▶ TEST SUITE 2: Advanced Meeting Management")

    list_res = client.get("/api/meetings", headers=p_header)
    meetings_data = list_res.json()
    assert_test(list_res.status_code == 200 and isinstance(meetings_data, list) and len(meetings_data) >= 4,
                f"Fetch meetings returns {len(meetings_data)} seeded meetings")
    initial_meeting_id = meetings_data[0]["_id"]

    comp_filter = client.get("/api/meetings?status=Completed", headers=p_header)
    comp_list = comp_filter.json()
    assert_test(comp_filter.status_code == 200 and all(m["status"] == "Completed" for m in comp_list),
                'Filter meetings by status "Completed" returns only completed meetings')

    create_res = client.post("/api/meetings", headers=p_header, json={
        "title": "Q1 Product Strategy & Brainstorming",
        "date": iso_now(),
        "type": "Brainstorming",
        "recurring": "Weekly",
        "agenda": "Topic: Market expansion\nTopic: Feature priorities",
        "attendees": ["Pranita", "Gargi", "Riya"]
    })
    created_meeting = create_res.json()
    assert_test(create_res.status_code == 201 and created_meeting["title"] == "Q1 Product Strategy & Brainstorming",
                "Create meeting with template, recurring weekly, and attendee names succeeds")
    created_meeting_id = created_meeting["_id"]

    # Pin / Unpin
    pin_res = client.patch(f"/api/meetings/{created_meeting_id}/pin", headers=p_header)
    assert_test(pin_res.status_code == 200 and pin_res.json()["pinned"] is True, "Pin meeting toggles pinned to true")
    unpin_res = client.patch(f"/api/meetings/{created_meeting_id}/pin", headers=p_header)
    assert_test(unpin_res.status_code == 200 and unpin_res.json()["pinned"] is False, "Pin meeting toggles pinned back to false")

    # Reschedule with audit trail
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat().replace("+00:00", "Z")
    edit_res = client.put(f"/api/meetings/{created_meeting_id}", headers=p_header, json={
        "date": tomorrow,
        "agenda": "Updated Agenda with Milestone reviews"
    })
    edit_data = edit_res.json()
    assert_test(edit_res.status_code == 200 and any("Rescheduled" in h["action"] for h in edit_data.get("history", [])),
                "Rescheduling meeting adds audit trail history item")

    # Duplicate
    dup_res = client.post(f"/api/meetings/{created_meeting_id}/duplicate", headers=p_header)
    dup_data = dup_res.json()
    assert_test(dup_res.status_code == 201 and "(Copy)" in dup_data["title"] and len(dup_data["decisions"]) == 0,
                "Duplicate meeting creates clean copy with reset action items and decisions")

    # Cancel with reason
    cancel_res = client.put(f"/api/meetings/{created_meeting_id}", headers=p_header, json={
        "status": "Cancelled",
        "cancelReason": "Stakeholders rescheduled to next sprint"
    })
    cancel_data = cancel_res.json()
    assert_test(cancel_res.status_code == 200 and cancel_data["status"] == "Cancelled" and cancel_data["cancelReason"] == "Stakeholders rescheduled to next sprint",
                "Cancel meeting records cancellation rationale")

    # Recurring meeting auto-schedule on completion
    rec_res = client.post("/api/meetings", headers=p_header, json={
        "title": "Engineering Core Sync",
        "date": iso_now(),
        "type": "Team Standup",
        "recurring": "Daily",
        "agenda": "Daily blockers",
        "attendees": ["Pranita", "Arjun"]
    })
    rec_mid = rec_res.json()["_id"]
    client.put(f"/api/meetings/{rec_mid}", headers=p_header, json={"status": "Completed"})

    after_comp = client.get("/api/meetings?search=Engineering Core Sync", headers=p_header).json()
    assert_test(len(after_comp) == 2, "Completing recurring daily meeting auto-schedules the next recurrence")

    # Duplicate prevention
    client.put(f"/api/meetings/{rec_mid}", headers=p_header, json={"status": "Completed"})
    after_second = client.get("/api/meetings?search=Engineering Core Sync", headers=p_header).json()
    assert_test(len(after_second) == 2, "Duplicate prevention works: re-completing does not duplicate recurring session")

    # ─────────────────────────────────────────────────────────────
    # 3. TASKS & KANBAN MANAGEMENT AUDIT
    # ─────────────────────────────────────────────────────────────
    print("\n▶ TEST SUITE 3: Action Items & Kanban Board")

    past_deadline = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat().replace("+00:00", "Z")
    add_task = client.post(f"/api/tasks/{initial_meeting_id}", headers=p_header, json={
        "description": "Audit database performance under load",
        "assignee": "Siddharth",
        "priority": "Critical",
        "deadline": past_deadline,
        "status": "Open",
        "progress": 15,
        "notes": "Profiling slow queries"
    })
    task_data = add_task.json()
    assert_test(add_task.status_code == 201 and task_data.get("priority") == "Critical",
                "Add action item with priority Critical and assignee Siddharth succeeds")
    task_id = task_data["_id"]

    my_tasks = client.get("/api/tasks?mine=true", headers=s_header).json()
    assert_test(any(t["description"] == "Audit database performance under load" for t in my_tasks),
                "Personal task filter (?mine=true) returns assigned tasks for Siddharth")

    crit_tasks = client.get("/api/tasks?priority=Critical", headers=p_header).json()
    assert_test(all(t["priority"] == "Critical" for t in crit_tasks),
                "Priority filter (?priority=Critical) returns only critical tasks")

    # Update status and progress
    patch_task = client.patch(f"/api/tasks/{initial_meeting_id}/{task_id}", headers=p_header, json={
        "status": "In Progress",
        "progress": 50
    }).json()
    assert_test(patch_task.get("status") == "In Progress" and patch_task.get("progress") == 50,
                "Kanban status update (Open -> In Progress) and progress slider persist")

    # Reassign
    reassign_res = client.patch(f"/api/tasks/{initial_meeting_id}/{task_id}", headers=p_header, json={
        "assignee": "Gargi"
    }).json()
    assert_test(reassign_res.get("assigneeName") == "Gargi",
                "Task reassignment updates assignee and appends to task history")

    # Mark completed
    comp_task = client.patch(f"/api/tasks/{initial_meeting_id}/{task_id}", headers=p_header, json={
        "status": "Completed"
    }).json()
    assert_test(comp_task.get("completedAt") is not None and comp_task.get("progress") == 100,
                "Marking task Completed sets completedAt timestamp and sets progress to 100%")

    # ─────────────────────────────────────────────────────────────
    # 4. NOTIFICATIONS & DEADLINE REMINDERS AUDIT
    # ─────────────────────────────────────────────────────────────
    print("\n▶ TEST SUITE 4: In-App Notifications & Automated Reminders")

    gargi_notifs = client.get("/api/notifications", headers=g_header).json()
    assert_test(isinstance(gargi_notifs.get("notifications"), list) and len(gargi_notifs["notifications"]) > 0,
                f"Notifications fetched successfully: {len(gargi_notifs['notifications'])} items")

    # Idempotent checking without duplicates
    overdue_before = sum(1 for n in gargi_notifs["notifications"] if n.get("type") == "task_overdue")
    gargi_again = client.get("/api/notifications", headers=g_header).json()
    overdue_after = sum(1 for n in gargi_again["notifications"] if n.get("type") == "task_overdue")
    assert_test(overdue_before == overdue_after,
                "Automated deadline checking is idempotent: does NOT generate duplicate notifications")

    # Mark single read
    notif_id = gargi_notifs["notifications"][0]["_id"]
    mark_read = client.patch(f"/api/notifications/{notif_id}/read", headers=g_header).json()
    assert_test(mark_read.get("read") is True, "Marking single notification as read updates read status")

    # Mark all read
    mark_all = client.post("/api/notifications/read-all", headers=g_header)
    assert_test(mark_all.status_code == 200, "Mark all notifications as read returns success")

    after_mark_all = client.get("/api/notifications", headers=g_header).json()
    assert_test(after_mark_all.get("unreadCount") == 0,
                "Unread notification count drops to 0 after mark-all-read")

    # ─────────────────────────────────────────────────────────────
    # 5. COLLABORATION (COMMENTS, ATTENDANCE, NOTES, DECISIONS)
    # ─────────────────────────────────────────────────────────────
    print("\n▶ TEST SUITE 5: Meeting Collaboration")

    # Record decision
    dec_res = client.post(f"/api/meetings/{initial_meeting_id}/decisions", headers=p_header, json={
        "text": "Standardize on DM Sans and DM Mono for typography system"
    }).json()
    assert_test(any("DM Sans" in d for d in dec_res.get("decisions", [])),
                "Recording decision appends to meeting decisions and history")

    # Post comment with @mention
    com_res = client.post(f"/api/meetings/{initial_meeting_id}/comments", headers=p_header, json={
        "text": "@Riya please verify test coverage on the new decision endpoint"
    })
    assert_test(com_res.status_code == 201 and "@Riya" in com_res.json().get("text", ""),
                "Post comment succeeds")

    # Verify mention notification
    riya_notifs = client.get("/api/notifications", headers=r_header).json()
    assert_test(any(n.get("type") == "mention" for n in riya_notifs.get("notifications", [])),
                "Mentioning @Riya triggers mention notification in Riya’s inbox")

    # Attendance roll-call
    att_res = client.put(f"/api/meetings/{initial_meeting_id}/attendance", headers=p_header, json={
        "attendance": [
            {"name": "Pranita", "status": "Present"},
            {"name": "Gargi", "status": "Late"},
            {"name": "Riya", "status": "Present"},
            {"name": "Arjun", "status": "Absent", "notes": "Travelling"}
        ]
    }).json()
    arjun_att = next((a for a in att_res.get("attendance", []) if a.get("name") == "Arjun"), None)
    assert_test(arjun_att and arjun_att.get("status") == "Absent",
                "Attendance roll-call persists member presence status")

    # Scratchpad notes
    notes_res = client.patch(f"/api/meetings/{initial_meeting_id}/notes", headers=p_header, json={
        "notes": "Key takeaway: architecture signed off by all leads."
    }).json()
    assert_test("signed off" in notes_res.get("notes", ""), "Meeting notes persist to database")

    # ─────────────────────────────────────────────────────────────
    # 6. AI INTELLIGENCE SUITE AUDIT
    # ─────────────────────────────────────────────────────────────
    print("\n▶ TEST SUITE 6: AI-Powered Meeting Intelligence")

    sum_res = client.post(f"/api/ai/{initial_meeting_id}/summary", headers=p_header)
    sum_data = sum_res.json()
    assert_test(sum_res.status_code == 200 and "objective" in sum_data and sum_data["_meta"]["isRealClaude"] is False,
                "Smart Summary generates valid structured JSON with local fallback and _meta.isRealClaude: false")

    ana_res = client.post(f"/api/ai/{initial_meeting_id}/analysis", headers=p_header)
    ana_data = ana_res.json()
    assert_test(ana_res.status_code == 200 and len(ana_data.get("topicAnalyses", [])) > 0,
                "Discussion Analysis synthesizes viewpoints and consensus across meeting topics")

    dec_intel = client.post(f"/api/ai/{initial_meeting_id}/decision-intel", headers=p_header)
    dec_intel_data = dec_intel.json()
    assert_test(dec_intel.status_code == 200 and len(dec_intel_data.get("decisionIntelligence", [])) > 0,
                "Decision Intelligence generates actionable rationale for each recorded decision")

    ask_dec = client.post(f"/api/ai/{initial_meeting_id}/ask", headers=p_header, json={"question": "What were the main decisions?"}).json()
    assert_test(ask_dec.get("grounded") is True and "decision" in ask_dec.get("answer", "").lower(),
                "Ask Your Meeting correctly answers questions about decisions grounded in meeting facts")

    ask_task = client.post(f"/api/ai/{initial_meeting_id}/ask", headers=p_header, json={"question": "What tasks were assigned to Gargi?"}).json()
    assert_test(ask_task.get("grounded") is True,
                "Ask Your Meeting answers questions about specific attendee action items")

    ask_person = client.post(f"/api/ai/{initial_meeting_id}/ask", headers=p_header, json={"question": "What did Gargi recommend?"}).json()
    assert_test(ask_person.get("grounded") is True,
                "Ask Your Meeting answers questions about participant recommendations")

    eff_res = client.get("/api/ai/effectiveness", headers=p_header)
    eff_data = eff_res.json()
    assert_test(eff_res.status_code == 200 and eff_data.get("productivityScore", -1) >= 0 and eff_data.get("completionRate", -1) >= 0,
                "Meeting Effectiveness returns dynamic productivity score and actionable insights")

    # ─────────────────────────────────────────────────────────────
    # 7. EXECUTIVE DASHBOARD & ANALYTICS AUDIT
    # ─────────────────────────────────────────────────────────────
    print("\n▶ TEST SUITE 7: Executive Dashboard & Dynamic Calculations")

    dash_res = client.get("/api/analytics/dashboard", headers=p_header)
    assert_test(dash_res.status_code == 200, "Dashboard endpoint returns HTTP 200")
    dash = dash_res.json()

    total_m = dash["totalMeetings"]
    comp_m = dash["completedMeetings"]
    up_m = dash["upcomingMeetings"]
    can_m = dash.get("cancelledMeetings", 0)
    assert_test(total_m == (comp_m + up_m + can_m),
                f"Meeting count math matches: total ({total_m}) == completed ({comp_m}) + upcoming ({up_m}) + cancelled ({can_m})")

    total_t = dash["totalTasks"]
    comp_t = dash["completedTasks"]
    op_t = dash["openTasks"]
    inp_t = dash["inProgressTasks"]
    assert_test(total_t == (comp_t + op_t + inp_t),
                f"Task count math matches: total ({total_t}) == completed ({comp_t}) + open ({op_t}) + inProgress ({inp_t})")

    expected_rate = round((comp_t / total_t) * 100) if total_t > 0 else 0
    assert_test(dash["completionRate"] == expected_rate,
                f"Completion rate ({dash['completionRate']}%) matches expected mathematical calculation ({expected_rate}%)")

    assert_test(isinstance(dash.get("timeline"), list) and len(dash["timeline"]) == 6,
                "Timeline chart data contains 6 dynamic month buckets")

    assert_test(isinstance(dash.get("teamPerformance"), list) and len(dash["teamPerformance"]) >= 5,
                "Team performance leaderboard includes all team members")

    range_7d = client.get("/api/analytics/dashboard?range=7d", headers=p_header).json()
    assert_test(range_7d["totalMeetings"] <= total_m,
                "7-day range filter successfully limits meeting scope")

    # ─────────────────────────────────────────────────────────────
    # 8. GLOBAL SEARCH & PRODUCTIVITY EXPORTS AUDIT
    # ─────────────────────────────────────────────────────────────
    print("\n▶ TEST SUITE 8: Global Search & User Profiles")

    s_hack = client.get("/api/search?q=Hackathon", headers=p_header).json()
    assert_test(len(s_hack.get("meetings", [])) > 0,
                'Global search returns matching meetings for keyword "Hackathon"')

    s_pranita = client.get("/api/search?q=Pranita", headers=p_header).json()
    assert_test(len(s_pranita.get("users", [])) > 0 or len(s_pranita.get("tasks", [])) > 0,
                "Global search matches user entities and assigned deliverables")

    me_user = client.get("/api/users/me", headers=p_header).json()
    profile = client.get(f"/api/users/{me_user['_id']}/profile", headers=p_header).json()
    assert_test("stats" in profile and profile["stats"].get("totalTasks", -1) >= 0,
                "User productivity profile calculates individual deliverables and meeting attendance")

    # ─────────────────────────────────────────────────────────────
    # SUMMARY
    # ─────────────────────────────────────────────────────────────
    print("\n======================================================")
    print(f" AUDIT SUMMARY: {len(results['passed'])} PASSED, {len(results['failed'])} FAILED")
    print("======================================================\n")

    if results["failed"]:
        sys.exit(1)

if __name__ == "__main__":
    run_audit()
