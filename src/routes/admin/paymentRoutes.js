const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const {
    getPayments,
    createPayment,
    updatePayment,
    updatePaymentStatus,
    uploadProofOfPayment,
    verifyProofOfPayment,
    getPaymentTotals,
    deletePayment
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
router.get('/total-income', checkRole('admin', 'ceo'), async (req, res) => {
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
router.get('/', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), getPayments);
router.post('/', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), async (req, res) => {
    try {
        console.log('🚀 Admin: Creating payment with Smart FIFO allocation (via paymentRoutes)...');
        
        const PaymentService = require('../../services/paymentService');
        
        // Validate required fields for Smart FIFO system
        const { totalAmount, payments, student, residence, method, date } = req.body;
        
        if (!totalAmount || !payments || !payments.length || !student || !residence) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields for Smart FIFO payment',
                required: ['totalAmount', 'payments', 'student', 'residence']
            });
        }
        
        // Validate payment breakdown
        const totalPaymentAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        if (Math.abs(totalPaymentAmount - totalAmount) > 0.01) {
            return res.status(400).json({
                success: false,
                message: 'Payment breakdown total does not match totalAmount',
                breakdownTotal: totalPaymentAmount,
                totalAmount: totalAmount
            });
        }
        
        // Create payment using Smart FIFO system
        const payment = await PaymentService.createPaymentWithSmartAllocation({
            totalAmount,
            payments,
            student,
            residence,
            method: method || 'Cash',
            date: date ? new Date(date) : new Date()
        }, req.user._id);
        
        console.log('✅ Admin: Smart FIFO payment created successfully (via paymentRoutes):', payment.paymentId);
        
        res.status(201).json({
            success: true,
            message: 'Payment created successfully with Smart FIFO allocation',
            payment: {
                paymentId: payment.paymentId,
                totalAmount: payment.totalAmount,
                status: payment.status,
                allocation: payment.allocation ? 'Completed' : 'Pending',
                allocationBreakdown: payment.allocation || null,
                createdAt: payment.createdAt
            }
        });
        
    } catch (error) {
        console.error('❌ Admin: Error creating Smart FIFO payment (via paymentRoutes):', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment',
            error: error.message
        });
    }
});
router.put('/:paymentId/status', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), updateStatusValidation, updatePaymentStatus);
router.put('/:id', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), updatePayment);
router.delete('/:id', checkRole('admin', 'finance_admin', 'ceo'), deletePayment);
router.get('/total', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), getPaymentTotals);

// Routes accessible to all authenticated users (POP related)
router.post('/:paymentId/upload-pop', uploadProofOfPayment);
router.put('/:paymentId/verify-pop', verifyPopValidation, verifyProofOfPayment);

module.exports = router; 