const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    createBooking,
    getMyBookings,
    getBooking,
    cancelBooking,
    addPayment
} = require('../../controllers/student/bookingController');

// Validation middleware
const bookingValidation = [
    check('residenceId', 'Residence ID is required').notEmpty(),
    check('roomNumber', 'Room number is required').notEmpty(),
    check('startDate', 'Start date is required').notEmpty().isISO8601(),
    check('endDate', 'End date is required').notEmpty().isISO8601(),
    check('startDate').custom((startDate, { req }) => {
        if (new Date(startDate) < new Date()) {
            throw new Error('Start date must be in the future');
        }
        return true;
    }),
    check('endDate').custom((endDate, { req }) => {
        if (new Date(endDate) <= new Date(req.body.startDate)) {
            throw new Error('End date must be after start date');
        }
        return true;
    })
];

const paymentValidation = [
    check('amount', 'Payment amount is required').isNumeric(),
    check('method', 'Payment method is required').notEmpty(),
    check('transactionId', 'Transaction ID is required').notEmpty()
];

// All routes require student role
router.use(auth);
router.use(checkRole('student'));

// Routes
router.post('/', bookingValidation, createBooking);
router.get('/my-bookings', getMyBookings);
router.get('/:id', getBooking);
router.post('/:id/cancel', cancelBooking);
router.post('/:id/payments', paymentValidation, addPayment);

module.exports = router; 