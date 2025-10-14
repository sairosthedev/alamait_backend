const nodemailer = require('nodemailer');
const EmailOutbox = require('../models/EmailOutbox');

// Create transporter with pooling and robust timeouts
const transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true,
    maxConnections: parseInt(process.env.EMAIL_MAX_CONNECTIONS || '2', 10), // Reduced to 2
    maxMessages: parseInt(process.env.EMAIL_MAX_MESSAGES || '20', 10), // Reduced to 20
    connectionTimeout: parseInt(process.env.EMAIL_CONN_TIMEOUT_MS || '10000', 10), // 10s
    greetingTimeout: parseInt(process.env.EMAIL_GREET_TIMEOUT_MS || '5000', 10),   // 5s
    socketTimeout: parseInt(process.env.EMAIL_SOCKET_TIMEOUT_MS || '15000', 10),    // 15s
    secure: true,
    tls: {
        rejectUnauthorized: false
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

        // Queue-first mode in production: skip immediate SMTP send and rely on outbox retry
        const sendMode = (process.env.EMAIL_SEND_MODE || '').toLowerCase();
        if (process.env.NODE_ENV === 'production' && sendMode === 'queue') {
            try {
                console.log(`📬 Queued email (queue-first mode): ${options.to} → ${options.subject}`);
            } catch (_) {}
            return; // do not attempt immediate send; outbox service will deliver
        }

        // 🆕 PRODUCTION FIX: If in production but not queue mode, try immediate send with shorter timeout
        if (process.env.NODE_ENV === 'production') {
            console.log(`📧 Production mode: Attempting immediate email send to ${options.to}`);
            
            const mailOptions = {
                from: `Alamait Student Accommodation <${process.env.EMAIL_USER}>`,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
                attachments: options.attachments
            };

            // Use shorter timeout for production to fail fast and queue
            const sendPromise = transporter.sendMail(mailOptions);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Email send timeout')), 10000); // 10s timeout (reduced from 20s)
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
        }

        const mailOptions = {
            from: `Alamait Student Accommodation <${process.env.EMAIL_USER}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            attachments: options.attachments
        };

        // Send email with timeout handling (reduced for production stability)
        const sendPromise = transporter.sendMail(mailOptions);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Email send timeout')), 20000); // 20s timeout
        });
        
        await Promise.race([sendPromise, timeoutPromise]);
        console.log(`✅ Email sent to ${options.to}`);

        // Mark outbox as sent
        outbox.status = 'sent';
        outbox.sentAt = new Date();
        outbox.attempts = (outbox.attempts || 0) + 1;
        await outbox.save();
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