const { validationResult } = require('express-validator');
const Payment = require('../../models/Payment');
const User = require('../../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Booking = require('../../models/Booking');
const Application = require('../../models/Application');
const Residence = require('../../models/Residence');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/pop';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'pop-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG and PDF files are allowed.'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
}).single('proofOfPayment');

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
            .populate('student', 'firstName lastName email')
            .populate('residence', 'name')
            .populate('proofOfPayment.verifiedBy', 'firstName lastName')
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Payment.countDocuments(query);

        // Transform payments data
        const transformedPayments = payments.map(payment => ({
            id: payment.paymentId,
            student: payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : 'Unknown',
            email: payment.student?.email,
            residence: payment.residence?.name === 'St Kilda Student House' ? 'St. Kilda' :
                      payment.residence?.name === 'Belvedere Student House' ? 'Belvedere' :
                      payment.residence?.name || 'Not Assigned',
            room: payment.room || 'N/A',
            roomType: payment.roomType || '',
            payments: [
                { type: 'rent', amount: payment.rentAmount || 0 },
                { type: 'admin', amount: payment.adminFee || 0 },
                { type: 'deposit', amount: payment.deposit || 0 }
            ],
            totalAmount: payment.totalAmount,
            date: payment.date.toISOString().split('T')[0],
            method: payment.method,
            status: payment.status,
            proofOfPayment: payment.proofOfPayment ? {
                fileUrl: payment.proofOfPayment.fileUrl,
                fileName: payment.proofOfPayment.fileName,
                uploadDate: payment.proofOfPayment.uploadDate,
                verifiedBy: payment.proofOfPayment.verifiedBy ? 
                    `${payment.proofOfPayment.verifiedBy.firstName} ${payment.proofOfPayment.verifiedBy.lastName}` : null,
                verificationDate: payment.proofOfPayment.verificationDate,
                verificationNotes: payment.proofOfPayment.verificationNotes
            } : null
        }));

        res.json({
            payments: transformedPayments,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
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
        const { student, payments, date, method, residence } = req.body;

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

        // Get room and residence information
        let roomInfo = {
            room: 'Not Assigned',
            residenceId: null,
            roomType: ''
        };

        // Find the residence by name
        const residenceDoc = await Residence.findOne({
            name: residence === 'St. Kilda' ? 'St Kilda Student House' :
                  residence === 'Belvedere' ? 'Belvedere Student House' :
                  residence
        });

        if (!residenceDoc) {
            return res.status(404).json({ error: 'Residence not found' });
        }

        // Check for active booking
        const activeBooking = await Booking.findOne({
            student: studentDoc._id,
            status: { $in: ['pending', 'confirmed'] }
        }).populate('residence');

        // Check for approved application
        const approvedApplication = await Application.findOne({
            $or: [
                { student: studentDoc._id },
                { email: studentDoc.email }
            ],
            status: 'approved'
        }).populate('residence');

        // Use room info from booking or application if available
        if (activeBooking && activeBooking.room) {
            roomInfo = {
                room: activeBooking.room.roomNumber,
                residenceId: activeBooking.residence?._id || residenceDoc._id,
                roomType: activeBooking.room.type || ''
            };
        } else if (approvedApplication && approvedApplication.allocatedRoom) {
            roomInfo = {
                room: approvedApplication.allocatedRoom,
                residenceId: approvedApplication.residence?._id || residenceDoc._id,
                roomType: approvedApplication.roomType || ''
            };
        } else {
            roomInfo.residenceId = residenceDoc._id;
        }

        // Calculate total amount
        const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        // Generate payment ID
        const paymentCount = await Payment.countDocuments();
        const paymentId = `PAY${String(paymentCount + 1).padStart(3, '0')}`;

        // Create new payment with room info
        const payment = new Payment({
            paymentId,
            student: studentDoc._id,
            residence: roomInfo.residenceId,  // Set the residence reference
            room: roomInfo.room,
            roomType: roomInfo.roomType,
            rentAmount: payments.find(p => p.type === 'rent')?.amount || 0,
            adminFee: payments.find(p => p.type === 'admin')?.amount || 0,
            deposit: payments.find(p => p.type === 'deposit')?.amount || 0,
            totalAmount,
            date: date || new Date(),
            method,
            createdBy: req.user._id
        });

        await payment.save();

        // Populate the saved payment with student and residence info
        await payment.populate([
            { path: 'student', select: 'firstName lastName email' },
            { path: 'residence', select: 'name' }
        ]);

        // Transform payment for response
        const transformedPayment = {
            id: payment.paymentId,
            student: `${payment.student.firstName} ${payment.student.lastName}`,
            email: payment.student.email,
            residence: payment.residence.name === 'St Kilda Student House' ? 'St. Kilda' :
                      payment.residence.name === 'Belvedere Student House' ? 'Belvedere' :
                      payment.residence.name,
            room: payment.room,
            roomType: payment.roomType,
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

// Upload proof of payment
exports.uploadProofOfPayment = (req, res) => {
    upload(req, res, async function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        try {
            const { paymentId } = req.params;
            const payment = await Payment.findOne({ paymentId });

            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            payment.proofOfPayment = {
                fileUrl: `/uploads/pop/${req.file.filename}`,
                fileName: req.file.originalname,
                uploadDate: new Date()
            };

            await payment.save();

            res.json({
                message: 'Proof of payment uploaded successfully',
                proofOfPayment: payment.proofOfPayment
            });
        } catch (error) {
            console.error('Error in uploadProofOfPayment:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });
};

// Verify proof of payment
exports.verifyProofOfPayment = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { status, notes } = req.body;

        const payment = await Payment.findOne({ paymentId });

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        if (!payment.proofOfPayment) {
            return res.status(400).json({ error: 'No proof of payment uploaded' });
        }

        payment.status = status;
        payment.proofOfPayment.verifiedBy = req.user._id;
        payment.proofOfPayment.verificationDate = new Date();
        payment.proofOfPayment.verificationNotes = notes;
        payment.updatedBy = req.user._id;

        await payment.save();

        res.json({
            message: 'Proof of payment verified successfully',
            payment: {
                id: payment.paymentId,
                status: payment.status,
                proofOfPayment: payment.proofOfPayment
            }
        });
    } catch (error) {
        console.error('Error in verifyProofOfPayment:', error);
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