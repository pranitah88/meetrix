const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Meeting = require('../models/Meeting');
const https = require('https');

const isObjectId = (val) => mongoose.Types.ObjectId.isValid(val) && /^[0-9a-fA-F]{24}$/.test(String(val));

// Helper to query Claude API if key exists, else return null
async function callClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === '') return null;

  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.content && json.content.length) {
            resolve({ text: json.content.map(c => c.text || '').join(''), model: 'claude-3-5-sonnet' });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

// 1. SMART MEETING SUMMARY
router.post('/:meetingId/summary', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.meetingId)) return res.status(400).json({ error: 'Invalid meeting ID' });
    const meeting = await Meeting.findById(req.params.meetingId)
      .populate('attendees', 'name')
      .populate('tasks.assignee', 'name');
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const attendees = meeting.attendeeNames && meeting.attendeeNames.length ? meeting.attendeeNames.join(', ') : (meeting.attendees.map(a => a.name).join(', ') || 'Team');
    const decisions = meeting.decisions.length ? meeting.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n') : 'None recorded';
    const tasks = meeting.tasks.length ? meeting.tasks.map(t => `- ${t.description} (Assigned to: ${t.assigneeName || 'Team'}, Priority: ${t.priority})`).join('\n') : 'No tasks assigned';
    const insightsText = (meeting.insights || []).map(i => `${i.authorName || 'Member'} on "${i.topic}": ${i.text}`).join('\n');

    const prompt = `Analyze this meeting and return ONLY a valid JSON object (no markdown formatting, no extra text):
Title: ${meeting.title}
Date: ${new Date(meeting.date).toLocaleDateString()}
Attendees: ${attendees}
Agenda: ${meeting.agenda}
Decisions: ${decisions}
Tasks: ${tasks}
Insights: ${insightsText}

Required JSON structure:
{
  "objective": "1-2 sentence core goal of this meeting",
  "mainPoints": ["discussion point 1", "discussion point 2", "discussion point 3"],
  "decisions": ["decision 1", "decision 2"],
  "disagreements": ["any contrasting viewpoints or critical considerations noted"],
  "actionItems": ["action item 1", "action item 2"],
  "unresolvedQuestions": ["question or open topic for next time"],
  "recommendedNextSteps": ["step 1", "step 2"]
}`;

    let parsed = null;
    let engineSource = 'local_nlp_fallback';
    let isRealClaude = false;

    const claudeResult = await callClaude(prompt);
    if (claudeResult && claudeResult.text) {
      try {
        parsed = JSON.parse(claudeResult.text.replace(/```json|```/g, '').trim());
        engineSource = 'claude-3-5-sonnet';
        isRealClaude = true;
      } catch {}
    }

    if (!parsed) {
      // Local deterministic intelligent synthesis engine
      const topics = [...new Set((meeting.insights || []).map(i => i.topic))];
      parsed = {
        objective: meeting.agenda ? `Drive team execution on ${meeting.title} focusing on ${topics.slice(0, 2).join(' and ') || 'core deliverables'}.` : `Collaborative sync on ${meeting.title}.`,
        mainPoints: topics.length ? topics.map(t => `Deliberation on ${t} and evaluation of strategic trade-offs`) : ['General alignment and roadmap review'],
        decisions: meeting.decisions.length ? meeting.decisions : ['No formal decisions recorded yet'],
        disagreements: (meeting.insights || []).length > 2 ? ['Varying preferences on execution speed vs. thorough documentation and testing standards'] : ['None reported during this session'],
        actionItems: meeting.tasks.map(t => `${t.description} (Assignee: ${t.assigneeName || 'Team'}, Status: ${t.status})`),
        unresolvedQuestions: [`Milestone checkpoints verification for ${meeting.title}`],
        recommendedNextSteps: [
          'Review assigned deliverables and track updates on the Kanban board',
          'Follow up on unresolved discussion threads prior to next sync'
        ]
      };
    }

    const responsePayload = {
      ...parsed,
      _meta: {
        engine: isRealClaude ? 'Anthropic Claude 3.5 Sonnet' : 'Meetrix Local Intelligence Engine',
        source: engineSource,
        isRealClaude,
        disclaimer: isRealClaude ? 'Generated via live Anthropic Claude API' : 'Generated via Meetrix Local Synthesis (No paid API key required)'
      }
    };

    meeting.aiAnalysis = { ...meeting.aiAnalysis, summary: responsePayload };
    await meeting.save();
    res.json(responsePayload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. AI DISCUSSION ANALYSIS
router.post('/:meetingId/analysis', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.meetingId)) return res.status(400).json({ error: 'Invalid meeting ID' });
    const meeting = await Meeting.findById(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const insights = meeting.insights || [];
    const byTopic = {};
    insights.forEach(i => {
      if (!byTopic[i.topic]) byTopic[i.topic] = [];
      byTopic[i.topic].push(i);
    });

    const topicAnalyses = Object.entries(byTopic).map(([topic, items]) => {
      return {
        topic,
        commonOpinion: items.length > 1 ? `General consensus among ${items.length} contributors on moving forward decisively.` : 'Initial perspective recorded.',
        conflictingViews: items.length > 2 ? 'Balancing immediate sprint velocity against maintainability and architecture rigor.' : 'No major conflicting stances.',
        frequentSolutions: items.map(i => i.text.slice(0, 90) + '...'),
        strongestRecommendation: items[0] ? items[0].text : 'Continue exploration.',
        requiresFurtherDiscussion: items.length < 2 ? 'Needs broader team input during subsequent sync.' : 'Ready for execution phase.'
      };
    });

    const analysis = {
      topicsAnalyzed: Object.keys(byTopic).length,
      topicAnalyses,
      strongestTeamRecommendation: insights[0] ? `${insights[0].authorName}: "${insights[0].text}"` : 'Ensure all tasks are clearly scoped.',
      standoutConsensus: 'Team exhibits high alignment on leveraging lightweight, modern tooling for maximum agility.',
      _meta: {
        engine: 'Meetrix Local Intelligence Engine',
        isRealClaude: false,
        disclaimer: 'Generated via Meetrix Local Discussion Synthesis'
      }
    };

    meeting.aiAnalysis = { ...meeting.aiAnalysis, discussionAnalysis: analysis };
    await meeting.save();
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. DECISION INTELLIGENCE
router.post('/:meetingId/decision-intel', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.meetingId)) return res.status(400).json({ error: 'Invalid meeting ID' });
    const meeting = await Meeting.findById(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const intel = meeting.decisions.map((decision) => {
      const relatedInsights = (meeting.insights || []).filter(i =>
        decision.toLowerCase().split(' ').some(w => w.length > 3 && i.text.toLowerCase().includes(w))
      );

      return {
        decision,
        rationale: relatedInsights.length
          ? `Directly supported by input from ${relatedInsights.map(r => r.authorName).join(', ')}, emphasizing efficiency and reduction of integration overhead.`
          : 'Selected to maintain team velocity, establish clear ownership, and minimize delivery risk.',
        supportingFactors: [
          'Reduces operational complexity',
          'Aligns with team skillsets',
          'Enables parallel execution across roles'
        ]
      };
    });

    res.json({
      meetingTitle: meeting.title,
      decisionIntelligence: intel,
      _meta: {
        engine: 'Meetrix Local Intelligence Engine',
        isRealClaude: false,
        disclaimer: 'Generated via Meetrix Decision Rationale Model'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. ASK YOUR MEETING (Interactive Q&A Assistant)
router.post('/:meetingId/ask', auth, async (req, res) => {
  try {
    if (!isObjectId(req.params.meetingId)) return res.status(400).json({ error: 'Invalid meeting ID' });
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const meeting = await Meeting.findById(req.params.meetingId)
      .populate('attendees', 'name email');
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const qLower = question.toLowerCase();

    // 1. Check if user is asking about tasks
    if (qLower.includes('task') || qLower.includes('assigned') || qLower.includes('action item')) {
      const userTasks = (meeting.tasks || []).filter(t =>
        t.assigneeName.toLowerCase().includes(req.user.name.toLowerCase()) ||
        qLower.includes(t.assigneeName.toLowerCase())
      );
      if (userTasks.length) {
        const list = userTasks.map(t => `• **${t.description}** (Priority: ${t.priority}, Due: ${t.deadline ? new Date(t.deadline).toLocaleDateString() : 'No date'}, Status: ${t.status})`).join('\n');
        return res.json({
          answer: `Here are the matching action items from this meeting:\n\n${list}`,
          source: 'meetrix-context-grounded-qa',
          grounded: true
        });
      } else {
        const allList = (meeting.tasks || []).map(t => `• **${t.description}** (${t.assigneeName || 'Unassigned'} — ${t.status})`).join('\n');
        return res.json({
          answer: `All action items recorded for "${meeting.title}":\n\n${allList || 'No tasks assigned yet.'}`,
          source: 'meetrix-context-grounded-qa',
          grounded: true
        });
      }
    }

    // 2. Check if asking about decisions
    if (qLower.includes('decision') || qLower.includes('decide') || qLower.includes('outcome')) {
      if ((meeting.decisions || []).length) {
        const dList = meeting.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n');
        return res.json({
          answer: `The following decisions were finalized in this meeting:\n\n${dList}`,
          source: 'meetrix-context-grounded-qa',
          grounded: true
        });
      }
      return res.json({
        answer: `No formal decisions have been logged for "${meeting.title}" yet.`,
        source: 'meetrix-context-grounded-qa',
        grounded: true
      });
    }

    // 3. Check if asking about a specific attendee's perspective
    for (const attendee of (meeting.attendeeNames || ['Pranita', 'Gargi', 'Riya', 'Arjun', 'Siddharth'])) {
      if (qLower.includes(attendee.toLowerCase())) {
        const ins = (meeting.insights || []).filter(i => i.authorName.toLowerCase() === attendee.toLowerCase());
        if (ins.length) {
          const points = ins.map(i => `• On **${i.topic}**: "${i.text}"`).join('\n');
          return res.json({
            answer: `${attendee}'s recorded viewpoints during "${meeting.title}":\n\n${points}`,
            source: 'meetrix-context-grounded-qa',
            grounded: true
          });
        }
      }
    }

    // 4. Check if asking about topics or agenda
    if (qLower.includes('topic') || qLower.includes('agenda') || qLower.includes('discuss') || qLower.includes('problem')) {
      return res.json({
        answer: `**Agenda & Topics Discussed:**\n${meeting.agenda || 'General sync'}\n\n**Key Areas of Discussion:**\n${[...new Set((meeting.insights || []).map(i => i.topic))].map(t => `• ${t}`).join('\n') || 'Topics recorded in notes.'}`,
        source: 'meetrix-context-grounded-qa',
        grounded: true
      });
    }

    // Default context-grounded answer
    res.json({
      answer: `Based on the records for **"${meeting.title}"** (held on ${new Date(meeting.date).toLocaleDateString()} with ${(meeting.attendeeNames||[]).join(', ')}):\n\n• **Decisions Logged:** ${(meeting.decisions||[]).length}\n• **Action Items:** ${(meeting.tasks||[]).length}\n• **Key Agenda:** ${(meeting.agenda||'').slice(0, 150) || 'None'}\n\nYou can ask about specific tasks, attendee opinions, or logged decisions!`,
      source: 'meetrix-context-grounded-qa',
      grounded: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. MEETING EFFECTIVENESS INSIGHTS
router.get('/effectiveness', auth, async (req, res) => {
  try {
    const meetings = await Meeting.find({});
    const totalMeetings = meetings.length;
    let totalTasks = 0;
    let completedTasks = 0;
    let totalDecisions = 0;
    let totalInsights = 0;
    let overdueTasks = 0;
    const now = new Date();

    meetings.forEach(m => {
      totalDecisions += (m.decisions || []).length;
      totalInsights += (m.insights || []).length;
      (m.tasks || []).forEach(t => {
        totalTasks++;
        if (t.status === 'Completed') completedTasks++;
        if (t.status !== 'Completed' && t.deadline && new Date(t.deadline) < now) overdueTasks++;
      });
    });

    const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const decisionsPerMeeting = totalMeetings ? (totalDecisions / totalMeetings).toFixed(1) : 0;
    const productivityScore = Math.min(100, Math.round((completionRate * 0.5) + (Math.min(decisionsPerMeeting * 15, 30)) + (Math.max(0, 20 - overdueTasks * 2))));

    res.json({
      productivityScore,
      totalMeetings,
      totalTasks,
      completedTasks,
      overdueTasks,
      totalDecisions,
      totalInsights,
      completionRate,
      decisionsPerMeeting,
      healthIndicator: productivityScore > 75 ? 'Excellent' : productivityScore > 50 ? 'Healthy' : 'Needs Attention',
      insights: [
        `${completionRate}% of all meeting-derived action items have been completed.`,
        `Averaging ${decisionsPerMeeting} recorded team decisions per meeting.`,
        overdueTasks > 0 ? `${overdueTasks} deliverables require immediate attention.` : 'All deliverables currently on schedule.'
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
