const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const maintenanceController = require('../../controllers/finance/maintenanceController');

// Apply authentication middleware to all routes
router.use(auth);

// Get all maintenance requests with financial details
router.get('/requests',
    checkRole('admin', 'finance_admin'),
    maintenanceController.getAllMaintenanceRequests
);

// Get maintenance request by ID
router.get('/requests/:id',
    checkRole('admin', 'finance_admin'),
    maintenanceController.getMaintenanceRequestById
);

// Update maintenance request financial details
router.put('/requests/:id/finance',
    checkRole('admin', 'finance_admin'),
    maintenanceController.updateMaintenanceRequestFinance
);

// Get maintenance requests by finance status
router.get('/requests/status/:status',
    checkRole('admin', 'finance_admin'),
    maintenanceController.getMaintenanceRequestsByFinanceStatus
);

// Get maintenance financial statistics
router.get('/statistics',
    checkRole('admin', 'finance_admin'),
    maintenanceController.getMaintenanceFinancialStats
);

// Add root GET endpoint for consistency with admin
router.get('/',
    checkRole('admin', 'finance_admin'),
    maintenanceController.getAllMaintenanceRequests
);

module.exports = router; 