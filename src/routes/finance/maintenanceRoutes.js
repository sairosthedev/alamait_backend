const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const maintenanceController = require('../../controllers/finance/maintenanceController');

// Apply authentication middleware to all routes
router.use(auth);

// Allow admin, finance, and finance_admin roles for all finance maintenance routes
const allowedRoles = ['admin', 'finance_admin', 'finance_user'];
router.use(checkRole(...allowedRoles));

// Get all maintenance requests with financial details
router.get('/requests',
    maintenanceController.getAllMaintenanceRequests
);

// Get maintenance request by ID
router.get('/requests/:id',
    maintenanceController.getMaintenanceRequestById
);

// Update maintenance request financial details
router.put('/requests/:id/finance',
    maintenanceController.updateMaintenanceRequestFinance
);

// Get maintenance requests by finance status
router.get('/requests/status/:status',
    maintenanceController.getMaintenanceRequestsByFinanceStatus
);

// Get maintenance financial statistics
router.get('/statistics',
    maintenanceController.getMaintenanceFinancialStats
);

// Add root GET endpoint for consistency with admin
router.get('/',
    maintenanceController.getAllMaintenanceRequests
);

module.exports = router; 