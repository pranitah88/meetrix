from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query
from db import db
from auth_utils import get_current_user_payload

router = APIRouter(prefix="/api/analytics", tags=["Executive Analytics"])

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

@router.get("/dashboard")
def get_dashboard_stats(
    range_param: Optional[str] = Query("all", alias="range"),
    payload: Dict[str, Any] = Depends(get_current_user_payload)
):
    now = datetime.utcnow()
    all_meetings = db.get_all_meetings()

    # Date range filtering
    filtered_meetings = []
    selected_range = range_param or "all"
    if selected_range == "7d":
        cutoff = now - timedelta(days=7)
        for m in all_meetings:
            dt = parse_date(m.get("date"))
            if dt and dt >= cutoff:
                filtered_meetings.append(m)
    elif selected_range == "30d":
        cutoff = now - timedelta(days=30)
        for m in all_meetings:
            dt = parse_date(m.get("date"))
            if dt and dt >= cutoff:
                filtered_meetings.append(m)
    else:
        filtered_meetings = all_meetings

    total_meetings = len(filtered_meetings)
    completed_meetings = sum(1 for m in filtered_meetings if m.get("status") == "Completed")
    cancelled_meetings = sum(1 for m in filtered_meetings if m.get("status") == "Cancelled")
    upcoming_meetings = total_meetings - completed_meetings - cancelled_meetings

    # Aggregate tasks from filtered meetings
    all_tasks = []
    total_decisions = 0
    for m in filtered_meetings:
        all_tasks.extend(m.get("tasks", []))
        total_decisions += len(m.get("decisions", []))

    total_tasks = len(all_tasks)
    completed_tasks = sum(1 for t in all_tasks if t.get("status") == "Completed")
    in_progress_tasks = sum(1 for t in all_tasks if t.get("status") == "In Progress")
    open_tasks = total_tasks - completed_tasks - in_progress_tasks

    overdue_tasks = 0
    for t in all_tasks:
        if t.get("status") != "Completed" and t.get("deadline"):
            dt = parse_date(t.get("deadline"))
            if dt and dt < now:
                overdue_tasks += 1

    completion_rate = round((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0

    # Priority distribution
    priority_dist = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    for t in all_tasks:
        p = t.get("priority", "Medium")
        if p in priority_dist:
            priority_dist[p] += 1
        else:
            priority_dist["Medium"] += 1

    # Dynamic 6-month timeline buckets
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    timeline = []
    for i in range(5, -1, -1):
        # Calculate target month
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        m_name = month_names[month - 1]

        count = 0
        for m in all_meetings:
            dt = parse_date(m.get("date"))
            if dt and dt.year == year and dt.month == month:
                count += 1
        timeline.append({"month": m_name, "meetings": count})

    # Team Performance Leaderboard
    all_users = db.get_all_users()
    team_perf = []
    for u in all_users:
        u_id = u["_id"]
        u_name = u["name"]

        u_assigned = [t for t in all_tasks if t.get("assignee") == u_id or t.get("assigneeName") == u_name]
        u_completed = [t for t in u_assigned if t.get("status") == "Completed"]
        u_total = len(u_assigned)
        u_comp_count = len(u_completed)
        u_rate = round((u_comp_count / u_total * 100)) if u_total > 0 else 0

        team_perf.append({
            "id": u_id,
            "name": u_name,
            "role": u.get("role", "Team Member"),
            "department": u.get("department", "Engineering"),
            "totalTasks": u_total,
            "completedTasks": u_comp_count,
            "pendingTasks": u_total - u_comp_count,
            "completionRate": u_rate
        })

    # Sort leaderboard by completion rate and completed tasks
    team_perf.sort(key=lambda x: (x["completionRate"], x["completedTasks"]), reverse=True)

    return {
        "totalMeetings": total_meetings,
        "completedMeetings": completed_meetings,
        "upcomingMeetings": upcoming_meetings,
        "cancelledMeetings": cancelled_meetings,
        "totalTasks": total_tasks,
        "completedTasks": completed_tasks,
        "openTasks": open_tasks,
        "inProgressTasks": in_progress_tasks,
        "overdueTasks": overdue_tasks,
        "totalDecisions": total_decisions,
        "completionRate": completion_rate,
        "priorityDistribution": priority_dist,
        "timeline": timeline,
        "teamPerformance": team_perf
    }
