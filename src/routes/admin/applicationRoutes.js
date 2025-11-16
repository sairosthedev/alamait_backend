const express = require('express');
const router = express.Router();
const { auth, checkAdminOrFinance } = require('../../middleware/auth');
const { check } = require('express-validator');
const {
    getApplications,
    getApplicationById,
    updateApplicationStatus,
    updateApplicationData,
    testUpdateApplicationStatus,
    updatePaymentStatus,
    deleteApplication,
    updateRoomValidity,
    syncRoomOccupancy,
    getExpiredStudents
} = require('../../controllers/admin/applicationController');

// Validation middleware for specific routes if needed in future
const updateStatusValidation = [
    // ... validation logic can be kept here for future use
];

// Get all applications with room status
router.get('/', auth, checkAdminOrFinance, getApplications);

// Get pending applications count (must be before /:id route)
// OPTIMIZED: Added caching to reduce database load
router.get('/pending-count', auth, checkAdminOrFinance, async (req, res) => {
    try {
        const Application = require('../../models/Application');
        const cacheService = require('../../services/cacheService');
        const cacheKey = 'applications-pending-count';
        
        // Try cache first (60 second TTL)
        const count = await cacheService.getOrSet(cacheKey, 60, async () => {
            return await Application.countDocuments({ status: 'pending' });
        });
        
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

// Update application data (firstName, lastName, email, phone, etc.)
router.put('/:applicationId/data', auth, checkAdminOrFinance, updateApplicationData);

// Test route to see if the route is being hit
router.put('/:applicationId/test', auth, checkAdminOrFinance, testUpdateApplicationStatus);

// Update payment status
router.put('/:applicationId/payment', auth, checkAdminOrFinance, updatePaymentStatus);

// Delete application
router.delete('/:applicationId', auth, checkAdminOrFinance, deleteApplication);

// Update room validity
router.put('/user/:userId/room-validity', auth, checkAdminOrFinance, updateRoomValidity);

// Sync room occupancy with allocations
router.post('/sync-room-occupancy', auth, checkAdminOrFinance, syncRoomOccupancy);

module.exports = router; 