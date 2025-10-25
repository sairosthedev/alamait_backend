const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');

// Test email endpoint (for debugging)
router.post('/test-email', async (req, res) => {
    try {
        const { to, subject, text } = req.body;
        
        console.log('🧪 Testing email service...');
        console.log('Environment variables:');
        console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
        console.log(`  - SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET'}`);
        console.log(`  - SENDGRID_FROM_EMAIL: ${process.env.SENDGRID_FROM_EMAIL || 'NOT SET'}`);
        console.log(`  - EMAIL_USER: ${process.env.EMAIL_USER || 'NOT SET'}`);
        
        const result = await emailService.sendEmail({
            to: to || 'test@example.com',
            subject: subject || 'Test Email from Alamait',
            text: text || 'This is a test email to verify the email service is working.',
            html: `<p>This is a test email to verify the email service is working.</p>`
        });
        
        if (result) {
            res.json({
                success: true,
                message: 'Test email sent successfully',
                environment: process.env.NODE_ENV,
                sendGridConfigured: emailService.isSendGridReady(),
                gmailConfigured: emailService.isGmailReady()
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send test email',
                environment: process.env.NODE_ENV,
                sendGridConfigured: emailService.isSendGridReady(),
                gmailConfigured: emailService.isGmailReady()
            });
        }
        
    } catch (error) {
        console.error('❌ Test email error:', error);
        res.status(500).json({
            success: false,
            message: 'Test email failed',
            error: error.message,
            environment: process.env.NODE_ENV,
            sendGridConfigured: emailService.isSendGridReady(),
            gmailConfigured: emailService.isGmailReady()
        });
    }
});

// Get email service status
router.get('/email-status', (req, res) => {
    res.json({
        environment: process.env.NODE_ENV,
        sendGridConfigured: emailService.isSendGridReady(),
        gmailConfigured: emailService.isGmailReady(),
        anyServiceReady: emailService.isAnyServiceReady(),
        environmentVariables: {
            SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET',
            SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || 'NOT SET',
            EMAIL_USER: process.env.EMAIL_USER || 'NOT SET',
            EMAIL_APP_PASSWORD: process.env.EMAIL_APP_PASSWORD ? 'SET' : 'NOT SET'
        }
    });
});

module.exports = router;
