const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createEvent,
  getAllEvents,
  updateEvent,
  deleteEvent,
  getTimelineForBatch
} = require('../controllers/timelineController');

// Public routes (protected)
router.get('/', protect, getAllEvents);
router.get('/batch/:batchId', protect, getTimelineForBatch);

// Admin only routes
router.post('/', protect, authorize('admin'), createEvent);
router.put('/:id', protect, authorize('admin'), updateEvent);
router.delete('/:id', protect, authorize('admin'), deleteEvent);

module.exports = router;

