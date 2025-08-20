const User = require('../../models/User');
const Booking = require('../../models/Booking');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../../utils/email');
const path = require('path');
const fs = require('fs');
const Residence = require('../../models/Residence');
const { getLeaseTemplateAttachment } = require('../../services/leaseTemplateService');
const ExpiredStudent = require('../../models/ExpiredStudent');
const Application = require('../../models/Application');
const Payment = require('../../models/Payment');
const { createAuditLog } = require('../../utils/auditLogger');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3, s3Configs, fileFilter, fileTypes } = require('../../config/s3');
const AuditLog = require('../../models/AuditLog');
const Lease = require('../../models/Lease');
const bcrypt = require('bcryptjs');
const { createDebtorForStudent } = require('../../services/debtorService');

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
exports.getStudents = async (req, res) => {
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
        console.error('Error in getStudents:', error);
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
            await createDebtorForStudent(student, {
                residenceId: residenceId,
                createdBy: req.user._id
            });
            console.log(`✅ Debtor account created for student ${student.email}`);
        } catch (debtorError) {
            console.error('❌ Failed to create debtor account:', debtorError);
            // Continue with student creation even if debtor creation fails
            // But log this for monitoring
            console.log('⚠️ Student created but debtor creation failed. Manual intervention may be needed.');
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

// Delete student
exports.deleteStudent = async (req, res) => {
    try {
        const student = await User.findOne({
            _id: req.params.studentId,
            role: 'student'
        });

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Check for active bookings
        const activeBookings = await Booking.findOne({
            student: student._id,
            status: { $in: ['pending', 'confirmed'] }
        });

        if (activeBookings) {
            return res.status(400).json({ error: 'Cannot delete student with active bookings' });
        }

        // Archive before removing the student
        const application = await Application.findOne({ student: student._id }).sort({ createdAt: -1 });
        // Fetch payment history
        const bookings = await Booking.find({ student: student._id }).lean();
        const paymentHistory = bookings.flatMap(booking => booking.payments || []);
        // Fetch leases
        const leases = await Lease.find({ studentId: student._id }).lean();
        await ExpiredStudent.create({
            student: student.toObject(),
            application: application ? application.toObject() : null,
            previousApplicationCode: application ? application.applicationCode : null,
            archivedAt: new Date(),
            reason: 'deleted_by_admin',
            paymentHistory,
            leases
        });

        // Before removing the student, update room status in residence
        if (student.residence && student.currentRoom) {
            const residence = await Residence.findById(student.residence);
            if (residence) {
                const room = residence.rooms.find(r => r.roomNumber === student.currentRoom);
                if (room) {
                    // Decrement occupancy, but not below 0
                    room.currentOccupancy = Math.max(0, (room.currentOccupancy || 1) - 1);
                    // Update status
                    if (room.currentOccupancy === 0) {
                        room.status = 'available';
                    } else if (room.currentOccupancy < room.capacity) {
                        room.status = 'reserved';
                    } else {
                        room.status = 'occupied';
                    }
                    await residence.save();
                }
            }
        }

        // Save before state for audit
        const before = student.toObject();
        await student.remove();

        // Audit log for deletion
        await AuditLog.create({
            user: req.user?._id,
            action: 'delete',
            collection: 'User',
            recordId: before._id,
            before,
            after: null
        });

        await createAuditLog({
            action: 'DELETE',
            resourceType: 'Student',
            resourceId: student._id,
            userId: req.user._id,
            details: `Deleted student ${student.email}`
        });

        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Error in deleteStudent:', error);
        res.status(500).json({ error: 'Server error' });
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

        // Check if user already exists
        let existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
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

        // Check room availability
        if (room.currentOccupancy >= room.capacity) {
            return res.status(400).json({ error: 'Room is at full capacity' });
        }

        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);

        // Create new student user
        const student = new User({
            email,
            firstName,
            lastName,
            phone,
            password: tempPassword, // Let the pre-save hook hash it
            status: 'active',
            emergencyContact,
            role: 'student',
            isVerified: true
        });

        await student.save();

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
            startDate,
            endDate,
            preferredRoom: roomNumber,
            allocatedRoom: roomNumber,
            residence: residenceId,
            applicationCode: applicationCode, // Set the generated application code
            applicationDate: new Date(),
            actionDate: new Date(),
            actionBy: req.user.id
        });

        await application.save();

        // Update student with application code
        student.applicationCode = application.applicationCode;
        await student.save();

        // Automatically create debtor account for the new student with application link
        try {
            await createDebtorForStudent(student, {
                residenceId: residenceId,
                roomNumber: roomNumber,
                createdBy: req.user._id,
                application: application._id, // Link to the application
                applicationCode: application.applicationCode, // Link application code
                startDate: startDate,
                endDate: endDate,
                roomPrice: monthlyRent
            });
            console.log(`✅ Debtor account created for manually added student ${student.email}`);
            console.log(`   Application Code: ${application.applicationCode}`);
        } catch (debtorError) {
            console.error('❌ Failed to create debtor account:', debtorError);
            // Continue with student creation even if debtor creation fails
            console.log('⚠️ Student manually added but debtor creation failed. Manual intervention may be needed.');
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
            totalAmount: monthlyRent,
            paymentStatus: 'paid',
            status: 'confirmed',
            paidAmount: monthlyRent + (adminFee || 0) + (securityDeposit || 0),
            payments: [{
                amount: monthlyRent + (adminFee || 0) + (securityDeposit || 0),
                date: new Date(),
                method: 'admin_manual',
                status: 'completed',
                transactionId: `ADMIN_${Date.now()}`
            }]
        });

        await booking.save();

        // Create lease record
        const lease = new Lease({
            studentId: student._id,
            studentName: `${firstName} ${lastName}`,
            email,
            residence: residenceId,
            residenceName: residence.name,
            startDate,
            endDate,
            filename: `lease_${student._id}_${Date.now()}.pdf`,
            originalname: `Lease_Agreement_${firstName}_${lastName}.pdf`,
            path: `/uploads/leases/lease_${student._id}_${Date.now()}.pdf`,
            mimetype: 'application/pdf',
            size: 0,
            uploadedAt: new Date()
        });

        await lease.save();

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
                Temporary Password: ${tempPassword}

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
                Monthly Rent: $${monthlyRent}
                Admin Fee: $${adminFee || 0}
                Security Deposit: $${securityDeposit || 0}
                Total Initial Payment: $${monthlyRent + (adminFee || 0) + (securityDeposit || 0)}

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
            message: 'Student added successfully with room assignment and lease',
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
            loginDetails: {
                email,
                temporaryPassword: tempPassword
            },
            booking: {
                id: booking._id,
                totalAmount: booking.totalAmount,
                paymentStatus: booking.paymentStatus
            },
            lease: {
                id: lease._id,
                filename: lease.filename
            },
            room: {
                name: roomNumber,
                status: room.status,
                currentOccupancy: room.currentOccupancy,
                capacity: room.capacity,
                occupancyDisplay: `${room.currentOccupancy}/${room.capacity}`
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
