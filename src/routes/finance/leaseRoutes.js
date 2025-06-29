const express = require('express');
const router = express.Router();
const { auth, checkRole, financeAccess } = require('../../middleware/auth');
const { getAllLeases, getLease } = require('../../controllers/finance/leaseController');

// Apply auth middleware to all routes
router.use(auth);
// Apply finance access middleware to all routes
router.use(financeAccess);

// Get all leases (finance admin and admin)
router.get('/', checkRole('admin', 'finance_admin', 'finance_user'), getAllLeases);

// Get single lease (finance admin and admin)
router.get('/:id', checkRole('admin', 'finance_admin', 'finance_user'), getLease);

module.exports = router; 