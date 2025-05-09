const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const {
    getPayments,
    createPayment,
    updatePaymentStatus,
    uploadProofOfPayment,
    verifyProofOfPayment
} = require('../../controllers/admin/paymentController');

// Validation middleware
const createPaymentValidation = [
    check('student', 'Student name is required').notEmpty(),
    check('payments').isArray(),
    check('payments.*.type').isIn(['rent', 'admin', 'deposit']),
    check('payments.*.amount').isNumeric(),
    check('date', 'Valid date is required').isISO8601(),
    check('method').isIn(['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks'])
];

const updateStatusValidation = [
    check('status').isIn(['Pending', 'Confirmed', 'Failed', 'Verified', 'Rejected'])
];

const verifyPopValidation = [
    check('status').isIn(['Verified', 'Rejected']).notEmpty(),
    check('notes').optional().isString()
];

// All routes require admin role
router.use(auth);
router.use(checkRole('admin'));

// Routes
router.get('/', getPayments);
router.post('/', createPaymentValidation, createPayment);
router.put('/:paymentId/status', updateStatusValidation, updatePaymentStatus);
router.post('/:paymentId/upload-pop', uploadProofOfPayment);
router.put('/:paymentId/verify-pop', verifyPopValidation, verifyProofOfPayment);

module.exports = router; 