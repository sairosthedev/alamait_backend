const Payment = require('../../models/Payment');
const User = require('../../models/User');
const Booking = require('../../models/Booking');
const { Residence } = require('../../models/Residence');
const Application = require('../../models/Application');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3, s3Configs, fileFilter, fileTypes } = require('../../config/s3');
const { sendEmail } = require('../../utils/email');

// Helper function to safely format dates
const safeDateFormat = (date) => {
    if (!date) return null;
    
    try {
        // If it's already a Date object
        if (date instanceof Date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        
        // If it's a string, try to parse it
        if (typeof date === 'string') {
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
                const year = parsedDate.getFullYear();
                const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                const day = String(parsedDate.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        }
        
        // If it's a number (timestamp), try to parse it
        if (typeof date === 'number') {
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
                const year = parsedDate.getFullYear();
                const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                const day = String(parsedDate.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error formatting date:', error);
        return null;
    }
};

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

        // --- Owing Calculation using Application Lease Period ---
        let totalDue = 0;
        let unpaidMonths = [];
        let breakdown = {};
        let monthlySummary = [];
        if (approvedApplication && approvedApplication.residence && approvedApplication.residence !== 'No residence') {
            // 1. Generate all months in the lease period
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
            const months = getMonthList(new Date(approvedApplication.startDate), new Date(approvedApplication.endDate));
            // 2. Group and sum payments by month
            const paymentsByMonth = {};
            payments.forEach(p => {
                if (!p.paymentMonth) return;
                const key = p.paymentMonth.length === 7 ? p.paymentMonth : p.paymentMonth.slice(0, 7);
                if (!paymentsByMonth[key]) paymentsByMonth[key] = [];
                if (["Confirmed", "Verified"].includes(p.status)) {
                    paymentsByMonth[key].push(Number(p.totalAmount) || 0);
                }
            });
            // 3. Calculate monthly summary
            let rent = 0;
            if (typeof approvedApplication.price === 'number' && approvedApplication.price > 0) {
                rent = approvedApplication.price;
            } else if (allocatedRoomDetails && typeof allocatedRoomDetails.price === 'number' && allocatedRoomDetails.price > 0) {
                rent = allocatedRoomDetails.price;
            }
            monthlySummary = months.map(month => {
                const paid = (paymentsByMonth[month] || []).reduce((a, b) => a + b, 0);
                let status = 'Unpaid';
                let outstanding = rent - paid;
                if (paid >= rent) {
                    status = 'Paid';
                    outstanding = 0;
                } else if (paid > 0) {
                    status = 'Partially Paid';
                }
                return {
                    month,
                    expected: rent,
                    paid,
                    outstanding: outstanding > 0 ? outstanding : 0,
                    status
                };
            });
            // 4. Find unpaid months (for legacy logic)
            unpaidMonths = months.filter(m => {
                const paid = (paymentsByMonth[m] || []).reduce((a, b) => a + b, 0);
                return paid < rent;
            });
            // 4. Calculate totalDue: rentDue + adminDue + depositOwing
            let rentDue = unpaidMonths.length * rent;
            
            // Determine residence type for payment requirements
            const residenceName = approvedApplication.residence && 
                                typeof approvedApplication.residence === 'object' && 
                                approvedApplication.residence.name ? 
                                approvedApplication.residence.name.toLowerCase() : '';
            const isStKilda = residenceName.includes('st kilda');
            const isBelvedere = residenceName.includes('belvedere');
            
            let adminDue = 0;
            let depositOwing = 0;
            
            if (isStKilda) {
                // Admin fee logic for St Kilda only
                const adminFeeTotal = 20;
                const adminPaid = payments
                    .filter(p => ['Confirmed', 'Verified'].includes(p.status))
                    .reduce((sum, p) => sum + (Number(p.adminFee) || 0), 0);
                adminDue = Math.max(0, adminFeeTotal - adminPaid);
                
                // Deposit logic for St Kilda only
                const depositRequired = rent;
                const depositPaid = payments
                    .filter(p => ['Confirmed', 'Verified'].includes(p.status))
                    .reduce((sum, p) => sum + (Number(p.deposit) || 0), 0);
                depositOwing = Math.max(0, depositRequired - depositPaid);
            } else if (!isBelvedere) {
                // Other residences (not St Kilda, not Belvedere): Deposit required, no admin fee
                const depositRequired = rent;
                const depositPaid = payments
                    .filter(p => ['Confirmed', 'Verified'].includes(p.status))
                    .reduce((sum, p) => sum + (Number(p.deposit) || 0), 0);
                depositOwing = Math.max(0, depositRequired - depositPaid);
            }
            // Belvedere: No deposit, no admin fee (both remain 0)
            
            // Calculate rent due for unpaid months
            rentDue = unpaidMonths.length * rent;
            
            // Calculate total due including admin and deposit
            totalDue = rentDue + adminDue + depositOwing;
            
            // Get current month for advance payment info
            const currentDate = new Date();
            const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            const currentMonthPaid = monthlySummary.some(m => m.month === currentMonth && m.status === 'Paid');
            
            breakdown = {
                rent: rent,
                rentDue: rentDue,
                adminFee: isStKilda ? 20 : 0,
                adminDue: adminDue,
                deposit: isStKilda || (!isBelvedere) ? rent : 0,
                depositOwing: depositOwing,
                unpaidMonths: unpaidMonths.length,
                isStKilda: isStKilda,
                isBelvedere: isBelvedere,
                currentMonth: currentMonth,
                currentMonthPaid: currentMonthPaid,
                canPayAdvance: currentMonthPaid && unpaidMonths.length === 0,
                nextDueMonth: unpaidMonths.length > 0 ? unpaidMonths[0] : null
            };
        }

        // Calculate past overdue (unpaid amounts older than 3 months)
        const pastOverDue = payments.reduce((acc, payment) => {
            const paymentDate = new Date(payment.date);
            if (paymentDate <= currentDate && payment.status !== 'Confirmed') {
                return acc + payment.totalAmount;
            }
            return acc;
        }, 0);

        // Format student info
        const studentInfo = {
            name: `${student.firstName} ${student.lastName}`,
            roll: student.email.split('@')[0], // Use email prefix as student ID
            course: `Room ${roomInfo.number}${roomInfo.type ? ' (' + roomInfo.type + ')' : ''}`,
            year: student.roomValidUntil ? new Date(student.roomValidUntil).getFullYear() : new Date().getFullYear(),
            institution: "University of Zimbabwe",
            residence: roomInfo.location,
            residenceId: residenceId, // Include residence ID
            applicationCode: approvedApplication ? approvedApplication.applicationCode : null,
            totalDue: Number(totalDue).toFixed(2) || '0.00',
            allocatedRoomDetails,
            unpaidMonths, // now formatted as YYYY-MM-01
            breakdown, // add breakdown for frontend
            monthlySummary // <-- new field for frontend
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
                paymentMonth: payment.paymentMonth || (payment.startDate ? new Date(payment.startDate).toISOString().slice(0, 7) : null),
                amount: payment.totalAmount.toFixed(2) || '0.00',
                type: payment.rentAmount > 0 ? 'Rent' : (payment.deposit > 0 ? 'Initial' : 'Admin'),
                ref: payment.paymentId,
                status: payment.status || 'Pending',
                month: date.toLocaleString('en-US', { month: 'long' }),
                paymentMethod: payment.method || 'Bank Transfer',
                rent: payment.rentAmount || 0,
                admin: payment.adminFee || 0,
                deposit: payment.deposit || 0,
                startDate: safeDateFormat(date),
                proofOfPayment: payment.proofOfPayment ? {
                    fileUrl: payment.proofOfPayment.fileUrl,
                    fileName: payment.proofOfPayment.fileName,
                    uploadDate: payment.proofOfPayment.uploadDate,
                    status: payment.proofOfPayment.status,
                    studentComment: payment.proofOfPayment.studentComment,
                    verificationNotes: payment.proofOfPayment.verificationNotes
                } : null
            };
        });

        res.json({
            studentInfo,
            paymentHistory,
            monthlySummary // <-- new field for frontend
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

            // --- S3 Upload Logic (like lease upload) ---
            const s3Key = `pop/${req.user._id}_${Date.now()}_${req.file.originalname}`;
            const s3UploadParams = {
                Bucket: s3Configs.proofOfPayment.bucket,
                Key: s3Key,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
                ACL: s3Configs.proofOfPayment.acl,
                Metadata: {
                    fieldName: req.file.fieldname,
                    uploadedBy: req.user._id.toString(),
                    uploadDate: new Date().toISOString()
                }
            };
            const s3Result = await s3.upload(s3UploadParams).promise();
            // --- End S3 Upload Logic ---

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
                fileUrl: s3Result.Location, // S3 URL
                fileName: req.file.originalname,
                uploadDate: new Date(),
                status: 'Under Review',
                studentComment: req.body.comment || ''
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

// Remove or disable the uploadNewProofOfPayment export and any code that creates new Payment records for students 