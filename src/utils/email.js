const nodemailer = require('nodemailer');
const EmailOutbox = require('../models/EmailOutbox');

// Create transporter with pooling and robust timeouts
const transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true,
    maxConnections: parseInt(process.env.EMAIL_MAX_CONNECTIONS || '3', 10),
    maxMessages: parseInt(process.env.EMAIL_MAX_MESSAGES || '50', 10),
    connectionTimeout: parseInt(process.env.EMAIL_CONN_TIMEOUT_MS || '15000', 10), // 15s
    greetingTimeout: parseInt(process.env.EMAIL_GREET_TIMEOUT_MS || '10000', 10),   // 10s
    socketTimeout: parseInt(process.env.EMAIL_SOCKET_TIMEOUT_MS || '20000', 10),    // 20s
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

        const mailOptions = {
            from: `Alamait Student Accommodation <${process.env.EMAIL_USER}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            attachments: options.attachments
        };

        await transporter.sendMail(mailOptions);
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