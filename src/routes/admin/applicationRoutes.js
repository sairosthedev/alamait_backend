const express = require('express');
const router = express.Router();
const { auth, checkAdminOrFinance } = require('../../middleware/auth');
const { check } = require('express-validator');
const {
    getApplications,
    updateApplicationStatus,
    updatePaymentStatus,
    deleteApplication,
    updateRoomValidity,
    syncRoomOccupancy
} = require('../../controllers/admin/applicationController');

// Validation middleware for specific routes if needed in future
const updateStatusValidation = [
    // ... validation logic can be kept here for future use
];

// Get all applications with room status
router.get('/', auth, checkAdminOrFinance, getApplications);

// Update application status (approve/reject/waitlist)
router.put('/:applicationId', auth, checkAdminOrFinance, updateApplicationStatus);

// Update payment status
router.put('/:applicationId/payment', auth, checkAdminOrFinance, updatePaymentStatus);

// Delete application
router.delete('/:applicationId', auth, checkAdminOrFinance, deleteApplication);

// Update room validity
router.put('/user/:userId/room-validity', auth, checkAdminOrFinance, updateRoomValidity);

// Sync room occupancy with allocations
router.post('/sync-room-occupancy', auth, checkAdminOrFinance, syncRoomOccupancy);

module.exports = router; 