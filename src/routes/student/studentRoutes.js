const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { check } = require('express-validator');
const leaseRoutes = require('./leaseRoutes');

// Import controllers (you'll need to create these)
const {
    getProfile,
    updateProfile,
    changePassword,
    getCurrentResidence,
    getAllUsersForMessaging,
    downloadLeaseAgreement,
    uploadSignedLeaseHandler
} = require('../../controllers/student/studentController');

// Import payment history controller
const { getPaymentHistory } = require('../../controllers/student/paymentHistoryController');

// Validation middleware
const profileUpdateValidation = [
    check('firstName', 'First name is required').optional().notEmpty(),
    check('lastName', 'Last name is required').optional().notEmpty(),
    check('phone', 'Phone number is required').optional().notEmpty(),
    check('emergencyContact.name', 'Emergency contact name is required').optional().notEmpty(),
    check('emergencyContact.relationship', 'Emergency contact relationship is required').optional().notEmpty(),
    check('emergencyContact.phone', 'Emergency contact phone is required').optional().notEmpty()
];

const passwordValidation = [
    check('currentPassword', 'Current password is required').notEmpty(),
    check('newPassword', 'Please enter a password with 8 or more characters').isLength({ min: 8 })
];

// All routes require student role
router.use(auth);
router.use(checkRole('student'));

// Routes
router.get('/profile', getProfile);
router.put('/profile', profileUpdateValidation, updateProfile);

// Change password route
router.put('/profile/change-password', passwordValidation, changePassword);

router.get('/current-residence', getCurrentResidence);

// Add route for getting all students for messaging
router.get('/users/students', getAllUsersForMessaging);

// Add route for downloading lease agreement as PDF
router.get('/lease-agreement', downloadLeaseAgreement);

// Add route for uploading signed lease
router.post('/lease-agreement/upload', uploadSignedLeaseHandler);

// Add payment history route
router.get('/paymenthistory', getPaymentHistory);

router.use('/lease', leaseRoutes);

module.exports = router; 