const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

class EmailServiceDebug {
    constructor() {
        this.gmailTransporter = null;
        this.sendGridConfigured = false;
        this.initialize();
    }

    initialize() {
        console.log('🔧 Initializing Email Service Debug...');
        console.log('Environment check:');
        console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
        console.log(`  - EMAIL_USER: ${process.env.EMAIL_USER ? 'SET' : 'NOT SET'}`);
        console.log(`  - EMAIL_APP_PASSWORD: ${process.env.EMAIL_APP_PASSWORD ? 'SET' : 'NOT SET'}`);
        console.log(`  - SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET'}`);

        // Initialize Gmail transporter
        if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
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
                console.log('✅ Gmail transporter initialized successfully');
            } catch (error) {
                console.error('❌ Error initializing Gmail transporter:', error);
            }
        } else {
            console.log('⚠️ Gmail credentials not found');
        }

        // Initialize SendGrid
        if (process.env.SENDGRID_API_KEY) {
            try {
                sgMail.setApiKey(process.env.SENDGRID_API_KEY);
                this.sendGridConfigured = true;
                console.log('✅ SendGrid configured successfully');
            } catch (error) {
                console.error('❌ Error configuring SendGrid:', error);
            }
        } else {
            console.log('⚠️ SendGrid API key not found');
        }
    }

    async sendEmail(options) {
        const { to, subject, text, html, attachments } = options;
        
        console.log(`📧 DEBUG: Attempting to send email to ${to}`);
        console.log(`📧 DEBUG: Subject: ${subject}`);
        console.log(`📧 DEBUG: Environment: ${process.env.NODE_ENV}`);

        // Try Gmail first
        if (this.gmailTransporter) {
            try {
                console.log(`📧 DEBUG: Trying Gmail SMTP...`);
                
                const mailOptions = {
                    from: `Alamait Student Accommodation <${process.env.EMAIL_USER}>`,
                    to: to,
                    subject: subject,
                    text: text,
                    html: html,
                    attachments: attachments
                };

                console.log(`📧 DEBUG: Mail options prepared:`, {
                    from: mailOptions.from,
                    to: mailOptions.to,
                    subject: mailOptions.subject,
                    hasHtml: !!mailOptions.html,
                    hasText: !!mailOptions.text
                });

                // Test connection first
                console.log(`📧 DEBUG: Testing Gmail connection...`);
                await this.gmailTransporter.verify();
                console.log(`📧 DEBUG: Gmail connection verified successfully`);

                // Send email
                const result = await this.gmailTransporter.sendMail(mailOptions);
                console.log(`✅ DEBUG: Email sent via Gmail successfully:`, result.messageId);
                return true;
                
            } catch (error) {
                console.error(`❌ DEBUG: Gmail send failed:`, {
                    message: error.message,
                    code: error.code,
                    command: error.command,
                    response: error.response,
                    stack: error.stack
                });
                
                // Try SendGrid as fallback
                if (this.sendGridConfigured) {
                    console.log(`📧 DEBUG: Trying SendGrid as fallback...`);
                    try {
                        await sgMail.send({
                            to: to,
                            from: process.env.EMAIL_USER,
                            subject: subject,
                            text: text,
                            html: html
                        });
                        console.log(`✅ DEBUG: Email sent via SendGrid successfully`);
                        return true;
                    } catch (sendGridError) {
                        console.error(`❌ DEBUG: SendGrid send failed:`, {
                            message: sendGridError.message,
                            code: sendGridError.code,
                            response: sendGridError.response
                        });
                    }
                }
                
                throw error;
            }
        } else {
            console.log(`❌ DEBUG: No email transporter available`);
            throw new Error('No email transporter configured');
        }
    }

    async testConnection() {
        console.log('🔧 Testing email connections...');
        
        if (this.gmailTransporter) {
            try {
                await this.gmailTransporter.verify();
                console.log('✅ Gmail connection test: SUCCESS');
                return true;
            } catch (error) {
                console.error('❌ Gmail connection test: FAILED', error.message);
                return false;
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

module.exports = EmailServiceDebug;
