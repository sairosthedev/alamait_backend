const express = require('express');
const router = express.Router();
const multer = require('multer');
const { s3, s3Configs, fileFilter, fileTypes } = require('../../config/s3');
const timeoutMiddleware = require('../../middleware/timeout');
const leaseController = require('../../controllers/student/leaseController');
const { auth, checkRole } = require('../../middleware/auth');

// Apply timeout middleware for file uploads
router.use(timeoutMiddleware(60000)); // 60 seconds timeout for uploads

// Set up multer with memory storage for more reliable uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory temporarily
  fileFilter: fileFilter([...fileTypes.documents, ...fileTypes.images]),
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB for faster uploads
    files: 1,
    fieldSize: 1024 * 1024 // 1MB for other fields
  }
});

// POST /api/student/lease/upload
router.post('/upload', upload.single('lease'), leaseController.uploadLease);

// GET /api/student/lease
router.get('/', leaseController.listLeases);

module.exports = router; 