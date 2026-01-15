const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
    importExcelFiles,
    searchProjects,
    getAllProjects,
    deleteAllProjects
} = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/auth');

// Configure multer for file upload (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept Excel files only
        const allowedMimes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel.sheet.macroEnabled.12'
        ];

        if (allowedMimes.includes(file.mimetype) ||
            file.originalname.match(/\.(xlsx|xls)$/)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
        }
    }
});

// Public routes
router.get('/search', searchProjects);
router.get('/', getAllProjects);

// Admin routes
router.post('/import', protect, authorize('admin'), upload.array('files', 10), importExcelFiles);
router.delete('/all', protect, authorize('admin'), deleteAllProjects);

module.exports = router;
