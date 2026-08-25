const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { protect, authorize, authorizeCoordinator } = require('../middleware/auth');

// Get all meeting plans (Overall coordinator / Admin only)
router.get('/', protect, authorize('admin'), meetingController.getAllPlans);
router.get('/section', protect, authorizeCoordinator, meetingController.getSectionPlans);

// Get meeting plan for a batch (both Student and Guide can access)
router.get('/:batchId', protect, meetingController.getMeetingPlan);

// Create or update meeting plan (Guide only)
router.post('/:batchId', protect, authorize('guide'), meetingController.updateMeetingPlan);

module.exports = router;
