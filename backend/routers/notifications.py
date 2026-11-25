from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, status, Depends
from db import db, new_id, iso_now
from auth_utils import get_current_user_payload

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

def parse_date(d_str: Any) -> Optional[datetime]:
    if not d_str:
        return None
    if isinstance(d_str, datetime):
        return d_str.replace(tzinfo=None)
    try:
        clean = str(d_str).replace("Z", "").split("+")[0]
        return datetime.fromisoformat(clean)
    except Exception:
        return None

def check_task_deadlines():
    """Scan all active tasks and generate deadline reminders without duplicate spam."""
    now = datetime.utcnow()
    in_48h = now + timedelta(hours=48)
    all_meetings = db.get_all_meetings()

    for m in all_meetings:
        for t in m.get("tasks", []):
            if t.get("status") == "Completed" or not t.get("assignee") or not t.get("deadline"):
                continue

            dt = parse_date(t.get("deadline"))
            if not dt:
                continue

            # Overdue
            if dt < now:
                existing = db.find_notification({
                    "recipient": t.get("assignee"),
                    "type": "task_overdue",
                    "linkId": t.get("_id")
                })
                if not existing:
                    db.insert_notification({
                        "_id": new_id(),
                        "recipient": t.get("assignee"),
                        "sender": "Meetrix System",
                        "type": "task_overdue",
                        "title": "Action Item Overdue",
                        "message": f'Action item "{t.get("description")}" in {m.get("title")} is past its deadline.',
                        "meetingId": m.get("_id"),
                        "linkId": t.get("_id"),
                        "read": False,
                        "createdAt": iso_now()
                    })

            # Approaching deadline (within 48 hours)
            elif now <= dt <= in_48h:
                existing = db.find_notification({
                    "recipient": t.get("assignee"),
                    "type": "task_deadline",
                    "linkId": t.get("_id")
                })
                if not existing:
                    db.insert_notification({
                        "_id": new_id(),
                        "recipient": t.get("assignee"),
                        "sender": "Meetrix System",
                        "type": "task_deadline",
                        "title": "Upcoming Deadline (< 48h)",
                        "message": f'Action item "{t.get("description")}" in {m.get("title")} is due within 48 hours.',
                        "meetingId": m.get("_id"),
                        "linkId": t.get("_id"),
                        "read": False,
                        "createdAt": iso_now()
                    })

@router.get("")
def list_notifications(payload: Dict[str, Any] = Depends(get_current_user_payload)):
    user_id = payload.get("id")
    check_task_deadlines()

    notifs = db.get_notifications_for_user(user_id)
    unread_count = sum(1 for n in notifs if not n.get("read", False))

    return {
        "notifications": notifs,
        "unreadCount": unread_count
    }

@router.get("/check")
def trigger_deadline_check(payload: Dict[str, Any] = Depends(get_current_user_payload)):
    check_task_deadlines()
    user_id = payload.get("id")
    notifs = db.get_notifications_for_user(user_id)
    unread = sum(1 for n in notifs if not n.get("read", False))
    return {"status": "ok", "unreadCount": unread}

@router.patch("/{notif_id}/read")
def mark_read(notif_id: str, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    updated = db.mark_notification_read(notif_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return {"read": True, "notification": updated}

@router.post("/read-all")
def mark_all_read(payload: Dict[str, Any] = Depends(get_current_user_payload)):
    user_id = payload.get("id")
    marked_count = db.mark_all_notifications_read(user_id)
    return {"success": True, "markedCount": marked_count}
