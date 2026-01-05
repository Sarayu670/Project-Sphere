const express = require('express');
const router = express.Router();
const {
  getAllProblems,
  getProblem,
  getProblemsByCOE,
  createProblem,
  updateProblem,
  deleteProblem,
  getMyProblems
} = require('../controllers/problemController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getAllProblems);
router.get('/my-problems', protect, authorize('guide'), getMyProblems);
router.get('/coe/:coeId', protect, getProblemsByCOE);
router.get('/:id', protect, getProblem);
router.post('/', protect, authorize('guide', 'admin'), createProblem);
router.put('/:id', protect, authorize('guide', 'admin'), updateProblem);
router.delete('/:id', protect, authorize('guide', 'admin'), deleteProblem);

module.exports = router;

