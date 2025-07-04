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
            // Find residence by name first
            try {
                const residenceObj = await Residence.findOne({ 
                    name: { $regex: new RegExp(residence, 'i') } 
                });
                
                if (residenceObj) {
                    // If found, filter by residence ID
                    query.residence = residenceObj._id;
                } else {
                    // If not found, try to filter by residence ID directly
                    // This allows flexibility in case the ID is passed directly
                    query.residence = residence;
                }
            } catch (error) {
                console.error('Error finding residence by name:', error);
                // In case of error, try to use the provided value directly
                query.residence = residence;
            }
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
            
            // Improved payment type detection
            if (payment.rentAmount > 0 && payment.adminFee === 0 && payment.deposit === 0) {
                paymentType = 'Rent';
            } else if (payment.deposit > 0 && payment.rentAmount === 0 && payment.adminFee === 0) {
                paymentType = 'Deposit';
            } else if (payment.adminFee > 0 && payment.rentAmount === 0 && payment.deposit === 0) {
                paymentType = 'Admin Fee';
            } else if (payment.rentAmount > 0 && payment.adminFee > 0 && payment.deposit === 0) {
                paymentType = 'Rent + Admin Fee';
            } else if (payment.rentAmount > 0 && payment.deposit > 0 && payment.adminFee === 0) {
                paymentType = 'Rent + Deposit';
            } else if (payment.rentAmount > 0 && payment.adminFee > 0 && payment.deposit > 0) {
                paymentType = 'Rent + Admin Fee + Deposit';
            } else if (payment.adminFee > 0 && payment.deposit > 0 && payment.rentAmount === 0) {
                paymentType = 'Admin Fee + Deposit';
            }
            
            const admin = payment.createdBy ? 
                `${payment.createdBy.firstName} ${payment.createdBy.lastName}` : 
                'System';
                
            return {
                id: payment.paymentId,
                student: payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : 'Unknown',
                admin: admin,
                residence: payment.residence ? payment.residence.name : 'Unknown',
                room: payment.room || 'Not Assigned',
                roomType: payment.roomType || '',
                paymentMonth: payment.paymentMonth || '',
                rentAmount: payment.rentAmount || 0,
                adminFee: payment.adminFee || 0,
                deposit: payment.deposit || 0,
                amount: payment.totalAmount,
                datePaid: payment.date.toISOString().split('T')[0],
                paymentType: paymentType,
                status: payment.status,
                proof: payment.proofOfPayment?.fileUrl || null,
                method: payment.method || '',
                description: payment.description || '',
                studentId: payment.student ? payment.student._id : null,
                residenceId: payment.residence ? payment.residence._id : null,
                applicationStatus: payment.applicationStatus || null,
                clarificationRequests: payment.clarificationRequests || []
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

/**
 * Get payments for a specific student (for finance)
 */
exports.getPaymentsByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { page = 1, limit = 10, status, startDate, endDate } = req.query;
        
        // Validate student ID
        if (!studentId) {
            return res.status(400).json({ error: 'Student ID is required' });
        }

        // Check if student exists
        const student = await User.findById(studentId).select('firstName lastName email');
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Build query
        const query = { student: studentId };
        
        if (status) {
            query.status = status;
        }
        
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        // Get payments with pagination
        const skip = (page - 1) * limit;
        const total = await Payment.countDocuments(query);
        
        const payments = await Payment.find(query)
            .populate('residence', 'name location')
            .populate('createdBy', 'firstName lastName')
            .populate('updatedBy', 'firstName lastName')
            .populate('proofOfPayment.verifiedBy', 'firstName lastName')
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        // Transform payments data
        const formattedPayments = payments.map(payment => {
            let paymentType = 'Other';
            
            // Improved payment type detection
            if (payment.rentAmount > 0 && payment.adminFee === 0 && payment.deposit === 0) {
                paymentType = 'Rent';
            } else if (payment.deposit > 0 && payment.rentAmount === 0 && payment.adminFee === 0) {
                paymentType = 'Deposit';
            } else if (payment.adminFee > 0 && payment.rentAmount === 0 && payment.deposit === 0) {
                paymentType = 'Admin Fee';
            } else if (payment.rentAmount > 0 && payment.adminFee > 0 && payment.deposit === 0) {
                paymentType = 'Rent + Admin Fee';
            } else if (payment.rentAmount > 0 && payment.deposit > 0 && payment.adminFee === 0) {
                paymentType = 'Rent + Deposit';
            } else if (payment.rentAmount > 0 && payment.adminFee > 0 && payment.deposit > 0) {
                paymentType = 'Rent + Admin Fee + Deposit';
            } else if (payment.adminFee > 0 && payment.deposit > 0 && payment.rentAmount === 0) {
                paymentType = 'Admin Fee + Deposit';
            }
            
            const admin = payment.createdBy ? 
                `${payment.createdBy.firstName} ${payment.createdBy.lastName}` : 
                'System';
                
            return {
                id: payment.paymentId,
                student: `${student.firstName} ${student.lastName}`,
                admin: admin,
                residence: payment.residence ? payment.residence.name : 'Unknown',
                room: payment.room || 'Not Assigned',
                roomType: payment.roomType || '',
                paymentMonth: payment.paymentMonth || '',
                rentAmount: payment.rentAmount || 0,
                adminFee: payment.adminFee || 0,
                deposit: payment.deposit || 0,
                amount: payment.totalAmount,
                datePaid: payment.date.toISOString().split('T')[0],
                paymentType: paymentType,
                status: payment.status,
                proof: payment.proofOfPayment?.fileUrl || null,
                method: payment.method || '',
                description: payment.description || '',
                studentId: student._id,
                residenceId: payment.residence ? payment.residence._id : null,
                applicationStatus: payment.applicationStatus || null,
                clarificationRequests: payment.clarificationRequests || []
            };
        });

        // Calculate summary statistics
        const totalPaid = payments
            .filter(p => ['Confirmed', 'Verified'].includes(p.status))
            .reduce((sum, p) => sum + p.totalAmount, 0);
        
        const totalPending = payments
            .filter(p => p.status === 'Pending')
            .reduce((sum, p) => sum + p.totalAmount, 0);

        const totalRejected = payments
            .filter(p => p.status === 'Rejected')
            .reduce((sum, p) => sum + p.totalAmount, 0);
        
        res.json({
            student: {
                id: student._id,
                name: `${student.firstName} ${student.lastName}`,
                email: student.email
            },
            payments: formattedPayments,
            summary: {
                totalPayments: total,
                totalPaid,
                totalPending,
                totalRejected,
                totalAmount: totalPaid + totalPending + totalRejected
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error in getPaymentsByStudent:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 