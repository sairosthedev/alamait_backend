const { validationResult } = require('express-validator');
const Payment = require('../../models/Payment');
const User = require('../../models/User');
const Residence = require('../../models/Residence');

/**
 * Get all student payments with pagination and filtering
 */
exports.getStudentPayments = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            status, 
            residence, 
            startDate, 
            endDate,
            student,
            paymentType
        } = req.query;
        
        const query = {};
        
        // Apply filters
        if (status) {
            query.status = status;
        }
        
        if (residence) {
            query.residence = residence;
        }
        
        if (student) {
            const studentUser = await User.findOne({
                $or: [
                    { _id: student },
                    { email: student },
                    { 
                        $expr: { 
                            $regexMatch: { 
                                input: { $concat: ["$firstName", " ", "$lastName"] }, 
                                regex: student, 
                                options: "i" 
                            } 
                        } 
                    }
                ]
            });
            
            if (studentUser) {
                query.student = studentUser._id;
            }
        }
        
        // Date filtering
        if (startDate || endDate) {
            query.date = {};
            
            if (startDate) {
                query.date.$gte = new Date(startDate);
            }
            
            if (endDate) {
                query.date.$lte = new Date(endDate);
            }
        }

        // Query the database directly without pagination to better match admin method
        const payments = await Payment.find(query)
            .populate('student', 'firstName lastName email')
            .populate('residence', 'name location')
            .populate('createdBy', 'firstName lastName')
            .populate('updatedBy', 'firstName lastName')
            .populate('proofOfPayment.verifiedBy', 'firstName lastName')
            .sort({ date: -1 });
            
        // Transform payments data
        const formattedPayments = payments.map(payment => {
            let paymentType = 'Other';
            
            if (payment.rentAmount > 0 && payment.adminFee === 0 && payment.deposit === 0) {
                paymentType = 'Rent';
            } else if (payment.deposit > 0 && payment.rentAmount === 0 && payment.adminFee === 0) {
                paymentType = 'Deposit';
            } else if (payment.adminFee > 0 && payment.rentAmount === 0 && payment.deposit === 0) {
                paymentType = 'Admin Fee';
            }
            
            const admin = payment.createdBy ? 
                `${payment.createdBy.firstName} ${payment.createdBy.lastName}` : 
                'System';
                
            return {
                id: payment.paymentId,
                student: payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : 'Unknown',
                admin: admin,
                residence: payment.residence ? payment.residence.name : 'Unknown',
                amount: payment.totalAmount,
                datePaid: payment.date.toISOString().split('T')[0],
                paymentType: paymentType,
                status: payment.status,
                proof: payment.proofOfPayment?.fileUrl ? 
                    (payment.proofOfPayment.fileUrl.startsWith('http') ? 
                        payment.proofOfPayment.fileUrl : 
                        `${process.env.BACKEND_URL || 'http://localhost:5000'}${payment.proofOfPayment.fileUrl}`) 
                    : null,
                studentId: payment.student ? payment.student._id : null,
                residenceId: payment.residence ? payment.residence._id : null
            };
        });
        
        const total = formattedPayments.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedPayments = formattedPayments.slice(startIndex, endIndex);
        
        res.json({
            payments: paginatedPayments,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalPayments: total
        });
    } catch (error) {
        console.error('Error in getStudentPayments:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Update payment status (confirm or reject)
 */
exports.updatePaymentStatus = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { status } = req.body;
        const payment = await Payment.findOne({ paymentId: req.params.paymentId })
            .populate('student', 'firstName lastName email');

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        payment.status = status;
        payment.updatedBy = req.user._id;
        await payment.save();

        // Return updated payment
        res.json({
            message: `Payment ${status.toLowerCase()} successfully`,
            payment: {
                id: payment.paymentId,
                status: payment.status
            }
        });
    } catch (error) {
        console.error('Error in updatePaymentStatus:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Request clarification for a payment
 */
exports.requestClarification = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { message } = req.body;
        const payment = await Payment.findOne({ paymentId: req.params.paymentId })
            .populate('student', 'firstName lastName email');

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        // Set payment status to 'Clarification Requested'
        payment.status = 'Clarification Requested';
        payment.updatedBy = req.user._id;
        
        // Add clarification request
        if (!payment.clarificationRequests) {
            payment.clarificationRequests = [];
        }
        
        payment.clarificationRequests.push({
            message: message,
            requestedBy: req.user._id,
            requestDate: new Date()
        });
        
        await payment.save();

        // In a real app, this would also send an email notification to the student

        res.json({
            message: 'Clarification requested successfully',
            payment: {
                id: payment.paymentId,
                status: payment.status
            }
        });
    } catch (error) {
        console.error('Error in requestClarification:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 