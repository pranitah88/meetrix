from fastapi import APIRouter, HTTPException, status, Depends
from typing import Dict, Any, List
from db import db
from auth_utils import get_current_user_payload
from routers.auth import sanitize_user

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.get("", response_model=List[Dict[str, Any]])
def list_users(payload: Dict[str, Any] = Depends(get_current_user_payload)):
    users = db.get_all_users()
    return [sanitize_user(u) for u in users]

@router.get("/me")
def get_current_profile(payload: Dict[str, Any] = Depends(get_current_user_payload)):
    user = db.find_user_by_id(payload.get("id"))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return sanitize_user(user)

@router.get("/{user_id}/profile")
def get_user_profile(user_id: str, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    user = db.find_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    clean_user = sanitize_user(user)
    meetings = db.get_all_meetings()

    assigned_tasks = []
    completed_tasks = []
    attended_count = 0

    for m in meetings:
        # Check attendance
        user_name = clean_user["name"]
        user_id = clean_user["_id"]
        attendees = m.get("attendees", [])
        attendee_names = m.get("attendeeNames", [])
        if user_id in attendees or user_name in attendee_names:
            attended_count += 1

        for t in m.get("tasks", []):
            if t.get("assignee") == user_id or t.get("assigneeName") == user_name:
                t_copy = dict(t)
                t_copy["meetingTitle"] = m.get("title", "")
                t_copy["meetingId"] = m.get("_id", "")
                assigned_tasks.append(t_copy)
                if t.get("status") == "Completed":
                    completed_tasks.append(t_copy)

    total_tasks = len(assigned_tasks)
    completed_count = len(completed_tasks)
    pending_count = total_tasks - completed_count
    rate = round((completed_count / total_tasks * 100)) if total_tasks > 0 else 0

    clean_user["stats"] = {
        "totalTasks": total_tasks,
        "completedTasks": completed_count,
        "pendingTasks": pending_count,
        "completionRate": rate,
        "meetingsAttended": attended_count,
        "productivityScore": min(100, max(0, rate + (attended_count * 2)))
    }
    clean_user["assignedTasks"] = assigned_tasks

    return clean_user
