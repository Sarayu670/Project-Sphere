const AIProgressAnalysis = require('../models/AIProgressAnalysis');
const Submission = require('../models/Submission');
const TimelineEvent = require('../models/TimelineEvent');
const ProgressUpdate = require('../models/ProgressUpdate');
const ProjectRoadmap = require('../models/ProjectRoadmap');

exports.analyzeBatchProgress = async (batchId) => {
  try {
    // 1. Fetch related records
    const [roadmap, submissions, timelineEvents, progressUpdates] = await Promise.all([
      ProjectRoadmap.findOne({ batchId }),
      Submission.find({ batchId }).populate('timelineEventId'),
      TimelineEvent.find({ isActive: true }).sort({ deadline: 1 }),
      ProgressUpdate.find({ batchId }).sort({ createdAt: -1 })
    ]);

    const now = new Date();
    const completedActivities = [];
    const pendingActivities = [];
    const delayedActivities = [];
    const adaptiveRecommendations = [];

    let totalWeight = 0;
    let earnedWeight = 0;

    // ── 2. Analyze Timeline Events & Submissions ────────────────────────────────

    timelineEvents.forEach(event => {
      totalWeight += 25; // 25 points per event weight
      const sub = submissions.find(s => String(s.timelineEventId?._id || s.timelineEventId) === String(event._id));

      const isPastDeadline = new Date(event.deadline).getTime() < now.getTime();

      if (sub && sub.status === 'accepted') {
        earnedWeight += 25;
        completedActivities.push({
          title: `Timeline Submission: ${event.title}`,
          category: 'submission',
          status: 'completed',
          dueDate: event.deadline,
          completedDate: sub.updatedAt,
          details: `Accepted by guide with ${sub.marks !== null ? sub.marks : 'graded'} marks.`
        });
      } else if (sub && (sub.status === 'submitted' || sub.status === 'under_review')) {
        earnedWeight += 15;
        pendingActivities.push({
          title: `Timeline Submission: ${event.title}`,
          category: 'submission',
          status: 'pending',
          dueDate: event.deadline,
          details: 'Submitted and currently under review by guide.'
        });
      } else if (sub && sub.status === 'needs_revision') {
        earnedWeight += 10;
        delayedActivities.push({
          title: `Timeline Submission: ${event.title}`,
          category: 'submission',
          status: 'delayed',
          dueDate: event.deadline,
          details: 'Guide requested revision for this submission.'
        });
      } else if (isPastDeadline) {
        delayedActivities.push({
          title: `Timeline Submission: ${event.title}`,
          category: 'submission',
          status: 'delayed',
          dueDate: event.deadline,
          details: `Missed deadline of ${new Date(event.deadline).toLocaleDateString()}.`
        });
      } else {
        pendingActivities.push({
          title: `Upcoming Deadline: ${event.title}`,
          category: 'timeline_event',
          status: 'pending',
          dueDate: event.deadline,
          details: `Due on ${new Date(event.deadline).toLocaleDateString()}.`
        });
      }
    });

    // ── 3. Analyze Roadmap Milestone Tasks ─────────────────────────────────────

    if (roadmap && roadmap.milestones) {
      let totalTasks = 0;
      let completedTasks = 0;

      roadmap.milestones.forEach(m => {
        m.tasks.forEach(t => {
          totalTasks++;
          if (t.completed) completedTasks++;
        });

        if (m.status === 'completed') {
          completedActivities.push({
            title: `Roadmap Phase ${m.phase}: ${m.title}`,
            category: 'roadmap_milestone',
            status: 'completed',
            completedDate: m.completedAt,
            details: `Milestone phase completed with ${m.tasks.length} tasks finalized.`
          });
        } else if (m.status === 'in_progress') {
          pendingActivities.push({
            title: `Roadmap Phase ${m.phase}: ${m.title}`,
            category: 'roadmap_milestone',
            status: 'pending',
            details: `${m.tasks.filter(t => t.completed).length} of ${m.tasks.length} tasks completed.`
          });
        }
      });

      if (totalTasks > 0) {
        totalWeight += 50;
        earnedWeight += Math.round((completedTasks / totalTasks) * 50);
      }
    }

    // ── 4. Calculate Health Score & Status ────────────────────────────────────

    let healthScore = 100;
    if (totalWeight > 0) {
      healthScore = Math.min(100, Math.max(0, Math.round((earnedWeight / totalWeight) * 100)));
    }

    // Penalty for delayed activities
    if (delayedActivities.length > 0) {
      healthScore = Math.max(10, healthScore - (delayedActivities.length * 15));
    }

    let healthStatus = 'On Track';
    if (healthScore >= 85 && delayedActivities.length === 0) {
      healthStatus = 'Ahead of Schedule';
    } else if (healthScore >= 70 && delayedActivities.length === 0) {
      healthStatus = 'On Track';
    } else if (healthScore >= 45 || delayedActivities.length === 1) {
      healthStatus = 'At Risk';
    } else {
      healthStatus = 'Delayed';
    }

    // ── 5. Generate Adaptive AI Recommendations ───────────────────────────────

    if (delayedActivities.length > 0) {
      const topDelay = delayedActivities[0];
      adaptiveRecommendations.push({
        type: 'warning',
        title: '🚨 Critical Delay Identified',
        message: `Your team has a delayed milestone/submission: "${topDelay.title}". ${topDelay.details}`,
        suggestedAction: 'Prioritize submitting this item immediately to improve project health score.',
        targetRole: 'both'
      });
    }

    if (submissions.some(s => s.status === 'needs_revision')) {
      adaptiveRecommendations.push({
        type: 'action_item',
        title: '✏️ Guide Revision Requested',
        message: 'Your guide requested changes on a recent submission. Review comments and upload a revised version.',
        suggestedAction: 'Check guide remarks under Submissions and re-upload the updated document.',
        targetRole: 'student'
      });
    }

    if (pendingActivities.length > 0) {
      const nextPending = pendingActivities[0];
      adaptiveRecommendations.push({
        type: 'action_item',
        title: '📌 Recommended Next Step',
        message: `Focus on completing "${nextPending.title}". ${nextPending.details}`,
        suggestedAction: 'Divide deliverable sub-tasks among team members and track completion on the AI Roadmap.',
        targetRole: 'student'
      });
    }

    if (healthStatus === 'Ahead of Schedule' || healthStatus === 'On Track') {
      adaptiveRecommendations.push({
        type: 'praise',
        title: '🌟 Excellent Progress!',
        message: `Project execution is ${healthStatus.toLowerCase()} with a strong Health Score of ${healthScore}%.`,
        suggestedAction: 'Keep up the consistent work pace and begin preparing final capstone presentation materials early.',
        targetRole: 'both'
      });
    }

    // Recommendation for guide
    if (submissions.some(s => s.status === 'submitted' || s.status === 'under_review')) {
      adaptiveRecommendations.push({
        type: 'action_item',
        title: '👨‍🏫 Pending Submissions to Grade',
        message: 'Students have submitted new deliverables waiting for your review and mark assignment.',
        suggestedAction: 'Review submissions and provide qualitative feedback to keep the team motivated.',
        targetRole: 'guide'
      });
    }

    // ── 6. Upsert AIProgressAnalysis ──────────────────────────────────────────

    let analysis = await AIProgressAnalysis.findOne({ batchId });
    if (analysis) {
      analysis.healthScore = healthScore;
      analysis.healthStatus = healthStatus;
      analysis.completedActivities = completedActivities;
      analysis.pendingActivities = pendingActivities;
      analysis.delayedActivities = delayedActivities;
      analysis.adaptiveRecommendations = adaptiveRecommendations;
      analysis.lastAnalyzedAt = new Date();
      await analysis.save();
    } else {
      analysis = await AIProgressAnalysis.create({
        batchId,
        healthScore,
        healthStatus,
        completedActivities,
        pendingActivities,
        delayedActivities,
        adaptiveRecommendations,
        lastAnalyzedAt: new Date()
      });
    }

    return analysis;
  } catch (error) {
    console.error('aiProgressMonitorService Error:', error);
    throw error;
  }
};
