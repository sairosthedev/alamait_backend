const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

class EmailService {
    constructor() {
        this.gmailTransporter = null;
        this.sendGridConfigured = false;
        this.initialize();
    }

    initialize() {
        // Initialize Gmail transporter
        if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
            this.gmailTransporter = nodemailer.createTransport({
                service: 'gmail',
                pool: false, // Disable pooling to avoid connection issues
                connectionTimeout: 30000, // 30 seconds
                greetingTimeout: 15000,   // 15 seconds
                socketTimeout: 45000,     // 45 seconds
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
            console.log('✅ Gmail transporter initialized');
        } else {
            console.warn('⚠️ Gmail configuration missing - EMAIL_USER or EMAIL_APP_PASSWORD not set');
        }

        // Initialize SendGrid
        if (process.env.SENDGRID_API_KEY) {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            this.sendGridConfigured = true;
            console.log('✅ SendGrid configured successfully');
        } else {
            console.warn('⚠️ SendGrid API key not found - SENDGRID_API_KEY environment variable required');
        }
    }

    async sendEmail(options) {
        const { to, subject, text, html, attachments } = options;
        
        console.log(`📧 Attempting to send email to ${to}`);

        // Try Gmail first
        if (this.gmailTransporter) {
            try {
                console.log(`📧 Trying Gmail SMTP first...`);
                
                const mailOptions = {
                    from: `Alamait Student Accommodation <${process.env.EMAIL_USER}>`,
                    to: to,
                    subject: subject,
                    text: text,
                    html: html,
                    attachments: attachments
                };

                // Create a fresh transporter for each email to avoid connection issues
                const freshTransporter = nodemailer.createTransport({
                    service: 'gmail',
                    pool: false,
                    connectionTimeout: 30000,
                    greetingTimeout: 15000,
                    socketTimeout: 45000,
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

                // Send with timeout
                const sendPromise = freshTransporter.sendMail(mailOptions);
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Gmail send timeout')), 60000); // 60s timeout
                });

                await Promise.race([sendPromise, timeoutPromise]);
                console.log(`✅ Email sent via Gmail to ${to}`);
                
                // Close the fresh transporter
                freshTransporter.close();
                return true;
                
            } catch (error) {
                console.error(`❌ Gmail failed for ${to}:`, error.message);
                console.log(`📧 Falling back to SendGrid...`);
            }
        } else {
            console.log(`📧 Gmail not configured, trying SendGrid...`);
        }

        // Fallback to SendGrid
        if (this.sendGridConfigured) {
            try {
                console.log(`📧 Trying SendGrid...`);
                
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

                await sgMail.send(msg);
                console.log(`✅ Email sent via SendGrid to ${to}`);
                return true;
                
            } catch (error) {
                console.error(`❌ SendGrid failed for ${to}:`, error.message);
            }
        } else {
            console.log(`📧 SendGrid not configured`);
        }

        // Both services failed
        throw new Error('All email services failed - Gmail and SendGrid both unavailable');
    }

    isGmailReady() {
        return this.gmailTransporter !== null;
    }

    isSendGridReady() {
        return this.sendGridConfigured;
    }

    isAnyServiceReady() {
        return this.isGmailReady() || this.isSendGridReady();
    }
}

module.exports = new EmailService();
