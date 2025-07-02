const Payment = require('../../models/Payment');
const User = require('../../models/User');
const Booking = require('../../models/Booking');
const Residence = require('../../models/Residence');
const Application = require('../../models/Application');
const multer = require('multer');
const { s3, s3Configs, fileFilter, fileTypes } = require('../../config/s3');

// Configure multer for temporary file storage (we'll upload to S3 manually)
const upload = multer({
    storage: multer.memoryStorage(), // Store in memory temporarily
    fileFilter: fileFilter([...fileTypes.images, 'application/pdf']),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1,
        fieldSize: 1024 * 1024 // 1MB for other fields
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

        // --- Owing Calculation using Application Lease Period ---
        let totalDue = 0;
        let unpaidMonths = [];
        if (approvedApplication && approvedApplication.residence && approvedApplication.residence !== 'No residence') {
            // 1. Generate all months in the lease period
            function getMonthList(startDate, endDate) {
                const months = [];
                let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
                while (current <= end) {
                    // Use YYYY-MM-01 for valid date parsing
                    months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-01`);
                    current.setMonth(current.getMonth() + 1);
                }
                return months;
            }
            const months = getMonthList(new Date(approvedApplication.startDate), new Date(approvedApplication.endDate));
            // 2. Find all paid months
            const paidMonths = payments
                .filter(p => ['Confirmed', 'Verified'].includes(p.status))
                .map(p => {
                    // Accept both YYYY-MM and YYYY-MM-01
                    if (p.paymentMonth && /^\d{4}-\d{2}-\d{2}$/.test(p.paymentMonth)) return p.paymentMonth;
                    if (p.paymentMonth && /^\d{4}-\d{2}$/.test(p.paymentMonth)) return p.paymentMonth + '-01';
                    return null;
                })
                .filter(Boolean);
            // 3. Find unpaid months
            unpaidMonths = months.filter(m => !paidMonths.includes(m));
            // 4. Calculate totalDue: rentDue + adminDue + depositOwing
            let rent = 0;
            if (typeof approvedApplication.price === 'number' && approvedApplication.price > 0) {
                rent = approvedApplication.price;
            } else if (allocatedRoomDetails && typeof allocatedRoomDetails.price === 'number' && allocatedRoomDetails.price > 0) {
                rent = allocatedRoomDetails.price;
            }
            const adminFee = 20;
            const deposit = rent;
            // Check if admin fee has been paid (assume paid if any payment has adminFee > 0 and status confirmed)
            const adminPaid = payments.some(p => ['Confirmed', 'Verified'].includes(p.status) && p.adminFee > 0);
            const adminDue = adminPaid ? 0 : adminFee;
            // Calculate deposit owing: deposit minus sum of deposit paid in confirmed/verified payments
            const depositPaid = payments
                .filter(p => ['Confirmed', 'Verified'].includes(p.status))
                .reduce((sum, p) => sum + (Number(p.deposit) || 0), 0);
            const depositOwing = Math.max(0, deposit - depositPaid);
            const rentDue = unpaidMonths.length * rent;
            totalDue = rentDue + adminDue + depositOwing;
        }

        // Calculate past overdue (unpaid amounts older than 3 months)
        const pastOverDue = payments.reduce((acc, payment) => {
            const paymentDate = new Date(payment.date);
            if (paymentDate <= currentDate && payment.status !== 'Confirmed') {
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
            applicationCode: approvedApplication ? approvedApplication.applicationCode : null,
            totalDue: Number(totalDue).toFixed(2) || '0.00',
            allocatedRoomDetails,
            unpaidMonths // now formatted as YYYY-MM-01
        };

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
    console.log('=== Starting uploadNewProofOfPayment ===');
    console.log('Request body:', req.body);
    
    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
        console.error('Upload timeout - request took too long');
        if (!res.headersSent) {
            res.status(408).json({ error: 'Upload timeout - request took too long' });
        }
    }, 45000); // 45 second timeout
    
    upload(req, res, async function(err) {
        console.log('=== Inside upload callback ===');
        
        // Clear timeout since we got a response
        clearTimeout(timeout);
        
        if (err) {
            console.error('Upload error:', err);
            if (!res.headersSent) {
                return res.status(400).json({ error: err.message });
            }
            return;
        }

        try {
            console.log('Processing file upload...');
            
            if (!req.file) {
                console.log('No file uploaded');
                if (!res.headersSent) {
                    return res.status(400).json({ error: 'No file uploaded' });
                }
                return;
            }

            console.log('File received:', {
                originalname: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            });

            // Manually upload to S3
            console.log('Uploading file to S3...');
            const s3Key = `pop/${req.user._id}_${Date.now()}_${req.file.originalname}`;
            
            const s3UploadParams = {
                Bucket: s3Configs.proofOfPayment.bucket,
                Key: s3Key,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
                ACL: s3Configs.proofOfPayment.acl,
                Metadata: {
                    fieldName: req.file.fieldname,
                    uploadedBy: req.user._id.toString(), // Convert ObjectId to string
                    uploadDate: new Date().toISOString()
                }
            };

            const s3Result = await s3.upload(s3UploadParams).promise();
            console.log('File uploaded successfully to S3:', s3Result.Location);

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

            console.log('Residence found:', residenceRef.name);

            // --- Prevent Overpayment Logic (Lease Month Enforcement) ---
            // 1. Fetch the student's latest approved/active application
            const application = await Application.findOne({
                $or: [
                    { student: req.user._id },
                    { email: req.user.email }
                ],
                status: { $in: ['approved', 'active'] }
            }).sort({ updatedAt: -1 });

            if (!application) {
                return res.status(400).json({ error: 'No active application found.' });
            }

            // 2. Generate all months in the lease period
            function getMonthList(startDate, endDate) {
                const months = [];
                let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
                while (current <= end) {
                    months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
                    current.setMonth(current.getMonth() + 1);
                }
                return months;
            }
            const months = getMonthList(new Date(application.startDate), new Date(application.endDate));

            // 3. Find all paid months
            const payments = await Payment.find({
                student: req.user._id,
                status: { $in: ['Confirmed', 'Verified'] }
            });
            const paidMonths = payments.map(p => p.paymentMonth);

            // 4. Find unpaid months
            const unpaidMonths = months.filter(m => !paidMonths.includes(m));

            // 5. Only allow payment for the oldest unpaid month
            let requestedMonth = req.body.paymentMonth;
            if (!requestedMonth) {
                // Auto-generate payment month if not provided
                const currentDate = new Date();
                requestedMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            }
            if (unpaidMonths.length > 0 && requestedMonth !== unpaidMonths[0]) {
                return res.status(400).json({
                    error: `You must pay for the oldest unpaid month first: ${unpaidMonths[0]}`,
                    unpaidMonths
                });
            }
            // --- End Prevent Overpayment Logic (Lease Month Enforcement) ---

            console.log('Creating new payment record...');

            // Generate a unique payment ID
            const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Get payment amounts from request
            const rentAmount = parseFloat(req.body.rentAmount) || 0;
            const adminFee = parseFloat(req.body.adminFee) || 0;
            const deposit = parseFloat(req.body.deposit) || 0;
            const totalAmount = rentAmount + adminFee + deposit;
            
            // Auto-generate payment month if not provided
            let paymentMonth = req.body.paymentMonth;
            if (!paymentMonth) {
                const currentDate = new Date();
                const year = currentDate.getFullYear();
                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                paymentMonth = `${year}-${month}`;
                console.log('Auto-generated payment month:', paymentMonth);
            }

            console.log('Payment amounts:', { rentAmount, adminFee, deposit, totalAmount, paymentMonth });

            // Validate paymentMonth format
            if (!/^\d{4}-\d{2}$/.test(paymentMonth)) {
                console.log('Invalid payment month format:', paymentMonth);
                return res.status(400).json({ error: 'Payment month must be in YYYY-MM format.' });
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
                createdBy: req.user._id,
                proofOfPayment: {
                    fileUrl: s3Result.Location, // Use the S3 URL from manual upload
                    fileName: req.file.originalname,
                    uploadDate: new Date(),
                    fileSize: req.file.size,
                    fileType: req.file.mimetype
                }
            });

            await payment.save();
            console.log('Payment record created successfully:', payment._id);

            res.status(200).json({
                message: 'Proof of payment uploaded successfully',
                payment: {
                    id: payment._id,
                    paymentId: payment.paymentId,
                    totalAmount: payment.totalAmount,
                    status: payment.status,
                    proofOfPayment: payment.proofOfPayment
                }
            });

        } catch (error) {
            console.error('Error in uploadNewProofOfPayment:', error);
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: 'Failed to upload proof of payment',
                    message: error.message 
                });
            }
        }
    });
}; 