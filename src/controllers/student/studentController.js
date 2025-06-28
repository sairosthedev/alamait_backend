const Student = require('../../models/Student');
const { validationResult } = require('express-validator');
const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const Residence = require('../../models/Residence');
const Application = require('../../models/Application');
const Booking = require('../../models/Booking');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const PDFDocument = require('pdfkit');
const multer = require('multer');

// Get all students
const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};

// Get a student by ID
const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (student) {
      res.json(student);
    } else {
      res.status(404).send('Student not found');
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student' });
  }
};

// Create a new student
const createStudent = async (req, res) => {
  try {
    const newStudent = new Student(req.body);
    await newStudent.save();
    res.status(201).json(newStudent);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create student' });
  }
};

// Update an existing student
const updateStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (student) {
      res.json(student);
    } else {
      res.status(404).send('Student not found');
    }
  } catch (error) {
    res.status(400).json({ error: 'Failed to update student' });
  }
};

// Delete a student
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (student) {
      res.status(204).send();
    } else {
      res.status(404).send('Student not found');
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete student' });
  }
};

// @route   GET /api/student/profile
// @desc    Get student profile
// @access  Private (Student only)
const getProfile = async (req, res) => {
    try {
        console.log('Fetching profile for user:', req.user._id);
        
        if (!req.user || !req.user._id) {
            console.error('No user found in request');
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const student = await User.findById(req.user._id)
            .select('-password')
            .populate('residence', 'name')
            .lean();

        if (!student) {
            console.log('Student not found in database');
            return res.status(404).json({ error: 'Student not found' });
        }

        console.log('Found student:', {
            id: student._id,
            email: student.email,
            currentRoom: student.currentRoom,
            roomValidUntil: student.roomValidUntil,
            roomApprovalDate: student.roomApprovalDate
        });

        // Check for active booking
        const currentBooking = await Booking.findOne({
            student: req.user._id,
            status: 'active'
        })
        .populate('residence', 'name')
        .populate('room', 'roomNumber type features floor')
        .lean();

        console.log('Current booking found:', currentBooking);

        // Check for approved application
        const approvedApplication = await Application.findOne({
            email: student.email,
            status: 'approved'
        })
        .populate('residence', 'name')
        .sort({ updatedAt: -1 })
        .lean();

        console.log('Approved application found:', approvedApplication);

        // Get residence details if we have a room number
        let residenceDetails = null;
        if (student.currentRoom) {
            const residence = await Residence.findOne({
                'rooms.roomNumber': student.currentRoom
            }).lean();
            
            if (residence) {
                const room = residence.rooms.find(r => r.roomNumber === student.currentRoom);
                residenceDetails = {
                    name: residence.name,
                    room: room
                };
            }
        }

        console.log('Residence details found:', residenceDetails);

        // Determine the residence name from various sources
        let residenceName = null;
        let residenceId = null; // Track residence ID
        if (currentBooking?.residence?.name) {
            residenceName = currentBooking.residence.name;
            residenceId = currentBooking.residence._id; // Get residence ID from booking
        } else if (approvedApplication?.residence?.name) {
            residenceName = approvedApplication.residence.name;
            residenceId = approvedApplication.residence._id; // Get residence ID from application
        } else if (residenceDetails?.name) {
            residenceName = residenceDetails.name;
            // Try to get residence ID from the residence lookup
            const residence = await Residence.findOne({ name: residenceDetails.name });
            residenceId = residence ? residence._id : null;
        } else if (student.residence?.name) {
            residenceName = student.residence.name;
            residenceId = student.residence._id; // Get residence ID from student
        }

        console.log('Determined residence name:', residenceName);
        console.log('Determined residence ID:', residenceId);

        // Format response to match frontend requirements
        const formattedProfile = {
            id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            phone: student.phone,
            studentId: student.studentId,
            program: student.program,
            year: student.year,
            emergencyContact: student.emergencyContact || {
                name: '',
                relationship: '',
                phone: ''
            },
            currentRoom: currentBooking ? {
                status: currentBooking.status,
                validUntil: currentBooking.endDate,
                approvalDate: currentBooking.startDate,
                roomNumber: currentBooking.room.roomNumber,
                roomType: currentBooking.room.type,
                residence: currentBooking.residence.name,
                residenceId: currentBooking.residence._id
            } : student.currentRoom && residenceDetails ? {
                status: 'active',
                validUntil: student.roomValidUntil,
                approvalDate: student.roomApprovalDate,
                roomNumber: student.currentRoom,
                roomType: residenceDetails.room.type,
                residence: residenceDetails.name,
                residenceId: residenceId
            } : approvedApplication ? {
                status: 'approved',
                validUntil: approvedApplication.actionDate ? new Date(new Date(approvedApplication.actionDate).setMonth(new Date(approvedApplication.actionDate).getMonth() + 4)) : new Date(Date.now() + (4 * 30 * 24 * 60 * 60 * 1000)),
                approvalDate: approvedApplication.actionDate || new Date(),
                roomNumber: approvedApplication.allocatedRoom || approvedApplication.preferredRoom,
                roomType: 'Standard',
                residence: residenceName || 'Not Assigned',
                residenceId: residenceId
            } : null
        };

        console.log('Sending formatted profile:', formattedProfile);
        res.json(formattedProfile);
    } catch (error) {
        console.error('Error in getProfile:', error);
        res.status(500).json({ 
            error: 'Server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch student profile'
        });
    }
};

// @route   PUT /api/student/profile
// @desc    Update student profile
// @access  Private (Student only)
const updateProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            firstName,
            lastName,
            phone,
            emergencyContact
        } = req.body;

        const student = await User.findById(req.user._id);

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Update fields if provided
        if (firstName) student.firstName = firstName;
        if (lastName) student.lastName = lastName;
        if (phone) student.phone = phone;
        if (emergencyContact) student.emergencyContact = emergencyContact;

        await student.save();

        // Return formatted profile
        const updatedProfile = {
            id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            phone: student.phone,
            studentId: student.studentId,
            program: student.program,
            year: student.year,
            emergencyContact: student.emergencyContact
        };

        res.json(updatedProfile);
    } catch (error) {
        console.error('Error in updateProfile:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// @route   PUT /api/student/profile/password
// @desc    Change student password
// @access  Private (Student only)
const changePassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { currentPassword, newPassword } = req.body;

        const student = await User.findById(req.user._id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, student.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        student.password = await bcrypt.hash(newPassword, salt);
        await student.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error in changePassword:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// @route   GET /api/student/current-residence
// @desc    Get student's current residence details
// @access  Private (Student only)
const getCurrentResidence = async (req, res) => {
    try {
        // Get current active booking
        const currentBooking = await Booking.findOne({
            student: req.user._id,
            status: 'active'
        })
        .populate('residence', 'name address image')
        .populate('room', 'roomNumber type features price floor')
        .lean();

        if (!currentBooking) {
            return res.status(404).json({ error: 'No active booking found' });
        }

        const response = {
            name: currentBooking.residence.name,
            address: currentBooking.residence.address,
            residenceId: currentBooking.residence._id,
            room: {
                number: currentBooking.room.roomNumber,
                type: currentBooking.room.type,
                floor: currentBooking.room.floor,
                features: currentBooking.room.features
            },
            status: currentBooking.status,
            validUntil: currentBooking.endDate,
            approvalDate: currentBooking.startDate,
            image: currentBooking.residence.image
        };

        res.json(response);
    } catch (error) {
        console.error('Error in getCurrentResidence:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// @route   GET /api/student/users/students
// @desc    Get all students for the student-to-student messaging
// @access  Private (Student only)
const getAllUsersForMessaging = async (req, res) => {
  try {
    // Find all users with student role
    const students = await User.find({ 
      role: 'student', 
      _id: { $ne: req.user._id } // Exclude current user
    })
    .select('_id firstName lastName currentRoom')
    .lean();
    
    // Return formatted list of students
    res.json(students);
  } catch (error) {
    console.error('Error fetching students for messaging:', error);
    res.status(500).json({ error: 'Failed to fetch students list' });
  }
};

// Download lease agreement as PDF
const downloadLeaseAgreement = async (req, res) => {
    try {
        // 1. Find the student's residenceId
        let residenceId = req.user.residence;
        let firstName = req.user.firstName || 'Student';
        let lastName = req.user.lastName || '';
        // If not in user, try latest approved application
        if (!residenceId) {
            const application = await Application.findOne({
                email: req.user.email,
                status: 'approved'
            }).sort({ updatedAt: -1 });
            if (application && application.residence) {
                residenceId = application.residence;
                firstName = application.firstName || firstName;
                lastName = application.lastName || lastName;
            }
        }
        if (!residenceId) {
            return res.status(404).json({ error: 'Residence not found for student.' });
        }
        // 2. Locate the correct lease agreement DOCX
        const templateName = `lease_agreement_${residenceId}.docx`;
        const templatePath = path.normalize(path.join(__dirname, '..', '..', '..', 'uploads', templateName));
        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ error: 'Lease agreement template not found for your property.' });
        }
        // 3. Convert DOCX to HTML using mammoth
        const docxBuffer = fs.readFileSync(templatePath);
        const { value: html } = await mammoth.convertToHtml({ buffer: docxBuffer });
        // 4. Convert HTML to PDF using pdfkit
        const doc = new PDFDocument();
        let filename = `Lease_Agreement_${firstName}_${lastName}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);
        // Simple HTML to PDF rendering (for more complex, use pdfmake or puppeteer)
        doc.fontSize(12).text(html.replace(/<[^>]+>/g, ''), { align: 'left' });
        doc.end();
    } catch (error) {
        console.error('Error downloading lease agreement:', error);
        res.status(500).json({ error: 'Failed to generate lease agreement PDF.' });
    }
};

// Multer storage for signed leases
const signedLeaseStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '..', '..', '..', 'uploads', 'signed_leases');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const ext = file.originalname.split('.').pop();
        cb(null, `${req.user._id}_${Date.now()}.${ext}`);
    }
});
const uploadSignedLease = multer({
    storage: signedLeaseStorage,
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only PDF, JPEG, or PNG allowed'));
    },
    limits: { fileSize: 10 * 1024 * 1024 }
}).single('signedLease');

// Student uploads signed lease
const uploadSignedLeaseHandler = async (req, res) => {
    uploadSignedLease(req, res, async function (err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        // Save file path in user model
        const filePath = `/uploads/signed_leases/${req.file.filename}`;
        await User.findByIdAndUpdate(req.user._id, { signedLeasePath: filePath });
        res.json({ message: 'Signed lease uploaded successfully', filePath });
    });
};

module.exports = {
    getAllStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    getProfile,
    updateProfile,
    changePassword,
    getCurrentResidence,
    getAllUsersForMessaging,
    downloadLeaseAgreement,
    uploadSignedLeaseHandler
}; 