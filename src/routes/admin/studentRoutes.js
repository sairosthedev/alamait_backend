const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const path = require('path');
const fs = require('fs');
const Lease = require('../../models/Lease');
const Application = require('../../models/Application');
const ExpiredStudent = require('../../models/ExpiredStudent');
const Residence = require('../../models/Residence');
const User = require('../../models/User');
const Booking = require('../../models/Booking');

const {
    getAllStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    getStudentPayments,
    getStudentLeases,
    downloadSignedLease,
    getExpiredStudents,
    getAllSignedLeases
} = require('../../controllers/admin/studentController');

// Validation middleware
const studentValidation = [
    check('email', 'Please include a valid email').isEmail(),
    check('firstName', 'First name is required').notEmpty(),
    check('lastName', 'Last name is required').notEmpty(),
    check('phone', 'Phone number is required').optional().notEmpty(),
    check('status').optional().isIn(['active', 'inactive', 'pending']),
    check('emergencyContact.name', 'Emergency contact name is required').optional().notEmpty(),
    check('emergencyContact.relationship', 'Emergency contact relationship is required').optional().notEmpty(),
    check('emergencyContact.phone', 'Emergency contact phone is required').optional().notEmpty(),
    check('residenceId', 'Residence ID is required').notEmpty().isMongoId().withMessage('Invalid residence ID format')
];

// All routes require admin role
router.use(auth);
router.use(checkRole('admin', 'finance', 'finance_admin', 'finance_user'));

// Place fixed routes BEFORE any :studentId routes
router.get('/all-signed-leases', getAllSignedLeases);
router.get('/expired', getExpiredStudents);

// Modified GET students route to handle both list and detailed views
router.get('/', async (req, res) => {
    try {
        // If list parameter is true, return simplified list for message recipients
        if (req.query.list === 'true') {
            const students = await User.find({ role: 'student' })
                .select('_id firstName lastName')
                .sort('firstName')
                .lean();
            return res.json(students);
        }
        // Otherwise, use the original getStudents controller
        return getAllStudents(req, res);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ error: 'Error fetching students' });
    }
});

// Route to check for and download a student's lease
router.all('/:studentId/download-lease', async (req, res) => {
    try {
        const { studentId } = req.params;

        // Find the latest lease for the specified student
        const lease = await Lease.findOne({ studentId }).sort({ uploadedAt: -1 });

        if (!lease) {
            return res.status(404).json({ message: 'No lease agreement found for this student.' });
        }

        // lease.path now contains an S3 URL
        if (lease.path && lease.path.startsWith('http')) {
            if (req.method === 'HEAD') {
                // If the frontend is just checking for existence, send a success status
                res.status(200).end();
            } else {
                // If the frontend wants the file, redirect to S3 URL
                res.redirect(lease.path);
            }
        } else {
            return res.status(404).json({ message: 'Lease file not available.' });
        }
    } catch (error) {
        console.error('Error fetching lease for download:', error);
        res.status(500).json({ message: 'Server error while fetching lease.' });
    }
});

router.post('/residence/:residenceId', [
    check('email', 'Please include a valid email').isEmail(),
    check('firstName', 'First name is required').notEmpty(),
    check('lastName', 'Last name is required').notEmpty(),
    check('phone', 'Phone number is required').optional().notEmpty(),
    check('status').optional().isIn(['active', 'inactive', 'pending']),
    check('emergencyContact.name', 'Emergency contact name is required').optional().notEmpty(),
    check('emergencyContact.relationship', 'Emergency contact relationship is required').optional().notEmpty(),
    check('emergencyContact.phone', 'Emergency contact phone is required').optional().notEmpty()
], createStudent);

router.get('/:studentId', getStudentById);
router.put('/:studentId', studentValidation, updateStudent);
router.delete('/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const student = await User.findById(studentId);

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const application = await Application.findOne({ student: student._id }).sort({ createdAt: -1 });
        if (application) {
            // Archive before removing the user and application
            try {
                let user = null;
                if (application.student) {
                    user = await User.findById(application.student._id);
                }
                // Fetch payment history
                let paymentHistory = [];
                if (user) {
                    const bookings = await Booking.find({ student: user._id }).lean();
                    paymentHistory = bookings.flatMap(booking => booking.payments || []);
                }
                // Fetch leases
                let leases = [];
                if (user) {
                    leases = await Lease.find({ studentId: user._id }).lean();
                }
                await ExpiredStudent.create({
                    student: user ? user.toObject() : null,
                    application: application.toObject(),
                    previousApplicationCode: application.applicationCode,
                    archivedAt: new Date(),
                    reason: 'application_deleted',
                    paymentHistory,
                    leases
                });
            } catch (archiveError) {
                console.error('Error archiving to ExpiredStudent:', archiveError);
            }
        }

        if (student.residence && student.currentRoom) {
            const residence = await Residence.findById(student.residence);
            if (residence) {
                const room = residence.rooms.find(r => r.roomNumber === student.currentRoom);
                if (room) {
                    room.currentOccupancy = Math.max(0, (room.currentOccupancy || 1) - 1);
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
        res.status(200).json({ message: 'Student archived successfully' });
    } catch (error) {
        console.error('Error archiving student:', error);
        res.status(500).json({ error: 'Error archiving student' });
    }
});
router.get('/:studentId/payments', getStudentPayments);
router.get('/:studentId/leases', getStudentLeases);
router.get('/lease-agreement/:studentId', downloadSignedLease);

module.exports = router; 