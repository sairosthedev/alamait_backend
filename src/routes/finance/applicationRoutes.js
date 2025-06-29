const express = require('express');
const router = express.Router();
const { auth, checkRole, financeAccess } = require('../../middleware/auth');
const { getAllApplications, getApplication, getApplicationStats } = require('../../controllers/finance/applicationController');

// Apply auth middleware to all routes
router.use(auth);
// Apply finance access middleware to all routes
router.use(financeAccess);

// Get all applications (finance admin and admin)
router.get('/', checkRole('admin', 'finance_admin', 'finance_user'), getAllApplications);

// Get application statistics (finance admin and admin)
router.get('/stats', checkRole('admin', 'finance_admin', 'finance_user'), getApplicationStats);

// Get single application (finance admin and admin)
router.get('/:id', checkRole('admin', 'finance_admin', 'finance_user'), getApplication);

module.exports = router; 