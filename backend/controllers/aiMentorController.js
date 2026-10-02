const ProjectRoadmap = require('../models/ProjectRoadmap');
const AIProgressAnalysis = require('../models/AIProgressAnalysis');
const Batch = require('../models/Batch');
const AIProblemStatement = require('../models/AIProblemStatement');
const ProblemStatement = require('../models/ProblemStatement');
const aiRoadmapService = require('../services/aiRoadmapService');
const aiProgressMonitorService = require('../services/aiProgressMonitorService');

// @desc    Get or generate AI Roadmap for a batch
// @route   GET /api/ai-mentor/roadmap/:batchId
exports.getBatchRoadmap = async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await Batch.findById(batchId)
      .populate('problemId')
      .populate('optedProblemId');

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    let roadmap = await ProjectRoadmap.findOne({ batchId });

    if (!roadmap) {
      // Find problem statement details
      const problem = batch.problemId || batch.optedProblemId;
      roadmap = await aiRoadmapService.generateRoadmapForBatch(batch, problem);
    }

    res.status(200).json({
      success: true,
      data: roadmap
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Regenerate AI Roadmap for a batch
// @route   POST /api/ai-mentor/roadmap/:batchId/regenerate
exports.regenerateBatchRoadmap = async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await Batch.findById(batchId)
      .populate('problemId')
      .populate('optedProblemId');

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const problem = batch.problemId || batch.optedProblemId;
    const roadmap = await aiRoadmapService.generateRoadmapForBatch(batch, problem);

    // Also trigger progress analysis update
    await aiProgressMonitorService.analyzeBatchProgress(batchId);

    res.status(200).json({
      success: true,
      message: 'AI Roadmap regenerated successfully',
      data: roadmap
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle milestone task completion
// @route   PUT /api/ai-mentor/roadmap/:batchId/tasks
exports.updateMilestoneTask = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { phaseIndex, taskIndex, completed } = req.body;

    const roadmap = await ProjectRoadmap.findOne({ batchId });
    if (!roadmap) {
      return res.status(404).json({ success: false, message: 'Roadmap not found' });
    }

    if (roadmap.milestones[phaseIndex] && roadmap.milestones[phaseIndex].tasks[taskIndex]) {
      const task = roadmap.milestones[phaseIndex].tasks[taskIndex];
      task.completed = typeof completed === 'boolean' ? completed : !task.completed;
      task.completedAt = task.completed ? new Date() : null;

      // Update phase status if all tasks completed
      const milestone = roadmap.milestones[phaseIndex];
      const allDone = milestone.tasks.every(t => t.completed);
      if (allDone) {
        milestone.status = 'completed';
        milestone.completedAt = new Date();
      } else if (milestone.tasks.some(t => t.completed)) {
        milestone.status = 'in_progress';
      }

      roadmap.lastUpdated = new Date();
      await roadmap.save();

      // Refresh progress monitoring analysis
      await aiProgressMonitorService.analyzeBatchProgress(batchId);
    }

    res.status(200).json({
      success: true,
      data: roadmap
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get AI Progress Analysis & Adaptive Recommendations for a batch
// @route   GET /api/ai-mentor/progress-analysis/:batchId
exports.getBatchProgressAnalysis = async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const analysis = await aiProgressMonitorService.analyzeBatchProgress(batchId);

    res.status(200).json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Force refresh AI Progress Analysis
// @route   POST /api/ai-mentor/progress-analysis/:batchId/refresh
exports.refreshBatchProgressAnalysis = async (req, res) => {
  try {
    const { batchId } = req.params;
    const analysis = await aiProgressMonitorService.analyzeBatchProgress(batchId);

    res.status(200).json({
      success: true,
      message: 'AI Progress Analysis refreshed successfully',
      data: analysis
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get personalized AI Problem Recommendations for a student
// @route   GET /api/ai-mentor/recommend-problems
exports.getRecommendedProblems = async (req, res) => {
  try {
    const student = req.user;
    const { branch, year, interests } = req.query;

    const userBranch = branch || student?.branch || 'CSE';
    const userYear = year || student?.year || '3rd';

    // Map branch to domain preferences
    const branchDomainMap = {
      'CSE': ['AI & Machine Learning', 'Web Development', 'Cybersecurity'],
      'IT': ['Web Development', 'Cloud Computing', 'Data Science'],
      'ECE': ['IoT & Embedded Systems', 'AI & Machine Learning'],
      'CSM': ['AI & Machine Learning', 'Data Science'],
      'CSD': ['Web Development', 'AI & Machine Learning'],
      'EEE': ['IoT & Embedded Systems', 'Cloud Computing'],
      'ETM': ['IoT & Embedded Systems', 'Cybersecurity']
    };

    const targetDomains = branchDomainMap[userBranch] || ['AI & Machine Learning', 'Web Development'];

    // Query problem statements matching target domains
    const recommended = await AIProblemStatement.find({
      domain: { $in: targetDomains },
      status: 'approved'
    }).limit(6);

    res.status(200).json({
      success: true,
      count: recommended.length,
      data: recommended
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
