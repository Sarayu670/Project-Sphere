const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, authorize } = require('../middleware/auth');
const {
  createOrUpdateSubmission,
  getSubmission,
  getBatchSubmissions,
  getGuideSubmissions,
  addComment,
  assignMarks,
  getAllSubmissions,
  addAdminRemark,
  getStudentsByBatch
} = require('../controllers/submissionController');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/submissions';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, `sub-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage: storage });

// Student routes
router.post('/', protect, authorize('student'), createOrUpdateSubmission);
router.get('/batch/:batchId', protect, getBatchSubmissions);
router.get('/batch/:batchId/students', protect, authorize('guide'), getStudentsByBatch);

// Guide routes
router.get('/guide', protect, authorize('guide'), getGuideSubmissions);
router.post('/:id/comment', protect, authorize('guide'), addComment);
router.post('/:id/marks', protect, authorize('guide'), assignMarks);

// Admin / Coordinator routes
router.post('/:id/admin-remark', protect, (req, res, next) => {
  if (req.user.role === 'admin') return next();
  if (req.user.role === 'guide' && req.user.isCoordinator) return next();
  return res.status(403).json({ success: false, message: 'Only admins and section coordinators can add remarks.' });
}, addAdminRemark);

// General
router.get('/', protect, (req, res, next) => {
  if (req.user.role === 'admin') return next();
  if (req.user.role === 'guide' && req.user.isCoordinator) return next();
  return res.status(403).json({ success: false, message: 'Only admins and coordinators can access all submissions.' });
}, getAllSubmissions);
router.get('/:id', protect, getSubmission);

module.exports = router;

