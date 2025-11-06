const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { check } = require('express-validator');
const leaseRoutes = require('./leaseRoutes');
const Lease = require('../../models/Lease');

// Import controllers (you'll need to create these)
const {
    getProfile,
    updateProfile,
    changePassword,
    getCurrentResidence,
    getAllUsersForMessaging,
    downloadLeaseAgreement,
    uploadSignedLeaseHandler,
    getSignedLeases,
    getStudentApplication
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

// All routes require student role (or admin/finance for certain operations)
router.use(auth);
router.use(checkRole('student', 'admin', 'finance_admin', 'finance_user', 'ceo'));

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

// Add route for getting signed leases (student's own leases only)
router.get('/signed-leases', getSignedLeases);

// Add payment history route
router.get('/paymenthistory', getPaymentHistory);

// Add the new route
router.get('/application', getStudentApplication);

// Get all leases for the current student
router.get('/leases', async (req, res) => {
  try {
    const userId = req.user._id;
    const leases = await Lease.find({ studentId: userId }).sort({ uploadedAt: -1 });
    res.json({ success: true, leases });
  } catch (error) {
    console.error('Error fetching student leases:', error);
    res.status(500).json({ error: 'Failed to fetch student leases' });
  }
});

router.use('/lease', leaseRoutes);

module.exports = router; 