const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const {
    getBookings,
    createBooking,
    getBookingDetails,
    updateBooking,
    cancelBooking
} = require('../../controllers/student/bookingController');

// Validation middleware
const bookingValidation = [
    check('residenceId', 'Residence ID is required').notEmpty(),
    check('roomNumber', 'Room number is required').notEmpty(),
    check('startDate', 'Start date is required').isISO8601(),
    check('endDate', 'End date is required').isISO8601(),
    check('emergencyContact.name', 'Emergency contact name is required').optional().notEmpty(),
    check('emergencyContact.relationship', 'Emergency contact relationship is required').optional().notEmpty(),
    check('emergencyContact.phone', 'Emergency contact phone is required').optional().notEmpty()
];

const updateBookingValidation = [
    check('specialRequests').optional().trim(),
    check('emergencyContact.name', 'Emergency contact name is required').optional().notEmpty(),
    check('emergencyContact.relationship', 'Emergency contact relationship is required').optional().notEmpty(),
    check('emergencyContact.phone', 'Emergency contact phone is required').optional().notEmpty()
];

// All routes require student role
router.use(auth);
router.use(checkRole('student'));

// Routes
router.get('/', getBookings);
router.post('/', bookingValidation, createBooking);
router.get('/:bookingId', getBookingDetails);
router.put('/:bookingId', updateBookingValidation, updateBooking);
router.delete('/:bookingId', cancelBooking);

module.exports = router; 