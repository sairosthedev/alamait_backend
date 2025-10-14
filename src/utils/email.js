const nodemailer = require('nodemailer');
const EmailOutbox = require('../models/EmailOutbox');
const sendGridService = require('../services/sendGridService');

// Create transporter with optimized Gmail configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: false, // Disable pooling to avoid connection issues
    connectionTimeout: 60000, // 60 seconds
    greetingTimeout: 30000,   // 30 seconds
    socketTimeout: 90000,     // 90 seconds
    secure: true,
    tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
    },
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

/**
 * Send email using nodemailer
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Email text content
 * @param {string} [options.html] - Optional HTML content
 */
exports.sendEmail = async (options) => {
    try {
        // Check if email configuration is available
        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
            console.warn('⚠️ Email configuration missing - EMAIL_USER or EMAIL_APP_PASSWORD not set');
            console.warn('📧 Email will be queued but not sent until configuration is complete');
            
            // Try to create outbox entry, but don't fail if MongoDB is not connected
            try {
                const outbox = await EmailOutbox.create({
                    to: options.to,
                    subject: options.subject,
                    text: options.text,
                    html: options.html,
                    attachments: options.attachments,
                    status: 'queued',
                    scheduledAt: new Date()
                });
                console.log(`📬 Email queued (no config): ${options.to} → ${options.subject}`);
            } catch (dbError) {
                console.warn('⚠️ Could not save email to outbox (MongoDB not connected):', dbError.message);
                console.log(`📧 Email would be sent to: ${options.to} → ${options.subject}`);
            }
            return; // Exit early - don't attempt to send
        }

        // Create outbox entry first
        const outbox = await EmailOutbox.create({
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            attachments: options.attachments,
            status: 'queued',
            scheduledAt: new Date()
        });

        // 🚀 IMMEDIATE SEND MODE: Always try to send immediately, queue as fallback
        const sendMode = (process.env.EMAIL_SEND_MODE || '').toLowerCase();
        console.log(`📧 Email send mode: ${sendMode || 'immediate'} (NODE_ENV: ${process.env.NODE_ENV})`);
        
        // Skip queue-only mode - always attempt immediate send first
        // if (process.env.NODE_ENV === 'production' && sendMode === 'queue') {
        //     try {
        //         console.log(`📬 Queued email (queue-first mode): ${options.to} → ${options.subject}`);
        //     } catch (_) {}
        //     return; // do not attempt immediate send; outbox service will deliver
        // }

        // 🚀 IMMEDIATE SEND: Try SendGrid first, then Gmail fallback
        console.log(`📧 Attempting immediate email send to ${options.to}`);
        
        // Try SendGrid first (most reliable for production)
        if (sendGridService.isReady()) {
            try {
                console.log(`📧 Trying SendGrid first...`);
                await sendGridService.sendEmail(options);
                console.log(`✅ Email sent via SendGrid to ${options.to}`);
                
                // Mark outbox as sent
                outbox.status = 'sent';
                outbox.sentAt = new Date();
                outbox.attempts = (outbox.attempts || 0) + 1;
                await outbox.save();
                return;
            } catch (error) {
                console.error(`❌ SendGrid failed for ${options.to}:`, error.message);
                console.log(`📧 Falling back to Gmail...`);
            }
        } else {
            console.log(`📧 SendGrid not configured, using Gmail...`);
        }

        // Fallback to Gmail with retry logic
        const freshTransporter = nodemailer.createTransport({
            service: 'gmail',
            pool: false, // No pooling
            connectionTimeout: 60000, // 60 seconds
            greetingTimeout: 30000,   // 30 seconds
            socketTimeout: 90000,     // 90 seconds
            secure: true,
            tls: {
                rejectUnauthorized: false,
                ciphers: 'SSLv3'
            },
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_APP_PASSWORD
            }
        });

        const mailOptions = {
            from: `Alamait Student Accommodation <${process.env.EMAIL_USER}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            attachments: options.attachments
        };

        try {
            // Try Gmail with retry logic
            let lastError;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    console.log(`📧 Gmail send attempt ${attempt}/3 for ${options.to}`);
                    
                    const sendPromise = freshTransporter.sendMail(mailOptions);
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Email send timeout')), 120000); // 2 minutes
                    });
                    
                    await Promise.race([sendPromise, timeoutPromise]);
                    console.log(`✅ Email sent via Gmail to ${options.to} (attempt ${attempt})`);
                    
                    // Mark outbox as sent
                    outbox.status = 'sent';
                    outbox.sentAt = new Date();
                    outbox.attempts = (outbox.attempts || 0) + 1;
                    await outbox.save();
                    
                    // Close the fresh transporter
                    freshTransporter.close();
                    return;
                } catch (error) {
                    lastError = error;
                    console.error(`❌ Gmail attempt ${attempt} failed for ${options.to}:`, error.message);
                    
                    if (attempt < 3) {
                        // Wait before retry
                        await new Promise(resolve => setTimeout(resolve, 5000 * attempt)); // 5s, 10s delays
                    }
                }
            }
            
            // All attempts failed
            throw lastError;
            
        } catch (error) {
            console.error(`❌ All email services failed for ${options.to}:`, error.message);
            console.log(`📬 Email will be retried by EmailOutboxService`);
            
            // Mark outbox as failed for retry
            outbox.status = 'failed';
            outbox.attempts = (outbox.attempts || 0) + 1;
            outbox.lastError = error.message;
            outbox.scheduledAt = new Date(Date.now() + 120000); // Retry in 2 minutes
            await outbox.save();
            
            // Close the fresh transporter
            freshTransporter.close();
            return;
        }
    } catch (error) {
        console.error('Error sending email:', error);
        try {
            // If we created an outbox entry above, update it; otherwise create a new failed entry
            const existing = await EmailOutbox.findOne({
                to: options.to,
                subject: options.subject
            }).sort({ createdAt: -1 });
            if (existing && existing.status === 'queued') {
                existing.status = 'failed';
                existing.attempts = (existing.attempts || 0) + 1;
                existing.lastError = error.code ? `${error.code}: ${error.message}` : error.message;
                existing.scheduledAt = new Date();
                await existing.save();
            } else {
                await EmailOutbox.create({
                    to: options.to,
                    subject: options.subject,
                    text: options.text,
                    html: options.html,
                    attachments: options.attachments,
                    status: 'failed',
                    attempts: 1,
                    lastError: error.code ? `${error.code}: ${error.message}` : error.message,
                    scheduledAt: new Date()
                });
            }
        } catch (_) {}
        throw new Error('Failed to send email');
    }
}; 