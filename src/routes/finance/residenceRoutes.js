const express = require('express');
const router = express.Router();
const { auth, checkRole, financeAccess } = require('../../middleware/auth');
const { getAllResidences, getResidence } = require('../../controllers/finance/residenceController');

// Apply auth middleware to all routes
router.use(auth);
// Apply finance access middleware to all routes
router.use(financeAccess);

// Get all residences (finance admin, admin, and CEO)
router.get('/', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), getAllResidences);

// Get single residence (finance admin, admin, and CEO)
router.get('/:id', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), getResidence);

module.exports = router; 