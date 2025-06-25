const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const {
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    getStudentPayments,
    downloadSignedLease
} = require('../../controllers/admin/studentController');
const User = require('../../models/User');

// Validation middleware
const studentValidation = [
    check('email', 'Please include a valid email').isEmail(),
    check('firstName', 'First name is required').notEmpty(),
    check('lastName', 'Last name is required').notEmpty(),
    check('phone', 'Phone number is required').optional().notEmpty(),
    check('status').optional().isIn(['active', 'inactive', 'pending']),
    check('emergencyContact.name', 'Emergency contact name is required').optional().notEmpty(),
    check('emergencyContact.relationship', 'Emergency contact relationship is required').optional().notEmpty(),
    check('emergencyContact.phone', 'Emergency contact phone is required').optional().notEmpty()
];

// All routes require admin role
router.use(auth);
router.use(checkRole('admin'));

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
        return getStudents(req, res);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ error: 'Error fetching students' });
    }
});

router.post('/', studentValidation, createStudent);
router.get('/:studentId', getStudentById);
router.put('/:studentId', studentValidation, updateStudent);
router.delete('/:studentId', deleteStudent);
router.get('/:studentId/payments', getStudentPayments);
router.get('/lease-agreement/:studentId', downloadSignedLease);

module.exports = router; 