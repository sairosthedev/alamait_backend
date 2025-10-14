const EmailOutbox = require('../models/EmailOutbox');
const emailService = require('../services/emailService');

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
        // Check if any email service is available
        if (!emailService.isAnyServiceReady()) {
            console.warn('⚠️ No email services configured - Gmail and SendGrid both unavailable');
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

        // 🚀 IMMEDIATE SEND: Try Gmail first, then SendGrid fallback
        console.log(`📧 Attempting to send email to ${options.to}`);
        
        try {
            // Use the robust email service (Gmail → SendGrid fallback)
            await emailService.sendEmail(options);
            console.log(`✅ Email sent successfully to ${options.to}`);
            
            // Mark outbox as sent
            outbox.status = 'sent';
            outbox.sentAt = new Date();
            outbox.attempts = (outbox.attempts || 0) + 1;
            await outbox.save();
            return;
            
        } catch (error) {
            console.error(`❌ All email services failed for ${options.to}:`, error.message);
            console.log(`📬 Email will be retried by EmailOutboxService`);
            
            // Mark outbox as failed for retry
            outbox.status = 'failed';
            outbox.attempts = (outbox.attempts || 0) + 1;
            outbox.lastError = error.message;
            outbox.scheduledAt = new Date(Date.now() + 120000); // Retry in 2 minutes
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