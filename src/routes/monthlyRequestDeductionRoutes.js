const express = require('express');
const router = express.Router();
const monthlyRequestDeductionController = require('../controllers/monthlyRequestDeductionController');
const { auth, checkRole } = require('../middleware/auth');
const { body } = require('express-validator');

// Apply authentication to all routes
router.use(auth);

// Create a maintenance request from an approved monthly request (Admin only)
router.post('/create-maintenance', [
    checkRole('admin'),
    body('monthlyRequestId').notEmpty().withMessage('Monthly Request ID is required'),
    body('itemIndex').isInt({ min: 0 }).withMessage('Item index must be a non-negative integer'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('week').notEmpty().withMessage('Week is required (e.g., "Week 1", "Week 2")')
], monthlyRequestDeductionController.createMaintenanceRequestFromMonthly);

// Get deduction summary for a specific monthly request item
router.get('/summary/:monthlyRequestId/:itemIndex', 
    checkRole('admin', 'finance_admin', 'finance_user'),
    monthlyRequestDeductionController.getDeductionSummary
);

// Get all deductions for a monthly request
router.get('/request/:monthlyRequestId', 
    checkRole('admin', 'finance_admin', 'finance_user'),
    monthlyRequestDeductionController.getAllDeductionsForRequest
);

// Get monthly request with deduction progress
router.get('/progress/:monthlyRequestId', 
    checkRole('admin', 'finance_admin', 'finance_user'),
    monthlyRequestDeductionController.getMonthlyRequestWithProgress
);

// Get maintenance requests that need finance approval
router.get('/finance/pending', 
    checkRole('finance_admin', 'finance_user'),
    monthlyRequestDeductionController.getMaintenanceRequestsForFinance
);

module.exports = router;
