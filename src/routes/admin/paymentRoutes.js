const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const {
    getPayments,
    createPayment,
    updatePaymentStatus
} = require('../../controllers/admin/paymentController');

// Validation middleware
const createPaymentValidation = [
    check('student', 'Student name is required').notEmpty(),
    check('payments').isArray(),
    check('payments.*.type').isIn(['rent', 'admin', 'deposit']),
    check('payments.*.amount').isNumeric(),
    check('date', 'Valid date is required').isISO8601(),
    check('method').isIn(['Bank Transfer', 'Cash', 'Online Payment'])
];

const updateStatusValidation = [
    check('status').isIn(['Pending', 'Confirmed', 'Failed'])
];

// All routes require admin role
router.use(auth);
router.use(checkRole('admin'));

// Routes
router.get('/', getPayments);
router.post('/', createPaymentValidation, createPayment);
router.put('/:paymentId/status', updateStatusValidation, updatePaymentStatus);

module.exports = router; 