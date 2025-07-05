const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { submitApplication, getApplicationStatus, checkEmailUsage, getPublicApplicationData } = require('../../controllers/public/applicationController');

// Validation middleware for application submission
const submitApplicationValidation = [
    check('firstName', 'First name is required').notEmpty().trim(),
    check('lastName', 'Last name is required').notEmpty().trim(),
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('phone', 'Phone number is required').notEmpty().trim(),
    check('requestType', 'Request type must be new or upgrade').optional().isIn(['new', 'upgrade']),
    check('preferredRoom', 'Preferred room is required for new applications').if(check('requestType').equals('new')).notEmpty(),
    check('reason', 'Reason is required for upgrade applications').if(check('requestType').equals('upgrade')).notEmpty(),
    check('residence', 'Residence is required').optional().notEmpty()
];

// Submit new application
router.post('/submit', submitApplicationValidation, submitApplication);

// Get application status
router.get('/status/:email', getApplicationStatus);

// Check email usage
router.get('/check-email', checkEmailUsage);

// Check email usage with email in path (for frontend compatibility)
router.get('/check-email/:email', checkEmailUsage);

// Get public application data with room occupancy status
router.get('/public-data', getPublicApplicationData);

// Frontend compatibility route - exact match for /api/applications/public
router.get('/', getPublicApplicationData);

module.exports = router; 