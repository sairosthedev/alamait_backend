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
        console.log(`📧 Environment: ${process.env.NODE_ENV}`);

        // For production, try SendGrid first
        if (process.env.NODE_ENV === 'production' && this.sendGridConfigured) {
            try {
                console.log(`📧 Trying SendGrid first (production)...`);
                
                // Validate SendGrid configuration
                if (!process.env.SENDGRID_API_KEY) {
                    throw new Error('SendGrid API key not configured');
                }
                
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

                // Add attachments if provided (FIXED VERSION)
                if (attachments && attachments.length > 0) {
                    console.log(`📎 Processing ${attachments.length} attachments...`);
                    msg.attachments = attachments.map((att, index) => {
                        try {
                            // Safely handle attachment content
                            let content = '';
                            if (att.content) {
                                if (typeof att.content === 'string') {
                                    content = Buffer.from(att.content).toString('base64');
                                } else if (Buffer.isBuffer(att.content)) {
                                    content = att.content.toString('base64');
                                } else {
                                    content = Buffer.from(att.content).toString('base64');
                                }
                            } else {
                                console.log(`⚠️ Attachment ${index} has no content, skipping`);
                                return null;
                            }
                            
                            return {
                                content: content,
                                filename: att.filename || `attachment_${index}`,
                                type: att.contentType || 'application/octet-stream',
                                disposition: 'attachment'
                            };
                        } catch (attError) {
                            console.error(`❌ Error processing attachment ${index}:`, attError.message);
                            return null;
                        }
                    }).filter(att => att !== null); // Remove null attachments
                    
                    console.log(`📎 Processed ${msg.attachments.length} valid attachments`);
                }

                await sgMail.send(msg);
                console.log(`✅ Email sent via SendGrid to ${to}`);
                return true;
                
            } catch (error) {
                console.error(`❌ SendGrid failed for ${to}:`, {
                    message: error.message,
                    code: error.code,
                    response: error.response?.body || error.response,
                    stack: error.stack
                });
                console.log(`📧 Falling back to Gmail...`);
            }
        }

        // Try Gmail (for local development or as fallback)
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
                
                // Validate SendGrid configuration
                if (!process.env.SENDGRID_API_KEY) {
                    throw new Error('SendGrid API key not configured');
                }
                
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

                // Add attachments if provided (FIXED VERSION)
                if (attachments && attachments.length > 0) {
                    console.log(`📎 Processing ${attachments.length} attachments...`);
                    msg.attachments = attachments.map((att, index) => {
                        try {
                            // Safely handle attachment content
                            let content = '';
                            if (att.content) {
                                if (typeof att.content === 'string') {
                                    content = Buffer.from(att.content).toString('base64');
                                } else if (Buffer.isBuffer(att.content)) {
                                    content = att.content.toString('base64');
                                } else {
                                    content = Buffer.from(att.content).toString('base64');
                                }
                            } else {
                                console.log(`⚠️ Attachment ${index} has no content, skipping`);
                                return null;
                            }
                            
                            return {
                                content: content,
                                filename: att.filename || `attachment_${index}`,
                                type: att.contentType || 'application/octet-stream',
                                disposition: 'attachment'
                            };
                        } catch (attError) {
                            console.error(`❌ Error processing attachment ${index}:`, attError.message);
                            return null;
                        }
                    }).filter(att => att !== null); // Remove null attachments
                    
                    console.log(`📎 Processed ${msg.attachments.length} valid attachments`);
                }

                await sgMail.send(msg);
                console.log(`✅ Email sent via SendGrid to ${to}`);
                return true;
                
            } catch (error) {
                console.error(`❌ SendGrid failed for ${to}:`, {
                    message: error.message,
                    code: error.code,
                    response: error.response?.body || error.response,
                    stack: error.stack
                });
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
