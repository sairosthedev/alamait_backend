const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const {
    getPayments,
    createPayment,
    updatePaymentStatus,
    uploadProofOfPayment,
    verifyProofOfPayment,
    getPaymentTotals
} = require('../../controllers/admin/paymentController');
const Payment = require('../../models/Payment');

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

// Basic authentication for all routes
router.use(auth);

// Admin-only routes
router.get('/total-income', checkRole('admin'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const query = { status: 'Confirmed' };
        
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const payments = await Payment.find(query);
        const totalIncome = payments.reduce((sum, payment) => sum + payment.totalAmount, 0);

        res.json({ totalIncome });
    } catch (error) {
        console.error('Error fetching total income:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin-only routes
router.get('/', checkRole('admin'), getPayments);
router.post('/', checkRole('admin'), createPaymentValidation, createPayment);
router.put('/:paymentId/status', checkRole('admin'), updateStatusValidation, updatePaymentStatus);
router.get('/total', checkRole('admin'), getPaymentTotals);

// Routes accessible to all authenticated users (POP related)
router.post('/:paymentId/upload-pop', uploadProofOfPayment);
router.put('/:paymentId/verify-pop', verifyPopValidation, verifyProofOfPayment);

module.exports = router; 