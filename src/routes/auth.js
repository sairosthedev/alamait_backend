const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const { auth, verifyApplicationCode } = require('../middleware/auth');
const {
    register,
    login,
    getCurrentUser,
    verifyEmail
} = require('../controllers/authController');

// Validation middleware
const registerValidation = [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be 6 or more characters').isLength({ min: 6 }),
    check('firstName', 'First name is required').notEmpty(),
    check('lastName', 'Last name is required').notEmpty(),
    check('phone', 'Phone number is required').notEmpty(),
    check('applicationCode', 'Application code is required for registration').notEmpty()
];

const loginValidation = [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
];

// Routes
router.post('/register', [...registerValidation, verifyApplicationCode], register);
router.post('/login', loginValidation, login);
router.get('/me', auth, getCurrentUser);
router.post('/verify-email', auth, verifyEmail);

module.exports = router; 