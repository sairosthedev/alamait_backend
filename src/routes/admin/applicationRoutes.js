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

// All routes require admin role
router.use(auth);
router.use(checkRole('admin'));

// Validation middleware
const updateStatusValidation = [
    check('action')
        .isIn(['approve', 'reject', 'waitlist'])
        .withMessage('Invalid action'),
    check('roomNumber')
        .if(check('action').equals('approve'))
        .notEmpty()
        .withMessage('Room number is required for approval')
];

// Get all applications with room status
router.get('/', getApplications);

// Update application status (approve/reject/waitlist)
router.put('/:applicationId', updateApplicationStatus);

// Update payment status
router.put('/:applicationId/payment', updatePaymentStatus);

// Delete application
router.delete('/:applicationId', deleteApplication);

// Update room validity
router.put('/user/:userId/room-validity', updateRoomValidity);

// Sync room occupancy with allocations
router.post('/sync-room-occupancy', syncRoomOccupancy);

module.exports = router; 