const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const leaseController = require('../../controllers/admin/leaseController');

// GET /api/admin/leases - Fetch all leases
router.get('/', auth, checkRole('admin'), leaseController.getAllLeases);

module.exports = router; 