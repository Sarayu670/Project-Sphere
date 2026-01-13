const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  importProjects,
  getAllProjects,
  getGuideProjects,
  searchProjects,
  exportProjects
} = require('../controllers/projectController');

// Admin routes
router.post('/import', protect, authorize('admin'), importProjects);

// Public routes (available to all authenticated users)
router.get('/search', searchProjects);
router.get('/export', exportProjects);
router.get('/', getAllProjects);

// Guide routes
router.get('/guide/myprojects', protect, authorize('guide'), getGuideProjects);

module.exports = router;
