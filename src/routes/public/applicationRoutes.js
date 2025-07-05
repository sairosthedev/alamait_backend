const express = require('express');
const router = express.Router();
const { submitApplication, getApplicationStatus, checkEmailUsage, getPublicApplicationData } = require('../../controllers/public/applicationController');

// Submit new application
router.post('/submit', submitApplication);

// Get application status
router.get('/status/:email', getApplicationStatus);

// Check email usage
router.get('/check-email', checkEmailUsage);

// Check email usage with email in path (for frontend compatibility)
router.get('/check-email/:email', checkEmailUsage);

// Get public application data with room occupancy status
router.get('/public-data', getPublicApplicationData);

module.exports = router; 