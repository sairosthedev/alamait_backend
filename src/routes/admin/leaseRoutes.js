const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const leaseController = require('../../controllers/admin/leaseController');

// GET /api/admin/leases - Fetch all leases
router.get('/', auth, checkRole('admin'), leaseController.getAllLeases);

// GET /api/admin/leases/student/:studentId - Fetch leases for a specific student
router.get('/student/:studentId', auth, checkRole('admin'), leaseController.getLeasesByStudentId);

module.exports = router; 