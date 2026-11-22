import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from db import db, new_id, iso_now
from auth_utils import get_current_user_payload

router = APIRouter(prefix="/api/meetings", tags=["Meetings"])

class CreateMeetingRequest(BaseModel):
    title: str
    date: Optional[str] = None
    duration: Optional[int] = 45
    type: Optional[str] = "General Discussion"
    recurring: Optional[str] = "None"
    agenda: Optional[str] = ""
    attendees: Optional[List[Any]] = []

class UpdateMeetingRequest(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    duration: Optional[int] = None
    status: Optional[str] = None
    type: Optional[str] = None
    recurring: Optional[str] = None
    agenda: Optional[str] = None
    cancelReason: Optional[str] = None
    attendees: Optional[List[Any]] = None
    pinned: Optional[bool] = None

class DecisionRequest(BaseModel):
    text: str

class CommentRequest(BaseModel):
    text: str

class AttendanceRequest(BaseModel):
    attendance: List[Dict[str, Any]]

class NotesRequest(BaseModel):
    notes: str

def parse_date(d_str: Any) -> datetime:
    if isinstance(d_str, datetime):
        return d_str.replace(tzinfo=None)
    if not d_str:
        return datetime.utcnow()
    try:
        clean = str(d_str).replace("Z", "").split("+")[0]
        return datetime.fromisoformat(clean)
    except Exception:
        return datetime.utcnow()

@router.get("", response_model=List[Dict[str, Any]])
def list_meetings(
    search: Optional[str] = None,
    status: Optional[str] = None,
    type: Optional[str] = None,
    pinned: Optional[bool] = None,
    payload: Dict[str, Any] = Depends(get_current_user_payload)
):
    all_m = db.get_all_meetings()
    filtered = []

    for m in all_m:
        if status and m.get("status") != status:
            continue
        if type and m.get("type") != type:
            continue
        if pinned is not None and m.get("pinned", False) != pinned:
            continue
        if search:
            q = search.lower().strip()
            title = m.get("title", "").lower()
            agenda = m.get("agenda", "").lower()
            attendee_names = " ".join(m.get("attendeeNames", [])).lower()
            if q not in title and q not in agenda and q not in attendee_names:
                continue
        filtered.append(m)

    return filtered

@router.post("", status_code=status.HTTP_201_CREATED)
def create_meeting(req: CreateMeetingRequest, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    user_id = payload.get("id")
    user_name = payload.get("name", "User")

    # Resolve attendees
    resolved_attendees = []
    resolved_names = []
    all_users = db.get_all_users()

    for item in req.attendees or []:
        item_str = str(item).strip()
        matched_user = None
        for u in all_users:
            if u["_id"] == item_str or u["name"].lower() == item_str.lower() or u["email"].lower() == item_str.lower():
                matched_user = u
                break

        if matched_user:
            if matched_user["_id"] not in resolved_attendees:
                resolved_attendees.append(matched_user["_id"])
                resolved_names.append(matched_user["name"])
        else:
            resolved_names.append(item_str)

    meeting_date = req.date if req.date else iso_now()

    doc = {
        "_id": new_id(),
        "title": req.title.strip(),
        "date": meeting_date,
        "duration": req.duration or 45,
        "status": "Upcoming",
        "type": req.type or "General Discussion",
        "recurring": req.recurring or "None",
        "pinned": False,
        "agenda": req.agenda or "",
        "cancelReason": "",
        "attendees": resolved_attendees,
        "attendeeNames": resolved_names,
        "attendance": [],
        "decisions": [],
        "tasks": [],
        "insights": [],
        "comments": [],
        "notes": "",
        "history": [
            {
                "action": "Meeting scheduled",
                "by": user_name,
                "at": iso_now(),
                "details": f"Template: {req.type or 'General'}"
            }
        ],
        "createdBy": user_id
    }

    created = db.insert_meeting(doc)
    return created

@router.get("/{meeting_id}")
def get_meeting(meeting_id: str, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    m = db.find_meeting_by_id(meeting_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return m

@router.put("/{meeting_id}")
def update_meeting(meeting_id: str, req: UpdateMeetingRequest, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    m = db.find_meeting_by_id(meeting_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    user_name = payload.get("name", "User")
    history = m.get("history", [])

    # Check date rescheduling
    if req.date and req.date != m.get("date"):
        history.append({
            "action": f"Rescheduled meeting to {req.date}",
            "by": user_name,
            "at": iso_now(),
            "details": f"Previous: {m.get('date')}"
        })
        m["date"] = req.date

    # Check cancellation
    if req.status == "Cancelled":
        m["status"] = "Cancelled"
        m["cancelReason"] = req.cancelReason or "No reason provided"
        history.append({
            "action": f"Cancelled: {m['cancelReason']}",
            "by": user_name,
            "at": iso_now(),
            "details": "Meeting cancelled"
        })
    elif req.status:
        prev_status = m.get("status")
        m["status"] = req.status
        if req.status != prev_status:
            history.append({
                "action": f"Status updated to {req.status}",
                "by": user_name,
                "at": iso_now(),
                "details": f"Transitioned from {prev_status}"
            })

    # Recurring meeting auto-schedule on completion
    if req.status == "Completed" and m.get("recurring") in ["Daily", "Weekly", "Monthly"]:
        curr_dt = parse_date(m.get("date", iso_now()))
        cadence = m.get("recurring")
        if cadence == "Daily":
            next_dt = curr_dt + timedelta(days=1)
        elif cadence == "Weekly":
            next_dt = curr_dt + timedelta(days=7)
        else: # Monthly
            next_dt = curr_dt + timedelta(days=30)
        next_dt_iso = next_dt.isoformat() + "Z"

        # Duplicate check: check if recurrence already exists
        all_meetings = db.get_all_meetings()
        existing_recurrence = False
        for ex in all_meetings:
            if ex.get("title") == m.get("title") and ex.get("_id") != m.get("_id"):
                ex_dt = parse_date(ex.get("date", ""))
                if ex_dt >= next_dt - timedelta(hours=12):
                    existing_recurrence = True
                    break

        if not existing_recurrence:
            next_meeting = {
                "_id": new_id(),
                "title": m.get("title"),
                "date": next_dt_iso,
                "duration": m.get("duration", 45),
                "status": "Upcoming",
                "type": m.get("type", "General Discussion"),
                "recurring": m.get("recurring"),
                "pinned": False,
                "agenda": m.get("agenda", ""),
                "cancelReason": "",
                "attendees": list(m.get("attendees", [])),
                "attendeeNames": list(m.get("attendeeNames", [])),
                "attendance": [],
                "decisions": [],
                "tasks": [
                    {
                        "_id": new_id(),
                        "description": t.get("description"),
                        "assignee": t.get("assignee"),
                        "assigneeName": t.get("assigneeName"),
                        "deadline": next_dt_iso,
                        "status": "Open",
                        "priority": t.get("priority", "Medium"),
                        "progress": 0,
                        "notes": "Rolled over from previous recurrence",
                        "createdAt": iso_now(),
                        "updatedAt": iso_now()
                    }
                    for t in m.get("tasks", []) if t.get("status") != "Completed"
                ],
                "insights": [],
                "comments": [],
                "notes": "",
                "history": [
                    {
                        "action": "Meeting scheduled",
                        "by": "Meetrix Automation",
                        "at": iso_now(),
                        "details": f"Recurring recurrence created from {m.get('title')}"
                    }
                ],
                "createdBy": payload.get("id")
            }
            db.insert_meeting(next_meeting)

    if req.title:
        m["title"] = req.title.strip()
    if req.duration is not None:
        m["duration"] = req.duration
    if req.type:
        m["type"] = req.type
    if req.recurring:
        m["recurring"] = req.recurring
    if req.agenda is not None:
        m["agenda"] = req.agenda
    if req.cancelReason and m.get("status") == "Cancelled":
        m["cancelReason"] = req.cancelReason
    if req.pinned is not None:
        m["pinned"] = req.pinned

    m["history"] = history
    updated = db.update_meeting(m)
    return updated

@router.delete("/{meeting_id}")
def delete_meeting(meeting_id: str, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    deleted = db.delete_meeting(meeting_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return {"success": True, "message": "Meeting deleted"}

@router.patch("/{meeting_id}/pin")
def toggle_pin(meeting_id: str, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    m = db.find_meeting_by_id(meeting_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    m["pinned"] = not m.get("pinned", False)
    db.update_meeting(m)
    return {"pinned": m["pinned"], "meeting": m}

@router.post("/{meeting_id}/duplicate", status_code=status.HTTP_201_CREATED)
def duplicate_meeting(meeting_id: str, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    m = db.find_meeting_by_id(meeting_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    user_name = payload.get("name", "User")
    dup_doc = {
        "_id": new_id(),
        "title": f"{m.get('title')} (Copy)",
        "date": iso_now(),
        "duration": m.get("duration", 45),
        "status": "Upcoming",
        "type": m.get("type", "General Discussion"),
        "recurring": "None",
        "pinned": False,
        "agenda": m.get("agenda", ""),
        "cancelReason": "",
        "attendees": list(m.get("attendees", [])),
        "attendeeNames": list(m.get("attendeeNames", [])),
        "attendance": [],
        "decisions": [],
        "tasks": [
            {
                "_id": new_id(),
                "description": t.get("description"),
                "assignee": t.get("assignee"),
                "assigneeName": t.get("assigneeName"),
                "deadline": t.get("deadline"),
                "status": "Open",
                "priority": t.get("priority", "Medium"),
                "progress": 0,
                "notes": t.get("notes", ""),
                "createdAt": iso_now(),
                "updatedAt": iso_now()
            }
            for t in m.get("tasks", [])
        ],
        "insights": [],
        "comments": [],
        "notes": "",
        "history": [
            {
                "action": "Meeting duplicated",
                "by": user_name,
                "at": iso_now(),
                "details": f"Cloned from {m.get('title')}"
            }
        ],
        "createdBy": payload.get("id")
    }

    created = db.insert_meeting(dup_doc)
    return created

@router.post("/{meeting_id}/decisions")
def add_decision(meeting_id: str, req: DecisionRequest, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    m = db.find_meeting_by_id(meeting_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Decision text cannot be empty")

    m.setdefault("decisions", []).append(text)
    user_name = payload.get("name", "User")
    m.setdefault("history", []).append({
        "action": f"Recorded decision: {text[:60]}",
        "by": user_name,
        "at": iso_now(),
        "details": text
    })

    db.update_meeting(m)
    return {"decisions": m["decisions"], "meeting": m}

@router.post("/{meeting_id}/comments", status_code=status.HTTP_201_CREATED)
def add_comment(meeting_id: str, req: CommentRequest, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    m = db.find_meeting_by_id(meeting_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    user_name = payload.get("name", "User")
    user_id = payload.get("id")
    text = req.text.strip()

    comment_doc = {
        "_id": new_id(),
        "author": user_id,
        "authorName": user_name,
        "text": text,
        "createdAt": iso_now(),
        "replies": []
    }

    m.setdefault("comments", []).append(comment_doc)
    db.update_meeting(m)

    # Detect @mentions e.g. @Riya, @Gargi
    mentions = re.findall(r"@([a-zA-Z0-9_-]+)", text)
    if mentions:
        all_users = db.get_all_users()
        for mention_name in mentions:
            for u in all_users:
                if u["name"].lower() == mention_name.lower():
                    # Create notification
                    notif = {
                        "_id": new_id(),
                        "recipient": u["_id"],
                        "sender": user_name,
                        "type": "mention",
                        "title": f"Mentioned by {user_name}",
                        "message": f'{user_name} mentioned you in {m.get("title")}: "{text}"',
                        "meetingId": m["_id"],
                        "linkId": comment_doc["_id"],
                        "read": False,
                        "createdAt": iso_now()
                    }
                    db.insert_notification(notif)
                    break

    return comment_doc

@router.put("/{meeting_id}/attendance")
def update_attendance(meeting_id: str, req: AttendanceRequest, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    m = db.find_meeting_by_id(meeting_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    m["attendance"] = req.attendance
    user_name = payload.get("name", "User")
    m.setdefault("history", []).append({
        "action": f"Updated attendance roll-call ({len(req.attendance)} records)",
        "by": user_name,
        "at": iso_now(),
        "details": "Roll-call saved"
    })

    db.update_meeting(m)
    return m

@router.patch("/{meeting_id}/notes")
def update_notes(meeting_id: str, req: NotesRequest, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    m = db.find_meeting_by_id(meeting_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    m["notes"] = req.notes
    db.update_meeting(m)
    return m
