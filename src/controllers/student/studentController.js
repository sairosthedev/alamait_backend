const Student = require('../../models/Student');
const { validationResult } = require('express-validator');
const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const Residence = require('../../models/Residence');
const Application = require('../../models/Application');
const Booking = require('../../models/Booking');

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
        
        const student = await User.findById(req.user._id)
            .select('-password')
            .lean();

        if (!student) {
            console.log('Student not found');
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
        .populate('residence', 'name address')
        .populate('room', 'roomNumber type features floor')
        .lean();

        console.log('Current booking found:', currentBooking);

        // Check for approved application
        const approvedApplication = await Application.findOne({
            email: student.email,
            status: 'approved'
        })
        .sort({ updatedAt: -1 })
        .lean();

        console.log('Approved application found:', approvedApplication);

        // If there's an approved application, get its residence details
        let applicationResidence = null;
        if (approvedApplication && approvedApplication.residence) {
            applicationResidence = await Residence.findById(approvedApplication.residence).lean();
            console.log('Application residence found:', applicationResidence);
        }

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
                residence: currentBooking.residence.name
            } : student.currentRoom && residenceDetails ? {
                status: 'active',
                validUntil: student.roomValidUntil,
                approvalDate: student.roomApprovalDate,
                roomNumber: student.currentRoom,
                roomType: residenceDetails.room.type,
                residence: residenceDetails.name
            } : approvedApplication ? {
                status: 'approved',
                validUntil: approvedApplication.actionDate ? new Date(new Date(approvedApplication.actionDate).setMonth(new Date(approvedApplication.actionDate).getMonth() + 4)) : new Date(Date.now() + (4 * 30 * 24 * 60 * 60 * 1000)),
                approvalDate: approvedApplication.actionDate || new Date(),
                roomNumber: approvedApplication.allocatedRoom || approvedApplication.preferredRoom,
                roomType: 'Standard',
                residence: applicationResidence ? applicationResidence.name : 'Assigned Residence'
            } : null
        };

        console.log('Sending formatted profile:', formattedProfile);
        res.json(formattedProfile);
    } catch (error) {
        console.error('Error in getProfile:', error);
        res.status(500).json({ error: 'Server error' });
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

module.exports = {
    getAllStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    getProfile,
    updateProfile,
    changePassword,
    getCurrentResidence
}; 