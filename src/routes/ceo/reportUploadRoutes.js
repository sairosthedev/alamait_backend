const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth, checkRole } = require('../../middleware/auth');
const reportController = require('../../controllers/reportController');
const { s3Configs, fileFilter, fileTypes } = require('../../config/s3');

// Configure multer for file uploads - allow various document and image types
const allowedReportTypes = [
    ...fileTypes.documents,
    ...fileTypes.images,
    'application/msword', // .doc
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'text/plain', // .txt
    'text/csv' // .csv
];

const reportUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: fileFilter(allowedReportTypes),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit for reports
        files: 1
    }
});

// All routes require authentication
router.use(auth);

// CEO routes - can view all reports including CEO-only
router.use(checkRole('ceo'));

// Upload report
router.post('/upload', reportUpload.single('file'), reportController.uploadReport);

// Get all reports (CEO can see all including CEO-only)
router.get('/', reportController.getAllReports);

// Get report by ID
router.get('/:id', reportController.getReportById);

// Get download URL
router.get('/:id/download', reportController.getDownloadUrl);

// Update report
router.put('/:id', reportController.updateReport);

// Delete report
router.delete('/:id', reportController.deleteReport);

module.exports = router;

