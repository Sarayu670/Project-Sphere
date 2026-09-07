const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getDashboard, getOverview, createAdmin, getBatchGuideMapping, getCoordinators, importBatches, importBatchData, importCoordinators, searchBatchesByGuide, fixCOEandRCClassification } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

router.post('/create', createAdmin); // Public for initial setup
router.get('/dashboard', protect, authorize('admin'), getDashboard);
router.get('/overview', protect, authorize('admin'), getOverview);
router.get('/batch-guide-mapping', protect, authorize('admin'), getBatchGuideMapping);
router.get('/coordinators', protect, authorize('admin'), getCoordinators);
router.delete('/coordinators/:id', protect, authorize('admin'), require('../controllers/adminController').deleteCoordinator);
router.get('/search-batches-by-guide', searchBatchesByGuide);
router.post('/import-batches', protect, authorize('admin'), importBatches);
router.post('/import-batch-data', protect, authorize('admin'), upload.single('file'), importBatchData);
router.post('/import-coordinators', protect, authorize('admin'), upload.single('file'), importCoordinators);
router.post('/fix-coe-rc-classification', protect, authorize('admin'), fixCOEandRCClassification);

module.exports = router;

