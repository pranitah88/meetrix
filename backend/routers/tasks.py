from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from db import db, new_id, iso_now
from auth_utils import get_current_user_payload

router = APIRouter(prefix="/api/tasks", tags=["Tasks & Kanban"])

class CreateTaskRequest(BaseModel):
    description: str
    assignee: Optional[Any] = None
    priority: Optional[str] = "Medium"
    deadline: Optional[Any] = None
    status: Optional[str] = "Open"
    progress: Optional[int] = 0
    notes: Optional[str] = ""

class UpdateTaskRequest(BaseModel):
    description: Optional[str] = None
    assignee: Optional[Any] = None
    priority: Optional[str] = None
    deadline: Optional[Any] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    notes: Optional[str] = None

PRIORITY_WEIGHT = {
    "Critical": 4,
    "High": 3,
    "Medium": 2,
    "Low": 1
}

@router.get("", response_model=List[Dict[str, Any]])
def list_tasks(
    mine: Optional[bool] = False,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee: Optional[str] = None,
    payload: Dict[str, Any] = Depends(get_current_user_payload)
):
    current_user_id = payload.get("id")
    current_user_name = payload.get("name", "")

    all_meetings = db.get_all_meetings()
    flat_tasks = []

    for m in all_meetings:
        for t in m.get("tasks", []):
            task_copy = dict(t)
            task_copy["meetingId"] = m.get("_id")
            task_copy["meetingTitle"] = m.get("title")

            # Filters
            if status and task_copy.get("status") != status:
                continue
            if priority and task_copy.get("priority") != priority:
                continue
            if assignee:
                a_str = assignee.lower().strip()
                if (str(task_copy.get("assignee")).lower() != a_str and
                    str(task_copy.get("assigneeName", "")).lower() != a_str):
                    continue
            if mine:
                if (task_copy.get("assignee") != current_user_id and
                    task_copy.get("assigneeName", "").lower() != current_user_name.lower()):
                    continue

            flat_tasks.append(task_copy)

    # Sort by priority descending, then deadline
    def sort_key(t):
        p_val = PRIORITY_WEIGHT.get(t.get("priority", "Medium"), 2)
        d_val = str(t.get("deadline", "9999"))
        return (-p_val, d_val)

    flat_tasks.sort(key=sort_key)
    return flat_tasks

@router.post("/{meeting_id}", status_code=status.HTTP_201_CREATED)
def create_task(meeting_id: str, req: CreateTaskRequest, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    m = db.find_meeting_by_id(meeting_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    user_name = payload.get("name", "User")
    all_users = db.get_all_users()

    # Resolve assignee
    assignee_id = None
    assignee_name = "Unassigned"

    if req.assignee:
        assignee_str = str(req.assignee).strip()
        for u in all_users:
            if u["_id"] == assignee_str or u["name"].lower() == assignee_str.lower() or u["email"].lower() == assignee_str.lower():
                assignee_id = u["_id"]
                assignee_name = u["name"]
                break
        if not assignee_id:
            assignee_name = assignee_str

    deadline_str = str(req.deadline) if req.deadline else None

    task_doc = {
        "_id": new_id(),
        "description": req.description.strip(),
        "assignee": assignee_id,
        "assigneeName": assignee_name,
        "priority": req.priority or "Medium",
        "deadline": deadline_str,
        "status": req.status or "Open",
        "progress": req.progress or 0,
        "notes": req.notes or "",
        "completedAt": None,
        "history": [
            {
                "action": f"Created by {user_name}",
                "by": user_name,
                "at": iso_now()
            }
        ],
        "createdAt": iso_now(),
        "updatedAt": iso_now()
    }

    if task_doc["status"] == "Completed":
        task_doc["completedAt"] = iso_now()
        task_doc["progress"] = 100

    m.setdefault("tasks", []).append(task_doc)
    db.update_meeting(m)

    # Trigger assignment notification
    if assignee_id:
        notif = {
            "_id": new_id(),
            "recipient": assignee_id,
            "sender": user_name,
            "type": "task_assigned",
            "title": "New Action Item Assigned",
            "message": f'{user_name} assigned you: "{task_doc["description"]}" in {m.get("title")}',
            "meetingId": m["_id"],
            "linkId": task_doc["_id"],
            "read": False,
            "createdAt": iso_now()
        }
        db.insert_notification(notif)

    return task_doc

@router.patch("/{meeting_id}/{task_id}")
def update_task(meeting_id: str, task_id: str, req: UpdateTaskRequest, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    m = db.find_meeting_by_id(meeting_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    tasks = m.get("tasks", [])
    target = None
    for t in tasks:
        if t.get("_id") == task_id:
            target = t
            break

    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    user_name = payload.get("name", "User")
    history = target.get("history", [])

    if req.description is not None:
        target["description"] = req.description.strip()
    if req.priority is not None:
        target["priority"] = req.priority
    if req.deadline is not None:
        target["deadline"] = str(req.deadline)
    if req.notes is not None:
        target["notes"] = req.notes

    # Reassignment check
    if req.assignee is not None:
        assignee_str = str(req.assignee).strip()
        all_users = db.get_all_users()
        new_id_val = None
        new_name_val = assignee_str

        for u in all_users:
            if u["_id"] == assignee_str or u["name"].lower() == assignee_str.lower() or u["email"].lower() == assignee_str.lower():
                new_id_val = u["_id"]
                new_name_val = u["name"]
                break

        if new_name_val != target.get("assigneeName"):
            history.append({
                "action": f"Reassigned to {new_name_val}",
                "by": user_name,
                "at": iso_now()
            })
            target["assignee"] = new_id_val
            target["assigneeName"] = new_name_val

            if new_id_val:
                db.insert_notification({
                    "_id": new_id(),
                    "recipient": new_id_val,
                    "sender": user_name,
                    "type": "task_reassigned",
                    "title": "Action Item Reassigned",
                    "message": f'{user_name} reassigned: "{target["description"]}" to you in {m.get("title")}',
                    "meetingId": m["_id"],
                    "linkId": target["_id"],
                    "read": False,
                    "createdAt": iso_now()
                })

    # Status & progress
    if req.status is not None:
        prev_st = target.get("status")
        target["status"] = req.status
        if req.status == "Completed":
            target["completedAt"] = iso_now()
            target["progress"] = 100
            history.append({
                "action": "Completed task",
                "by": user_name,
                "at": iso_now()
            })
        elif prev_st == "Completed" and req.status != "Completed":
            target["completedAt"] = None
            if req.progress is None:
                target["progress"] = 50

    if req.progress is not None:
        target["progress"] = req.progress
        if req.progress == 100:
            target["status"] = "Completed"
            target["completedAt"] = target.get("completedAt") or iso_now()

    target["updatedAt"] = iso_now()
    target["history"] = history
    db.update_meeting(m)
    return target

@router.delete("/{meeting_id}/{task_id}")
def delete_task(meeting_id: str, task_id: str, payload: Dict[str, Any] = Depends(get_current_user_payload)):
    m = db.find_meeting_by_id(meeting_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    tasks = m.get("tasks", [])
    before_len = len(tasks)
    m["tasks"] = [t for t in tasks if t.get("_id") != task_id]

    if len(m["tasks"]) == before_len:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    db.update_meeting(m)
    return {"success": True, "message": "Task deleted"}

