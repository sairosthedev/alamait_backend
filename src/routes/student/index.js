const express = require('express');
const router = express.Router();

router.use('/booking', require('./bookingRoutes'));
router.use('/booking-details', require('./bookingDetailsRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/events', require('./eventsRoutes'));
router.use('/messages', require('./messagesRoutes'));
router.use('/profile', require('./profileRoutes'));
router.use('/residence', require('./residenceRoutes'));
router.use('/student', require('./studentRoutes'));

module.exports = router; 