const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const pettyCashController = require('../../controllers/finance/pettyCashController');
const { authenticateToken } = require('../../middleware/auth');
const roleMiddleware = require('../../middleware/roleMiddleware');

// Validation middleware
const validatePettyCashInitialization = [
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('custodian').notEmpty().withMessage('Custodian is required'),
    body('description').optional().isString().withMessage('Description must be a string')
];

const validatePettyCashReplenishment = [
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('receipts').optional().isArray().withMessage('Receipts must be an array')
];

const validatePettyCashExpense = [
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('category').isIn(['office_supplies', 'transportation', 'meals', 'maintenance', 'other']).withMessage('Invalid category'),
    body('description').notEmpty().withMessage('Description is required'),
    body('receipt').optional().isString().withMessage('Receipt must be a string')
];

// Routes

// Initialize petty cash fund
router.post('/initialize', 
    authenticateToken, 
    roleMiddleware(['admin', 'finance_admin']), 
    validatePettyCashInitialization,
    pettyCashController.initializePettyCash
);

// Replenish petty cash fund
router.post('/replenish', 
    authenticateToken, 
    roleMiddleware(['admin', 'finance_admin', 'finance_user']), 
    validatePettyCashReplenishment,
    pettyCashController.replenishPettyCash
);

// Record petty cash expense
router.post('/expense', 
    authenticateToken, 
    roleMiddleware(['admin', 'finance_admin', 'finance_user']), 
    validatePettyCashExpense,
    pettyCashController.recordExpense
);

// Get petty cash status
router.get('/status', 
    authenticateToken, 
    roleMiddleware(['admin', 'finance_admin', 'finance_user']), 
    pettyCashController.getPettyCashStatus
);

// Get petty cash report
router.get('/report', 
    authenticateToken, 
    roleMiddleware(['admin', 'finance_admin', 'finance_user']), 
    pettyCashController.getPettyCashReport
);

module.exports = router; 