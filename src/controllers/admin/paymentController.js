const { validationResult } = require('express-validator');
const Payment = require('../../models/Payment');
const User = require('../../models/User');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3, s3Configs, fileFilter, fileTypes } = require('../../config/s3');
const Booking = require('../../models/Booking');
const Application = require('../../models/Application');
const Residence = require('../../models/Residence');
const mongoose = require('mongoose');

// Configure multer for S3 file uploads
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: s3Configs.proofOfPayment.bucket,
        acl: s3Configs.proofOfPayment.acl,
        key: s3Configs.proofOfPayment.key
    }),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter([...fileTypes.images, 'application/pdf'])
}).single('proofOfPayment');

// Get all payments
const getPayments = async (req, res) => {
    try {
        const { status, residence, period, date } = req.query;
        
        // Build query based on filters
        const query = {};

        if (status) {
            query.status = status;
        }

        if (residence && residence !== 'all') {
            try {
                query.residence = new mongoose.Types.ObjectId(residence);
            } catch (error) {
                return res.status(400).json({
                    message: 'Invalid residence ID format',
                    field: 'residence'
                });
            }
        }

        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query.paymentDate = { $gte: startDate, $lte: endDate };
        }

        if (period === 'weekly') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            query.paymentDate = { $gte: oneWeekAgo };
        } else if (period === 'monthly') {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            query.paymentDate = { $gte: oneMonthAgo };
        }

        const payments = await Payment.find(query)
            .populate('residence', 'name')
            .populate('student', 'firstName lastName email')
            .sort({ paymentDate: -1 });

        res.status(200).json(payments);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get payment by ID
const getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Invalid payment ID format'
            });
        }

        const payment = await Payment.findById(id)
            .populate('residence', 'name')
            .populate('student', 'firstName lastName email');

        if (!payment) {
            return res.status(404).json({
                message: 'Payment not found'
            });
        }

        res.status(200).json(payment);
    } catch (error) {
        console.error('Error fetching payment:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update payment status
const updatePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Invalid payment ID format'
            });
        }

        if (!status) {
            return res.status(400).json({
                message: 'Status is required'
            });
        }

        const validStatuses = ['Pending', 'Paid', 'Failed', 'Refunded'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Invalid status value',
                validStatuses
            });
        }

        const payment = await Payment.findById(id);
        if (!payment) {
            return res.status(404).json({
                message: 'Payment not found'
            });
        }

        payment.status = status;
        payment.updatedBy = req.user._id;
        await payment.save();

        const updatedPayment = await Payment.findById(id)
            .populate('residence', 'name')
            .populate('student', 'firstName lastName email');

        res.status(200).json(updatedPayment);
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ message: error.message });
    }
};

// Upload proof of payment
const uploadProofOfPayment = async (req, res) => {
    try {
        upload(req, res, async function(err) {
            if (err) {
                return res.status(400).json({ message: err.message });
            }

            const { paymentId } = req.params;
            
            if (!mongoose.Types.ObjectId.isValid(paymentId)) {
                return res.status(400).json({
                    message: 'Invalid payment ID format'
                });
            }

            const payment = await Payment.findById(paymentId);
            if (!payment) {
                return res.status(404).json({
                    message: 'Payment not found'
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    message: 'No file uploaded'
                });
            }

            payment.proofOfPayment = {
                fileUrl: req.file.location, // S3 URL
                fileName: req.file.originalname,
                uploadDate: new Date()
            };

            await payment.save();

            const updatedPayment = await Payment.findById(paymentId)
                .populate('residence', 'name')
                .populate('student', 'firstName lastName email');

            res.status(200).json(updatedPayment);
        });
    } catch (error) {
        console.error('Error uploading proof of payment:', error);
        res.status(500).json({ message: error.message });
    }
};

// Verify proof of payment
const verifyProofOfPayment = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { status, notes } = req.body;

        if (!mongoose.Types.ObjectId.isValid(paymentId)) {
            return res.status(400).json({
                message: 'Invalid payment ID format'
            });
        }

        const payment = await Payment.findById(paymentId);
        if (!payment) {
            return res.status(404).json({
                message: 'Payment not found'
            });
        }

        if (!payment.proofOfPayment) {
            return res.status(400).json({
                message: 'No proof of payment uploaded'
            });
        }

        // Set new PoP status and verification notes
        payment.proofOfPayment.status = status;
        payment.proofOfPayment.verificationNotes = notes;
        payment.proofOfPayment.verifiedBy = req.user._id;
        payment.proofOfPayment.verificationDate = new Date();

        // Optionally update main payment status for legacy compatibility
        if (status === 'Accepted') {
            payment.status = 'Verified';
        } else if (status === 'Rejected') {
            payment.status = 'Rejected';
        } else {
            payment.status = 'Pending';
        }

        await payment.save();

        const updatedPayment = await Payment.findById(paymentId)
            .populate('residence', 'name')
            .populate('student', 'firstName lastName email');

        res.status(200).json({
            ...updatedPayment.toObject(),
            studentComment: payment.proofOfPayment.studentComment
        });
    } catch (error) {
        console.error('Error verifying proof of payment:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get payment totals
const getPaymentTotals = async (req, res) => {
    try {
        const { period, residence, date } = req.query;
        
        // Build query based on filters
        const query = {};

        // Add residence filter if not 'all'
        if (residence && residence !== 'all') {
            try {
                query.residence = new mongoose.Types.ObjectId(residence);
            } catch (error) {
                return res.status(400).json({
                    message: 'Invalid residence ID format',
                    field: 'residence'
                });
            }
        }

        // Handle date filter
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query.paymentDate = { $gte: startDate, $lte: endDate };
        }

        // Handle period filter
        if (period === 'weekly') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            query.paymentDate = { $gte: oneWeekAgo };
        } else if (period === 'monthly') {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            query.paymentDate = { $gte: oneMonthAgo };
        }

        // Get total payments
        const totalPayments = await Payment.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Get payments by status
        const paymentsByStatus = await Payment.aggregate([
            { $match: query },
            { $group: { _id: '$status', total: { $sum: '$amount' } } }
        ]);

        // Get payments by method
        const paymentsByMethod = await Payment.aggregate([
            { $match: query },
            { $group: { _id: '$paymentMethod', total: { $sum: '$amount' } } }
        ]);

        res.status(200).json({
            total: totalPayments[0]?.total || 0,
            byStatus: paymentsByStatus.reduce((acc, curr) => {
                acc[curr._id] = curr.total;
                return acc;
            }, {}),
            byMethod: paymentsByMethod.reduce((acc, curr) => {
                acc[curr._id] = curr.total;
                return acc;
            }, {})
        });
    } catch (error) {
        console.error('Error getting payment totals:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create new payment
const createPayment = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Accept all required fields from frontend
        const {
            paymentId,
            student,
            residence,
            room,
            roomType,
            payments,
            totalAmount,
            paymentMonth,
            date,
            method,
            status,
            description
        } = req.body;

        // Validate required fields
        if (!paymentId || !student || !residence || !totalAmount || !paymentMonth || !date || !method) {
            return res.status(400).json({
                message: 'Missing required fields',
                required: ['paymentId', 'student', 'residence', 'totalAmount', 'paymentMonth', 'date', 'method']
            });
        }

        if (!mongoose.Types.ObjectId.isValid(student)) {
            return res.status(400).json({ message: 'Invalid student ID format' });
        }
        if (!mongoose.Types.ObjectId.isValid(residence)) {
            return res.status(400).json({ message: 'Invalid residence ID format' });
        }

        // Check if student exists
        const studentExists = await User.findOne({ _id: student, role: 'student' });
        if (!studentExists) {
            return res.status(404).json({ message: 'Student not found' });
        }
        // Check if residence exists
        const residenceExists = await Residence.findById(residence);
        if (!residenceExists) {
            return res.status(404).json({ message: 'Residence not found' });
        }

        // Calculate top-level breakdown from payments array if present
        let rent = 0, admin = 0, deposit = 0;
        let parsedPayments = payments;
        if (payments) {
            if (typeof payments === 'string') {
                parsedPayments = JSON.parse(payments);
            }
            rent = parsedPayments.find(p => p.type === 'rent')?.amount || 0;
            admin = parsedPayments.find(p => p.type === 'admin')?.amount || 0;
            deposit = parsedPayments.find(p => p.type === 'deposit')?.amount || 0;
        }

        // Create new payment
        const payment = new Payment({
            paymentId,
            student,
            residence,
            room,
            roomType,
            payments: parsedPayments,
            totalAmount,
            paymentMonth,
            date,
            method,
            status,
            description,
            rentAmount: rent,
            adminFee: admin,
            deposit: deposit,
            createdBy: req.user._id
        });

        await payment.save();

        // Populate the response
        const populatedPayment = await Payment.findById(payment._id)
            .populate('student', 'firstName lastName email')
            .populate('residence', 'name');

        res.status(201).json(populatedPayment);
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({ message: error.message });
    }
};

// Export all functions
module.exports = {
    getPayments,
    getPaymentById,
    updatePaymentStatus,
    uploadProofOfPayment,
    verifyProofOfPayment,
    getPaymentTotals,
    createPayment
}; 