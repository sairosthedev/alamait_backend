const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

// Send verification email
exports.sendVerificationEmail = async (email, token) => {
    // Use frontend URL for verification
    const verificationUrl = `https://alamait.vercel.app/verify-email/${token}`;
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verify Your Email - Alamait Property Management',
        html: `
            <h1>Email Verification</h1>
            <p>Please click the link below to verify your email address:</p>
            <a href="${verificationUrl}">${verificationUrl}</a>
            <p>This link will expire in 24 hours.</p>
            <p>If you did not request this verification, please ignore this email.</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        ('Verification email sent successfully');
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw error;
    }
};

// Send password reset email
exports.sendPasswordResetEmail = async (email, token) => {
    // Use frontend URL for password reset
    const resetUrl = `https://alamait.vercel.app/reset-password/${token}`;
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset - Alamait Property Management',
        html: `
            <h1>Password Reset Request</h1>
            <p>You requested a password reset. Please click the link below to reset your password:</p>
            <a href="${resetUrl}">${resetUrl}</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this reset, please ignore this email.</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        ('Password reset email sent successfully');
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw error;
    }
}; 

// Send invoice email with PDF attachment
exports.sendInvoiceEmail = async (email, invoice, tenant, pdfBuffer) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Invoice ${invoice.invoiceNumber} - Alamait Property Management`,
        html: `
            <h1>Invoice ${invoice.invoiceNumber}</h1>
            <p>Dear ${tenant?.name || tenant?.fullName || 'Tenant'},</p>
            <p>Please find attached your invoice for unit <b>${invoice.unit}</b> for the period <b>${invoice.billingPeriod}</b>.</p>
            <p>Due Date: <b>${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : ''}</b></p>
            <p>Status: <b>${invoice.status}</b></p>
            <p>If you have any questions, please contact us.</p>
        `,
        attachments: [
            {
                filename: `Invoice-${invoice.invoiceNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }
        ]
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log('Invoice email sent successfully');
    } catch (error) {
        console.error('Error sending invoice email:', error);
        throw error;
    }
}; 