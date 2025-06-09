const express = require('express');
const router = express.Router();
const { auth, checkRole, financeAccess } = require('../../middleware/auth');
const { getAllResidences, getResidence } = require('../../controllers/finance/residenceController');

// Apply auth middleware to all routes
router.use(auth);
// Apply finance access middleware to all routes
router.use(financeAccess);

// Get all residences (finance admin and admin)
router.get('/', checkRole('admin', 'finance_admin', 'finance_user'), getAllResidences);

// Get single residence (finance admin and admin)
router.get('/:id', checkRole('admin', 'finance_admin', 'finance_user'), getResidence);

module.exports = router; 