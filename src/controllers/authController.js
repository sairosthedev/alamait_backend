const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

// Generate JWT Token
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// Register new user
const register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, firstName, lastName, phone, applicationCode, role } = req.body;

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Create new user
        user = new User({
            email,
            password,
            firstName,
            lastName,
            phone,
            applicationCode,
            role: role || 'student', // Default role is student
            isVerified: false
        });

        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            token,
            user: user.getPublicProfile()
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Login user
const login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.json({
            token,
            user: user.getPublicProfile()
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get current user
const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({ user: user.getPublicProfile() });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Verify email
const verifyEmail = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.isVerified = true;
        await user.save();

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    register,
    login,
    getCurrentUser,
    verifyEmail
}; 