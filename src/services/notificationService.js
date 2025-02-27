const nodemailer = require('nodemailer');

// Create email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD // Use App Password for Gmail
    }
});

// Email templates
const notifications = {
    bookingConfirmation: (booking) => ({
        subject: 'Booking Confirmation',
        html: `
            <h2>Your booking has been confirmed!</h2>
            <p>Dear ${booking.student.firstName},</p>
            <div style="margin: 20px 0; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
                <p><strong>Residence:</strong> ${booking.residence.name}</p>
                <p><strong>Room:</strong> ${booking.room.roomNumber}</p>
                <p><strong>Check-in:</strong> ${new Date(booking.startDate).toLocaleDateString()}</p>
                <p><strong>Check-out:</strong> ${new Date(booking.endDate).toLocaleDateString()}</p>
                <p><strong>Total Amount:</strong> $${booking.totalAmount}</p>
            </div>
            <p>If you have any questions, please don't hesitate to contact us.</p>
        `
    }),
    
    maintenanceUpdate: (maintenance) => ({
        subject: 'Maintenance Request Update',
        html: `
            <h2>Maintenance Request Update</h2>
            <div style="margin: 20px 0; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
                <p><strong>Status:</strong> ${maintenance.status}</p>
                <p><strong>Title:</strong> ${maintenance.title}</p>
                <p><strong>Location:</strong> Room ${maintenance.room.roomNumber}</p>
                ${maintenance.status === 'completed' ? 
                    `<p><strong>Completed on:</strong> ${new Date(maintenance.completedDate).toLocaleDateString()}</p>` 
                    : ''}
            </div>
            <p>If you have any questions about this maintenance request, please contact the property manager.</p>
        `
    }),
    
    paymentReminder: (booking) => ({
        subject: 'Payment Reminder',
        html: `
            <h2>Payment Reminder</h2>
            <p>Dear ${booking.student.firstName},</p>
            <div style="margin: 20px 0; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
                <p><strong>Outstanding Balance:</strong> $${booking.totalAmount - booking.paidAmount}</p>
                <p><strong>Due Date:</strong> ${new Date(booking.startDate).toLocaleDateString()}</p>
                <p><strong>Room:</strong> ${booking.room.roomNumber}</p>
            </div>
            <p><strong>Please complete your payment to secure your booking.</strong></p>
            <p>If you have already made the payment, please disregard this reminder.</p>
        `
    }),
    
    eventReminder: (event) => ({
        subject: `Event Reminder: ${event.title}`,
        html: `
            <h2>${event.title}</h2>
            <div style="margin: 20px 0; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
                <p><strong>Date:</strong> ${new Date(event.date).toLocaleDateString()}</p>
                <p><strong>Time:</strong> ${event.startTime}</p>
                <p><strong>Location:</strong> ${event.location}</p>
                ${event.requirements ? `
                <p><strong>Required Materials:</strong></p>
                <ul>
                    ${event.requirements.map(req => `<li>${req}</li>`).join('')}
                </ul>
                ` : ''}
            </div>
            <p>We look forward to seeing you there!</p>
        `
    })
};

// Send notification based on type
const sendNotification = async (type, data, recipient) => {
    try {
        const template = notifications[type](data);
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: recipient.email,
            subject: template.subject,
            html: template.html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return info;
    } catch (error) {
        console.error(`Failed to send ${type} notification:`, error);
        throw error;
    }
};

module.exports = {
    sendNotification,
    notifications
}; 