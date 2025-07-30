const User = require('../../models/User');
const Booking = require('../../models/Booking');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../../utils/email');
const path = require('path');
const fs = require('fs');
const Residence = require('../../models/Residence');
const Application = require('../../models/Application');
const Lease = require('../../models/Lease');
const bcrypt = require('bcryptjs');

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
        const { email, firstName, lastName, phone, status, emergencyContact, residenceId } = req.body;

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
            isVerified: false
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

            // Map residence name to file
            let leaseFile = null;
            if (residence) {
                const name = residence.name.toLowerCase();
                if (name.includes('st kilda') || name.includes('belvedere')) {
                    leaseFile = 'ST Kilda Boarding Agreement1.docx';
                } else if (name.includes('newlands')) {
                    leaseFile = 'Lease_Agreement_Template.docx';
                } else if (name.includes('office')) {
                    leaseFile = 'Office_Lease_Agreement.docx'; // replace with actual filename if different
                }
            }

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
        const filePath = path.join(__dirname, '..', '..', '..', user.signedLeasePath);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Signed lease file missing from server.' });
        }
        res.download(filePath, err => {
            if (err) res.status(500).json({ error: 'Failed to download file.' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error.' });
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
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        // Create new student user
        const student = new User({
            email,
            firstName,
            lastName,
            phone,
            password: hashedPassword,
            status: 'active',
            emergencyContact,
            role: 'student',
            isVerified: true
        });

        await student.save();

        // Create application record (following the existing application logic)
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
            applicationDate: new Date(),
            actionDate: new Date(),
            actionBy: req.user.id
        });

        await application.save();

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
                endDate
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