const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const leaseDownloadController = require('../controllers/leaseDownloadController');

// Apply authentication to all routes
router.use(auth);

// Download a single lease file
router.get('/single/:leaseId', leaseDownloadController.downloadLease);

// Download multiple leases as ZIP (POST with lease IDs in body)
router.post('/multiple', leaseDownloadController.downloadMultipleLeases);

// Download all leases for a specific residence (admin/finance/ceo only)
router.get('/residence/:residenceId', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user', 'ceo'), 
    leaseDownloadController.downloadResidenceLeases
);

// Download all leases (admin/finance/ceo only)
router.get('/all', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user', 'ceo'), 
    leaseDownloadController.downloadAllLeases
);

module.exports = router; 