const axios = require('axios');

class WhatsAppService {
    constructor() {
        ('WhatsApp service initialized in mock mode');
    }

    async sendMessage(to, message) {
        try {
            // Just log the message for now
            ('Mock WhatsApp message:', {
                to: this.formatPhoneNumber(to),
                message: message
            });
            return true;
        } catch (error) {
            console.error('Error in mock WhatsApp service:', error);
            return false;
        }
    }

    formatPhoneNumber(phone) {
        if (!phone) return '';
        // Remove any non-digit characters
        let cleaned = phone.replace(/\D/g, '');
        
        // Ensure the number starts with country code
        if (!cleaned.startsWith('1') && !cleaned.startsWith('91')) {
            cleaned = '91' + cleaned; // Default to India country code if none provided
        }
        
        return cleaned;
    }

    // Mock implementations of other methods
    async sendApplicationStatus(student, status) {
        if (!student?.phone) return false;
        const message = `Your room application has been ${status}.`;
        return this.sendMessage(student.phone, message);
    }

    async sendPaymentConfirmation(student, payment) {
        if (!student?.phone || !payment?.amount) return false;
        const message = `Payment confirmation: $${payment.amount}`;
        return this.sendMessage(student.phone, message);
    }

    async sendPaymentReminder(student, payment) {
        if (!student?.phone || !payment?.amount) return false;
        const message = `Payment reminder: $${payment.amount} due`;
        return this.sendMessage(student.phone, message);
    }

    async sendMaintenanceUpdate(student, maintenance) {
        if (!student?.phone || !maintenance?.id) return false;
        const message = `Maintenance request #${maintenance.id} update: ${maintenance.status}`;
        return this.sendMessage(student.phone, message);
    }

    async sendMessageAlert(student, sender) {
        if (!student?.phone || !sender) return false;
        const message = `New message from ${sender}`;
        return this.sendMessage(student.phone, message);
    }

    async sendAnnouncement(students, announcement) {
        if (!Array.isArray(students) || !announcement) return [];
        const failures = [];
        
        for (const student of students) {
            if (!student?.phone) {
                failures.push(student?.id || 'unknown');
                continue;
            }
            const success = await this.sendMessage(student.phone, announcement);
            if (!success) failures.push(student.id);
        }
        return failures;
    }
}

module.exports = new WhatsAppService();