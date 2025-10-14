const cron = require('node-cron');
const nodemailer = require('nodemailer');
const EmailOutbox = require('../models/EmailOutbox');
const sendGridService = require('./sendGridService');

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
                        console.log(`📧 Attempting to send queued email to ${item.to} (attempt ${(item.attempts || 0) + 1})`);
                        
                        let emailSent = false;
                        
                        // Try SendGrid first (using SMTP for better reliability)
                        if (process.env.SENDGRID_API_KEY) {
                            try {
                                console.log(`📧 Outbox: Trying SendGrid SMTP for ${item.to}`);
                                
                                const sgTransporter = nodemailer.createTransport({
                                    host: 'smtp.sendgrid.net',
                                    port: 587,
                                    auth: {
                                        user: 'apikey',
                                        pass: process.env.SENDGRID_API_KEY
                                    },
                                    connectionTimeout: 15000,
                                    greetingTimeout: 10000,
                                    socketTimeout: 20000
                                });

                                await sgTransporter.sendMail({
                                    from: `Alamait Student Accommodation <${process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL || 'notifications@alamait.com'}>`,
                                    to: item.to,
                                    subject: item.subject,
                                    text: item.text,
                                    html: item.html,
                                    attachments: item.attachments
                                });
                                
                                emailSent = true;
                                console.log(`✅ Outbox: SendGrid SMTP success -> ${item.to}`);
                            } catch (error) {
                                console.error(`❌ Outbox: SendGrid SMTP failed for ${item.to}:`, error.message);
                            }
                        } else {
                            console.log(`📧 Outbox: SendGrid not configured, using Gmail for ${item.to}`);
                        }
                        
                        // Fallback to Gmail if SendGrid failed or not configured
                        if (!emailSent) {
                            console.log(`📧 Outbox: Using Gmail fallback for ${item.to}`);
                            
                            // Create a new transporter for each email to avoid connection issues
                            const freshTransporter = nodemailer.createTransport({
                                service: 'gmail',
                                auth: { 
                                    user: process.env.EMAIL_USER, 
                                    pass: process.env.EMAIL_APP_PASSWORD 
                                },
                                connectionTimeout: 30000, // 30 seconds (increased)
                                greetingTimeout: 15000,   // 15 seconds (increased)
                                socketTimeout: 45000,    // 45 seconds (increased)
                                secure: true,
                                tls: {
                                    rejectUnauthorized: false,
                                    ciphers: 'SSLv3'
                                }
                            });

                            // Send with timeout
                            const sendPromise = freshTransporter.sendMail({
                                from: `Alamait Student Accommodation <${process.env.EMAIL_USER}>`,
                                to: item.to,
                                subject: item.subject,
                                text: item.text,
                                html: item.html,
                                attachments: item.attachments
                            });

                            const timeoutPromise = new Promise((_, reject) => {
                                setTimeout(() => reject(new Error('Email send timeout')), 60000); // 60s timeout (increased)
                            });

                            await Promise.race([sendPromise, timeoutPromise]);
                            console.log(`✅ Outbox: Gmail success -> ${item.to}`);
                            
                            // Close the fresh transporter
                            freshTransporter.close();
                        }

                            item.status = 'sent';
                            item.sentAt = new Date();
                            item.attempts = (item.attempts || 0) + 1;
                            item.lastError = undefined;
                            item.service = emailSent ? 'sendgrid' : 'gmail';
                            await item.save();
                            console.log(`✅ Outbox resend success -> ${item.to} (${item.subject}) via ${item.service}`);
                    } catch (err) {
                        item.status = 'failed';
                        item.attempts = (item.attempts || 0) + 1;
                        item.lastError = err.code ? `${err.code}: ${err.message}` : err.message;
                        
                        // Exponential backoff up to 30 minutes
                        const delayMinutes = Math.min(30, Math.pow(2, Math.min(item.attempts, 6)));
                        const nextTime = new Date(Date.now() + delayMinutes * 60 * 1000);
                        item.scheduledAt = nextTime;
                        await item.save();
                        console.error(`❌ Outbox resend failed (attempt ${item.attempts}) -> ${item.to}: ${item.lastError}`);
                        
                        // If this is a connection timeout, try a different approach
                        if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
                            console.log(`🔄 Connection timeout detected for ${item.to}, will retry with longer delay`);
                        }
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


