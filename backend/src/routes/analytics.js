const router = require('express').Router();
const auth = require('../middleware/auth');
const Meeting = require('../models/Meeting');
const User = require('../models/User');

// GET /api/analytics/dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const { range } = req.query; // '7d', '30d', 'all'
    const now = new Date();
    let dateFilter = null;

    if (range === '7d') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === '30d') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const meetingQuery = dateFilter ? { date: { $gte: dateFilter } } : {};
    const meetings = await Meeting.find(meetingQuery)
      .populate('attendees', 'name email avatar role');

    let totalTasks = 0;
    let openTasks = 0;
    let inProgressTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;
    let totalDecisions = 0;
    let upcomingMeetings = 0;
    let completedMeetings = 0;
    let cancelledMeetings = 0;

    const priorityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    const memberStats = {};

    // Initialize user stats
    const allUsers = await User.find({}).select('name avatar role');
    allUsers.forEach(u => {
      memberStats[u.name] = {
        name: u.name,
        role: u.role || 'Member',
        assigned: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
        meetingsAttended: 0
      };
    });

    meetings.forEach(m => {
      if (m.status === 'Completed') {
        completedMeetings++;
      } else if (m.status === 'Cancelled') {
        cancelledMeetings++;
      } else if (m.status === 'Upcoming' || m.status === 'Ongoing') {
        upcomingMeetings++;
      } else if (new Date(m.date) < now) {
        completedMeetings++;
      } else {
        upcomingMeetings++;
      }

      totalDecisions += (m.decisions || []).length;

      (m.attendees || []).forEach(att => {
        if (memberStats[att.name]) {
          memberStats[att.name].meetingsAttended++;
        }
      });

      (m.tasks || []).forEach(t => {
        totalTasks++;
        const p = t.priority || 'Medium';
        if (priorityCounts[p] !== undefined) priorityCounts[p]++;

        const isOver = t.status !== 'Completed' && t.deadline && new Date(t.deadline) < now;
        if (isOver) overdueTasks++;

        if (t.status === 'Completed') completedTasks++;
        else if (t.status === 'In Progress') inProgressTasks++;
        else openTasks++;

        const assignee = t.assigneeName;
        if (assignee && memberStats[assignee]) {
          memberStats[assignee].assigned++;
          if (t.status === 'Completed') memberStats[assignee].completed++;
          else memberStats[assignee].pending++;
          if (isOver) memberStats[assignee].overdue++;
        }
      });
    });

    const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Timeline data (last 6 months or weeks)
    const timeline = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthLabel = d.toLocaleString('en-US', { month: 'short' });
      const year = d.getFullYear();
      const count = meetings.filter(m => {
        const md = new Date(m.date);
        return md.getMonth() === d.getMonth() && md.getFullYear() === year;
      }).length;
      timeline.push({ label: monthLabel, meetings: count });
    }

    res.json({
      totalMeetings: meetings.length,
      upcomingMeetings,
      completedMeetings,
      cancelledMeetings,
      totalTasks,
      openTasks,
      inProgressTasks,
      completedTasks,
      overdueTasks,
      completionRate,
      totalDecisions,
      priorityDistribution: priorityCounts,
      timeline,
      teamPerformance: Object.values(memberStats)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

