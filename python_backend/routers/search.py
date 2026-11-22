from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query
from db import db
from auth_utils import get_current_user_payload
from routers.auth import sanitize_user

router = APIRouter(prefix="/api/search", tags=["Global Search"])

@router.get("")
def global_search(
    q: Optional[str] = "",
    payload: Dict[str, Any] = Depends(get_current_user_payload)
):
    query = (q or "").strip().lower()
    if not query:
        return {"meetings": [], "tasks": [], "decisions": [], "users": []}

    all_meetings = db.get_all_meetings()
    all_users = db.get_all_users()

    matched_meetings = []
    matched_tasks = []
    matched_decisions = []

    for m in all_meetings:
        m_id = m.get("_id")
        title = m.get("title", "")
        agenda = m.get("agenda", "")

        # Match meeting title / agenda / attendees
        attendee_str = " ".join(m.get("attendeeNames", []))
        if query in title.lower() or query in agenda.lower() or query in attendee_str.lower():
            matched_meetings.append(m)

        # Match tasks
        for t in m.get("tasks", []):
            desc = t.get("description", "")
            notes = t.get("notes", "")
            assignee_name = t.get("assigneeName", "")
            if query in desc.lower() or query in notes.lower() or query in assignee_name.lower():
                t_copy = dict(t)
                t_copy["meetingId"] = m_id
                t_copy["meetingTitle"] = title
                matched_tasks.append(t_copy)

        # Match decisions
        for d in m.get("decisions", []):
            if query in str(d).lower():
                matched_decisions.append({
                    "text": d,
                    "meetingId": m_id,
                    "meetingTitle": title,
                    "meetingDate": m.get("date")
                })

    # Match users
    matched_users = []
    for u in all_users:
        name = u.get("name", "")
        email = u.get("email", "")
        role = u.get("role", "")
        dept = u.get("department", "")
        if (query in name.lower() or query in email.lower() or
            query in role.lower() or query in dept.lower()):
            matched_users.append(sanitize_user(u))

    return {
        "meetings": matched_meetings,
        "tasks": matched_tasks,
        "decisions": matched_decisions,
        "users": matched_users
    }
