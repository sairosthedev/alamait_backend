const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { check } = require('express-validator');

// Import controllers (you'll need to create these)
const {
    getProfile,
    updateProfile,
    changePassword,
    getCurrentResidence
} = require('../../controllers/student/studentController');

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

module.exports = router; 