const Payment = require('../../models/Payment');
const User = require('../../models/User');
const Booking = require('../../models/Booking');
const Residence = require('../../models/Residence');
const Application = require('../../models/Application');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use the uploads/pop directory which is created at server startup
        const uploadDir = path.join(process.cwd(), 'uploads/pop');
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

exports.getPaymentHistory = async (req, res) => {
    try {
        console.log('Beginning getPaymentHistory for user ID:', req.user._id);
        
        // Get student info
        const student = await User.findById(req.user._id)
            .populate('residence', 'name');  // Populate the residence reference
        console.log('Found student:', {
            id: student._id,
            name: `${student.firstName} ${student.lastName}`,
            email: student.email,
            currentRoom: student.currentRoom,
            residence: student.residence?.name
        });
        
        // Find approved application (either by student ID or email)
        const approvedApplication = await Application.findOne({
            $or: [
                { student: req.user._id },
                { email: student.email }
            ],
            status: 'approved'
        })
        .populate('residence', 'name')  // Ensure residence is populated
        .lean();
        
        console.log('Approved application found:', approvedApplication ? {
            id: approvedApplication._id,
            code: approvedApplication.applicationCode,
            allocatedRoom: approvedApplication.allocatedRoom,
            residence: approvedApplication.residence?.name || 'No residence'
        } : 'None');
        
        // Find active booking with residence populated for more details
        const activeBooking = await Booking.findOne({ 
            student: req.user._id,
            status: { $in: ['pending', 'confirmed'] }
        })
        .populate('residence', 'name')  // Ensure residence is populated
        .lean();
        
        // Get all payments
        const payments = await Payment.find({ student: req.user._id })
            .sort({ date: -1 });

        // Calculate balances
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        // Get confirmed payments for current month
        const currentMonthPayments = payments.filter(payment => {
            const paymentDate = new Date(payment.date);
            return payment.status === 'Confirmed' && 
                   paymentDate.getMonth() === currentMonth &&
                   paymentDate.getFullYear() === currentYear;
        });

        // Calculate current month's total confirmed payments
        const currentMonthPaid = currentMonthPayments.reduce((sum, payment) => sum + payment.totalAmount, 0);

        // Calculate past due (unpaid amounts from previous months)
        const threeMonthsAgo = new Date(currentDate.setMonth(currentDate.getMonth() - 3));
        const pastDue = payments.reduce((acc, payment) => {
            const paymentDate = new Date(payment.date);
            if (paymentDate > threeMonthsAgo && 
                paymentDate < new Date(currentYear, currentMonth, 1) && 
                payment.status !== 'Confirmed') {
                return acc + payment.totalAmount;
            }
            return acc;
        }, 0);

        // Calculate past overdue (unpaid amounts older than 3 months)
        const pastOverDue = payments.reduce((acc, payment) => {
            const paymentDate = new Date(payment.date);
            if (paymentDate <= threeMonthsAgo && payment.status !== 'Confirmed') {
                return acc + payment.totalAmount;
            }
            return acc;
        }, 0);

        // Get room and residence information with priority order:
        // 1. Approved Application
        // 2. Active Booking
        // 3. User's current room
        let roomInfo = {
            number: 'Not Assigned',
            type: '',
            location: 'Not Assigned'
        };

        // First check for approved application
        if (approvedApplication) {
            // If we have an approved application with allocated room
            if (approvedApplication.allocatedRoom) {
                // Find the residence that contains this room
                const residence = await Residence.findOne({
                    'rooms.roomNumber': approvedApplication.allocatedRoom
                });
                
                if (residence) {
                    roomInfo = {
                        number: approvedApplication.allocatedRoom,
                        type: approvedApplication.roomType || 'Standard',
                        location: residence.name
                    };
                    console.log('Using room info from approved application with residence lookup:', roomInfo);
                } else {
                    // If residence not found, still use the room info
                roomInfo = {
                    number: approvedApplication.allocatedRoom,
                        type: approvedApplication.roomType || 'Standard',
                        location: 'Not Assigned'
                };
                    console.log('Using room info from approved application (residence not found):', roomInfo);
                }
            }
            // If we have residence but no allocated room yet
            else if (approvedApplication.residence && approvedApplication.residence !== 'No residence') {
                roomInfo = {
                    number: 'Not Assigned',
                    type: approvedApplication.roomType || 'Standard',
                    location: approvedApplication.residence
                };
                console.log('Using residence from approved application (no room allocated yet):', roomInfo);
            }
        }
        // Then check for active booking if no approved application
        else if (activeBooking && activeBooking.room && activeBooking.room.roomNumber) {
            roomInfo = {
                number: activeBooking.room.roomNumber,
                type: activeBooking.room.type || '',
                location: activeBooking.residence?.name || 'Not Assigned'
            };
            console.log('Using room info from active booking:', roomInfo);
        }
        // Finally check user model if neither exists
        else if (student.currentRoom) {
            let residenceName = 'Not Assigned';
            if (student.residence?.name) {
                residenceName = student.residence.name;
            } else {
                try {
                    const residence = await Residence.findOne({
                        'rooms.roomNumber': student.currentRoom
                    });
                    residenceName = residence ? residence.name : 'Not Assigned';
                } catch (err) {
                    console.error('Error finding residence:', err);
                }
            }
            
            roomInfo = {
                number: student.currentRoom,
                type: '',
                location: residenceName
            };
            console.log('Using room info from user model:', roomInfo);
        } else {
            console.log('No room information found in any source');
        }

        // Format student info
        const studentInfo = {
            name: `${student.firstName} ${student.lastName}`,
            roll: student.email.split('@')[0], // Use email prefix as student ID
            course: `Room ${roomInfo.number}${roomInfo.type ? ' (' + roomInfo.type + ')' : ''}`,
            year: student.roomValidUntil ? new Date(student.roomValidUntil).getFullYear() : null,
            institution: "University of Zimbabwe",
            residence: roomInfo.location,
            currentDue: currentMonthPaid.toFixed(2) || '0.00',
            pastDue: pastDue.toFixed(2) || '0.00',
            pastOverDue: pastOverDue.toFixed(2) || '0.00',
            applicationCode: approvedApplication ? approvedApplication.applicationCode : null,
            totalDue: (currentMonthPaid + pastDue + pastOverDue).toFixed(2) || '0.00'
        };

        // Debug logs
        console.log('Room Info:', {
            number: roomInfo.number,
            type: roomInfo.type,
            location: roomInfo.location
        });
        console.log('Student Info being sent:', {
            course: studentInfo.course,
            residence: studentInfo.residence,
            roomInfo: roomInfo
        });

        console.log('Sending student info:', {
            name: studentInfo.name,
            roll: studentInfo.roll,
            room: studentInfo.course,
            residence: studentInfo.residence,
            applicationCode: studentInfo.applicationCode,
            currentDue: studentInfo.currentDue,
            pastDue: studentInfo.pastDue,
            pastOverDue: studentInfo.pastOverDue,
            totalDue: studentInfo.totalDue
        });

        // Format payment history
        const paymentHistory = payments.map(payment => {
            const date = new Date(payment.date);
            return {
                id: payment.paymentId,
                date: date.toLocaleDateString('en-US', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: '2-digit' 
                }),
                amount: payment.totalAmount.toFixed(2) || '0.00',
                type: payment.rentAmount > 0 ? 'Rent' : (payment.deposit > 0 ? 'Initial' : 'Admin'),
                ref: payment.paymentId,
                status: payment.status || 'Pending',
                month: date.toLocaleString('en-US', { month: 'long' }),
                paymentMethod: payment.method || 'Bank Transfer',
                rent: payment.rentAmount || 0,
                admin: payment.adminFee || 0,
                deposit: payment.deposit || 0,
                startDate: date.toISOString().split('T')[0],
                proofOfPayment: payment.proofOfPayment ? {
                    fileUrl: payment.proofOfPayment.fileUrl,
                    fileName: payment.proofOfPayment.fileName,
                    uploadDate: payment.proofOfPayment.uploadDate,
                    verificationStatus: payment.status,
                    verificationNotes: payment.proofOfPayment.verificationNotes
                } : null
            };
        });

        res.json({
            studentInfo,
            paymentHistory
        });
    } catch (error) {
        console.error('Error in getPaymentHistory:', error);
        res.status(500).json({ error: 'Error retrieving payment history' });
    }
};

// Upload proof of payment
exports.uploadProofOfPayment = (req, res) => {
    upload(req, res, async function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        try {
            const payment = await Payment.findOne({
                paymentId: req.params.paymentId,
                student: req.user._id
            });

            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            // Get payment amounts from the request body
            const rentAmount = parseFloat(req.body.rentAmount) || payment.rentAmount || 0;
            const adminFee = parseFloat(req.body.adminFee) || payment.adminFee || 0;
            const deposit = parseFloat(req.body.deposit) || payment.deposit || 0;
            const totalAmount = rentAmount + adminFee + deposit;

            // Update payment amounts
            payment.rentAmount = rentAmount;
            payment.adminFee = adminFee;
            payment.deposit = deposit;
            payment.totalAmount = totalAmount;

            // Update payment with proof of payment details
            payment.proofOfPayment = {
                fileUrl: `/uploads/pop/${req.file.filename}`,
                fileName: req.file.originalname,
                uploadDate: new Date(),
                verificationStatus: 'Pending'
            };

            await payment.save();

            res.json({
                message: 'Proof of payment uploaded successfully',
                payment: {
                    id: payment.paymentId,
                    status: payment.status,
                    rentAmount,
                    adminFee,
                    deposit,
                    totalAmount
                },
                proofOfPayment: payment.proofOfPayment
            });
        } catch (error) {
            console.error('Error uploading proof of payment:', error);
            res.status(500).json({ error: 'Error uploading proof of payment' });
        }
    });
};

// Upload new proof of payment without a specific payment ID
exports.uploadNewProofOfPayment = (req, res) => {
    upload(req, res, async function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        try {
            console.log('Uploading new proof of payment without specific payment ID');
            
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            // Get student info including room
            const student = await User.findById(req.user._id)
                .populate('residence');
            
            console.log('Student info:', {
                id: student._id,
                currentRoom: student.currentRoom,
                residence: student.residence?.name
            });

            // First check for approved application
            const approvedApplication = await Application.findOne({
                $or: [
                    { student: req.user._id },
                    { email: student.email }
                ],
                status: 'approved'
            }).populate('residence');

            console.log('Approved application:', approvedApplication ? {
                id: approvedApplication._id,
                allocatedRoom: approvedApplication.allocatedRoom,
                residence: approvedApplication.residence?.name
            } : 'None');

            // Get residence information from various sources
            let residenceRef = null;
            let roomInfo = {};

            // First check approved application
            if (approvedApplication && approvedApplication.allocatedRoom) {
                // Find the residence that contains this room
                const residence = await Residence.findOne({
                    'rooms.roomNumber': approvedApplication.allocatedRoom
                });
                
                if (residence) {
                    residenceRef = residence;
                    roomInfo = {
                        number: approvedApplication.allocatedRoom,
                        type: approvedApplication.roomType || 'Standard'
                    };
                    console.log('Using residence from approved application room lookup:', {
                        residence: residenceRef.name,
                        room: roomInfo
                    });
                }
            }
            // Then check current room
            else if (student.currentRoom) {
                const residence = await Residence.findOne({
                    'rooms.roomNumber': student.currentRoom
                });
                if (residence) {
                    residenceRef = residence;
                    const room = residence.rooms.find(r => r.roomNumber === student.currentRoom);
                    roomInfo = {
                        number: student.currentRoom,
                        type: room?.type || 'Standard'
                    };
                    console.log('Using residence from current room:', {
                        residence: residenceRef.name,
                        room: roomInfo
                    });
                }
            }
            // Finally check residence from request body
            else if (req.body.residence && req.body.residence !== 'Not Assigned') {
                residenceRef = await Residence.findOne({ name: req.body.residence });
                if (residenceRef) {
                    roomInfo = {
                        number: 'Not Assigned',
                        type: 'Standard'
                    };
                    console.log('Using residence from request body:', {
                        residence: residenceRef.name,
                        room: roomInfo
                    });
                }
            }

            // If no residence found, return error
            if (!residenceRef) {
                console.log('No residence found in any source');
                return res.status(400).json({ error: 'No residence found. Please ensure you have an approved application or assigned room.' });
            }

            // Generate a unique payment ID
            const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Get payment amounts from request
            const rentAmount = parseFloat(req.body.rentAmount) || 0;
            const adminFee = parseFloat(req.body.adminFee) || 0;
            const deposit = parseFloat(req.body.deposit) || 0;
            const totalAmount = rentAmount + adminFee + deposit;

            // Create a new payment record
            const payment = new Payment({
                paymentId,
                student: req.user._id,
                residence: residenceRef._id,
                room: roomInfo.number,
                roomType: roomInfo.type,
                rentAmount,
                adminFee,
                deposit,
                totalAmount,
                date: new Date(),
                status: 'Pending',
                method: 'Bank Transfer',
                proofOfPayment: {
                    fileUrl: `/uploads/pop/${req.file.filename}`,
                    fileName: req.file.originalname,
                    uploadDate: new Date()
                },
                createdBy: req.user._id
            });

            await payment.save();

            // Populate the payment with residence info for response
            await payment.populate([
                { path: 'residence', select: 'name' },
                { path: 'student', select: 'firstName lastName email' }
            ]);

            console.log('New payment record created:', {
                id: payment.paymentId,
                student: `${payment.student.firstName} ${payment.student.lastName}`,
                residence: payment.residence?.name || 'Not Assigned',
                room: payment.room,
                totalAmount: payment.totalAmount
            });

            res.status(200).json({
                message: 'Proof of payment uploaded successfully',
                payment: {
                    id: payment.paymentId,
                    student: `${payment.student.firstName} ${payment.student.lastName}`,
                    residence: payment.residence?.name === 'St Kilda Student House' ? 'St. Kilda' :
                             payment.residence?.name === 'Belvedere Student House' ? 'Belvedere' :
                             payment.residence?.name || 'Not Assigned',
                    room: payment.room,
                    roomType: payment.roomType,
                    rentAmount: payment.rentAmount,
                    adminFee: payment.adminFee,
                    deposit: payment.deposit,
                    totalAmount: payment.totalAmount,
                    date: payment.date,
                    status: payment.status,
                    proofOfPayment: payment.proofOfPayment
                }
            });
        } catch (error) {
            console.error('Error uploading proof of payment:', error);
            res.status(500).json({ error: 'Error uploading proof of payment' });
        }
    });
}; 