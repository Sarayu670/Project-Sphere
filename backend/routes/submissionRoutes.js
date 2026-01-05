const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createOrUpdateSubmission,
  getSubmission,
  getBatchSubmissions,
  getGuideSubmissions,
  addComment,
  assignMarks,
  getAllSubmissions,
  addAdminRemark
} = require('../controllers/submissionController');

// Student routes
router.post('/', protect, authorize('student'), createOrUpdateSubmission);
router.get('/batch/:batchId', protect, getBatchSubmissions);

// Guide routes
router.get('/guide', protect, authorize('guide'), getGuideSubmissions);
router.post('/:id/comment', protect, authorize('guide'), addComment);
router.post('/:id/marks', protect, authorize('guide'), assignMarks);

// Admin routes
router.post('/:id/admin-remark', protect, authorize('admin'), addAdminRemark);

// General
router.get('/', protect, authorize('admin'), getAllSubmissions);
router.get('/:id', protect, getSubmission);

module.exports = router;

