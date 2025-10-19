const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const leaseController = require('../../controllers/admin/leaseController');
const { 
    validateStudentId, 
    validateLeaseDates, 
    validateBulkLeaseUpdates 
} = require('../../middleware/leaseValidation');

// GET /api/admin/leases - Fetch all leases
router.get('/', auth, checkRole('admin'), leaseController.getAllLeases);

// GET /api/admin/leases/student/:studentId - Fetch leases for a specific student
router.get('/student/:studentId', auth, checkRole('admin'), leaseController.getLeasesByStudentId);

// 🆕 NEW LEASE UPDATE ENDPOINTS

// GET /api/admin/students/:studentId/lease - Get student lease information
router.get('/students/:studentId/lease', 
    auth, 
    checkRole('admin'), 
    validateStudentId, 
    leaseController.getStudentLeaseInfo
);

// PUT /api/admin/students/:studentId/lease - Update student lease dates
router.put('/students/:studentId/lease', 
    auth, 
    checkRole('admin'), 
    validateStudentId, 
    validateLeaseDates, 
    leaseController.updateStudentLeaseDates
);

// PUT /api/admin/students/lease/bulk - Bulk update lease dates
router.put('/students/lease/bulk', 
    auth, 
    checkRole('admin'), 
    validateBulkLeaseUpdates, 
    leaseController.bulkUpdateLeaseDates
);

// GET /api/admin/students/:studentId/lease/history - Get lease update history
router.get('/students/:studentId/lease/history', 
    auth, 
    checkRole('admin'), 
    validateStudentId, 
    leaseController.getLeaseUpdateHistory
);

module.exports = router; 