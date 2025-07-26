const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { auth, checkAdminOrFinance } = require('../../middleware/auth');
const {
    getAllPettyCash,
    getPettyCashById,
    getEligibleUsers,
    allocatePettyCash,
    updatePettyCash,
    getPettyCashUsage,
    createPettyCashUsage,
    updatePettyCashUsageStatus,
    createPettyCashEntry,
    getPettyCashBalance
} = require('../../controllers/finance/pettyCashController');

// Apply authentication and role middleware to all routes
router.use(auth);
router.use(checkAdminOrFinance);

// Petty Cash Allocation Routes
router.get('/', getAllPettyCash);
router.get('/eligible-users', getEligibleUsers);
router.get('/:id', getPettyCashById);

router.post('/', [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('notes').optional().isString().withMessage('Notes must be a string')
], allocatePettyCash);

router.put('/:id', [
    body('allocatedAmount').optional().isNumeric().withMessage('Allocated amount must be a number'),
    body('status').optional().isIn(['active', 'inactive', 'closed']).withMessage('Invalid status'),
    body('notes').optional().isString().withMessage('Notes must be a string')
], updatePettyCash);

// Petty Cash Usage Routes
router.get('/:pettyCashId/usage', getPettyCashUsage);

router.post('/usage', [
    body('pettyCashId').notEmpty().withMessage('Petty cash ID is required'),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('description').notEmpty().withMessage('Description is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('date').optional().isISO8601().withMessage('Date must be a valid date'),
    body('notes').optional().isString().withMessage('Notes must be a string')
], createPettyCashUsage);

router.put('/usage/:id', [
    body('status').isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status'),
    body('notes').optional().isString().withMessage('Notes must be a string')
], updatePettyCashUsageStatus);

// Direct petty cash entry routes (for admin and petty cash users)
router.get('/balance', getPettyCashBalance);

router.post('/entry', [
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('description').notEmpty().withMessage('Description is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('category').isIn(['maintenance', 'utilities', 'supplies', 'transportation', 'meals', 'other']).withMessage('Invalid category'),
    body('date').optional().isISO8601().withMessage('Date must be a valid date'),
    body('notes').optional().isString().withMessage('Notes must be a string')
], createPettyCashEntry);

module.exports = router; 