const { check } = require('express-validator');
const { checkRole } = require('../../middleware/auth');
const Payment = require('../../models/Payment');
const PaymentService = require('../../services/paymentService');
const {
    getPayments,
    getPaymentById,
    updatePayment,
    updatePaymentStatus,
    uploadProofOfPayment,
    verifyProofOfPayment,
    getPaymentTotals,
    deletePayment
} = require('../../controllers/admin/paymentController');

const updateStatusValidation = [
    check('status').isIn(['Pending', 'Confirmed', 'Failed', 'Verified', 'Rejected'])
];

const verifyPopValidation = [
    check('status').isIn(['Verified', 'Rejected']).notEmpty(),
    check('notes').optional().isString()
];

async function createSmartFifoPayment(req, res) {
    try {
        const { totalAmount, payments, student, residence, method, date } = req.body;

        if (!totalAmount || !payments || !payments.length || !student || !residence) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields for Smart FIFO payment',
                required: ['totalAmount', 'payments', 'student', 'residence']
            });
        }

        const totalPaymentAmount = payments.reduce((sum, paymentItem) => sum + paymentItem.amount, 0);
        if (Math.abs(totalPaymentAmount - totalAmount) > 0.01) {
            return res.status(400).json({
                success: false,
                message: 'Payment breakdown total does not match totalAmount',
                breakdownTotal: totalPaymentAmount,
                totalAmount
            });
        }

        const payment = await PaymentService.createPaymentWithSmartAllocation({
            totalAmount,
            payments,
            student,
            residence,
            method: method || 'Cash',
            date: date ? new Date(date) : new Date()
        }, req.user._id);

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
        console.error('Error creating Smart FIFO payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment',
            error: error.message
        });
    }
}

function registerTotalIncomeRoute(router, roles) {
    router.get('/total-income', checkRole(...roles), async (req, res) => {
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
}

function registerPaymentRoutes(router, options = {}) {
    const {
        readRoles = [],
        createRoles = [],
        updateRoles = [],
        deleteRoles = [],
        totalIncomeRoles = [],
        includePopRoutes = true,
        includeGetById = true
    } = options;

    if (totalIncomeRoles.length > 0) {
        registerTotalIncomeRoute(router, totalIncomeRoles);
    }

    router.get('/total', checkRole(...readRoles), getPaymentTotals);
    router.get('/', checkRole(...readRoles), getPayments);

    if (createRoles.length > 0) {
        router.post('/', checkRole(...createRoles), createSmartFifoPayment);
    }

    router.put('/:paymentId/status', checkRole(...updateRoles), updateStatusValidation, updatePaymentStatus);
    router.put('/:id', checkRole(...updateRoles), updatePayment);

    if (deleteRoles.length > 0) {
        router.delete('/:id', checkRole(...deleteRoles), deletePayment);
    }

    if (includePopRoutes) {
        router.post('/:paymentId/upload-pop', uploadProofOfPayment);
        router.put('/:paymentId/verify-pop', verifyPopValidation, verifyProofOfPayment);
    }

    if (includeGetById) {
        router.get('/:id', checkRole(...readRoles), getPaymentById);
    }
}

module.exports = {
    registerPaymentRoutes,
    createSmartFifoPayment,
    updateStatusValidation
};
