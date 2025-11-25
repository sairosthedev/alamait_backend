const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/User');
const { sendEmail } = require('../../utils/email');
const { createDebtorForStudent } = require('../../services/debtorService');
const { logAuthOperation, createAuditLog } = require('../../utils/auditLogger');

/**
 * Get real client IP address (handles proxies and localhost)
 */
const getRealClientIp = (req) => {
    // Try various headers and methods to get real IP
    let ip = req.headers['x-forwarded-for'];
    if (ip) {
        // X-Forwarded-For can contain multiple IPs, get the first one
        ip = ip.split(',')[0].trim();
        // Remove IPv6 prefix if present
        if (ip.startsWith('::ffff:')) {
            ip = ip.substring(7);
        }
    }
    
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
        ip = req.headers['x-real-ip'];
    }
    
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
        ip = req.headers['cf-connecting-ip']; // Cloudflare
    }
    
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
        ip = req.headers['x-client-ip'];
    }
    
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
        ip = req.connection?.remoteAddress;
    }
    
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
        ip = req.socket?.remoteAddress;
    }
    
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
        ip = req.ip;
    }
    
    // Remove IPv6 prefix if present
    if (ip && ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
    }
    
    // If still localhost, try to get from socket connection
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
        const socket = req.connection?.socket || req.socket;
        if (socket) {
            ip = socket.remoteAddress;
            if (ip && ip.startsWith('::ffff:')) {
                ip = ip.substring(7);
            }
        }
    }
    
    return ip || 'unknown';
};

/**
 * Generate device identifier/fingerprint from request headers
 * Creates a unique identifier for the device/laptop using IP address and device info
 */
const getDeviceIdentifier = (req) => {
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const ip = getRealClientIp(req);
    
    // Create device fingerprint from available information
    // Use IP as primary identifier, combined with device characteristics
    const deviceString = `${ip}|${userAgent}|${acceptLanguage}|${acceptEncoding}`;
    const deviceHash = crypto.createHash('sha256').update(deviceString).digest('hex');
    
    // Create a readable device identifier using IP and device type
    // Format: IP-DeviceType-ShortHash (e.g., "192.168.1.100-desktop-a1b2c3d4")
    
    // Extract device type and name from User Agent
    let deviceType = 'unknown';
    let deviceName = 'unknown';
    
    if (userAgent) {
        // Check for mobile devices
        if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
            deviceType = 'mobile';
        } else if (/tablet|ipad/i.test(userAgent)) {
            deviceType = 'tablet';
        } else {
            deviceType = 'desktop';
        }
        
        // Extract browser and OS info
        const browserMatch = userAgent.match(/(?:Chrome|Firefox|Safari|Edge|Opera|MSIE)\/([\d.]+)/i);
        const osMatch = userAgent.match(/(?:Windows|Mac OS|Linux|Android|iOS|iPhone|iPad)/i);
        
        if (browserMatch && osMatch) {
            deviceName = `${osMatch[0]} - ${browserMatch[0].split('/')[0]}`;
        } else if (osMatch) {
            deviceName = osMatch[0];
        } else if (browserMatch) {
            deviceName = browserMatch[0].split('/')[0];
        }
    }
    
    // Create readable device identifier
    const deviceIdentifier = `${ip}-${deviceType}-${deviceHash.substring(0, 8)}`;
    
    return {
        deviceHash: deviceHash.substring(0, 16), // Short hash for display
        deviceAddress: deviceHash, // Full hash for unique identification
        deviceIdentifier: deviceIdentifier, // Readable identifier: IP-DeviceType-ShortHash
        deviceIp: ip, // Actual IP address
        deviceType,
        deviceName,
        userAgent
    };
};

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
        
        // Check if password is SHA-256 hash (from client-side hashing)
        const { isSha256Hash } = require('../../utils/clientPasswordHash');
        const isHashed = isSha256Hash(password);
        console.log('Password provided: [REDACTED]');
        console.log('Password format:', isHashed ? 'SHA-256 hash (client-side hashed)' : 'Plain text');
        console.log('Password length:', password ? password.length : 0);

        // Get device information including real IP address
        const deviceInfo = getDeviceIdentifier(req);
        const clientIp = deviceInfo.deviceIp; // Use real IP from device info
        const attemptTime = new Date().toISOString();

        // Check if user exists - always lowercase email for consistency
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Log failed login attempt to audit log (no userId available)
            const userAgent = req.headers['user-agent'] || 'unknown';
            console.log('⚠️ FAILED LOGIN ATTEMPT - User Not Found');
            console.log('Email:', email);
            console.log('Attempt Time:', attemptTime);
            console.log('Device IP Address:', deviceInfo.deviceIp);
            console.log('Device Identifier:', deviceInfo.deviceIdentifier);
            console.log('Device Address (Hash):', deviceInfo.deviceAddress);
            console.log('Device Type:', deviceInfo.deviceType);
            console.log('Device Name:', deviceInfo.deviceName);
            console.log('User Agent:', userAgent);
            console.log('-'.repeat(80));
            
            // Log to audit log with system user ID for failed attempts
            try {
                await createAuditLog({
                    action: 'login',
                    collection: 'User',
                    recordId: null,
                    userId: '68b7909295210ad2fa2c5dcf', // System user ID for failed attempts
                    details: JSON.stringify({
                        event: 'failed_login_attempt',
                        reason: 'user_not_found',
                        email: email,
                        timestamp: attemptTime,
                        deviceIp: deviceInfo.deviceIp,
                        deviceIdentifier: deviceInfo.deviceIdentifier,
                        deviceAddress: deviceInfo.deviceAddress,
                        deviceHash: deviceInfo.deviceHash,
                        deviceType: deviceInfo.deviceType,
                        deviceName: deviceInfo.deviceName
                    }),
                    ipAddress: deviceInfo.deviceIp, // Use real IP
                    userAgent: userAgent,
                    statusCode: 401,
                    errorMessage: 'Invalid credentials - User not found'
                });
            } catch (auditError) {
                console.error('Failed to log audit entry for failed login:', auditError);
            }
            
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        console.log('User found:', user.email, 'Role:', user.role);
        console.log('Password hash: [REDACTED]');

        // Verify password using the model's method
        try {
            const isMatch = await user.comparePassword(password);
            console.log('Password match result:', isMatch);
            
            // Check if login failed due to format mismatch (SHA-256 hash vs old format)
            if (!isMatch && isHashed && user._formatMismatch) {
                console.log('⚠️ Login failed: Client sent SHA-256 hash but user has old password format');
                console.log('   Solution: User needs to login with plain text password once to migrate');
            }
            
            if (!isMatch) {
                // Log failed login attempt to audit log
                const userAgent = req.headers['user-agent'] || 'unknown';
                console.log('⚠️ FAILED LOGIN ATTEMPT - Invalid Password');
                console.log('User:', `${user.firstName} ${user.lastName}`);
                console.log('Email:', user.email);
                console.log('User ID:', user._id);
                console.log('Role:', user.role);
                console.log('Attempt Time:', attemptTime);
                console.log('Device IP Address:', deviceInfo.deviceIp);
                console.log('Device Identifier:', deviceInfo.deviceIdentifier);
                console.log('Device Address (Hash):', deviceInfo.deviceAddress);
                console.log('Device Type:', deviceInfo.deviceType);
                console.log('Device Name:', deviceInfo.deviceName);
                console.log('User Agent:', userAgent);
                console.log('-'.repeat(80));
                
                // Log to audit log
                try {
                    await logAuthOperation(
                        'login',
                        user._id,
                        JSON.stringify({
                            event: 'failed_login_attempt',
                            reason: 'invalid_password',
                            email: user.email,
                            timestamp: attemptTime,
                            deviceIp: deviceInfo.deviceIp,
                            deviceIdentifier: deviceInfo.deviceIdentifier,
                            deviceAddress: deviceInfo.deviceAddress,
                            deviceHash: deviceInfo.deviceHash,
                            deviceType: deviceInfo.deviceType,
                            deviceName: deviceInfo.deviceName
                        }),
                        deviceInfo.deviceIp, // Use real IP
                        userAgent
                    );
                } catch (auditError) {
                    console.error('Failed to log audit entry for failed login:', auditError);
                }
                
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

        const loginTime = new Date().toISOString();
        const userAgent = req.headers['user-agent'] || 'unknown';
        
        // Log successful login event with user info, time, IP, and device
        console.log('='.repeat(80));
        console.log('🔐 SUCCESSFUL LOGIN EVENT');
        console.log('='.repeat(80));
        console.log('User:', `${user.firstName} ${user.lastName}`);
        console.log('Email:', user.email);
        console.log('User ID:', user._id);
        console.log('Role:', user.role);
        console.log('Login Time:', loginTime);
        console.log('Device IP Address:', deviceInfo.deviceIp);
        console.log('Device Identifier:', deviceInfo.deviceIdentifier);
        console.log('Device Address (Hash):', deviceInfo.deviceAddress);
        console.log('Device Hash:', deviceInfo.deviceHash);
        console.log('Device Type:', deviceInfo.deviceType);
        console.log('Device Name:', deviceInfo.deviceName);
        console.log('User Agent:', userAgent);
        console.log('='.repeat(80));

        // Update last login
        user.lastLogin = Date.now();
        
        // Migrate password if user logged in with plain text (old format)
        // Convert to new format (bcrypt(SHA256)) for future logins with client-side hashing
        if (user._plainPasswordLogin && user._plainPasswordForMigration) {
            try {
                const { hashPasswordSha256 } = require('../../utils/clientPasswordHash');
                const sha256Hash = hashPasswordSha256(user._plainPasswordForMigration);
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(sha256Hash, salt);
                console.log('✅ Migrated user password from old format to new format (bcrypt(SHA256))');
                // Clear migration flags
                delete user._plainPasswordLogin;
                delete user._plainPasswordForMigration;
            } catch (migrationError) {
                console.error('⚠️ Failed to migrate password:', migrationError);
                // Don't fail login if migration fails
            }
        }
        
        await user.save();

        // Log successful login to audit log with device information
        try {
            await logAuthOperation(
                'login',
                user._id,
                JSON.stringify({
                    event: 'successful_login',
                    email: user.email,
                    role: user.role,
                    timestamp: loginTime,
                    deviceIp: deviceInfo.deviceIp,
                    deviceIdentifier: deviceInfo.deviceIdentifier,
                    deviceAddress: deviceInfo.deviceAddress,
                    deviceHash: deviceInfo.deviceHash,
                    deviceType: deviceInfo.deviceType,
                    deviceName: deviceInfo.deviceName
                }),
                deviceInfo.deviceIp, // Use real IP
                userAgent
            );
            
            // Also track in UserActivity for comprehensive activity tracking
            const UserActivityService = require('../services/userActivityService');
            await UserActivityService.trackLogin(user._id, req, deviceInfo);
        } catch (auditError) {
            console.error('Failed to log audit entry for successful login:', auditError);
            // Don't fail the login if audit logging fails
        }

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

// Request password reset - sends OTP to email
exports.forgotPassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Don't reveal if user exists for security
            return res.json({ message: 'If the email exists, an OTP has been sent' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 600000; // 10 minutes

        // Store OTP and reset verification status
        user.resetPasswordOtp = otp;
        user.resetPasswordOtpExpires = otpExpires;
        user.resetPasswordOtpVerified = false;
        // Also keep reset token for backward compatibility if needed
        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        await user.save();

        // Send OTP email
        try {
            await sendEmail({
                to: user.email,
                subject: 'Password Reset OTP - Alamait Student Accommodation',
                text: `Your password reset OTP is: ${otp}\n\nThis OTP will expire in 10 minutes.\n\nIf you didn't request this password reset, please ignore this email.`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
                            <h2 style="color: #333;">Password Reset Verification</h2>
                            <p>You requested a password reset for your Alamait Student Accommodation account.</p>
                            <p>Use the following OTP (One-Time Password) to verify your identity:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <div style="background-color: #007bff; color: white; padding: 20px; border-radius: 10px; font-size: 32px; font-weight: bold; letter-spacing: 10px; display: inline-block;">
                                    ${otp}
                                </div>
                            </div>
                            <p><strong>Important:</strong> This OTP will expire in 10 minutes for security reasons.</p>
                            <p>If you didn't request this password reset, please ignore this email and your account will remain secure.</p>
                            <hr style="margin: 20px 0;">
                            <p style="font-size: 12px; color: #666;">
                                This is an automated message from Alamait Student Accommodation.<br>
                                Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                `
            });
            console.log(`✅ Password reset OTP sent successfully to ${user.email}`);
            res.json({ 
                message: 'If the email exists, an OTP has been sent',
                // Include token for frontend to use in verify-otp endpoint
                resetToken: resetToken
            });
        } catch (emailError) {
            console.error('Failed to send password reset OTP email:', emailError);
            res.status(500).json({ error: 'Failed to send password reset OTP email' });
        }
    } catch (error) {
        console.error('Error in forgotPassword:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Verify OTP for password reset
exports.verifyOtp = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, otp, resetToken } = req.body;

        const user = await User.findOne({
            email: email.toLowerCase(),
            resetPasswordToken: resetToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset request' });
        }

        // Check if OTP matches and is not expired
        if (user.resetPasswordOtp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        if (!user.resetPasswordOtpExpires || user.resetPasswordOtpExpires < Date.now()) {
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        // Mark OTP as verified
        user.resetPasswordOtpVerified = true;
        await user.save();

        console.log(`✅ OTP verified successfully for ${user.email}`);
        res.json({ 
            message: 'OTP verified successfully',
            verified: true,
            resetToken: resetToken // Return token for password reset
        });
    } catch (error) {
        console.error('Error in verifyOtp:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Reset password - requires OTP verification
exports.resetPassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { token, email, newPassword } = req.body;

        const user = await User.findOne({
            email: email ? email.toLowerCase() : undefined,
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Check if OTP has been verified
        if (!user.resetPasswordOtpVerified) {
            return res.status(400).json({ 
                error: 'OTP not verified. Please verify the OTP first.',
                requiresOtpVerification: true
            });
        }

        // Normalize password (handle client-side hashing)
        // This ensures the password is stored in new format (bcrypt(SHA256_hash))
        const { normalizePassword } = require('../../utils/clientPasswordHash');
        const normalizedPassword = normalizePassword(newPassword);

        // Set password - the pre-save hook will hash it with bcrypt
        user.password = normalizedPassword;
        
        // Clear reset fields
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.resetPasswordOtp = undefined;
        user.resetPasswordOtpExpires = undefined;
        user.resetPasswordOtpVerified = false;

        await user.save();

        console.log(`✅ Password reset successful for ${user.email}`);
        console.log(`   Password has been migrated to new format (bcrypt(SHA256_hash))`);
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