const express = require('express');
const router = express.Router();
const {
  getAllBatches,
  getMyBatch,
  createBatch,
  selectProblem,
  updateBatchStatus,
  getBatch,
  getOptedTeams,
  allotProblem,
  rejectProblem
} = require('../controllers/batchController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getAllBatches);
router.get('/my-batch', protect, authorize('student'), getMyBatch);
router.get('/opted-teams', protect, authorize('guide'), getOptedTeams);
router.get('/:id', protect, getBatch);
router.post('/', protect, authorize('student'), createBatch);
router.post('/select-problem', protect, authorize('student'), selectProblem);
router.post('/:id/allot', protect, authorize('guide'), allotProblem);
router.post('/:id/reject', protect, authorize('guide'), rejectProblem);
router.put('/:id/status', protect, authorize('guide'), updateBatchStatus);

module.exports = router;

