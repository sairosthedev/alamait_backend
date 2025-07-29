const express = require('express');
const router = express.Router();
const { auth, checkRole, financeAccess } = require('../../middleware/auth');
const { getAllApplications, getApplication, getApplicationStats } = require('../../controllers/finance/applicationController');

// Apply auth middleware to all routes
router.use(auth);
// Apply finance access middleware to all routes
router.use(financeAccess);

// Get all applications (finance admin, admin, and CEO)
router.get('/', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), getAllApplications);

// Get application statistics (finance admin, admin, and CEO)
router.get('/stats', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), getApplicationStats);

// Get single application (finance admin, admin, and CEO)
router.get('/:id', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), getApplication);

module.exports = router; 