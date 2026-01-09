const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const {
    register,
    login,
    verifyEmail,
    forgotPassword,
    verifyOtp,
    resetPassword,
    adminResetPassword
} = require('../controllers/auth/authController');
const { verifyApplicationCode } = require('../middleware/auth');
const Application = require('../models/Application');
const User = require('../models/User');

// Validation middleware
const registerValidation = [
    check('email', 'Please include a valid email')
        .optional({ checkFalsy: true, nullable: true }) // Allow empty strings, null, undefined
        .isEmail()
        .normalizeEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('firstName', 'First name is required').notEmpty().trim(),
    check('lastName', 'Last name is optional')
        .optional({ checkFalsy: true, nullable: true }) // Allow empty strings, null, undefined
        .trim(),
    check('phone', 'Phone number is optional')
        .optional({ checkFalsy: true, nullable: true }) // Allow empty strings, null, undefined
        .trim(),
    check('emergencyContact.name', 'Emergency contact name is optional')
        .optional({ checkFalsy: true, nullable: true })
        .trim(),
    check('emergencyContact.relationship', 'Emergency contact relationship is optional')
        .optional({ checkFalsy: true, nullable: true })
        .trim(),
    check('emergencyContact.phone', 'Emergency contact phone is optional')
        .optional({ checkFalsy: true, nullable: true })
        .trim(),
    check('applicationCode', 'Application code is required').notEmpty().trim()
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
router.post('/verify-otp', [
    check('email', 'Please include a valid email').isEmail(),
    check('otp', 'OTP is required and must be 6 digits').isLength({ min: 6, max: 6 }).isNumeric(),
    check('resetToken', 'Reset token is required').notEmpty()
], verifyOtp);
router.post('/reset-password', resetPasswordValidation.concat([
    check('token', 'Reset token is required').notEmpty(),
    check('email', 'Email is required for security verification').isEmail()
]), resetPassword);

// Validate application code
router.post('/validate-code', [
    check('applicationCode', 'Application code is required').notEmpty()
], verifyApplicationCode, (req, res) => {
    res.json({ valid: true });
});

// Temporary admin route to reset password
router.post('/admin-reset-password', [
    check('email', 'Please include a valid email').isEmail(),
    check('newPassword', 'Password is required').exists()
], adminResetPassword);

// Temporary endpoint to fix application issues (REMOVE AFTER USE - SECURITY RISK!)
// TODO: IMPORTANT - Delete this endpoint after fixing the application issue
router.get('/fix-application/:code', async (req, res) => {
    try {
        const applicationCode = req.params.code;
        
        // Find the application
        const application = await Application.findOne({ applicationCode });
        
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        // Prepare updates
        const updates = {
            applicationDate: new Date() // Fix future date
        };
        
        // Update status if waitlisted
        if (application.status === 'waitlisted') {
            updates.status = 'approved';
            
            // If there's a waitlistedRoom but no allocatedRoom, assign the waitlistedRoom
            if (application.waitlistedRoom && !application.allocatedRoom) {
                updates.allocatedRoom = application.waitlistedRoom;
            }
        }
        
        // Apply updates
        await Application.updateOne({ applicationCode }, { $set: updates });
        
        // Get updated application
        const updatedApplication = await Application.findOne({ applicationCode });
        
        res.json({
            message: 'Application fixed successfully',
            application: {
                email: updatedApplication.email,
                status: updatedApplication.status,
                applicationDate: updatedApplication.applicationDate,
                allocatedRoom: updatedApplication.allocatedRoom
            }
        });
    } catch (error) {
        console.error('Error fixing application:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Special endpoint to fix the specific APP252537 code
router.get('/fix-specific-code', async (req, res) => {
    try {
        const specificCode = 'APP252537';
        
        // Check if application with this code exists
        let application = await Application.findOne({ applicationCode: specificCode });
        
        if (application) {
            // If application exists but has wrong status, fix it
            if (application.status !== 'approved') {
                application.status = 'approved';
                
                // If there's a waitlistedRoom but no allocatedRoom, assign the waitlistedRoom
                if (application.waitlistedRoom && !application.allocatedRoom) {
                    application.allocatedRoom = application.waitlistedRoom;
                }
                
                await application.save();
                
                return res.json({
                    message: 'Existing application fixed successfully',
                    application: {
                        email: application.email,
                        status: application.status,
                        applicationCode: application.applicationCode
                    }
                });
            }
            
            return res.json({
                message: 'Application already exists and is approved',
                application: {
                    email: application.email,
                    status: application.status,
                    applicationCode: application.applicationCode
                }
            });
        }
        
        // If no application with this code exists, create a dummy one
        // This is a temporary solution - in production, you would want to verify the user's identity
        const newApplication = new Application({
            email: 'placeholder@example.com', // This should be updated with the actual user's email
            firstName: 'Placeholder',
            lastName: 'User',
            phone: '1234567890',
            requestType: 'new',
            status: 'approved',
            applicationCode: specificCode,
            preferredRoom: 'Any',
            applicationDate: new Date()
        });
        
        await newApplication.save();
        
        res.json({
            message: 'New application created with the specific code',
            application: {
                email: newApplication.email,
                status: newApplication.status,
                applicationCode: newApplication.applicationCode
            },
            note: 'This is a placeholder application. Please update the email and other details as needed.'
        });
    } catch (error) {
        console.error('Error fixing specific application code:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Reset password by email (FOR TESTING ONLY)
router.post('/reset-password-by-email', [
    check('email', 'Please include a valid email').isEmail(),
    check('newPassword', 'Password must be at least 6 characters').isLength({ min: 6 })
], async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        
        let user = await User.findOne({ email });
        
        if (!user) {
            // Check if there's an approved application for this email
            const application = await Application.findOne({ 
                email: email.toLowerCase(), 
                status: 'approved' 
            });
            
            if (application) {
                // Create a new user account from the approved application
                user = new User({
                    email: application.email,
                    firstName: application.firstName,
                    lastName: application.lastName,
                    phone: application.phone,
                    password: newPassword, // Pre-save hook will hash it
                    applicationCode: application.applicationCode,
                    role: 'student',
                    isVerified: true
                });
                
                await user.save();
                console.log('User account created from approved application for:', email);
            } else {
                return res.status(404).json({ error: 'User not found and no approved application exists' });
            }
        } else {
            // Reset the password for existing user
            user.password = newPassword; // Pre-save hook will hash it
            await user.save();
        }
        
        console.log('Password reset successfully for:', email);
        
        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router; 