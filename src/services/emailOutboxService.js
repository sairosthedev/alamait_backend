const cron = require('node-cron');
const nodemailer = require('nodemailer');
const EmailOutbox = require('../models/EmailOutbox');

// Dedicated transporter (reuse same env vars)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD }
});

class EmailOutboxService {
    constructor() {
        this.job = null;
    }

    start() {
        // Only run in production as requested
        if (process.env.NODE_ENV !== 'production') {
            console.log('EmailOutboxService disabled (NODE_ENV!=production)');
            return;
        }

        // Every 60 seconds
        this.job = cron.schedule('* * * * *', async () => {
            try {
                // Fetch failed or queued items due now
                const pending = await EmailOutbox.find({
                    status: { $in: ['failed', 'queued'] },
                    scheduledAt: { $lte: new Date() }
                }).sort({ createdAt: 1 }).limit(25);

                for (const item of pending) {
                    try {
                        await transporter.sendMail({
                            from: `Alamait Student Accommodation <${process.env.EMAIL_USER}>`,
                            to: item.to,
                            subject: item.subject,
                            text: item.text,
                            html: item.html,
                            attachments: item.attachments
                        });

                        item.status = 'sent';
                        item.sentAt = new Date();
                        item.attempts = (item.attempts || 0) + 1;
                        item.lastError = undefined;
                        await item.save();
                        console.log(`📧 Outbox resend success -> ${item.to} (${item.subject})`);
                    } catch (err) {
                        item.status = 'failed';
                        item.attempts = (item.attempts || 0) + 1;
                        item.lastError = err.code ? `${err.code}: ${err.message}` : err.message;
                        // Exponential backoff up to 30 minutes
                        const delayMinutes = Math.min(30, Math.pow(2, Math.min(item.attempts, 6)));
                        const nextTime = new Date(Date.now() + delayMinutes * 60 * 1000);
                        item.scheduledAt = nextTime;
                        await item.save();
                        console.error(`📧 Outbox resend failed (attempt ${item.attempts}) -> ${item.to}: ${item.lastError}`);
                    }
                }
            } catch (err) {
                console.error('EmailOutboxService cycle error:', err);
            }
        }, { scheduled: true, timezone: 'Africa/Harare' });

        console.log('✅ EmailOutboxService started (every 60s in production)');
    }
}

module.exports = new EmailOutboxService();


