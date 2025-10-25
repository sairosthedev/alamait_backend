const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { auth, checkRole } = require('../middleware/auth');
const installmentPaymentController = require('../controllers/installmentPaymentController');

// Apply authentication to all routes
router.use(auth);

// Validation middleware
const createInstallmentPaymentValidation = [
    body('monthlyRequestId').notEmpty().withMessage('Monthly request ID is required'),
    body('itemIndex').isInt({ min: 0 }).withMessage('Item index must be a non-negative integer'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('paymentMethod').optional().isIn(['Cash', 'Bank Transfer', 'Check', 'Other']).withMessage('Invalid payment method'),
    body('notes').optional().isString().withMessage('Notes must be a string')
];

const updateStatusValidation = [
    body('status').isIn(['pending', 'paid', 'failed', 'cancelled']).withMessage('Invalid status'),
    body('notes').optional().isString().withMessage('Notes must be a string')
];

/**
 * @route   POST /api/installment-payments
 * @desc    Create an installment payment for a monthly request item
 * @access  Private (Admin/Finance)
 */
router.post('/', 
    checkRole('admin', 'finance_admin', 'finance_user'),
    createInstallmentPaymentValidation,
    installmentPaymentController.createInstallmentPayment
);

/**
 * @route   GET /api/installment-payments/summary/:monthlyRequestId/:itemIndex
 * @desc    Get installment payment summary for a specific item
 * @access  Private (Admin/Finance)
 */
router.get('/summary/:monthlyRequestId/:itemIndex',
    checkRole('admin', 'finance_admin', 'finance_user'),
    installmentPaymentController.getInstallmentSummary
);

/**
 * @route   GET /api/installment-payments/request/:monthlyRequestId
 * @desc    Get all installment payments for a monthly request
 * @access  Private (Admin/Finance)
 */
router.get('/request/:monthlyRequestId',
    checkRole('admin', 'finance_admin', 'finance_user'),
    installmentPaymentController.getAllInstallmentsForRequest
);

/**
 * @route   GET /api/installment-payments/:id
 * @desc    Get installment payment by ID
 * @access  Private (Admin/Finance)
 */
router.get('/:id',
    checkRole('admin', 'finance_admin', 'finance_user'),
    installmentPaymentController.getInstallmentPaymentById
);

/**
 * @route   PATCH /api/installment-payments/:id/status
 * @desc    Update installment payment status
 * @access  Private (Admin/Finance)
 */
router.patch('/:id/status',
    checkRole('admin', 'finance_admin', 'finance_user'),
    updateStatusValidation,
    installmentPaymentController.updateInstallmentPaymentStatus
);

/**
 * @route   DELETE /api/installment-payments/:id
 * @desc    Delete installment payment (only if not paid)
 * @access  Private (Admin/Finance)
 */
router.delete('/:id',
    checkRole('admin', 'finance_admin'),
    installmentPaymentController.deleteInstallmentPayment
);

module.exports = router;

