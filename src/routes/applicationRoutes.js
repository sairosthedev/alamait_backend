const express = require('express');
const router = express.Router();
const { auth, checkAdminOrFinance } = require('../middleware/auth');
const {
    getApplications,
    getApplicationById,
    updateApplicationStatus,
    updatePaymentStatus,
    deleteApplication,
    updateRoomValidity,
    syncRoomOccupancy,
    getExpiredStudents
} = require('../controllers/admin/applicationController');

// Get all applications with room status
router.get('/', auth, checkAdminOrFinance, getApplications);

// Get pending applications count (must be before /:id route)
router.get('/pending-count', auth, checkAdminOrFinance, async (req, res) => {
    try {
        const Application = require('../models/Application');
        const count = await Application.countDocuments({ status: 'pending' });
        res.json({ count });
    } catch (error) {
        console.error('Error getting pending applications count:', error);
        res.status(500).json({ error: 'Failed to get pending applications count' });
    }
});

// Get application by ID
router.get('/:id', auth, checkAdminOrFinance, getApplicationById);

// Get expired students
router.get('/expired', auth, checkAdminOrFinance, getExpiredStudents);

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

