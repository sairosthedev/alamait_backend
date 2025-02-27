const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { getBookingDetails } = require('../../controllers/student/bookingDetailsController');

// All routes require student role
router.use(auth);
router.use(checkRole('student'));

// Get booking details route
router.get('/', getBookingDetails);

module.exports = router; 