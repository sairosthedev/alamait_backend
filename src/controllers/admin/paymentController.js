const { validationResult } = require('express-validator');
const Payment = require('../../models/Payment');
const User = require('../../models/User');

// Get all payments with pagination and filters
exports.getPayments = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, startDate, endDate } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        }

        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const skip = (page - 1) * limit;

        const payments = await Payment.find(query)
            .populate('student', 'firstName lastName')
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Payment.countDocuments(query);

        // Transform payments to match frontend format
        const transformedPayments = payments.map(payment => ({
            id: payment.paymentId,
            student: `${payment.student.firstName} ${payment.student.lastName}`,
            payments: [
                { type: 'rent', amount: payment.rentAmount || 0 },
                { type: 'admin', amount: payment.adminFee || 0 },
                { type: 'deposit', amount: payment.deposit || 0 }
            ],
            totalAmount: payment.totalAmount,
            date: payment.date.toISOString().split('T')[0],
            method: payment.method,
            status: payment.status
        }));

        res.json({
            payments: transformedPayments,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error in getPayments:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create new payment
exports.createPayment = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { student, payments, date, method } = req.body;

        // Find student by name
        const [firstName, ...lastNameParts] = student.split(' ');
        const lastName = lastNameParts.join(' ');
        
        const studentDoc = await User.findOne({
            firstName: new RegExp(`^${firstName}$`, 'i'),
            lastName: new RegExp(`^${lastName}$`, 'i'),
            role: 'student'
        });

        if (!studentDoc) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Calculate total amount
        const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        // Generate payment ID
        const paymentCount = await Payment.countDocuments();
        const paymentId = `PAY${String(paymentCount + 1).padStart(3, '0')}`;

        // Create new payment
        const payment = new Payment({
            paymentId,
            student: studentDoc._id,
            rentAmount: payments.find(p => p.type === 'rent')?.amount || 0,
            adminFee: payments.find(p => p.type === 'admin')?.amount || 0,
            deposit: payments.find(p => p.type === 'deposit')?.amount || 0,
            totalAmount,
            date: new Date(date),
            method,
            status: 'Pending',
            createdBy: req.user._id
        });

        await payment.save();

        // Return transformed payment
        const transformedPayment = {
            id: payment.paymentId,
            student: `${studentDoc.firstName} ${studentDoc.lastName}`,
            payments: [
                { type: 'rent', amount: payment.rentAmount },
                { type: 'admin', amount: payment.adminFee },
                { type: 'deposit', amount: payment.deposit }
            ],
            totalAmount: payment.totalAmount,
            date: payment.date.toISOString().split('T')[0],
            method: payment.method,
            status: payment.status
        };

        res.status(201).json(transformedPayment);
    } catch (error) {
        console.error('Error in createPayment:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update payment status
exports.updatePaymentStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const payment = await Payment.findOne({ paymentId: req.params.paymentId })
            .populate('student', 'firstName lastName');

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        payment.status = status;
        payment.updatedBy = req.user._id;
        payment.updatedAt = new Date();
        await payment.save();

        // Transform payment for response
        const transformedPayment = {
            id: payment.paymentId,
            student: `${payment.student.firstName} ${payment.student.lastName}`,
            payments: [
                { type: 'rent', amount: payment.rentAmount },
                { type: 'admin', amount: payment.adminFee },
                { type: 'deposit', amount: payment.deposit }
            ],
            totalAmount: payment.totalAmount,
            date: payment.date.toISOString().split('T')[0],
            method: payment.method,
            status: payment.status
        };

        res.json(transformedPayment);
    } catch (error) {
        console.error('Error in updatePaymentStatus:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 