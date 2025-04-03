const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { 
    getCurrentBooking,
    getBookingHistory,
    getAvailableRooms,
    getApprovedApplication,
    requestRoomChange
} = require('../../controllers/student/bookingDetailsController');
const Residence = require('../../models/Residence');

// Log all requests for debugging
const loggerMiddleware = (req, res, next) => {
    ('Incoming request:', {
        method: req.method,
        path: req.path,
        headers: {
            ...req.headers,
            authorization: req.headers.authorization ? '[REDACTED]' : undefined
        },
        body: req.body,
        user: req.user ? {
            id: req.user._id,
            email: req.user.email,
            role: req.user.role
        } : 'No user'
    });
    next();
};

// Apply logging middleware
router.use(loggerMiddleware);

// Debug route to check residences and rooms
router.get('/debug/residences', async (req, res) => {
    try {
        const residences = await Residence.find({ status: 'active' });
        const residenceData = residences.map(residence => ({
            id: residence._id,
            name: residence.name,
            totalRooms: residence.rooms.length,
            rooms: residence.rooms.map(room => ({
                roomNumber: room.roomNumber,
                type: room.type,
                price: room.price,
                currentOccupancy: room.currentOccupancy,
                capacity: room.capacity,
                status: room.status
            }))
        }));
        
        res.json({
            success: true,
            count: residences.length,
            residences: residenceData
        });
    } catch (error) {
        console.error('Error in debug route:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Booking details service is running' });
});

// Protected routes - require authentication and student role
router.use(auth, checkRole('student'));

// Get current booking
router.get('/current', getCurrentBooking);

// Get booking history
router.get('/history', getBookingHistory);

// Get available rooms
router.get('/available-rooms', getAvailableRooms);

// Get approved application
router.get('/approved-application', getApprovedApplication);

// Request room change
router.post('/request-room-change', requestRoomChange);

module.exports = router; 