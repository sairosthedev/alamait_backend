const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3, s3Configs, fileFilter, fileTypes } = require('../../config/s3');
const leaseController = require('../../controllers/student/leaseController');
const { auth, checkRole } = require('../../middleware/auth');

// Set up multer S3 storage
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: s3Configs.leases.bucket,
    acl: s3Configs.leases.acl,
    key: s3Configs.leases.key
  }),
  fileFilter: fileFilter([...fileTypes.documents, ...fileTypes.images]),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/student/lease/upload
router.post('/upload', upload.single('lease'), leaseController.uploadLease);

// GET /api/student/lease
router.get('/', leaseController.listLeases);

module.exports = router; 