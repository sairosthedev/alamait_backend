const Payment = require('../../models/Payment');
const Refund = require('../../models/Refund');

// GET /api/finance/refunds/payments?studentId=...&status=Confirmed
exports.listStudentPayments = async (req, res) => {
    try {
        const { studentId, status } = req.query;

        if (!studentId) {
            return res.status(400).json({ error: 'studentId is required' });
        }

        const filter = { user: studentId };
        if (status) {
            filter.status = status;
        }

        const payments = await Payment.find(filter)
            .sort({ date: -1 })
            .select('paymentId totalAmount date method status payments description');

        res.json({ payments });
    } catch (err) {
        console.error('Error listing student payments for refund:', err);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
};

// POST /api/finance/refunds
// body: { paymentId, studentId, amount, reason, method, reference }
exports.createRefund = async (req, res) => {
    try {
        const { paymentId, studentId, amount, reason, method, reference } = req.body;

        if (!paymentId || !studentId || typeof amount !== 'number') {
            return res.status(400).json({ error: 'paymentId, studentId and numeric amount are required' });
        }

        const payment = await Payment.findOne({ paymentId, user: studentId });
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found for student' });
        }

        // Optional: cap refund to payment total
        const paymentTotal = payment.totalAmount || payment.calculatedAmount || 0;
        if (amount < 0 || amount > paymentTotal) {
            return res.status(400).json({ error: 'Refund amount must be between 0 and original payment total' });
        }

        const refund = new Refund({
            payment: payment._id,
            student: studentId,
            amount,
            reason: reason || '',
            method: method || 'Bank Transfer',
            status: 'Pending',
            reference: reference || null,
            createdBy: req.user._id
        });

        await refund.save();

        res.status(201).json({ message: 'Refund created', refund });
    } catch (err) {
        console.error('Error creating refund:', err);
        res.status(500).json({ error: 'Failed to create refund' });
    }
};






