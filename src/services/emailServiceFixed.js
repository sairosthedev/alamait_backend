const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

class EmailServiceFixed {
    constructor() {
        this.gmailTransporter = null;
        this.sendGridConfigured = false;
        this.initialize();
    }

    initialize() {
        console.log('🔧 Initializing Email Service (Fixed)...');
        console.log('Environment check:');
        console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
        console.log(`  - EMAIL_USER: ${process.env.EMAIL_USER ? 'SET' : 'NOT SET'}`);
        console.log(`  - EMAIL_APP_PASSWORD: ${process.env.EMAIL_APP_PASSWORD ? 'SET' : 'NOT SET'}`);
        console.log(`  - SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET'}`);

        // Initialize Gmail transporter (for local development)
        if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD && process.env.NODE_ENV !== 'production') {
            try {
                this.gmailTransporter = nodemailer.createTransporter({
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
                console.log('✅ Gmail transporter initialized (local only)');
            } catch (error) {
                console.error('❌ Error initializing Gmail transporter:', error);
            }
        }

        // Initialize SendGrid (for production)
        if (process.env.SENDGRID_API_KEY) {
            try {
                sgMail.setApiKey(process.env.SENDGRID_API_KEY);
                this.sendGridConfigured = true;
                console.log('✅ SendGrid configured successfully');
            } catch (error) {
                console.error('❌ Error configuring SendGrid:', error);
            }
        } else {
            console.log('⚠️ SendGrid API key not found - emails will be disabled');
        }
    }

    async sendEmail(options) {
        const { to, subject, text, html, attachments } = options;
        
        console.log(`📧 Attempting to send email to ${to}`);
        console.log(`📧 Environment: ${process.env.NODE_ENV}`);

        // For production, use SendGrid only
        if (process.env.NODE_ENV === 'production') {
            if (this.sendGridConfigured) {
                return await this.sendViaSendGrid(to, subject, text, html, attachments);
            } else {
                console.log('❌ No email service configured for production');
                return false;
            }
        }

        // For local development, try Gmail first, then SendGrid
        if (this.gmailTransporter) {
            try {
                console.log(`📧 Trying Gmail SMTP (local)...`);
                
                const mailOptions = {
                    from: `Alamait Student Accommodation <${process.env.EMAIL_USER}>`,
                    to: to,
                    subject: subject,
                    text: text,
                    html: html,
                    attachments: attachments
                };

                await this.gmailTransporter.sendMail(mailOptions);
                console.log(`✅ Email sent via Gmail to ${to}`);
                return true;
                
            } catch (error) {
                console.error(`❌ Gmail failed for ${to}:`, error.message);
                console.log(`📧 Falling back to SendGrid...`);
            }
        }

        // Fallback to SendGrid
        if (this.sendGridConfigured) {
            return await this.sendViaSendGrid(to, subject, text, html, attachments);
        }

        console.log('❌ No email service available');
        return false;
    }

    async sendViaSendGrid(to, subject, text, html, attachments) {
        try {
            console.log(`📧 Sending via SendGrid to ${to}`);
            
            const msg = {
                to: to,
                from: {
                    email: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER || 'noreply@alamait.com',
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
                msg.attachments = attachments.map(attachment => ({
                    content: attachment.content,
                    filename: attachment.filename,
                    type: attachment.type,
                    disposition: 'attachment'
                }));
            }

            await sgMail.send(msg);
            console.log(`✅ Email sent via SendGrid to ${to}`);
            return true;
            
        } catch (error) {
            console.error(`❌ SendGrid failed for ${to}:`, {
                message: error.message,
                code: error.code,
                response: error.response?.body
            });
            return false;
        }
    }

    async testConnection() {
        console.log('🔧 Testing email connections...');
        
        if (process.env.NODE_ENV === 'production') {
            if (this.sendGridConfigured) {
                console.log('✅ SendGrid configured for production');
                return true;
            } else {
                console.log('❌ SendGrid not configured for production');
                return false;
            }
        }

        if (this.gmailTransporter) {
            try {
                await this.gmailTransporter.verify();
                console.log('✅ Gmail connection test: SUCCESS');
                return true;
            } catch (error) {
                console.error('❌ Gmail connection test: FAILED', error.message);
            }
        }
        
        if (this.sendGridConfigured) {
            console.log('✅ SendGrid configured: SUCCESS');
            return true;
        }
        
        console.log('❌ No email service available');
        return false;
    }
}

module.exports = EmailServiceFixed;
