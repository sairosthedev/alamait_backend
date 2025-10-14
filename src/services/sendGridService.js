const sgMail = require('@sendgrid/mail');

class SendGridService {
    constructor() {
        this.isConfigured = false;
        this.initialize();
    }

    initialize() {
        if (process.env.SENDGRID_API_KEY) {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            this.isConfigured = true;
            console.log('✅ SendGrid configured successfully');
        } else {
            console.warn('⚠️ SendGrid API key not found - SENDGRID_API_KEY environment variable required');
        }
    }

    async sendEmail(options) {
        if (!this.isConfigured) {
            throw new Error('SendGrid not configured - missing SENDGRID_API_KEY');
        }

        const { to, subject, text, html, attachments } = options;
        
        console.log(`📧 SendGrid: Sending email to ${to}`);

        const msg = {
            to: to,
            from: {
                email: process.env.SENDGRID_FROM_EMAIL || 'noreply@alamait.com',
                name: 'Alamait Student Accommodation'
            },
            replyTo: {
                email: process.env.SENDGRID_REPLY_TO || 'support@alamait.com',
                name: 'Alamait Support Team'
            },
            subject: subject,
            text: text,
            html: html
        };

        // Add attachments if provided
        if (attachments && attachments.length > 0) {
            msg.attachments = attachments.map(att => ({
                content: att.content.toString('base64'),
                filename: att.filename,
                type: att.contentType,
                disposition: 'attachment'
            }));
        }

        try {
            await sgMail.send(msg);
            console.log(`✅ SendGrid: Email sent successfully to ${to}`);
            return true;
        } catch (error) {
            console.error(`❌ SendGrid: Failed to send email to ${to}:`, error.message);
            throw error;
        }
    }

    isReady() {
        return this.isConfigured;
    }

    // Send verification email for user registration
    async sendVerificationEmail(email, token) {
        const verificationUrl = `${process.env.FRONTEND_URL || 'https://alamait.vercel.app'}/verify-email?token=${token}`;
        
        const emailContent = `
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
        `;

        return await this.sendEmail({
            to: email,
            subject: 'Verify Your Email Address - Alamait Student Accommodation',
            text: `Please verify your email address by visiting: ${verificationUrl}`,
            html: emailContent
        });
    }

    // Send password reset email
    async sendPasswordResetEmail(email, token) {
        const resetUrl = `${process.env.FRONTEND_URL || 'https://alamait.vercel.app'}/reset-password?token=${token}`;
        
        const emailContent = `
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
        `;

        return await this.sendEmail({
            to: email,
            subject: 'Password Reset Request - Alamait Student Accommodation',
            text: `Reset your password by visiting: ${resetUrl}`,
            html: emailContent
        });
    }
}

module.exports = new SendGridService();