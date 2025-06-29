const express = require('express');
const router = express.Router();
const { submitApplication, getApplicationStatus, checkEmailUsage } = require('../../controllers/public/applicationController');

// Submit new application
router.post('/submit', submitApplication);

// Get application status
router.get('/status/:email', getApplicationStatus);

// Check email usage
router.get('/check-email', checkEmailUsage);

module.exports = router; 