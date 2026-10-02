const express = require('express');
const router = express.Router();
const {
  getBatchRoadmap,
  regenerateBatchRoadmap,
  updateMilestoneTask,
  getBatchProgressAnalysis,
  refreshBatchProgressAnalysis,
  getRecommendedProblems
} = require('../controllers/aiMentorController');

const { protect, authorize } = require('../middleware/auth');

// Roadmap endpoints
router.get('/roadmap/:batchId', protect, getBatchRoadmap);
router.post('/roadmap/:batchId/regenerate', protect, regenerateBatchRoadmap);
router.put('/roadmap/:batchId/tasks', protect, updateMilestoneTask);

// Progress Monitor & Adaptive Recommendations endpoints
router.get('/progress-analysis/:batchId', protect, getBatchProgressAnalysis);
router.post('/progress-analysis/:batchId/refresh', protect, refreshBatchProgressAnalysis);

// Problem Statement Recommendation endpoint
router.get('/recommend-problems', protect, getRecommendedProblems);

module.exports = router;
