const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3, s3Configs, fileFilter, fileTypes } = require('../../config/s3');
const timeoutMiddleware = require('../../middleware/timeout');
const leaseController = require('../../controllers/student/leaseController');
const { auth, checkRole } = require('../../middleware/auth');

// Apply timeout middleware for file uploads
router.use(timeoutMiddleware(60000)); // 60 seconds timeout for uploads

// Set up multer S3 storage with optimized settings
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: s3Configs.leases.bucket,
    acl: s3Configs.leases.acl,
    key: s3Configs.leases.key,
    // Add S3 upload timeout and retry settings
    s3UploadTimeout: 25000, // 25 seconds timeout
    s3RetryCount: 3,
    s3RetryDelay: 1000
  }),
  fileFilter: fileFilter([...fileTypes.documents, ...fileTypes.images]),
  limits: { 
    fileSize: 5 * 1024 * 1024, // Reduced to 5MB for faster uploads
    files: 1,
    fieldSize: 1024 * 1024 // 1MB for other fields
  }
});

// POST /api/student/lease/upload
router.post('/upload', upload.single('lease'), leaseController.uploadLease);

// GET /api/student/lease
router.get('/', leaseController.listLeases);

module.exports = router; 