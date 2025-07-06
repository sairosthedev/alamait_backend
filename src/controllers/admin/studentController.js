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
const Lease = require('../../models/Lease');
const Payment = require('../../models/Payment');

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
        const salt = await bcrypt.genSalt(10);
        student.password = await bcrypt.hash(tempPassword, salt);

        await student.save();

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

        await student.remove();

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