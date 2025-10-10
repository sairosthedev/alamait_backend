const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const path = require('path');
const fs = require('fs');
const Lease = require('../../models/Lease');
const Application = require('../../models/Application');
const ExpiredStudent = require('../../models/ExpiredStudent');
const { Residence } = require('../../models/Residence');
const User = require('../../models/User');
const Booking = require('../../models/Booking');
const { adminUploadSignedLease } = require('../../controllers/admin/studentController');
const admin = require('../../middleware/admin');
const excelUpload = require('../../middleware/excelUpload');
const StudentDeletionService = require('../../services/studentDeletionService');

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
    getAllSignedLeases,
    manualAddStudent,
    uploadCsvStudents,
    uploadExcelStudents,
    getStudentCsvTemplate,
    getStudentExcelTemplate,
    backfillAllTransactions,
    backfillDebtorTransactions
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

// Comprehensive validation for manual student addition
const manualStudentValidation = [
    check('email', 'Please include a valid email').isEmail(),
    check('firstName', 'First name is required').notEmpty().trim(),
    check('lastName', 'Last name is required').notEmpty().trim(),
    check('phone', 'Phone number is required').notEmpty().trim(),
    check('emergencyContact.name', 'Emergency contact name is required').notEmpty().trim(),
    check('emergencyContact.relationship', 'Emergency contact relationship is required').notEmpty().trim(),
    check('emergencyContact.phone', 'Emergency contact phone is required').notEmpty().trim(),
    check('residenceId', 'Residence ID is required').isMongoId(),
    check('roomNumber', 'Room number is required').notEmpty().trim(),
    check('startDate', 'Start date is required').isISO8601().toDate(),
    check('endDate', 'End date is required').isISO8601().toDate(),
    check('monthlyRent', 'Monthly rent is required').isNumeric().withMessage('Monthly rent must be a number'),
    check('securityDeposit').optional().isNumeric().withMessage('Security deposit must be a number'),
    check('adminFee').optional().isNumeric().withMessage('Admin fee must be a number'),
    check('endDate').custom((endDate, { req }) => {
        const startDate = new Date(req.body.startDate);
        const endDateObj = new Date(endDate);
        if (endDateObj <= startDate) {
            throw new Error('End date must be after start date');
        }
        return true;
    })
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

router.post('/', studentValidation, createStudent);
router.post('/manual-add', manualStudentValidation, manualAddStudent);

/**
 * Upload CSV for bulk student creation
 * POST /api/admin/students/upload-csv
 */
router.post('/upload-csv', auth, checkRole(['admin']), uploadCsvStudents);

/**
 * Upload Excel for bulk student creation
 * POST /api/admin/students/upload-excel
 */
router.post('/upload-excel', auth, checkRole(['admin']), excelUpload.single('file'), uploadExcelStudents);

/**
 * Get CSV template for student upload
 * GET /api/admin/students/csv-template
 */
router.get('/csv-template', auth, checkRole(['admin']), getStudentCsvTemplate);

/**
 * Get Excel template for student upload
 * GET /api/admin/students/excel-template
 */
router.get('/excel-template', auth, checkRole(['admin']), getStudentExcelTemplate);

/**
 * Manual backfill transactions for all debtors
 * POST /api/admin/students/backfill-transactions
 */
router.post('/backfill-transactions', auth, checkRole(['admin']), backfillAllTransactions);

/**
 * Manual backfill transactions for a specific debtor
 * POST /api/admin/students/:debtorId/backfill-transactions
 */
router.post('/:debtorId/backfill-transactions', auth, checkRole(['admin']), backfillDebtorTransactions);

router.get('/:studentId', getStudentById);
router.put('/:studentId', studentValidation, updateStudent);
router.delete('/:studentId', auth, checkRole(['admin']), deleteStudent);
router.get('/:studentId/payments', getStudentPayments);
router.get('/:studentId/leases', getStudentLeases);
router.get('/lease-agreement/:studentId', downloadSignedLease);
router.post('/:studentId/lease', admin, adminUploadSignedLease);

module.exports = router; 