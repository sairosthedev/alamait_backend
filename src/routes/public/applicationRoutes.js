const express = require('express');
const router = express.Router();
const { submitApplication, getApplicationStatus } = require('../../controllers/public/applicationController');

// Submit new application
router.post('/submit', submitApplication);

// Get application status
router.get('/status/:email', getApplicationStatus);

module.exports = router; 