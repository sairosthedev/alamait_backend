const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const leaseController = require('../../controllers/admin/leaseController');
const { 
    validateStudentId,
    validateApplicationId,
    validateDebtorId,
    validateLeaseDates, 
    validateBulkLeaseUpdates 
} = require('../../middleware/leaseValidation');

// GET /api/admin/leases - Fetch all leases
router.get('/', auth, checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), leaseController.getAllLeases);

// GET /api/admin/leases/student/:studentId - Fetch leases for a specific student
router.get('/student/:studentId', auth, checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), leaseController.getLeasesByStudentId);

// 🆕 NEW LEASE UPDATE ENDPOINTS

// GET /api/admin/students/:studentId/lease - Get student lease information
router.get('/students/:studentId/lease', 
    auth, 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), 
    validateStudentId, 
    leaseController.getStudentLeaseInfo
);

// PUT /api/admin/students/:studentId/lease - Update student lease dates (admin only)
router.put('/students/:studentId/lease', 
    auth, 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), 
    validateStudentId, 
    validateLeaseDates, 
    leaseController.updateStudentLeaseDates
);

// PUT /api/admin/leases/applications/:applicationId/lease - Update by application (tenants without login)
router.put('/applications/:applicationId/lease',
    auth,
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    validateApplicationId,
    validateLeaseDates,
    leaseController.updateApplicationLeaseDates
);

// PUT /api/admin/leases/debtors/:debtorId/lease - Update from debtors list
router.put('/debtors/:debtorId/lease',
    auth,
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    validateDebtorId,
    validateLeaseDates,
    leaseController.updateDebtorLeaseDates
);

// POST /api/admin/leases/applications/:applicationId/sync-accruals - Backfill missing accruals
router.post('/applications/:applicationId/sync-accruals',
    auth,
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    validateApplicationId,
    leaseController.syncApplicationAccruals
);

// POST /api/admin/leases/debtors/:debtorId/sync-accruals - Backfill from debtor id
router.post('/debtors/:debtorId/sync-accruals',
    auth,
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    validateDebtorId,
    leaseController.syncApplicationAccruals
);

// PUT /api/admin/students/lease/bulk - Bulk update lease dates (admin only)
router.put('/students/lease/bulk', 
    auth, 
    checkRole('admin'), 
    validateBulkLeaseUpdates, 
    leaseController.bulkUpdateLeaseDates
);

// GET /api/admin/students/:studentId/lease/history - Get lease update history
router.get('/students/:studentId/lease/history', 
    auth, 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), 
    validateStudentId, 
    leaseController.getLeaseUpdateHistory
);

module.exports = router; 