const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');

// Import controllers
const {
    getResidencePaymentConfiguration,
    updateResidencePaymentConfiguration,
    calculatePaymentAmounts,
    getAllResidencePaymentConfigurations,
    applyDefaultPaymentConfiguration
} = require('../../controllers/admin/residencePaymentController');

// Validation middleware for payment configuration
const paymentConfigValidation = [
    body('paymentConfiguration').isObject().withMessage('Payment configuration must be an object'),
    body('paymentConfiguration.adminFee').optional().isObject().withMessage('Admin fee configuration must be an object'),
    body('paymentConfiguration.adminFee.enabled').optional().isBoolean().withMessage('Admin fee enabled must be boolean'),
    body('paymentConfiguration.adminFee.amount').optional().isFloat({ min: 0 }).withMessage('Admin fee amount must be non-negative'),
    body('paymentConfiguration.adminFee.application').optional().isIn(['first_month', 'every_month', 'upfront', 'last_month']).withMessage('Invalid admin fee application'),
    
    body('paymentConfiguration.deposit').optional().isObject().withMessage('Deposit configuration must be an object'),
    body('paymentConfiguration.deposit.enabled').optional().isBoolean().withMessage('Deposit enabled must be boolean'),
    body('paymentConfiguration.deposit.amount').optional().isFloat({ min: 0 }).withMessage('Deposit amount must be non-negative'),
    body('paymentConfiguration.deposit.calculation').optional().isIn(['fixed_amount', 'one_month_rent', 'percentage_of_rent', 'custom']).withMessage('Invalid deposit calculation'),
    body('paymentConfiguration.deposit.percentage').optional().isFloat({ min: 0, max: 1000 }).withMessage('Deposit percentage must be between 0 and 1000'),
    body('paymentConfiguration.deposit.application').optional().isIn(['upfront', 'last_month', 'split_months', 'first_month']).withMessage('Invalid deposit application'),
    
    body('paymentConfiguration.utilities').optional().isObject().withMessage('Utilities configuration must be an object'),
    body('paymentConfiguration.utilities.enabled').optional().isBoolean().withMessage('Utilities enabled must be boolean'),
    body('paymentConfiguration.utilities.amount').optional().isFloat({ min: 0 }).withMessage('Utilities amount must be non-negative'),
    body('paymentConfiguration.utilities.application').optional().isIn(['every_month', 'first_month', 'last_month', 'upfront']).withMessage('Invalid utilities application'),
    
    body('paymentConfiguration.maintenance').optional().isObject().withMessage('Maintenance configuration must be an object'),
    body('paymentConfiguration.maintenance.enabled').optional().isBoolean().withMessage('Maintenance enabled must be boolean'),
    body('paymentConfiguration.maintenance.amount').optional().isFloat({ min: 0 }).withMessage('Maintenance amount must be non-negative'),
    body('paymentConfiguration.maintenance.application').optional().isIn(['every_month', 'first_month', 'last_month', 'upfront']).withMessage('Invalid maintenance application')
];

// Validation middleware for payment calculation
const paymentCalculationValidation = [
    body('room').isObject().withMessage('Room object is required'),
    body('room.price').isFloat({ min: 0 }).withMessage('Room price must be non-negative'),
    body('startDate').isISO8601().withMessage('Start date must be valid ISO 8601 date'),
    body('endDate').isISO8601().withMessage('End date must be valid ISO 8601 date'),
    body('currentMonth').isInt({ min: 1, max: 12 }).withMessage('Current month must be between 1 and 12'),
    body('currentYear').isInt({ min: 2020, max: 2030 }).withMessage('Current year must be between 2020 and 2030')
];

// Apply auth middleware to all routes
router.use(auth);
router.use(checkRole('admin', 'ceo', 'finance'));

// Routes
router.get('/all', getAllResidencePaymentConfigurations);
router.get('/:residenceId', getResidencePaymentConfiguration);
router.put('/:residenceId', paymentConfigValidation, updateResidencePaymentConfiguration);
router.post('/:residenceId/calculate', paymentCalculationValidation, calculatePaymentAmounts);
router.post('/:residenceId/apply-default', applyDefaultPaymentConfiguration);

module.exports = router;
