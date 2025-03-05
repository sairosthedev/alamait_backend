const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { getBookingDetails } = require('../../controllers/student/bookingDetailsController');
const Application = require('../../models/Application');

// Log all requests for debugging
const loggerMiddleware = (req, res, next) => {
    console.log('Incoming request:', {
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body
    });
    next();
};

// Apply logging middleware
router.use(loggerMiddleware);

// Protected routes with authentication
router.get('/approved-application', auth, checkRole('student'), async (req, res) => {
    try {
        // Log the request for debugging
        console.log('Fetching approved application for user:', req.user?.email);
        console.log('Auth token:', req.headers.authorization);

        // Check if user exists in request
        if (!req.user || !req.user.email) {
            return res.status(401).json({
                message: 'User not authenticated',
                success: false
            });
        }

        const application = await Application.findOne({
            email: req.user.email,
            status: 'approved',
            applicationCode: { $exists: true }
        }).sort({ actionDate: -1 });

        if (!application) {
            console.log('No approved application found for user:', req.user.email);
            return res.status(404).json({ 
                message: 'No approved application found',
                success: false 
            });
        }

        console.log('Found approved application:', application);
        res.json({ 
            application,
            success: true 
        });
    } catch (error) {
        console.error('Error in approved-application route:', error);
        res.status(500).json({ 
            message: 'Server error',
            success: false,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Booking details route (protected)
router.get('/', auth, checkRole('student'), getBookingDetails);

module.exports = router; 