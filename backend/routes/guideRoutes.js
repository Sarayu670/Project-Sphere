const express = require('express');
const router = express.Router();
const { getAllGuides, getGuide, createGuide, updateGuide, getMyBatches } = require('../controllers/guideController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getAllGuides);
router.get('/my-batches', protect, authorize('guide'), getMyBatches);
router.get('/:id', protect, getGuide);
router.post('/', protect, authorize('admin'), createGuide);
router.put('/:id', protect, authorize('admin'), updateGuide);

module.exports = router;

