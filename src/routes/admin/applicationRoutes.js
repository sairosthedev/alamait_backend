const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    getApplications,
    updateApplicationStatus,
    updatePaymentStatus
} = require('../../controllers/admin/applicationController');

// All routes require admin role
router.use(auth);
router.use(checkRole('admin'));

// Get all applications with room status
router.get('/', getApplications);

// Update application status (approve/reject/waitlist)
router.put('/:applicationId', updateApplicationStatus);

// Update payment status
router.put('/:applicationId/payment', updatePaymentStatus);

module.exports = router; 