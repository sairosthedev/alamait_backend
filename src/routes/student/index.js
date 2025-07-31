const express = require('express');
const router = express.Router();

router.use('/booking', require('./bookingRoutes'));
router.use('/booking-details', require('./bookingDetailsRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/events', require('./eventRoutes'));
router.use('/messages', require('./messageRoutes'));
// router.use('/profile', require('./profileRoutes')); // Commented out - file doesn't exist
router.use('/residence', require('./residenceRoutes'));
router.use('/student', require('./studentRoutes'));

module.exports = router; 