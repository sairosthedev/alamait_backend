const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const maintenanceController = require('../../controllers/finance/maintenanceController');

// Apply authentication middleware to all routes
router.use(auth);

// Allow admin, finance, and finance_admin roles for all finance maintenance routes
const allowedRoles = ['admin', 'finance_admin', 'finance_user'];
router.use(checkRole(...allowedRoles));

// POST route for approve that accepts requestId in body (for frontend compatibility)
// This must come BEFORE the /requests/status/:status route to avoid conflicts
router.post('/approve',
    checkRole('admin', 'finance_admin'),
    async (req, res, next) => {
        const { requestId } = req.body;
        if (!requestId) {
            return res.status(400).json({ error: 'requestId is required in request body' });
        }
        // Set the ID in params so the controller can access it
        req.params.id = requestId;
        next();
    },
    maintenanceController.approveMaintenance
);

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

// Approve maintenance request (admin and finance_admin only)
router.patch('/requests/:id/approve',
    checkRole('admin', 'finance_admin'),
    maintenanceController.approveMaintenance
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