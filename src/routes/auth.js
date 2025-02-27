const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const {
    register,
    login,
    verifyEmail,
    forgotPassword,
    resetPassword
} = require('../controllers/auth/authController');

// Validation middleware
const registerValidation = [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('firstName', 'First name is required').notEmpty(),
    check('lastName', 'Last name is required').notEmpty(),
    check('phone', 'Phone number is required').notEmpty(),
    check('applicationCode', 'Application code is required').notEmpty()
];

const loginValidation = [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
];

const forgotPasswordValidation = [
    check('email', 'Please include a valid email').isEmail()
];

const resetPasswordValidation = [
    check('newPassword', 'Password must be at least 6 characters').isLength({ min: 6 })
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', forgotPasswordValidation, forgotPassword);
router.post('/reset-password/:token', resetPasswordValidation, resetPassword);

module.exports = router; 