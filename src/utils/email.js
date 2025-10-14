const nodemailer = require('nodemailer');
const EmailOutbox = require('../models/EmailOutbox');

// Create transporter with more generous timeouts for production stability
const transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true,
    maxConnections: parseInt(process.env.EMAIL_MAX_CONNECTIONS || '1', 10), // Reduced to 1 for stability
    maxMessages: parseInt(process.env.EMAIL_MAX_MESSAGES || '10', 10), // Reduced to 10
    connectionTimeout: parseInt(process.env.EMAIL_CONN_TIMEOUT_MS || '30000', 10), // 30s (increased)
    greetingTimeout: parseInt(process.env.EMAIL_GREET_TIMEOUT_MS || '15000', 10),   // 15s (increased)
    socketTimeout: parseInt(process.env.EMAIL_SOCKET_TIMEOUT_MS || '45000', 10),    // 45s (increased)
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

        // 🚀 IMMEDIATE SEND: Always attempt immediate send first (production and development)
        console.log(`📧 Attempting immediate email send to ${options.to}`);
        console.log(`📧 SMTP Config: connectionTimeout=30s, greetingTimeout=15s, socketTimeout=45s`);
        
        const mailOptions = {
            from: `Alamait Student Accommodation <${process.env.EMAIL_USER}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            attachments: options.attachments
        };

        // Use generous timeout for immediate send (production needs more time)
        const sendPromise = transporter.sendMail(mailOptions);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Email send timeout')), 60000); // 60s timeout (increased)
        });
        
        try {
            await Promise.race([sendPromise, timeoutPromise]);
            console.log(`✅ Email sent immediately to ${options.to}`);
            
            // Mark outbox as sent
            outbox.status = 'sent';
            outbox.sentAt = new Date();
            outbox.attempts = (outbox.attempts || 0) + 1;
            await outbox.save();
            return;
        } catch (error) {
            console.error(`❌ Immediate send failed for ${options.to}:`, error.message);
            console.log(`📬 Email will be retried by EmailOutboxService`);
            
            // Mark outbox as failed for retry
            outbox.status = 'failed';
            outbox.attempts = (outbox.attempts || 0) + 1;
            outbox.lastError = error.code ? `${error.code}: ${error.message}` : error.message;
            outbox.scheduledAt = new Date(Date.now() + 60000); // Retry in 1 minute
            await outbox.save();
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