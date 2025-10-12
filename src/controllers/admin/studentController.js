const User = require('../../models/User');
const Booking = require('../../models/Booking');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../../utils/email');
const path = require('path');
const fs = require('fs');
const { Residence } = require('../../models/Residence');
const { getLeaseTemplateAttachment } = require('../../services/leaseTemplateService');
const ExpiredStudent = require('../../models/ExpiredStudent');
const Application = require('../../models/Application');
const Payment = require('../../models/Payment');
const { createAuditLog } = require('../../utils/auditLogger');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3, s3Configs, fileFilter, fileTypes } = require('../../config/s3');
const AuditLog = require('../../models/AuditLog');
// const Lease = require('../../models/Lease'); // Removed - leases collection is only for student-uploaded leases
const bcrypt = require('bcryptjs');
const { createDebtorForStudent } = require('../../services/debtorService');
const DebtorTransactionSyncService = require('../../services/debtorTransactionSyncService');
const DebtorDataSyncService = require('../../services/debtorDataSyncService');
const { backfillTransactionsForDebtor } = require('../../services/transactionBackfillService');
const ExcelJS = require('exceljs');
const StudentDeletionService = require('../../services/studentDeletionService');

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

// Get all students with pagination and filters
exports.getAllStudents = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status } = req.query;
        const query = { role: 'student' };

        // Add filters
        if (status) {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const students = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.json({
            students,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error in getAllStudents:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get student by ID
exports.getStudentById = async (req, res) => {
    try {
        const { studentId } = req.params;
        
        const student = await User.findById(studentId)
            .select('-password')
            .populate('residence', 'name address')
            .populate('currentBooking', 'totalAmount paymentStatus status');
            
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        res.json({ student });
    } catch (error) {
        console.error('Error in getStudentById:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create new student
exports.createStudent = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, firstName, lastName, phone, status, emergencyContact, residenceId } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);

        const student = new User({
            email,
            firstName,
            lastName,
            phone,
            password: tempPassword,
            status: status || 'active',
            emergencyContact,
            role: 'student',
            isVerified: true,
            residence: residenceId
        });

        await student.save();

        res.status(201).json({
            message: 'Student created successfully',
            student: {
                id: student._id,
                email: student.email,
                firstName: student.firstName,
                lastName: student.lastName,
                status: student.status
            },
            temporaryPassword: tempPassword
        });
    } catch (error) {
        console.error('Error in createStudent:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update student
exports.updateStudent = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { studentId } = req.params;
        const { firstName, lastName, phone, status, emergencyContact, residenceId } = req.body;

        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Update fields
        if (firstName) student.firstName = firstName;
        if (lastName) student.lastName = lastName;
        if (phone) student.phone = phone;
        if (status) student.status = status;
        if (emergencyContact) student.emergencyContact = emergencyContact;
        if (residenceId) student.residence = residenceId;

        await student.save();

        res.json({
            message: 'Student updated successfully',
            student: {
                id: student._id,
                email: student.email,
                firstName: student.firstName,
                lastName: student.lastName,
                status: student.status
            }
        });
    } catch (error) {
        console.error('Error in updateStudent:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get student details by ID
exports.getStudentById = async (req, res) => {
    try {
        const student = await User.findOne({
            _id: req.params.studentId,
            role: 'student'
        }).select('-password');

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        res.json(student);
    } catch (error) {
        console.error('Error in getStudentById:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create new student
exports.createStudent = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, firstName, lastName, phone, status, emergencyContact } = req.body;
        const { residenceId } = req.params;

        // Validate residence ID
        if (!residenceId) {
            return res.status(400).json({ error: 'Residence ID is required' });
        }

        // Check if user exists
        let student = await User.findOne({ email });
        if (student) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create new student
        student = new User({
            email,
            firstName,
            lastName,
            phone,
            status: status || 'pending',
            emergencyContact,
            role: 'student',
            isVerified: false,
            residence: residenceId
        });

        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-8);
        student.password = tempPassword; // Let the pre-save hook hash it

        await student.save();

        // Automatically create debtor account for the new student
        try {
            // Get residence details for proper debtor creation
            const residence = await Residence.findById(residenceId);
            if (!residence) {
                throw new Error('Residence not found for debtor creation');
            }

            // Find a default room to get pricing information
            let defaultRoom = null;
            let roomPrice = 0;
            if (residence.rooms && residence.rooms.length > 0) {
                defaultRoom = residence.rooms[0];
                roomPrice = defaultRoom.price || 150; // Default price if not set
            }

            // Set default lease dates (6 months from now)
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 6);

            const debtorOptions = {
                residenceId: residenceId,
                roomNumber: defaultRoom ? defaultRoom.roomNumber : 'TBD',
                createdBy: req.user._id,
                startDate: startDate,
                endDate: endDate,
                roomPrice: roomPrice,
                // Note: No application context since this is direct student creation
                notes: 'Created directly by admin - no application context'
            };

            await createDebtorForStudent(student, debtorOptions);
            console.log(`✅ Debtor account created for manually added student ${student.email}`);
        } catch (debtorError) {
            console.error('❌ Failed to create debtor account:', debtorError);
            // Continue with student creation even if debtor creation fails
            // But log this for monitoring
            console.log('⚠️ Student created but debtor creation failed. Manual intervention may be needed.');
            console.log('   Error details:', debtorError.message);
        }

        await createAuditLog({
            action: 'CREATE',
            resourceType: 'Student',
            resourceId: student._id,
            userId: req.user._id,
            details: `Created student ${student.email}`
        });

        // Prepare lease agreement attachment if residenceId is provided
        let attachments = [];
        if (residenceId) {
            // Fetch the residence name from DB
            const residence = await Residence.findById(residenceId);

            // Get lease template attachment from S3
            if (residence) {
                const templateAttachment = await getLeaseTemplateAttachment(residence.name);
                if (templateAttachment) {
                    attachments.push(templateAttachment);
                }
            }
        }

        // Send onboarding email with temporary password and lease agreement if available
        await sendEmail({
            to: email,
            subject: 'Welcome to Alamait Student Accommodation',
            text: `
                Dear ${firstName} ${lastName},

                Welcome to Alamait Student Accommodation! Your account has been created.

                Temporary Password: (provided upon registration)

                Please log in and change your password as soon as possible.

                Your lease agreement is attached to this email. Please review and sign it as required.

                Best regards,
                Alamait Student Accommodation Team
            `,
            attachments: attachments.length > 0 ? attachments : undefined
        });

        res.status(201).json({
            ...student.toObject(),
            password: undefined
        });
    } catch (error) {
        console.error('Error in createStudent:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update student
exports.updateStudent = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { firstName, lastName, phone, status, emergencyContact } = req.body;

        const student = await User.findOne({
            _id: req.params.studentId,
            role: 'student'
        });

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Update fields
        if (firstName) student.firstName = firstName;
        if (lastName) student.lastName = lastName;
        if (phone) student.phone = phone;
        if (status) student.status = status;
        if (emergencyContact) student.emergencyContact = emergencyContact;

        await student.save();

        await createAuditLog({
            action: 'UPDATE',
            resourceType: 'Student',
            resourceId: student._id,
            userId: req.user._id,
            details: `Updated student ${student.email}`
        });

        res.json({
            ...student.toObject(),
            password: undefined
        });
    } catch (error) {
        console.error('Error in updateStudent:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete student comprehensively
exports.deleteStudent = async (req, res) => {
    try {
        const studentId = req.params.studentId;

        // Validate deletion before proceeding
        const validation = await StudentDeletionService.validateDeletion(studentId);
        
        if (!validation.canDelete) {
            return res.status(400).json({ 
                error: 'Cannot delete student',
                reasons: validation.blockers
            });
        }

        // Show warnings if any exist
        if (validation.warnings.length > 0) {
            console.log('⚠️ Deletion warnings:', validation.warnings);
        }

        // Perform comprehensive deletion
        const deletionSummary = await StudentDeletionService.deleteStudentCompletely(
            studentId, 
            req.user
        );

        // Return detailed response with safety checks
        const safeDeletedCollections = deletionSummary.deletedCollections || {};
        const safeErrors = deletionSummary.errors || [];
        
        res.json({
            message: safeErrors.length > 0 
                ? 'Student deletion completed with some errors' 
                : 'Student and all related data deleted successfully',
            summary: {
                studentInfo: deletionSummary.studentInfo || { id: studentId, email: 'Unknown', name: 'Unknown' },
                collectionsAffected: Object.keys(safeDeletedCollections).length,
                totalRecordsDeleted: Object.values(safeDeletedCollections)
                    .reduce((sum, item) => sum + (item.count || 0), 0),
                archived: deletionSummary.archived || false,
                residenceUpdated: deletionSummary.residenceUpdated || null,
                warnings: validation.warnings || [],
                errors: safeErrors
            },
            details: safeDeletedCollections
        });

    } catch (error) {
        console.error('Error in comprehensive student deletion:', error);
        res.status(500).json({ 
            error: 'Server error during student deletion',
            message: error.message
        });
    }
};

// Helper function to find student by ID across multiple collections
const findStudentById = async (studentId) => {
    try {
        // First, try to find in User collection
        let student = await User.findById(studentId).select('firstName lastName email');
        if (student) {
            return { student, source: 'User' };
        }

        // If not found in User, try ExpiredStudent collection
        const ExpiredStudent = require('../../models/ExpiredStudent');
        const expiredStudent = await ExpiredStudent.findOne({
            $or: [
                { 'student._id': studentId },
                { 'student': studentId },
                { 'student': new (require('mongoose').Types.ObjectId)(studentId) }
            ]
        });

        if (expiredStudent) {
            // Handle different formats of student data in ExpiredStudent
            let studentData;
            
            // First, try to get student data from application.student (most complete)
            if (expiredStudent.application && expiredStudent.application.student) {
                const appStudent = expiredStudent.application.student;
                studentData = {
                    _id: studentId,
                    firstName: appStudent.firstName,
                    lastName: appStudent.lastName,
                    email: appStudent.email,
                    phone: appStudent.phone,
                    role: appStudent.role,
                    isExpired: true,
                    expiredAt: expiredStudent.archivedAt,
                    expirationReason: expiredStudent.reason
                };
            }
            // If no application.student, check if student field is a full object
            else if (expiredStudent.student && typeof expiredStudent.student === 'object' && expiredStudent.student.constructor.name !== 'ObjectId') {
                studentData = {
                    _id: studentId,
                    firstName: expiredStudent.student.firstName,
                    lastName: expiredStudent.student.lastName,
                    email: expiredStudent.student.email,
                    phone: expiredStudent.student.phone,
                    role: expiredStudent.student.role,
                    isExpired: true,
                    expiredAt: expiredStudent.archivedAt,
                    expirationReason: expiredStudent.reason
                };
            }
            // If student is just an ObjectId, try to get name from transaction metadata
            else {
                const TransactionEntry = require('../../models/TransactionEntry');
                const transactionWithName = await TransactionEntry.findOne({
                    'metadata.studentId': studentId,
                    'metadata.studentName': { $exists: true, $ne: null }
                }).sort({ date: -1 });

                let firstName = 'Unknown';
                let lastName = 'Student';
                if (transactionWithName && transactionWithName.metadata.studentName) {
                    const nameParts = transactionWithName.metadata.studentName.split(' ');
                    firstName = nameParts[0] || 'Unknown';
                    lastName = nameParts.slice(1).join(' ') || 'Student';
                }

                studentData = {
                    _id: studentId,
                    firstName,
                    lastName,
                    email: 'expired@student.com',
                    role: 'student',
                    isExpired: true,
                    expiredAt: expiredStudent.archivedAt,
                    expirationReason: expiredStudent.reason
                };
            }

            return { student: studentData, source: 'ExpiredStudent' };
        }

        // If not found in User, try Application collection
        const application = await Application.findById(studentId).select('firstName lastName email');
        if (application) {
            // Try to find User by email from Application
            if (application.email) {
                const userByEmail = await User.findOne({ email: application.email }).select('firstName lastName email');
                if (userByEmail) {
                    return { student: userByEmail, source: 'User (from Application email)' };
                }
            }
            // fallback: return application as before
            return { 
                student: { 
                    _id: application._id,
                    firstName: application.firstName,
                    lastName: application.lastName,
                    email: application.email
                }, 
                source: 'Application' 
            };
        }

        // If not found in Application, try to find by email in User collection
        if (studentId.includes('@')) {
            student = await User.findOne({ email: studentId }).select('firstName lastName email');
            if (student) {
                return { student, source: 'User (by email)' };
            }
        }

        // If not found by email, try to find in Application collection by email
        if (studentId.includes('@')) {
            const appByEmail = await Application.findOne({ email: studentId }).select('firstName lastName email');
            if (appByEmail) {
                return { 
                    student: { 
                        _id: appByEmail._id,
                        firstName: appByEmail.firstName,
                        lastName: appByEmail.lastName,
                        email: appByEmail.email
                    }, 
                    source: 'Application (by email)' 
                };
            }
        }

        // If still not found, try to find by looking up payments for this student ID
        const payment = await Payment.findOne({ student: studentId }).populate('student', 'firstName lastName email');
        if (payment && payment.student) {
            return { student: payment.student, source: 'Payment' };
        }

        // If not found in payments, try to find by looking up leases for this student ID
        const lease = await Lease.findOne({ studentId }).populate('studentId', 'firstName lastName email');
        if (lease && lease.studentId) {
            return { student: lease.studentId, source: 'Lease' };
        }

        // If still not found, try to find by looking up payments where student field matches
        const paymentByStudentField = await Payment.findOne({ student: studentId });
        if (paymentByStudentField) {
            // Try to find the actual student record
            const actualStudent = await User.findById(studentId).select('firstName lastName email');
            if (actualStudent) {
                return { student: actualStudent, source: 'Payment -> User' };
            }
            
            // If not found in User, try Application
            const actualApp = await Application.findById(studentId).select('firstName lastName email');
            if (actualApp) {
                return { 
                    student: { 
                        _id: actualApp._id,
                        firstName: actualApp.firstName,
                        lastName: actualApp.lastName,
                        email: actualApp.email
                    }, 
                    source: 'Payment -> Application' 
                };
            }
            
            // If we have a payment but no student record, create a minimal student object
            return { 
                student: { 
                    _id: studentId,
                    firstName: 'Unknown',
                    lastName: 'Student',
                    email: 'unknown@student.com'
                }, 
                source: 'Payment (no student record)' 
            };
        }

        return null;
    } catch (error) {
        console.error('Error in findStudentById:', error);
        return null;
    }
};

// Get student payment history
exports.getStudentPayments = async (req, res) => {
    try {
        const { studentId } = req.params;
        
        // Validate student ID
        if (!studentId) {
            return res.status(400).json({ error: 'Student ID is required' });
        }

        console.log('Looking up student with ID:', studentId);

        // Use the robust student lookup
        const studentResult = await findStudentById(studentId);
        if (!studentResult) {
            console.log('Student not found for ID:', studentId);
            return res.status(404).json({ error: 'Student not found' });
        }

        const { student, source } = studentResult;
        console.log('Found student:', student.firstName, student.lastName, 'from source:', source);

        // Get all payments for the student using the Payment model
        // Try multiple ways to find payments for this student
        let payments = await Payment.find({ student: student._id })
            .populate('residence', 'name')
            .populate('createdBy', 'firstName lastName')
            .populate('updatedBy', 'firstName lastName')
            .populate('proofOfPayment.verifiedBy', 'firstName lastName')
            .sort({ date: -1 });

        // If no payments found with student._id, try with the original studentId
        if (payments.length === 0) {
            payments = await Payment.find({ student: studentId })
                .populate('residence', 'name')
                .populate('createdBy', 'firstName lastName')
                .populate('updatedBy', 'firstName lastName')
                .populate('proofOfPayment.verifiedBy', 'firstName lastName')
                .sort({ date: -1 });
        }

        // If still no payments, try to find by email if available
        if (payments.length === 0 && student.email) {
            payments = await Payment.find({ email: student.email })
                .populate('residence', 'name')
                .populate('createdBy', 'firstName lastName')
                .populate('updatedBy', 'firstName lastName')
                .populate('proofOfPayment.verifiedBy', 'firstName lastName')
                .sort({ date: -1 });
        }

        console.log('Found', payments.length, 'payments for student');

        // Format payments for response
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
                datePaid: safeDateFormat(payment.date),
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
                totalPayments: payments.length,
                totalPaid,
                totalPending,
                totalRejected,
                totalAmount: totalPaid + totalPending + totalRejected
            },
            debug: {
                source: source,
                studentId: studentId
            }
        });
    } catch (error) {
        console.error('Error in getStudentPayments:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin downloads a student's signed lease
exports.downloadSignedLease = async (req, res) => {
    try {
        const { studentId } = req.params;
        const user = await User.findById(studentId);
        
        if (!user || !user.signedLeasePath) {
            return res.status(404).json({ error: 'Signed lease not found for this student.' });
        }
        
        // signedLeasePath now contains an S3 URL
        if (user.signedLeasePath.startsWith('http')) {
            // Redirect to S3 URL for download
            res.redirect(user.signedLeasePath);
        } else {
            return res.status(404).json({ error: 'Invalid signed lease URL.' });
        }
    } catch (error) {
        console.error('Error downloading signed lease:', error);
        res.status(500).json({ error: 'Server error.' });
    }
};

// Multer config for signed lease uploads
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: s3Configs.signedLeases.bucket,
        acl: s3Configs.signedLeases.acl,
        key: s3Configs.signedLeases.key
    }),
    fileFilter: fileFilter(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    limits: { fileSize: 10 * 1024 * 1024 }
}).single('signedLease');

// Admin uploads signed lease for student
exports.adminUploadSignedLease = (req, res) => {
    upload(req, res, async function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        const { studentId } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        try {
            const student = await User.findById(studentId);
            if (!student) {
                return res.status(404).json({ error: 'Student not found' });
            }
            student.signedLeasePath = req.file.location;
            student.signedLeaseUploadDate = new Date();
            await student.save();
            await createAuditLog({
                action: 'UPLOAD',
                resourceType: 'Lease',
                resourceId: student._id,
                userId: req.user._id,
                details: `Admin uploaded signed lease for student ${student.email}`
            });
            res.status(200).json({ message: 'Signed lease uploaded successfully', fileUrl: req.file.location });
        } catch (error) {
            res.status(500).json({ error: 'Failed to upload signed lease' });
        }
    });
};

// Fetch expired (archived) students
exports.getExpiredStudents = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await ExpiredStudent.countDocuments();
        const expiredStudents = await ExpiredStudent.find()
            .sort({ archivedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        res.json({
            success: true,
            expiredStudents,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get all signed leases from all students (admin only)
const getAllSignedLeases = async (req, res) => {
  try {
    console.log('=== Getting all signed leases for admin ===');
    
    // Find all users who have signed leases
    const usersWithSignedLeases = await User.find({
      signedLeasePath: { $exists: true, $ne: null }
    })
    .select('_id firstName lastName email signedLeasePath signedLeaseUploadDate currentRoom residence')
    .populate('residence', 'name')
    .lean();

    console.log(`Found ${usersWithSignedLeases.length} users with signed leases`);
    if (usersWithSignedLeases.length > 0) {
      console.log('Sample user:', usersWithSignedLeases[0]);
    }

    // Get all approved applications to cross-reference room and residence info
    const approvedApplications = await Application.find({ 
      status: 'approved',
      student: { $in: usersWithSignedLeases.map(u => u._id) }
    })
    .populate('residence', 'name')
    .lean();

    // Create a map of student ID to application data
    const applicationMap = {};
    approvedApplications.forEach(app => {
      applicationMap[app.student.toString()] = app;
    });

    // Format the response with enhanced room and residence lookup
    const signedLeases = await Promise.all(usersWithSignedLeases.map(async user => {
      let currentRoom = user.currentRoom;
      let residenceName = 'Not Assigned';
      let residenceId = null;

      // First check if user has direct room and residence info
      if (user.currentRoom && user.residence) {
        currentRoom = user.currentRoom;
        residenceName = user.residence.name || 'Not Assigned';
        residenceId = user.residence._id;
      }
      // Then check approved application for room and residence info
      else if (applicationMap[user._id.toString()]) {
        const app = applicationMap[user._id.toString()];
        currentRoom = app.allocatedRoom || app.preferredRoom || 'Not Assigned';
        residenceName = app.residence?.name || 'Not Assigned';
        residenceId = app.residence?._id || null;
      }
      // Finally, if user has currentRoom but no residence, try to find the residence
      else if (user.currentRoom) {
        currentRoom = user.currentRoom;
        try {
          const residence = await Residence.findOne({
            'rooms.roomNumber': user.currentRoom
          }).select('name _id').lean();
          
          if (residence) {
            residenceName = residence.name;
            residenceId = residence._id;
          }
        } catch (err) {
          console.error('Error finding residence for room:', user.currentRoom, err);
        }
      }

      return {
        id: user._id,
        studentName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email,
        currentRoom: currentRoom,
        residence: residenceName,
        residenceId: residenceId,
        fileUrl: user.signedLeasePath,
        uploadDate: user.signedLeaseUploadDate,
        fileName: user.signedLeasePath ? user.signedLeasePath.split('/').pop() : null
      };
    }));

    res.json({
      message: `Found ${signedLeases.length} signed leases`,
      signedLeases: signedLeases
    });

  } catch (error) {
    console.error('Error getting all signed leases:', error);
    if (error.stack) console.error(error.stack);
    res.status(500).json({ 
      error: 'Failed to get signed leases',
      message: error.message,
      stack: error.stack
    });
  }
};

// Export the new function
exports.getAllSignedLeases = getAllSignedLeases;

// Get student leases
exports.getStudentLeases = async (req, res) => {
    try {
        const { studentId } = req.params;
        
        // Validate student ID
        if (!studentId) {
            return res.status(400).json({ error: 'Student ID is required' });
        }

        console.log('Looking up student leases for ID:', studentId);

        // Use the robust student lookup
        const studentResult = await findStudentById(studentId);
        if (!studentResult) {
            console.log('Student not found for ID:', studentId);
            return res.status(404).json({ error: 'Student not found' });
        }

        const { student, source } = studentResult;
        console.log('Found student:', student.firstName, student.lastName, 'from source:', source);

        // Get all leases for the student
        const leases = await Lease.find({ studentId: student._id })
            .populate('residence', 'name')
            .sort({ uploadedAt: -1 });

        console.log('Found', leases.length, 'leases for student');

        // Format leases for response
        const formattedLeases = leases.map(lease => ({
            id: lease._id,
            filename: lease.filename,
            originalname: lease.originalname,
            mimetype: lease.mimetype,
            size: lease.size,
            status: lease.status,
            uploadedAt: lease.uploadedAt,
            residence: lease.residence ? {
                id: lease.residence._id,
                name: lease.residence.name
            } : null,
            downloadUrl: lease.path,
            viewUrl: lease.path
        }));

        res.json({
            student: {
                id: student._id,
                name: `${student.firstName} ${student.lastName}`,
                email: student.email
            },
            leases: formattedLeases,
            totalLeases: leases.length,
            debug: {
                source: source,
                studentId: studentId
            }
        });
    } catch (error) {
        console.error('Error in getStudentLeases:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 
// Comprehensive function to manually add student with room assignment and lease
exports.manualAddStudent = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            email,
            firstName,
            lastName,
            phone,
            emergencyContact,
            residenceId,
            roomNumber,
            startDate,
            endDate,
            monthlyRent,
            securityDeposit,
            adminFee
        } = req.body;

        // Check if user already exists and has an active lease
        let existingUser = await User.findOne({ email });
        if (existingUser) {
            // Check if user has any active leases that haven't ended
            const currentDate = new Date();
            const activeLease = await Application.findOne({
                email: email.toLowerCase(),
                status: 'approved',
                endDate: { $gt: currentDate } // Lease hasn't ended yet
            });
            
            if (activeLease) {
                return res.status(400).json({ 
                    error: 'User has an active lease that hasn\'t ended yet. Please wait until the lease ends to create a new application.',
                    existingLease: {
                        id: activeLease._id,
                        applicationCode: activeLease.applicationCode,
                        startDate: activeLease.startDate,
                        endDate: activeLease.endDate,
                        daysRemaining: Math.ceil((new Date(activeLease.endDate) - currentDate) / (1000 * 60 * 60 * 24))
                    }
                });
            }
            
            // If no active lease, allow re-application
            console.log(`🔄 Re-application detected for existing student: ${email}`);
        }

        // Validate residence and room
        const residence = await Residence.findById(residenceId);
        if (!residence) {
            return res.status(404).json({ error: 'Residence not found' });
        }

        const room = residence.rooms.find(r => r.roomNumber === roomNumber);
        if (!room) {
            return res.status(404).json({ error: 'Room not found in this residence' });
        }

        // Check room availability using date-based booking logic
        const Booking = require('../../models/Booking');
        const isRoomAvailable = await Booking.checkAvailability(residenceId, roomNumber, startDate, endDate);
        
        if (!isRoomAvailable) {
            const roomCapacity = room.capacity || 1;
            if (roomCapacity === 1) {
                return res.status(400).json({ 
                    error: 'Room is not available for the specified dates',
                    details: 'Another booking already exists for this room during the requested period'
                });
            } else {
                return res.status(400).json({ 
                    error: 'Room is at full capacity for the specified dates',
                    details: `Room has reached its maximum capacity of ${roomCapacity} students during the requested period`
                });
            }
        }
        
        // Also check current occupancy as a secondary check
        if (room.currentOccupancy >= room.capacity) {
            console.log(`⚠️ Room ${roomNumber} is at full capacity (${room.currentOccupancy}/${room.capacity}), but checking if it will be available by lease start date`);
            
            // If room is at capacity, check if any current occupants will be leaving before the lease starts
            const leaseStartDate = new Date(startDate);
            const currentDate = new Date();
            
            if (leaseStartDate > currentDate) {
                // Check if any current bookings end before the new lease starts
                const currentBookings = await Booking.find({
                    residence: residenceId,
                    'room.roomNumber': roomNumber,
                    status: { $nin: ['cancelled', 'completed'] },
                    endDate: { $lt: leaseStartDate }
                });
                
                const roomsFreeingUp = currentBookings.length;
                const projectedOccupancy = Math.max(0, room.currentOccupancy - roomsFreeingUp);
                
                if (projectedOccupancy >= room.capacity) {
                    return res.status(400).json({ 
                        error: 'Room will not be available by the lease start date',
                        details: `Room will still be at capacity (${projectedOccupancy}/${room.capacity}) when lease starts`
                    });
                }
                
                console.log(`✅ Room will be available by lease start date. Current: ${room.currentOccupancy}, Freeing up: ${roomsFreeingUp}, Projected: ${projectedOccupancy}`);
            } else {
                // Re-check using accurate occupancy (exclude expired/forfeited/cancelled), and try sync once
                const RoomOccupancyUtils = require('../../utils/roomOccupancyUtils');
                const occ = await RoomOccupancyUtils.calculateAccurateRoomOccupancy(residence._id, room.roomNumber);
                if (occ.currentOccupancy < occ.capacity) {
                    console.log('✅ Accurate occupancy allows allocation:', occ);
                } else {
                    await RoomOccupancyUtils.updateRoomOccupancy(residence._id, room.roomNumber);
                    const occ2 = await RoomOccupancyUtils.calculateAccurateRoomOccupancy(residence._id, room.roomNumber);
                    if (occ2.currentOccupancy < occ2.capacity) {
                        console.log('✅ After sync, room available:', occ2);
                    } else {
                        return res.status(400).json({ 
                            error: 'Room is at full capacity and lease starts immediately',
                            details: 'Cannot allocate room that is currently at full capacity'
                        });
                    }
                }
            }
        }

        // Validate all required variables are defined
        console.log('🔍 Validating required variables...');
        console.log(`   residenceId: ${residenceId} (${typeof residenceId})`);
        console.log(`   roomNumber: ${roomNumber} (${typeof roomNumber})`);
        console.log(`   startDate: ${startDate} (${typeof startDate})`);
        console.log(`   endDate: ${endDate} (${typeof endDate})`);
        console.log(`   monthlyRent: ${monthlyRent} (${typeof monthlyRent})`);
        console.log(`   req.user: ${req.user ? 'exists' : 'undefined'}`);
        console.log(`   req.user._id: ${req.user?._id || 'undefined'}`);
        
        // Only validate truly required fields - financial details are now optional
        if (!residenceId || !roomNumber || !startDate || !endDate || !req.user?._id) {
            const missingVars = [];
            if (!residenceId) missingVars.push('residenceId');
            if (!roomNumber) missingVars.push('roomNumber');
            if (!startDate) missingVars.push('startDate');
            if (!endDate) missingVars.push('endDate');
            if (!req.user?._id) missingVars.push('req.user._id');
            
            return res.status(400).json({ 
                error: 'Missing required variables',
                details: `Missing: ${missingVars.join(', ')}`
            });
        }
        
        // Set default values for optional financial fields
        const finalMonthlyRent = monthlyRent || 150; // Default monthly rent
        const finalSecurityDeposit = securityDeposit || finalMonthlyRent; // Default to 1 month's rent
        const finalAdminFee = adminFee || 0; // Default admin fee
        
        console.log('💰 Financial details (with defaults):');
        console.log(`   Monthly Rent: $${finalMonthlyRent} ${monthlyRent ? '(provided)' : '(default)'}`);
        console.log(`   Security Deposit: $${finalSecurityDeposit} ${securityDeposit ? '(provided)' : '(default)'}`);
        console.log(`   Admin Fee: $${finalAdminFee} ${adminFee ? '(provided)' : '(default)'}`);
        
        // Parse and validate dates
        let parsedStartDate, parsedEndDate;
        try {
            parsedStartDate = new Date(startDate);
            parsedEndDate = new Date(endDate);
            
            if (isNaN(parsedStartDate.getTime())) {
                return res.status(400).json({ error: 'Invalid start date format' });
            }
            if (isNaN(parsedEndDate.getTime())) {
                return res.status(400).json({ error: 'Invalid end date format' });
            }
            if (parsedEndDate <= parsedStartDate) {
                return res.status(400).json({ error: 'End date must be after start date' });
            }
        } catch (dateError) {
            return res.status(400).json({ error: 'Date parsing error', details: dateError.message });
        }
        
        console.log('✅ All variables validated successfully');
        console.log(`   Parsed start date: ${parsedStartDate}`);
        console.log(`   Parsed end date: ${parsedEndDate}`);

        // Handle existing user or create new one
        let student = existingUser;
        let tempPassword = null; // Initialize tempPassword at higher scope
        
        if (!student) {
            // Generate temporary password for new user
            tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);

            // Create new student user
            student = new User({
                email,
                firstName,
                lastName,
                phone: phone || '', // Make phone optional
                password: tempPassword, // Let the pre-save hook hash it
                status: 'active',
                emergencyContact: emergencyContact || {}, // Make emergency contact optional
                role: 'student',
                isVerified: true
            });

            await student.save();
            console.log(`✅ New student created: ${student.email}`);
            
            // Create audit log for new student creation
            await createAuditLog({
                action: 'create',
                collection: 'User',
                recordId: student._id,
                userId: req.user._id,
                before: null,
                after: {
                    email: student.email,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    role: student.role,
                    status: student.status
                },
                details: `Manual student creation - ${student.email}`
            });
        } else {
            // Update existing user information if needed
            let updated = false;
            if (student.firstName !== firstName) {
                student.firstName = firstName;
                updated = true;
            }
            if (student.lastName !== lastName) {
                student.lastName = lastName;
                updated = true;
            }
            if (student.phone !== (phone || '')) {
                student.phone = phone || '';
                updated = true;
            }
            if (emergencyContact && JSON.stringify(student.emergencyContact) !== JSON.stringify(emergencyContact)) {
                student.emergencyContact = emergencyContact;
                updated = true;
            }
            
            if (updated) {
                await student.save();
                console.log(`✅ Existing student updated: ${student.email}`);
                
                // Create audit log for existing student update
                await createAuditLog({
                    action: 'update',
                    collection: 'User',
                    recordId: student._id,
                    userId: req.user._id,
                    before: {
                        firstName: existingUser.firstName,
                        lastName: existingUser.lastName,
                        phone: existingUser.phone,
                        emergencyContact: existingUser.emergencyContact
                    },
                    after: {
                        firstName: student.firstName,
                        lastName: student.lastName,
                        phone: student.phone,
                        emergencyContact: student.emergencyContact
                    },
                    details: `Manual student update during re-application - ${student.email}`
                });
            } else {
                console.log(`✅ Using existing student: ${student.email}`);
            }
        }

        // Generate application code
        const applicationCode = `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // Create application record with proper application code
        const application = new Application({
            student: student._id,
            email,
            firstName,
            lastName,
            phone,
            requestType: 'new',
            status: 'approved', // Directly approve the application
            paymentStatus: 'paid', // Mark as paid since admin is adding manually
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            preferredRoom: roomNumber,
            allocatedRoom: roomNumber,
            residence: residenceId,
            applicationCode: applicationCode, // Set the generated application code
            applicationDate: new Date(),
            actionDate: new Date(),
            actionBy: req.user._id // Use _id consistently
        });

        await application.save();

        // Create audit log for application creation
        await createAuditLog({
            action: 'create',
            collection: 'Application',
            recordId: application._id,
            userId: req.user._id,
            before: null,
            after: {
                applicationCode: application.applicationCode,
                email: application.email,
                firstName: application.firstName,
                lastName: application.lastName,
                status: application.status,
                residence: application.residence,
                allocatedRoom: application.allocatedRoom,
                startDate: application.startDate,
                endDate: application.endDate
            },
            details: `Manual application creation - ${application.applicationCode} for ${application.email}`
        });

        // Update student with application code
        student.applicationCode = application.applicationCode;
        await student.save();

        // Automatically create debtor account for the new student with application link
        let debtor = null;
        try {
            console.log(`🏗️  Creating debtor account for manually added student: ${student.email}`);
            console.log(`   Debug - residenceId: ${residenceId} (type: ${typeof residenceId})`);
            console.log(`   Debug - req.user: ${req.user ? 'exists' : 'undefined'}`);
            console.log(`   Debug - req.user._id: ${req.user?._id || 'undefined'}`);
            
            // Validate required parameters before calling service
            if (!residenceId) {
                   return res.status(404).json({ error: 'No residense Id Found' });
            }
            if (!roomNumber) {
               return res.status(404).json({ error: 'Room Number Not Found' });
            }
            if (!req.user?._id) {
                return res.status(404).json({ error: 'User Not Found' });
            }
            
            debtor = await createDebtorForStudent(student, {
                residenceId: residenceId,
                roomNumber: roomNumber,
                createdBy: req.user._id,
                application: application._id, // Link to the application
                applicationCode: application.applicationCode, // Link application code
                startDate: parsedStartDate,
                endDate: parsedEndDate,
                roomPrice: finalMonthlyRent,
                skipBackfill: true // Skip backfill completely - will be handled by async processing
            });
            
            if (debtor) {
                console.log(`✅ Debtor account created for manually added student ${student.email}`);
                console.log(`   Application Code: ${application.applicationCode}`);
                console.log(`   Debtor Code: ${debtor.debtorCode}`);
                
                // Create audit log for debtor creation
                await createAuditLog({
                    action: 'create',
                    collection: 'Debtor',
                    recordId: debtor._id,
                    userId: req.user._id,
                    before: null,
                    after: {
                        debtorCode: debtor.debtorCode,
                        user: debtor.user,
                        accountCode: debtor.accountCode,
                        status: debtor.status,
                        currentBalance: debtor.currentBalance,
                        totalOwed: debtor.totalOwed,
                        residence: debtor.residence,
                        roomNumber: debtor.roomNumber
                    },
                    details: `Manual debtor creation - ${debtor.debtorCode} for student ${student.email}`
                });
                
                // Link the debtor back to the application
                application.debtor = debtor._id;
                await application.save();
                console.log(`🔗 Linked debtor ${debtor._id} to application ${application._id}`);
                
                // 🆕 SCHEDULE ASYNC PROCESSING for lease start accruals and invoices
                // This prevents timeout issues by processing heavy operations in the background
                try {
                    console.log(`🔄 Scheduling async processing for lease start accruals and invoices...`);
                    
                    // Schedule the accrual and backfill processing to run in the background
                    setImmediate(async () => {
                        try {
                            console.log(`🏠 Starting async processing for ${student.email}...`);
                            
                            // 1. Create lease start accruals
                            const RentalAccrualService = require('../../services/rentalAccrualService');
                            const accrualResult = await RentalAccrualService.createLeaseStartAccrualsOnly(application);
                            
                            if (accrualResult && accrualResult.success) {
                                console.log(`✅ Async lease start accruals completed for ${student.email}`);
                                console.log(`   - Transaction ID: ${accrualResult.transactionId || 'N/A'}`);
                            } else {
                                console.log(`⚠️  Async lease start accruals completed with warnings for ${student.email}:`, accrualResult?.error || 'Unknown issue');
                            }
                            
                            // 2. Run backfill for the debtor (with optimized settings)
                            try {
                                console.log(`🔄 Starting async backfill for ${student.email}...`);
                                const { backfillTransactionsForDebtor } = require('../../services/transactionBackfillService');
                                
                                const backfillResult = await backfillTransactionsForDebtor(debtor, {
                                    auto: true,
                                    skipInvoiceCreation: true, // Skip invoice creation - handled by cron service
                                    skipMonthlyAccruals: true  // Skip monthly accruals (handled by lease start accruals)
                                });
                                
                                if (backfillResult.success) {
                                    console.log(`✅ Async backfill completed for ${student.email}`);
                                    console.log(`   - Lease start created: ${backfillResult.leaseStartCreated}`);
                                    console.log(`   - Monthly transactions created: ${backfillResult.monthlyTransactionsCreated}`);
                                } else {
                                    console.log(`⚠️  Async backfill completed with warnings for ${student.email}:`, backfillResult?.error || 'Unknown issue');
                                }
                            } catch (backfillError) {
                                console.error(`❌ Error in async backfill for ${student.email}:`, backfillError);
                            }
                            
                        } catch (asyncError) {
                            console.error(`❌ Error in async processing for ${student.email}:`, asyncError);
                        }
                    });
                    
                    console.log(`✅ Async processing scheduled for ${student.email}`);
                } catch (scheduleError) {
                    console.error(`❌ Error scheduling async processing:`, scheduleError);
                    console.log(`ℹ️  Student created successfully, but async processing scheduling failed.`);
                }
            } else {
                console.log(`⚠️  Debtor creation returned null - this indicates a problem`);
                console.log(`   Student: ${student.email}`);
                console.log(`   Application: ${application.applicationCode}`);
                console.log(`   Residence: ${residenceId}`);
                console.log(`   Room: ${roomNumber}`);
                console.log(`   Start Date: ${parsedStartDate}`);
                console.log(`   End Date: ${parsedEndDate}`);
                console.log(`   Room Price: ${monthlyRent}`);
                
                // CRITICAL: Fail the request if debtor creation fails
                throw new Error('Debtor creation failed - returned null. This is required for student functionality.');
            }
        } catch (debtorError) {
            console.error(`❌ Failed to create debtor account:`, debtorError);
            console.error(`   Error details:`, debtorError.message);
            console.error(`   Stack trace:`, debtorError.stack);
            console.error(`   Input data:`, {
                student: student.email,
                application: application.applicationCode,
                residenceId,
                roomNumber,
                startDate: parsedStartDate,
                endDate: parsedEndDate,
                monthlyRent: finalMonthlyRent,
                securityDeposit: finalSecurityDeposit,
                adminFee: finalAdminFee
            });
            
            // CRITICAL: Clean up created data and fail the request
            console.log('🧹 Cleaning up created data due to debtor creation failure...');
            
            try {
                // Remove the application
                await Application.deleteOne({ _id: application._id });
                console.log('✅ Application cleaned up');
                
                // Remove the student
                await User.deleteOne({ _id: student._id });
                console.log('✅ Student cleaned up');
                
                // Reset room occupancy
                if (room) {
                    room.currentOccupancy = Math.max(0, room.currentOccupancy - 1);
                    if (room.currentOccupancy === 0) {
                        room.status = 'available';
                    } else if (room.currentOccupancy < room.capacity) {
                        room.status = 'reserved';
                    }
                    await residence.save();
                    console.log('✅ Room occupancy reset');
                }
            } catch (cleanupError) {
                console.error('❌ Error during cleanup:', cleanupError.message);
            }
            
            // Return error response
            return res.status(500).json({ 
                error: 'Failed to create student - debtor account creation failed',
                details: debtorError.message,
                message: 'Student creation failed because debtor account could not be created. This is required for proper functionality.'
            });
        }

        // Update room occupancy and status (following existing logic)
        room.currentOccupancy = (room.currentOccupancy || 0) + 1;
        room.occupants = [...(room.occupants || []), student._id];
        
        // Update room status based on occupancy
        if (room.currentOccupancy >= room.capacity) {
            room.status = 'occupied';
        } else if (room.currentOccupancy > 0) {
            room.status = 'reserved';
        }

        await residence.save();

        // Update student with room assignment (following existing logic)
        const approvalDate = new Date();
        const validUntil = new Date(endDate);
        
        student.currentRoom = roomNumber;
        student.roomValidUntil = validUntil;
        student.roomApprovalDate = approvalDate;
        student.residence = residenceId;
        await student.save();

        // Create booking record
        const booking = new Booking({
            student: student._id,
            residence: residenceId,
            room: {
                roomNumber: roomNumber,
                type: room.type,
                price: room.price
            },
            startDate,
            endDate,
            totalAmount: finalMonthlyRent,
            paymentStatus: 'paid',
            status: 'confirmed',
            paidAmount: finalMonthlyRent + finalAdminFee + finalSecurityDeposit,
            payments: [{
                amount: finalMonthlyRent + finalAdminFee + finalSecurityDeposit,
                date: new Date(),
                method: 'admin_manual',
                status: 'completed',
                transactionId: `ADMIN_${Date.now()}`
            }]
        });

        await booking.save();

        // Note: Lease record is NOT created here - leases collection is only for student-uploaded leases
        // The lease template is sent via email for the student to download, sign, and upload

        // Update student with current booking
        student.currentBooking = booking._id;
        await student.save();

        // Prepare lease agreement attachment (following existing logic)
        let attachments = [];
        const leaseFile = getLeaseTemplateFile(residence.name);
        if (leaseFile) {
            const templatePath = path.normalize(path.join(__dirname, '..', '..', '..', 'uploads', leaseFile));
            if (fs.existsSync(templatePath)) {
                attachments.push({
                    filename: leaseFile,
                    path: templatePath,
                    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                });
            }
        }

        // Send welcome email with login details (following existing application approval logic)
        await sendEmail({
            to: email,
            subject: 'Welcome to Alamait Student Accommodation - Your Account Details',
            text: `
                Dear ${firstName} ${lastName},

                Welcome to Alamait Student Accommodation! Your account has been successfully created and your application has been approved.

                ACCOUNT DETAILS:
                Email: ${email}
                ${tempPassword ? `Temporary Password: ${tempPassword}` : 'Password: Use your existing password'}

                APPLICATION DETAILS:
                Application Code: ${application.applicationCode}
                Allocated Room: ${roomNumber}
                Approval Date: ${approvalDate.toLocaleDateString()}
                Valid Until: ${validUntil.toLocaleDateString()}

                ROOM ASSIGNMENT:
                Residence: ${residence.name}
                Room: ${roomNumber}
                Start Date: ${new Date(startDate).toLocaleDateString()}
                End Date: ${new Date(endDate).toLocaleDateString()}

                PAYMENT DETAILS:
                Monthly Rent: $${finalMonthlyRent}
                Admin Fee: $${finalAdminFee}
                Security Deposit: $${finalSecurityDeposit}
                Total Initial Payment: $${finalMonthlyRent + finalAdminFee + finalSecurityDeposit}

                IMPORTANT:
                1. Please log in to your account using the temporary password above
                2. Change your password immediately after first login
                3. Review and sign your lease agreement (attached)
                4. Upload your signed lease agreement through your student portal

                LOGIN URL: ${process.env.FRONTEND_URL || 'http://localhost:5173' ||'https://alamait.vercel.app' || 'https://alamait.com'}/login

                If you have any questions, please contact our support team.

                Best regards,
                Alamait Student Accommodation Team
            `,
            attachments: attachments.length > 0 ? attachments : undefined
        });

        // Return success response with login details (following existing application response format)
        res.status(201).json({
            success: true,
            message: 'Student added successfully with room assignment and lease. Accruals and invoices are being processed in the background.',
            application: {
                id: application._id,
                applicationCode: application.applicationCode,
                status: application.status,
                paymentStatus: application.paymentStatus
            },
            student: {
                id: student._id,
                email,
                firstName,
                lastName,
                phone,
                status: student.status,
                residence: residence.name,
                roomNumber,
                startDate,
                endDate,
                applicationCode: application.applicationCode
            },
            debtor: debtor ? {
                id: debtor._id,
                debtorCode: debtor.debtorCode,
                accountCode: debtor.accountCode,
                status: debtor.status,
                currentBalance: debtor.currentBalance,
                totalOwed: debtor.totalOwed,
                created: true
            } : {
                created: false,
                error: 'Debtor creation failed - check server logs for details'
            },
            loginDetails: {
                email,
                temporaryPassword: tempPassword || 'Existing user - no new password generated',
                isExistingUser: !!existingUser
            },
            booking: {
                id: booking._id,
                totalAmount: booking.totalAmount,
                paymentStatus: booking.paymentStatus
            },
            lease: {
                id: null,
                filename: null,
                note: "Lease template sent via email - student must upload signed lease"
            },
            room: {
                name: roomNumber,
                status: room.status,
                currentOccupancy: room.currentOccupancy,
                capacity: room.capacity,
                occupancyDisplay: `${room.currentOccupancy}/${room.capacity}`
            },
            financialSummary: {
                monthlyRent: finalMonthlyRent,
                securityDeposit: finalSecurityDeposit,
                adminFee: finalAdminFee,
                totalInitialPayment: finalMonthlyRent + finalAdminFee + finalSecurityDeposit
            },
            backgroundProcessing: {
                status: 'scheduled',
                message: 'Lease start accruals and backfill transactions are being processed in the background',
                estimatedCompletion: '2-5 minutes'
            }
        });

    } catch (error) {
        console.error('Error in manualAddStudent:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
};

// Helper function to get lease template file based on residence name
function getLeaseTemplateFile(residenceName) {
    const name = residenceName.toLowerCase();
    if (name.includes('st kilda') || name.includes('belvedere')) {
        return 'ST Kilda Boarding Agreement1.docx';
    } else if (name.includes('newlands')) {
        return 'Lease_Agreement_Template.docx';
    } else if (name.includes('office')) {
        return 'Office_Lease_Agreement.docx';
    }
    return null;
}

/**
 * Upload CSV and create multiple students
 */
exports.uploadCsvStudents = async (req, res) => {
    try {
        const { csvData, residenceId, defaultRoomNumber, defaultStartDate, defaultEndDate, defaultMonthlyRent } = req.body;
        
        console.log('📁 Processing CSV upload for students in residence:', residenceId);
        
        if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'CSV data is required and must be an array'
            });
        }
        
        if (!residenceId) {
            return res.status(400).json({
                success: false,
                message: 'Residence ID is required for all students'
            });
        }
        
        // Validate residence exists
        const residence = await Residence.findById(residenceId);
        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }
        
        const results = {
            successful: [],
            failed: [],
            summary: {
                totalProcessed: csvData.length,
                totalSuccessful: 0,
                totalFailed: 0,
                totalStudents: 0
            }
        };
        
        // Process each CSV row
        for (let i = 0; i < csvData.length; i++) {
            const row = csvData[i];
            const rowNumber = i + 1;
            
            try {
                // Validate required fields
                if (!row.email || !row.firstName || !row.lastName) {
                    results.failed.push({
                        row: rowNumber,
                        error: 'Missing required fields: email, firstName, lastName',
                        data: row
                    });
                    results.summary.totalFailed++;
                    continue;
                }
                
                // Check if user already exists and has an active lease
                const existingUser = await User.findOne({ email: row.email });
                if (existingUser) {
                    // Check if user has any active leases that haven't ended
                    const currentDate = new Date();
                    const activeLease = await Application.findOne({
                        email: row.email.toLowerCase(),
                        status: 'approved',
                        endDate: { $gt: currentDate } // Lease hasn't ended yet
                    });
                    
                    if (activeLease) {
                        results.failed.push({
                            row: rowNumber,
                            error: `User has an active lease ending ${activeLease.endDate.toDateString()}. Cannot create new application.`,
                            data: row
                        });
                        results.summary.totalFailed++;
                        continue;
                    }
                    
                    // If no active lease, allow re-application
                    console.log(`🔄 Re-application detected for existing student: ${row.email}`);
                }
                
                // Validate room if provided
                let roomNumber = row.roomNumber || defaultRoomNumber;
                let room = null;
                
                if (roomNumber) {
                    room = residence.rooms.find(r => r.roomNumber === roomNumber);
                    if (!room) {
                        results.failed.push({
                            row: rowNumber,
                            error: `Room ${roomNumber} not found in residence`,
                            data: row
                        });
                        results.summary.totalFailed++;
                        continue;
                    }
                    
                    // Check room availability
                    if (room.currentOccupancy >= room.capacity) {
                        results.failed.push({
                            row: rowNumber,
                            error: `Room ${roomNumber} is at full capacity`,
                            data: row
                        });
                        results.summary.totalFailed++;
                        continue;
                    }
                }
                
                // Parse dates
                const startDate = row.startDate ? new Date(row.startDate) : (defaultStartDate ? new Date(defaultStartDate) : new Date());
                const endDate = row.endDate ? new Date(row.endDate) : (defaultEndDate ? new Date(defaultEndDate) : new Date());
                const monthlyRent = parseFloat(row.monthlyRent) || parseFloat(defaultMonthlyRent) || 150; // Default to $150
                
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    results.failed.push({
                        row: rowNumber,
                        error: 'Invalid date format',
                        data: row
                    });
                    results.summary.totalFailed++;
                    continue;
                }
                
                if (endDate <= startDate) {
                    results.failed.push({
                        row: rowNumber,
                        error: 'End date must be after start date',
                        data: row
                    });
                    results.summary.totalFailed++;
                    continue;
                }
                
                // Handle existing user or create new one
                let student = existingUser;
                let tempPassword = null; // Initialize tempPassword
                
                if (!student) {
                    // Generate temporary password for new user
                    tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
                    
                    // Create new student user
                    student = new User({
                        email: row.email,
                        firstName: row.firstName,
                        lastName: row.lastName,
                        phone: row.phone || '',
                        password: tempPassword,
                        status: row.status || 'active',
                        emergencyContact: row.emergencyContact || {},
                        role: 'student',
                        isVerified: true,
                        residence: residenceId
                    });
                    
                    await student.save();
                    console.log(`✅ New student created: ${student.email}`);
                } else {
                    // Update existing user information if needed
                    let updated = false;
                    if (student.firstName !== row.firstName) {
                        student.firstName = row.firstName;
                        updated = true;
                    }
                    if (student.lastName !== row.lastName) {
                        student.lastName = row.lastName;
                        updated = true;
                    }
                    if (student.phone !== (row.phone || '')) {
                        student.phone = row.phone || '';
                        updated = true;
                    }
                    
                    if (updated) {
                        await student.save();
                        console.log(`✅ Existing student updated: ${student.email}`);
                    } else {
                        console.log(`✅ Using existing student: ${student.email}`);
                    }
                }
                
                // Generate application code
                const applicationCode = `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
                
                // Create application record
                const application = new Application({
                    student: student._id,
                    email: row.email,
                    firstName: row.firstName,
                    lastName: row.lastName,
                    phone: row.phone || '',
                    requestType: 'new',
                    status: 'approved',
                    paymentStatus: 'paid',
                    startDate: startDate,
                    endDate: endDate,
                    preferredRoom: roomNumber,
                    allocatedRoom: roomNumber,
                    residence: residenceId,
                    applicationCode: applicationCode,
                    applicationDate: new Date(),
                    actionDate: new Date(),
                    actionBy: req.user._id
                });
                
                await application.save();
                
                // Update student with application code
                student.applicationCode = application.applicationCode;
                await student.save();
                
                // Create debtor account
                let debtor = null;
                try {
                    debtor = await createDebtorForStudent(student, {
                        residenceId: residenceId,
                        roomNumber: roomNumber,
                        createdBy: req.user._id,
                        application: application._id,
                        applicationCode: application.applicationCode,
                        startDate: startDate,
                        endDate: endDate,
                        roomPrice: monthlyRent
                    });
                    
                    if (debtor) {
                        application.debtor = debtor._id;
                        await application.save();
                    }
                } catch (debtorError) {
                    console.error(`❌ Failed to create debtor for CSV student ${row.email}:`, debtorError);
                    // Continue with student creation even if debtor fails
                }
                
                // Update room occupancy if room is assigned
                if (room && roomNumber) {
                    room.currentOccupancy = (room.currentOccupancy || 0) + 1;
                    room.occupants = [...(room.occupants || []), student._id];
                    
                    if (room.currentOccupancy >= room.capacity) {
                        room.status = 'occupied';
                    } else if (room.currentOccupancy > 0) {
                        room.status = 'reserved';
                    }
                    
                    await residence.save();
                }
                
                // Update student with room assignment
                if (roomNumber) {
                    student.currentRoom = roomNumber;
                    student.roomValidUntil = endDate;
                    student.roomApprovalDate = new Date();
                    await student.save();
                }
                
                // Create booking record
                const booking = new Booking({
                    student: student._id,
                    residence: residenceId,
                    room: room ? {
                        roomNumber: roomNumber,
                        type: room.type,
                        price: room.price
                    } : null,
                    startDate: startDate,
                    endDate: endDate,
                    totalAmount: monthlyRent,
                    paymentStatus: 'paid',
                    status: 'confirmed',
                    paidAmount: monthlyRent,
                    payments: [{
                        amount: monthlyRent,
                        date: new Date(),
                        method: 'admin_csv_upload',
                        status: 'completed',
                        transactionId: `CSV_${Date.now()}_${i}`
                    }]
                });
                
                await booking.save();
                
                // Update student with current booking
                student.currentBooking = booking._id;
                await student.save();
                
                results.successful.push({
                    row: rowNumber,
                    studentId: student._id,
                    email: student.email,
                    name: `${student.firstName} ${student.lastName}`,
                    roomNumber: roomNumber,
                    applicationCode: application.applicationCode,
                    debtorCreated: !!debtor,
                    temporaryPassword: tempPassword || 'Existing user - no new password generated',
                    isExistingUser: !!existingUser
                });
                
                results.summary.totalSuccessful++;
                results.summary.totalStudents++;
                
            } catch (error) {
                results.failed.push({
                    row: rowNumber,
                    error: error.message,
                    data: row
                });
                results.summary.totalFailed++;
            }
        }
        
        console.log(`✅ CSV upload completed: ${results.summary.totalSuccessful} successful, ${results.summary.totalFailed} failed`);
        
        // Create audit log for CSV bulk upload
        await createAuditLog({
            action: 'bulk_create',
            collection: 'User',
            recordId: null, // Bulk operation doesn't have a single record ID
            userId: req.user._id,
            before: null,
            after: {
                totalProcessed: results.summary.totalProcessed,
                totalSuccessful: results.summary.totalSuccessful,
                totalFailed: results.summary.totalFailed,
                residenceId: residenceId,
                defaultRoomNumber: defaultRoomNumber,
                defaultStartDate: defaultStartDate,
                defaultEndDate: defaultEndDate,
                defaultMonthlyRent: defaultMonthlyRent
            },
            details: `CSV bulk student upload - ${results.summary.totalSuccessful} students created, ${results.summary.totalFailed} failed`
        });
        
        res.status(200).json({
            success: true,
            message: 'CSV upload processed successfully',
            data: results
        });
        
    } catch (error) {
        console.error('Error processing CSV upload:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process CSV upload',
            error: error.message
        });
    }
};

/**
 * Get CSV template for student upload
 */
exports.getStudentCsvTemplate = async (req, res) => {
    try {
        const template = {
            headers: [
                'email',
                'firstName',
                'lastName',
                'phone',
                'status',
                'roomNumber',
                'startDate',
                'endDate',
                'monthlyRent',
                'emergencyContact'
            ],
            sampleData: [
                {
                    email: 'john.doe@example.com',
                    firstName: 'John',
                    lastName: 'Doe',
                    phone: '+1234567890',
                    status: 'active',
                    roomNumber: 'A101',
                    startDate: '2025-01-15',
                    endDate: '2025-07-15',
                    monthlyRent: 500,
                    emergencyContact: {
                        name: 'Jane Doe',
                        relationship: 'Parent',
                        phone: '+1234567891'
                    }
                },
                {
                    email: 'jane.smith@example.com',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    phone: '+1234567892',
                    status: 'active',
                    roomNumber: 'A102',
                    startDate: '2025-01-15',
                    endDate: '2025-07-15',
                    monthlyRent: 500,
                    emergencyContact: {
                        name: 'John Smith',
                        relationship: 'Parent',
                        phone: '+1234567893'
                    }
                }
            ],
            instructions: [
                'Each row represents one student to be created',
                'Required fields: email, firstName, lastName',
                'Optional fields: phone, status, roomNumber, startDate, endDate, monthlyRent, emergencyContact',
                'Date format: YYYY-MM-DD',
                'Status options: active, inactive, pending',
                'If roomNumber is not provided, default room will be used',
                'If dates are not provided, default dates will be used',
                'If monthlyRent is not provided, default rent will be used',
                'Emergency contact should be a JSON object with name, relationship, and phone'
            ]
        };
        
        res.status(200).json({
            success: true,
            message: 'CSV template retrieved successfully',
            data: template
        });
        
    } catch (error) {
        console.error('Error getting CSV template:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get CSV template',
            error: error.message
        });
    }
}; 

/**
 * Upload Excel file and create multiple students
 */
exports.uploadExcelStudents = async (req, res) => {
    try {
        console.log('📁 Excel upload request received');
        console.log('📁 Request body:', req.body);
        console.log('📁 Request file:', req.file ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        } : 'No file');
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Excel file is required'
            });
        }

        const { residenceId, defaultRoomNumber, defaultStartDate, defaultEndDate, defaultMonthlyRent } = req.body;
        
        console.log('📁 Processing Excel upload for students in residence:', residenceId);
        
        if (!residenceId) {
            return res.status(400).json({
                success: false,
                message: 'Residence ID is required for all students'
            });
        }
        
        // Validate residence exists
        const residence = await Residence.findById(residenceId);
        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        // Parse Excel file
        console.log('📊 Loading Excel file...');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        console.log('✅ Excel file loaded successfully');
        
        const worksheet = workbook.getWorksheet(1); // Get first worksheet
        if (!worksheet) {
            return res.status(400).json({
                success: false,
                message: 'No worksheet found in Excel file'
            });
        }
        console.log('✅ Worksheet found');

        // Convert Excel rows to CSV format
        const csvData = [];
        const headers = [];
        
        // Get headers from first row
        worksheet.getRow(1).eachCell((cell, colNumber) => {
            headers[colNumber - 1] = cell.value ? cell.value.toString().toLowerCase().trim() : '';
        });

        console.log('📋 Excel headers found:', headers);
        console.log('📊 Total rows in worksheet:', worksheet.rowCount);
        console.log('🔍 Expected headers vs actual:', {
            expected: ['email', 'firstname', 'lastname', 'phone', 'roomnumber', 'monthlyrent', 'status', 'emergencycontact', 'startdate', 'enddate'],
            actual: headers
        });

        // Process data rows (skip header row)
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            const rowData = {};
            
            // Skip empty rows
            let hasData = false;
            row.eachCell((cell, colNumber) => {
                if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
                    hasData = true;
                }
            });
            
            if (!hasData) continue;

            // Map Excel columns to expected fields
            console.log(`📝 Processing row ${rowNumber} cells:`);
            row.eachCell((cell, colNumber) => {
                const header = headers[colNumber - 1];
                const value = cell.value;
                
                if (header && value !== null && value !== undefined) {
                    // Convert Excel date to string if needed
                    if (value instanceof Date) {
                        rowData[header] = value.toISOString().split('T')[0]; // YYYY-MM-DD format
                        console.log(`   📅 ${header}: ${value} → ${rowData[header]} (date)`);
                    } else {
                        const stringValue = value.toString().trim();
                        
                        // Handle date strings in MM/DD/YYYY format
                        if ((header === 'startdate' || header === 'enddate' || header === 'startDate' || header === 'endDate') && stringValue.includes('/')) {
                            const parts = stringValue.split('/');
                            if (parts.length === 3) {
                                const month = parts[0].padStart(2, '0');
                                const day = parts[1].padStart(2, '0');
                                const year = parts[2];
                                rowData[header] = `${year}-${month}-${day}`;
                                console.log(`   📅 ${header}: ${stringValue} → ${rowData[header]} (converted date)`);
                            } else {
                                rowData[header] = stringValue;
                                console.log(`   📝 ${header}: ${stringValue}`);
                            }
                        } else {
                            rowData[header] = stringValue;
                            console.log(`   📝 ${header}: ${stringValue}`);
                        }
                    }
                }
            });

            // Normalize field names to handle variations (headers are converted to lowercase)
            console.log(`🔄 Normalizing row ${rowNumber} data:`, rowData);
            
            // Handle room number variations
            if (rowData.roomnumb) {
                rowData.roomnumber = rowData.roomnumb;
                delete rowData.roomnumb;
                console.log(`   ✅ roomnumb → roomnumber: ${rowData.roomnumber}`);
            }
            if (rowData.roomnumber) {
                console.log(`   ✅ roomnumber already exists: ${rowData.roomnumber}`);
            }
            
            // Handle monthly rent variations
            if (rowData.monthlyren) {
                rowData.monthlyrent = rowData.monthlyren;
                delete rowData.monthlyren;
                console.log(`   ✅ monthlyren → monthlyrent: ${rowData.monthlyrent}`);
            }
            if (rowData.monthlyrent) {
                console.log(`   ✅ monthlyrent already exists: ${rowData.monthlyrent}`);
            }
            
            // Handle emergency contact variations
            if (rowData.emergency) {
                rowData.emergencycontact = rowData.emergency;
                delete rowData.emergency;
                console.log(`   ✅ emergency → emergencycontact: ${rowData.emergencycontact}`);
            }
            
            // Handle date field variations (lowercase)
            if (rowData.startdate) {
                rowData.startDate = rowData.startdate;
                delete rowData.startdate;
                console.log(`   ✅ startdate → startDate: ${rowData.startDate}`);
            }
            if (rowData.enddate) {
                rowData.endDate = rowData.enddate;
                delete rowData.enddate;
                console.log(`   ✅ enddate → endDate: ${rowData.endDate}`);
            }
            
            // Handle firstName/lastName variations
            if (rowData['first name']) {
                rowData.firstname = rowData['first name'];
                delete rowData['first name'];
            }
            if (rowData['last name']) {
                rowData.lastname = rowData['last name'];
                delete rowData['last name'];
            }
            if (rowData.firstname) {
                rowData.firstname = rowData.firstname;
            }
            if (rowData.lastname) {
                rowData.lastname = rowData.lastname;
            }
            
            // Handle camelCase variations
            if (rowData.firstName) {
                rowData.firstname = rowData.firstName;
                delete rowData.firstName;
            }
            if (rowData.lastName) {
                rowData.lastname = rowData.lastName;
                delete rowData.lastName;
            }

            // Only add row if it has required fields
            if (rowData.email || rowData.firstname || rowData.lastname) {
                console.log(`📝 Processing row ${rowNumber}:`, rowData);
                csvData.push(rowData);
            }
        }

        console.log(`📊 Parsed ${csvData.length} student records from Excel`);
        console.log('📋 Final csvData:', JSON.stringify(csvData, null, 2));

        if (csvData.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid student data found in Excel file'
            });
        }

        const results = {
            successful: [],
            failed: [],
            summary: {
                totalProcessed: csvData.length,
                totalSuccessful: 0,
                totalFailed: 0,
                totalStudents: 0
            }
        };
        
        // Process each Excel row (same logic as CSV upload)
        console.log('🔄 Starting to process Excel rows...');
        for (let i = 0; i < csvData.length; i++) {
            const row = csvData[i];
            const rowNumber = i + 2; // +2 because Excel rows start at 1 and we skip header
            console.log(`🔄 Processing row ${i + 1}:`, row);
            
            try {
                // Validate required fields
                if (!row.email || !row.firstname || !row.lastname) {
                    results.failed.push({
                        row: rowNumber,
                        error: 'Missing required fields: email, firstName, lastName',
                        data: row
                    });
                    results.summary.totalFailed++;
                    continue;
                }
                
                // Check if user already exists and has an active lease
                const existingUser = await User.findOne({ email: row.email });
                if (existingUser) {
                    // Check if user has any active leases that haven't ended
                    const currentDate = new Date();
                    const activeLease = await Application.findOne({
                        email: row.email.toLowerCase(),
                        status: 'approved',
                        endDate: { $gt: currentDate } // Lease hasn't ended yet
                    });
                    
                    if (activeLease) {
                        results.failed.push({
                            row: rowNumber,
                            error: `User has an active lease ending ${activeLease.endDate.toDateString()}. Cannot create new application.`,
                            data: row
                        });
                        results.summary.totalFailed++;
                        continue;
                    }
                    
                    // If no active lease, allow re-application
                    console.log(`🔄 Re-application detected for existing student: ${row.email}`);
                }
                
                // Validate room if provided
                console.log(`🔍 Room validation for row ${rowNumber}:`, {
                    roomnumber: row.roomnumber,
                    room_number: row.room_number,
                    defaultRoomNumber: defaultRoomNumber,
                    allRowData: row
                });
                let roomNumber = row.roomnumber || row.room_number || defaultRoomNumber;
                let room = null;
                
                if (roomNumber) {
                    room = residence.rooms.find(r => r.roomNumber === roomNumber);
                    if (!room) {
                        results.failed.push({
                            row: rowNumber,
                            error: `Room ${roomNumber} not found in residence`,
                            data: row
                        });
                        results.summary.totalFailed++;
                        continue;
                    }
                    
                    // Check room availability
                    if (room.currentOccupancy >= room.capacity) {
                        results.failed.push({
                            row: rowNumber,
                            error: `Room ${roomNumber} is at full capacity`,
                            data: row
                        });
                        results.summary.totalFailed++;
                        continue;
                    }
                }
                
                // Parse dates (handle both normalized and original field names)
                const startDate = row.startDate || row.startdate || row.start_date ? new Date(row.startDate || row.startdate || row.start_date) : (defaultStartDate ? new Date(defaultStartDate) : new Date());
                const endDate = row.endDate || row.enddate || row.end_date ? new Date(row.endDate || row.enddate || row.end_date) : (defaultEndDate ? new Date(defaultEndDate) : new Date());
                
                // Parse monthly rent from the correct column
                let monthlyRent = parseFloat(row.monthlyrent || row.monthlyRent || row.monthly_rent) || 0;
                console.log(`💰 Monthly rent parsing:`, {
                    monthlyrent: row.monthlyrent,
                    monthlyRent: row.monthlyRent,
                    monthly_rent: row.monthly_rent,
                    parsed: monthlyRent
                });
                
                // Fallback to default if no rent found
                if (monthlyRent === 0) {
                    monthlyRent = parseFloat(defaultMonthlyRent) || 150; // Default to $150
                    console.log(`💰 Using default monthly rent: $${monthlyRent}`);
                }
                
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    results.failed.push({
                        row: rowNumber,
                        error: 'Invalid date format',
                        data: row
                    });
                    results.summary.totalFailed++;
                    continue;
                }
                
                if (endDate <= startDate) {
                    results.failed.push({
                        row: rowNumber,
                        error: 'End date must be after start date',
                        data: row
                    });
                    results.summary.totalFailed++;
                    continue;
                }
                
                // Handle existing user or create new one
                let student = existingUser;
                let tempPassword = null; // Initialize tempPassword
                
                if (!student) {
                    // Generate temporary password for new user
                    tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
                    
                    // Use status as is since it's already correct
                    let cleanStatus = row.status || 'active';
                    
                    // Create new student user
                    student = new User({
                        email: row.email,
                        firstName: row.firstname,
                        lastName: row.lastname,
                        phone: row.phone || '',
                        password: tempPassword,
                        status: cleanStatus,
                        emergencyContact: row.emergencycontact || row.emergency_contact || {},
                        role: 'student',
                        isVerified: true,
                        residence: residenceId
                    });
                    
                    await student.save();
                    console.log(`✅ New student created: ${student.email}`);
                } else {
                    // Update existing user information if needed
                    let updated = false;
                    if (student.firstName !== row.firstname) {
                        student.firstName = row.firstname;
                        updated = true;
                    }
                    if (student.lastName !== row.lastname) {
                        student.lastName = row.lastname;
                        updated = true;
                    }
                    if (student.phone !== (row.phone || '')) {
                        student.phone = row.phone || '';
                        updated = true;
                    }
                    
                    if (updated) {
                        await student.save();
                        console.log(`✅ Existing student updated: ${student.email}`);
                    } else {
                        console.log(`✅ Using existing student: ${student.email}`);
                    }
                }
                
                // Generate application code
                const applicationCode = `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
                
                // Create application record
                const application = new Application({
                    student: student._id,
                    email: row.email,
                    firstName: row.firstname,
                    lastName: row.lastname,
                    phone: row.phone || '',
                    requestType: 'new',
                    status: 'approved',
                    paymentStatus: 'paid',
                    startDate: startDate,
                    endDate: endDate,
                    preferredRoom: roomNumber,
                    allocatedRoom: roomNumber,
                    residence: residenceId,
                    applicationCode: applicationCode,
                    applicationDate: new Date(),
                    actionDate: new Date(),
                    actionBy: req.user._id
                });
                
                await application.save();
                
                // Update student with application code
                student.applicationCode = application.applicationCode;
                await student.save();
                
                // Create debtor account
                let debtor = null;
                try {
                    debtor = await createDebtorForStudent(student, {
                        residenceId: residenceId,
                        roomNumber: roomNumber,
                        createdBy: req.user._id,
                        application: application._id,
                        applicationCode: application.applicationCode,
                        startDate: startDate,
                        endDate: endDate,
                        roomPrice: monthlyRent
                    });
                    
                    if (debtor) {
                        application.debtor = debtor._id;
                        await application.save();
                        
                        // 🆕 INTEGRATED: Backfill transactions for the debtor automatically
                        try {
                            console.log(`🔄 Auto-backfilling transactions for new debtor: ${debtor.debtorCode}`);
                            const backfillResult = await backfillTransactionsForDebtor(debtor, { bulk: true });
                            
                            if (backfillResult.success) {
                                console.log(`✅ Auto-backfill completed for ${debtor.debtorCode}:`);
                                console.log(`   - Lease start created: ${backfillResult.leaseStartCreated}`);
                                console.log(`   - Monthly transactions created: ${backfillResult.monthlyTransactionsCreated}`);
                                console.log(`   - Duplicates removed: ${backfillResult.duplicatesRemoved}`);
                            } else if (backfillResult.skipped) {
                                console.log(`⏭️  Backfill skipped for ${debtor.debtorCode}: ${backfillResult.reason || 'not in bulk mode'}`);
                            } else {
                                console.error(`❌ Auto-backfill failed for ${debtor.debtorCode}: ${backfillResult.error}`);
                            }
                        } catch (backfillError) {
                            console.error(`❌ Failed to auto-backfill transactions for ${student.email}:`, backfillError);
                            // Continue with student creation even if backfill fails
                        }
                    }
                } catch (debtorError) {
                    console.error(`❌ Failed to create debtor for Excel student ${row.email}:`, debtorError);
                    // Continue with student creation even if debtor fails
                }
                
                // Update room occupancy if room is assigned
                if (room && roomNumber) {
                    room.currentOccupancy = (room.currentOccupancy || 0) + 1;
                    room.occupants = [...(room.occupants || []), student._id];
                    
                    if (room.currentOccupancy >= room.capacity) {
                        room.status = 'occupied';
                    } else if (room.currentOccupancy > 0) {
                        room.status = 'reserved';
                    }
                    
                    await residence.save();
                }
                
                // Update student with room assignment
                if (roomNumber) {
                    student.currentRoom = roomNumber;
                    student.roomValidUntil = endDate;
                    student.roomApprovalDate = new Date();
                    await student.save();
                }
                
                // Create booking record
                const booking = new Booking({
                    student: student._id,
                    residence: residenceId,
                    room: room ? {
                        roomNumber: roomNumber,
                        type: room.type,
                        price: room.price
                    } : null,
                    startDate: startDate,
                    endDate: endDate,
                    totalAmount: monthlyRent,
                    paymentStatus: 'paid',
                    status: 'confirmed',
                    paidAmount: monthlyRent,
                    payments: [{
                        amount: monthlyRent,
                        date: new Date(),
                        method: 'admin_excel_upload',
                        status: 'completed',
                        transactionId: `EXCEL_${Date.now()}_${i}`
                    }]
                });
                
                await booking.save();
                
                // Update student with current booking
                student.currentBooking = booking._id;
                await student.save();
                
                results.successful.push({
                    row: rowNumber,
                    studentId: student._id,
                    email: student.email,
                    name: `${student.firstName} ${student.lastName}`,
                    roomNumber: roomNumber,
                    applicationCode: application.applicationCode,
                    debtorCreated: !!debtor,
                    temporaryPassword: tempPassword || 'Existing user - no new password generated',
                    isExistingUser: !!existingUser
                });
                
                results.summary.totalSuccessful++;
                results.summary.totalStudents++;
                
            } catch (error) {
                results.failed.push({
                    row: rowNumber,
                    error: error.message,
                    data: row
                });
                results.summary.totalFailed++;
            }
        }
        
        console.log(`✅ Excel upload completed: ${results.summary.totalSuccessful} successful, ${results.summary.totalFailed} failed`);
        
        // Create audit log for Excel bulk upload
        await createAuditLog({
            action: 'bulk_create',
            collection: 'User',
            recordId: null, // Bulk operation doesn't have a single record ID
            userId: req.user._id,
            before: null,
            after: {
                totalProcessed: results.summary.totalProcessed,
                totalSuccessful: results.summary.totalSuccessful,
                totalFailed: results.summary.totalFailed,
                residenceId: residenceId,
                defaultRoomNumber: defaultRoomNumber,
                defaultStartDate: defaultStartDate,
                defaultEndDate: defaultEndDate,
                defaultMonthlyRent: defaultMonthlyRent,
                fileName: req.file ? req.file.originalname : 'unknown'
            },
            details: `Excel bulk student upload - ${results.summary.totalSuccessful} students created, ${results.summary.totalFailed} failed`
        });
        
        res.status(200).json({
            success: true,
            message: 'Excel upload processed successfully',
            data: results
        });
        
    } catch (error) {
        console.error('Error processing Excel upload:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process Excel upload',
            error: error.message
        });
    }
};

/**
 * Get Excel template for student upload
 */
exports.getStudentExcelTemplate = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Students');
        
        // Define headers
        const headers = [
            'Email',
            'firstName', 
            'lastName',
            'Phone',
            'Status',
            'roomNumber',
            'startDate',
            'endDate',
            'monthlyRent',
            'Emergency Contact Name',
            'Emergency Contact Phone'
        ];
        
        // Add headers to worksheet
        worksheet.addRow(headers);
        
        // Style the header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Add sample data
        const sampleData = [
            [
                'john.doe@example.com',
                'John',
                'Doe',
                '+1234567890',
                'active',
                'A101',
                '2025-01-15',
                '2025-07-15',
                '500',
                'Jane Doe',
                '+1234567891'
            ],
            [
                'jane.smith@example.com',
                'Jane',
                'Smith',
                '+1234567892',
                'active',
                'A102',
                '2025-01-15',
                '2025-07-15',
                '500',
                'John Smith',
                '+1234567893'
            ]
        ];
        
        sampleData.forEach(row => {
            worksheet.addRow(row);
        });
        
        // Set column widths
        worksheet.columns.forEach(column => {
            column.width = 15;
        });
        
        // Add data validation for status column
        worksheet.dataValidations.add('E2:E1000', {
            type: 'list',
            allowBlank: true,
            formulae: ['"active,inactive,pending"']
        });
        
        // Add data validation for date columns
        worksheet.dataValidations.add('G2:H1000', {
            type: 'date',
            allowBlank: true,
            operator: 'greaterThan',
            formulae: ['TODAY()']
        });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="student_upload_template.xlsx"');
        
        // Write to response
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('Error generating Excel template:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate Excel template',
            error: error.message
        });
    }
};

/**
 * Manual backfill transactions for all debtors
 * @route POST /api/admin/students/backfill-transactions
 * @access Private (Admin only)
 */
exports.backfillAllTransactions = async (req, res) => {
    try {
        console.log('🔄 Manual backfill request received');
        
        const { backfillAllTransactions } = require('../../services/transactionBackfillService');
        
        const result = await backfillAllTransactions();
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Backfill completed successfully',
                data: result.summary
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Backfill failed',
                error: result.error
            });
        }
    } catch (error) {
        console.error('❌ Error in manual backfill:', error);
        res.status(500).json({
            success: false,
            message: 'Backfill operation failed',
            error: error.message
        });
    }
};

/**
 * Manual backfill transactions for a specific debtor
 * @route POST /api/admin/students/:debtorId/backfill-transactions
 * @access Private (Admin only)
 */
exports.backfillDebtorTransactions = async (req, res) => {
	try {
		const { debtorId } = req.params;
		console.log(`🔄 Manual backfill request for debtor: ${debtorId}`);
		
		const Debtor = require('../../models/Debtor');
		const { backfillTransactionsForDebtor } = require('../../services/transactionBackfillService');
		
		// Find the debtor
		const debtor = await Debtor.findById(debtorId)
			.populate('user', 'firstName lastName email')
			.populate('application', 'applicationCode startDate endDate');
		
		if (!debtor) {
			return res.status(404).json({
				success: false,
				message: 'Debtor not found'
			});
		}
		
		const bulk = (req.query.bulk === 'true') || (req.body && req.body.bulk === true);
		const manual = (req.query.manual === 'true') || (req.body && req.body.manual === true);
		const result = await backfillTransactionsForDebtor(debtor, { bulk, manual });
		
		if (result.success) {
			res.json({
				success: true,
				message: 'Backfill completed successfully',
				leaseStartCreated: result.leaseStartCreated,
				monthlyTransactionsCreated: result.monthlyTransactionsCreated,
				duplicatesRemoved: result.duplicatesRemoved
			});
		} else if (result.skipped) {
			res.status(200).json({
				success: true,
				message: `Backfill skipped: ${result.reason || 'not in bulk mode'}`
			});
		} else {
			res.status(500).json({
				success: false,
				message: 'Backfill failed',
				error: result.error
			});
		}
	} catch (error) {
		console.error('❌ Manual backfill failed:', error);
		res.status(500).json({
			success: false,
			message: 'Backfill operation failed',
			error: error.message
		});
	}
};

/**
 * Manual backfill transactions for a specific debtor
 * @route POST /api/admin/students/:debtorId/backfill-transactions
 * @access Private (Admin only)
 */
exports.backfillDebtorTransactions = async (req, res) => {
	try {
		const { debtorId } = req.params;
		console.log(`🔄 Manual backfill request for debtor: ${debtorId}`);
		
		const Debtor = require('../../models/Debtor');
		const { backfillTransactionsForDebtor } = require('../../services/transactionBackfillService');
		
		// Find the debtor
		const debtor = await Debtor.findById(debtorId)
			.populate('user', 'firstName lastName email')
			.populate('application', 'applicationCode startDate endDate');
		
		if (!debtor) {
			return res.status(404).json({
				success: false,
				message: 'Debtor not found'
			});
		}
		
		const bulk = (req.query.bulk === 'true') || (req.body && req.body.bulk === true);
		const manual = (req.query.manual === 'true') || (req.body && req.body.manual === true);
		const result = await backfillTransactionsForDebtor(debtor, { bulk, manual });
		
		if (result.success) {
			res.json({
				success: true,
				message: 'Backfill completed successfully',
				leaseStartCreated: result.leaseStartCreated,
				monthlyTransactionsCreated: result.monthlyTransactionsCreated,
				duplicatesRemoved: result.duplicatesRemoved
			});
		} else if (result.skipped) {
			res.status(200).json({
				success: true,
				message: `Backfill skipped: ${result.reason || 'not in bulk mode'}`
			});
		} else {
			res.status(500).json({
				success: false,
				message: 'Backfill failed',
				error: result.error
			});
		}
	} catch (error) {
		console.error('❌ Manual backfill failed:', error);
		res.status(500).json({
			success: false,
			message: 'Backfill operation failed',
			error: error.message
		});
	}
}; 
