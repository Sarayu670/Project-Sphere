const express = require('express');
const router = express.Router();
const {
  getAIProblems,
  getAIProblem,
  requestAIProblem,
  adoptAIProblemByGuide,
  triggerAICrawl,

  getAICrawlerStats,
  createAIProblem,
  updateAIProblem,
  deleteAIProblem
} = require('../controllers/aiProblemController');

const { protect, authorize } = require('../middleware/auth');

// Public / Protected read routes
router.get('/', protect, getAIProblems);
router.get('/stats', protect, authorize('admin'), getAICrawlerStats);
router.post('/crawl', protect, authorize('admin'), triggerAICrawl);
router.get('/:id', protect, getAIProblem);
router.post('/:id/request', protect, authorize('student'), requestAIProblem);
router.post('/:id/adopt', protect, authorize('guide'), adoptAIProblemByGuide);


// Admin CUD routes
router.post('/', protect, authorize('admin'), createAIProblem);
router.put('/:id', protect, authorize('admin'), updateAIProblem);
router.delete('/:id', protect, authorize('admin'), deleteAIProblem);

module.exports = router;
