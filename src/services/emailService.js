const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

class EmailService {
    constructor() {
        this.gmailTransporter = null;
        this.sendGridConfigured = false;
        this.initialize();
    }

    initialize() {
        // Initialize Gmail transporter with optimized settings
        if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
            this.gmailTransporter = nodemailer.createTransport({
                service: 'gmail',
                pool: true, // Enable pooling for better performance
                maxConnections: 3, // Limit concurrent connections
                maxMessages: 50,   // Limit messages per connection
                rateDelta: 30000, // Rate limiting: 30 seconds
                rateLimit: 3,      // Max 3 emails per 30 seconds
                connectionTimeout: 15000, // 15 seconds (reduced)
                greetingTimeout: 10000,   // 10 seconds (reduced)
                socketTimeout: 20000,     // 20 seconds (reduced)
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
            console.log('✅ Gmail transporter initialized with optimized settings');
        } else {
            console.warn('⚠️ Gmail configuration missing - EMAIL_USER or EMAIL_APP_PASSWORD not set');
        }

        // SendGrid disabled for now: force Gmail-only sending.
        this.sendGridConfigured = false;
        console.log('📧 SendGrid disabled - using Gmail only');
    }

    async sendEmail(options) {
        const { to, subject, text, html, attachments } = options;
        
        console.log(`📧 Attempting to send email to ${to}`);
        console.log(`📧 Environment: ${process.env.NODE_ENV}`);

        // Gmail-only mode
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
                console.log(`📧 Gmail send failed in Gmail-only mode`);
            }
        } else {
            console.log(`📧 Gmail not configured`);
        }
        throw new Error('Email service failed - Gmail unavailable');
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
