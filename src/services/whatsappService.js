const twilio = require('twilio');

class WhatsAppService {
    constructor() {
        this.client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );
        this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
    }

    async sendMessage(to, message) {
        try {
            await this.client.messages.create({
                from: `whatsapp:${this.fromNumber}`,
                to: `whatsapp:${to}`,
                body: message
            });
            return true;
        } catch (error) {
            console.error('WhatsApp notification error:', error);
            return false;
        }
    }

    // Application notifications
    async sendApplicationStatus(student, status) {
        const message = `Your room application has been ${status}. ${
            status === 'approved' 
                ? 'Check your email for registration details.' 
                : 'Please contact admin for more information.'
        }`;
        return this.sendMessage(student.phone, message);
    }

    // Payment notifications
    async sendPaymentConfirmation(student, payment) {
        const message = `Your payment of $${payment.amount} on ${new Date(payment.date).toLocaleDateString()} has been processed. Thank you!`;
        return this.sendMessage(student.phone, message);
    }

    async sendPaymentReminder(student, payment) {
        const message = `Upcoming payment due: $${payment.amount} on ${new Date(payment.dueDate).toLocaleDateString()}.`;
        return this.sendMessage(student.phone, message);
    }

    // Maintenance notifications
    async sendMaintenanceUpdate(student, maintenance) {
        const message = `Maintenance request #${maintenance.id} is now ${maintenance.status.toLowerCase()}.`;
        return this.sendMessage(student.phone, message);
    }

    // Message notifications
    async sendMessageAlert(student, sender) {
        const message = `You have a new message from ${sender}. Check your inbox.`;
        return this.sendMessage(student.phone, message);
    }

    // Admin announcements
    async sendAnnouncement(students, announcement) {
        const failures = [];
        for (const student of students) {
            const success = await this.sendMessage(
                student.phone,
                `New announcement from Admin: ${announcement}`
            );
            if (!success) failures.push(student.id);
        }
        return failures;
    }
}

module.exports = new WhatsAppService(); 