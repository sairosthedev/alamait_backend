const Payment = require('../../models/Payment');
const User = require('../../models/User');
const Booking = require('../../models/Booking');
const Residence = require('../../models/Residence');
const Application = require('../../models/Application');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3, s3Configs, fileFilter, fileTypes } = require('../../config/s3');

// Configure multer for S3 file uploads
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: s3Configs.proofOfPayment.bucket,
        acl: s3Configs.proofOfPayment.acl,
        key: s3Configs.proofOfPayment.key
    }),
    fileFilter: fileFilter([...fileTypes.images, 'application/pdf']),
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
        let allocatedRoomDetails = null;
        let residenceId = null; // Track residence ID

        // First check for approved application
        if (approvedApplication) {
            // If we have an approved application with allocated room
            if (approvedApplication.allocatedRoom) {
                // Find the residence that contains this room
                const residence = await Residence.findOne({
                    'rooms.roomNumber': approvedApplication.allocatedRoom
                });
                if (residence) {
                    const room = residence.rooms.find(r => r.roomNumber === approvedApplication.allocatedRoom);
                    allocatedRoomDetails = room ? { ...room.toObject?.() || room } : null;
                    roomInfo = {
                        number: approvedApplication.allocatedRoom,
                        type: approvedApplication.roomType || (room ? room.type : 'Standard'),
                        location: residence.name
                    };
                    residenceId = residence._id; // Set residence ID
                    console.log('Using room info from approved application with residence lookup:', roomInfo);
                } else {
                    roomInfo = {
                        number: approvedApplication.allocatedRoom,
                        type: approvedApplication.roomType || 'Standard',
                        location: 'Not Assigned'
                    };
                    allocatedRoomDetails = null;
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
                allocatedRoomDetails = null;
                // Try to get residence ID from the application's residence field
                if (approvedApplication.residence && typeof approvedApplication.residence === 'object') {
                    residenceId = approvedApplication.residence._id;
                }
                console.log('Using residence from approved application (no room allocated yet):', roomInfo);
            }
        }
        // Then check for active booking if no approved application
        else if (activeBooking && activeBooking.room && activeBooking.room.roomNumber) {
            // Find the residence and room
            const residence = await Residence.findOne({
                'rooms.roomNumber': activeBooking.room.roomNumber
            });
            let room = null;
            if (residence) {
                room = residence.rooms.find(r => r.roomNumber === activeBooking.room.roomNumber);
                residenceId = residence._id; // Set residence ID
            }
            allocatedRoomDetails = room ? { ...room.toObject?.() || room } : null;
            roomInfo = {
                number: activeBooking.room.roomNumber,
                type: activeBooking.room.type || (room ? room.type : ''),
                location: activeBooking.residence?.name || residence?.name || 'Not Assigned'
            };
            console.log('Using room info from active booking:', roomInfo);
        }
        // Finally check user model if neither exists
        else if (student.currentRoom) {
            let residenceName = 'Not Assigned';
            let room = null;
            if (student.residence?.name) {
                residenceName = student.residence.name;
                residenceId = student.residence._id; // Set residence ID from student's residence
            } else {
                try {
                    const residence = await Residence.findOne({
                        'rooms.roomNumber': student.currentRoom
                    });
                    residenceName = residence ? residence.name : 'Not Assigned';
                    if (residence) {
                        room = residence.rooms.find(r => r.roomNumber === student.currentRoom);
                        residenceId = residence._id; // Set residence ID
                    }
                } catch (err) {
                    console.error('Error finding residence:', err);
                }
            }
            allocatedRoomDetails = room ? { ...room.toObject?.() || room } : null;
            roomInfo = {
                number: student.currentRoom,
                type: room ? room.type : '',
                location: residenceName
            };
            console.log('Using room info from user model:', roomInfo);
        } else {
            allocatedRoomDetails = null;
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
            residenceId: residenceId, // Include residence ID
            currentDue: currentMonthPaid.toFixed(2) || '0.00',
            pastDue: pastDue.toFixed(2) || '0.00',
            pastOverDue: pastOverDue.toFixed(2) || '0.00',
            applicationCode: approvedApplication ? approvedApplication.applicationCode : null,
            totalDue: (currentMonthPaid + pastDue + pastOverDue).toFixed(2) || '0.00',
            allocatedRoomDetails
        };

        // Calculate the next unpaid month and set currentDue
        let currentDue = 0;
        if (allocatedRoomDetails && allocatedRoomDetails.price) {
            // Find all months with confirmed rent payments
            const paidMonths = payments
                .filter(p => p.status === 'Confirmed' && p.rentAmount > 0)
                .map(p => {
                    const d = new Date(p.date);
                    return d.getFullYear() + '-' + (d.getMonth() + 1); // e.g., '2025-7'
                });
            // Find the latest paid month
            let nextDueMonth;
            if (paidMonths.length > 0) {
                // Get the latest paid month
                const latestPaid = payments
                    .filter(p => p.status === 'Confirmed' && p.rentAmount > 0)
                    .map(p => new Date(p.date))
                    .sort((a, b) => b - a)[0];
                nextDueMonth = new Date(latestPaid.getFullYear(), latestPaid.getMonth() + 1, 1);
            } else {
                // If never paid, due is current month
                nextDueMonth = new Date(currentYear, currentMonth, 1);
            }
            // Check if payment exists for nextDueMonth
            const hasPaidNextMonth = payments.some(p => {
                const d = new Date(p.date);
                return (
                    p.status === 'Confirmed' &&
                    d.getMonth() === nextDueMonth.getMonth() &&
                    d.getFullYear() === nextDueMonth.getFullYear() &&
                    p.rentAmount > 0
                );
            });
            if (!hasPaidNextMonth) {
                currentDue = allocatedRoomDetails.price;
            }
        }
        studentInfo.currentDue = currentDue.toFixed(2);

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

            // --- Prevent Overpayment Logic ---
            // Find all payments for this student
            const allPayments = await Payment.find({ student: req.user._id });
            // Find all months with confirmed rent payments
            const paidMonths = allPayments
                .filter(p => p.status === 'Confirmed' && p.rentAmount > 0)
                .map(p => new Date(p.date));
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth();
            const currentYear = currentDate.getFullYear();
            let nextDueMonth;
            if (paidMonths.length > 0) {
                const latestPaid = new Date(Math.max(...paidMonths));
                nextDueMonth = new Date(latestPaid.getFullYear(), latestPaid.getMonth() + 1, 1);
            } else {
                nextDueMonth = new Date(currentYear, currentMonth, 1);
            }
            // Check if payment already exists for nextDueMonth
            const hasPaidNextMonth = allPayments.some(p => {
                const d = new Date(p.date);
                return (
                    p.status === 'Confirmed' &&
                    d.getMonth() === nextDueMonth.getMonth() &&
                    d.getFullYear() === nextDueMonth.getFullYear() &&
                    p.rentAmount > 0
                );
            });
            if (hasPaidNextMonth) {
                return res.status(400).json({ error: 'Rent for the next due month has already been paid.' });
            }
            // --- End Prevent Overpayment Logic ---

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

            // Update payment with proof of payment details (S3 URL)
            payment.proofOfPayment = {
                fileUrl: req.file.location, // S3 URL
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

            // --- Prevent Overpayment Logic ---
            // Find all payments for this student
            const allPayments = await Payment.find({ student: req.user._id });
            // Find all months with confirmed rent payments
            const paidMonths = allPayments
                .filter(p => p.status === 'Confirmed' && p.rentAmount > 0)
                .map(p => new Date(p.date));
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth();
            const currentYear = currentDate.getFullYear();
            let nextDueMonth;
            if (paidMonths.length > 0) {
                const latestPaid = new Date(Math.max(...paidMonths));
                nextDueMonth = new Date(latestPaid.getFullYear(), latestPaid.getMonth() + 1, 1);
            } else {
                nextDueMonth = new Date(currentYear, currentMonth, 1);
            }
            // Check if payment already exists for nextDueMonth
            const hasPaidNextMonth = allPayments.some(p => {
                const d = new Date(p.date);
                return (
                    p.status === 'Confirmed' &&
                    d.getMonth() === nextDueMonth.getMonth() &&
                    d.getFullYear() === nextDueMonth.getFullYear() &&
                    p.rentAmount > 0
                );
            });
            if (hasPaidNextMonth) {
                return res.status(400).json({ error: 'Rent for the next due month has already been paid.' });
            }
            // --- End Prevent Overpayment Logic ---

            // Generate a unique payment ID
            const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Get payment amounts from request
            const rentAmount = parseFloat(req.body.rentAmount) || 0;
            const adminFee = parseFloat(req.body.adminFee) || 0;
            const deposit = parseFloat(req.body.deposit) || 0;
            const totalAmount = rentAmount + adminFee + deposit;
            const { paymentMonth } = req.body;

            // Validate paymentMonth
            if (!paymentMonth || !/^\d{4}-\d{2}$/.test(paymentMonth)) {
                return res.status(400).json({ error: 'Payment month is required in YYYY-MM format.' });
            }

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
                paymentMonth,
                date: new Date(),
                status: 'Pending',
                method: 'Bank Transfer',
                proofOfPayment: {
                    fileUrl: req.file.location, // S3 URL
                    fileName: req.file.originalname,
                    uploadDate: new Date(),
                    verificationStatus: 'Pending'
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
                    paymentMonth: payment.paymentMonth,
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