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

// Get student payment history
exports.getStudentPayments = async (req, res) => {
    try {
        const bookings = await Booking.find({
            student: req.params.studentId
        })
        .select('payments totalAmount paymentStatus startDate endDate')
        .sort({ createdAt: -1 });

        const payments = bookings.flatMap(booking => {
            return booking.payments.map(payment => ({
                ...payment.toObject(),
                bookingId: booking._id,
                totalAmount: booking.totalAmount,
                paymentStatus: booking.paymentStatus,
                startDate: booking.startDate,
                endDate: booking.endDate
            }));
        });

        res.json(payments);
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
    .select('_id firstName lastName email signedLeasePath signedLeaseUploadDate currentRoom')
    .populate('residence', 'name')
    .lean();

    console.log(`Found ${usersWithSignedLeases.length} users with signed leases`);

    // Format the response
    const signedLeases = usersWithSignedLeases.map(user => ({
      id: user._id,
      studentName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email,
      currentRoom: user.currentRoom,
      residence: user.residence?.name || 'Not Assigned',
      fileUrl: user.signedLeasePath,
      uploadDate: user.signedLeaseUploadDate,
      fileName: user.signedLeasePath ? user.signedLeasePath.split('/').pop() : null
    }));

    res.json({
      message: `Found ${signedLeases.length} signed leases`,
      signedLeases: signedLeases
    });

  } catch (error) {
    console.error('Error getting all signed leases:', error);
    res.status(500).json({ 
      error: 'Failed to get signed leases',
      message: error.message 
    });
  }
};

// Export the new function
exports.getAllSignedLeases = getAllSignedLeases; 