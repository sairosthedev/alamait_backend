const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
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
router.get('/', auth, checkRole('admin'), getApplications);

// Update application status (approve/reject/waitlist)
router.put('/:applicationId', auth, checkRole('admin'), updateApplicationStatus);

// Update payment status
router.put('/:applicationId/payment', auth, checkRole('admin'), updatePaymentStatus);

// Delete application
router.delete('/:applicationId', auth, checkRole('admin'), deleteApplication);

// Update room validity
router.put('/user/:userId/room-validity', auth, checkRole('admin'), updateRoomValidity);

// Sync room occupancy with allocations
router.post('/sync-room-occupancy', auth, checkRole('admin'), syncRoomOccupancy);

module.exports = router; 