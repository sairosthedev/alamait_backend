const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const leaseController = require('../../controllers/student/leaseController');

// Set up multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// POST /api/student/lease/upload
router.post('/upload', upload.single('lease'), leaseController.uploadLease);

// GET /api/student/lease
router.get('/', leaseController.listLeases);

module.exports = router; 