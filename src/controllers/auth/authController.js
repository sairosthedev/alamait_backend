const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/User');
const { sendEmail } = require('../../utils/email');
const { createDebtorForStudent } = require('../../services/debtorService');

// Register new user
exports.register = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password, firstName, lastName, phone, applicationCode } = req.body;
        ('Registration attempt for email:', email);

        // Check if user exists
        let user = await User.findOne({ email });
        if (user) {
            ('User already exists:', email);
            return res.status(400).json({ error: 'User already exists' });
        }

        // Create new user
        user = new User({
            email,
            firstName,
            lastName,
            phone,
            password, // The pre-save hook will hash this
            applicationCode,
            role: 'student', // Default role for registration
            isVerified: true  // Set to true since we're not doing email verification
        });

        await user.save();
        ('User saved successfully:', email);
        ('Saved user role:', user.role);
        ('Password after save:', user.password.substring(0, 10) + '...');

        // NOTE: Debtor creation is now handled by User model post-save middleware
        // This ensures debtors are only created from approved applications, not automatically
        if (user.role === 'student') {
            console.log('📝 Student registered - debtor will be created by middleware if approved application exists');
        }

        // Send verification email (same method as invoice emails)
        try {
            const verificationUrl = `${process.env.FRONTEND_URL || 'https://alamait.vercel.app'}/verify-email?token=${user.emailVerificationToken}`;
            
            await sendEmail({
                to: user.email,
                subject: 'Verify Your Email Address - Alamait Student Accommodation',
                text: `Please verify your email address by visiting: ${verificationUrl}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
                            <h2 style="color: #333;">Verify Your Email Address</h2>
                            <p>Thank you for registering with Alamait Student Accommodation!</p>
                            <p>Please click the button below to verify your email address:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${verificationUrl}" 
                                   style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Verify Email Address
                                </a>
                            </div>
                            <p>If the button doesn't work, copy and paste this link into your browser:</p>
                            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
                            <p>This link will expire in 24 hours.</p>
                            <hr style="margin: 20px 0;">
                            <p style="font-size: 12px; color: #666;">
                                This is an automated message from Alamait Student Accommodation.<br>
                                Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                `
            });
            console.log('✅ Verification email sent successfully');
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            // Continue with registration even if email fails
        }

        // Generate JWT
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
            token,
            user: {
                _id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        console.error('Error in register:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Login user
exports.login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;
        console.log('Login attempt for email:', email);
        console.log('Password provided (length):', password.length);

        // Check if user exists - always lowercase email for consistency
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.log('User not found with email:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        console.log('User found:', user.email, 'Role:', user.role);
        console.log('Stored password hash:', user.password);

        // Verify password using the model's method
        try {
            const isMatch = await user.comparePassword(password);
            console.log('Password match result:', isMatch);
            
            if (!isMatch) {
                console.log('Password verification failed for user:', email);
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        } catch (passwordError) {
            console.error('Error during password comparison:', passwordError);
            return res.status(500).json({ error: 'Error verifying credentials' });
        }

        // Generate JWT
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

        // Update last login
        user.lastLogin = Date.now();
        await user.save();

        res.json({
            token,
            user: {
                _id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Verify email
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        user.isVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        console.error('Error in verifyEmail:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Request password reset
exports.forgotPassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        await user.save();

        // Send password reset email (same method as invoice emails)
        try {
            const resetUrl = `${process.env.FRONTEND_URL || 'https://alamait.vercel.app'}/reset-password?token=${resetToken}`;
            
            await sendEmail({
                to: user.email,
                subject: 'Password Reset Request - Alamait Student Accommodation',
                text: `Reset your password by visiting: ${resetUrl}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
                            <h2 style="color: #333;">Password Reset Request</h2>
                            <p>You requested a password reset for your Alamait Student Accommodation account.</p>
                            <p>Click the button below to reset your password:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${resetUrl}" 
                                   style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Reset Password
                                </a>
                            </div>
                            <p>If the button doesn't work, copy and paste this link into your browser:</p>
                            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
                            <p><strong>Important:</strong> This link will expire in 1 hour for security reasons.</p>
                            <p>If you didn't request this password reset, please ignore this email.</p>
                            <hr style="margin: 20px 0;">
                            <p style="font-size: 12px; color: #666;">
                                This is an automated message from Alamait Student Accommodation.<br>
                                Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                `
            });
            console.log('✅ Password reset email sent successfully');
            res.json({ message: 'Password reset email sent' });
        } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);
            res.status(500).json({ error: 'Failed to send password reset email' });
        }
    } catch (error) {
        console.error('Error in forgotPassword:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Reset password
exports.resetPassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Error in resetPassword:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Temporary admin endpoint to reset user password
exports.adminResetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        
        await user.save();
        ('Password reset successfully for user:', email);

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Error in adminResetPassword:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 