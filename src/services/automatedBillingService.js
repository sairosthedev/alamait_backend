const cron = require('node-cron');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const { Residence } = require('../models/Residence');
const emailService = require('./emailService');
const whatsappService = require('./whatsappService');

class AutomatedBillingService {
    constructor() {
        this.isRunning = false;
    }

    // Start the automated billing service
    start() {
        if (this.isRunning) {
            console.log('Automated billing service is already running');
            return;
        }

        console.log('Starting automated billing service...');

        // Schedule daily tasks
        cron.schedule('0 9 * * *', () => {
            this.processDailyTasks();
        }, {
            scheduled: true,
            timezone: "Africa/Harare"
        });

        // Schedule weekly tasks
        cron.schedule('0 10 * * 1', () => {
            this.processWeeklyTasks();
        }, {
            scheduled: true,
            timezone: "Africa/Harare"
        });

        // Schedule monthly tasks
        cron.schedule('0 8 1 * *', () => {
            this.generateRecurringInvoices();
        }, {
            scheduled: true,
            timezone: "Africa/Harare"
        });

        this.isRunning = true;
        console.log('Automated billing service started successfully');
    }

    // Stop the automated billing service
    stop() {
        if (!this.isRunning) {
            console.log('Automated billing service is not running');
            return;
        }

        cron.getTasks().forEach(task => task.stop());
        this.isRunning = false;
        console.log('Automated billing service stopped');
    }

    // Daily tasks
    async processDailyTasks() {
        try {
            console.log('Processing daily billing tasks...');

            // Process overdue invoices
            await this.processOverdueInvoices();

            // Send due date reminders
            await this.sendDueDateReminders();

            // Update invoice statuses
            await this.updateInvoiceStatuses();

            console.log('Daily billing tasks completed');
        } catch (error) {
            console.error('Error in daily billing tasks:', error);
        }
    }

    // Weekly tasks
    async processWeeklyTasks() {
        try {
            console.log('Processing weekly billing tasks...');

            // Send overdue reminders
            await this.sendOverdueReminders();

            // Generate weekly reports
            await this.generateWeeklyReports();

            console.log('Weekly billing tasks completed');
        } catch (error) {
            console.error('Error in weekly billing tasks:', error);
        }
    }

    // Generate recurring invoices
    async generateRecurringInvoices() {
        try {
            console.log('Generating recurring invoices...');

            const recurringInvoices = await Invoice.find({
                isRecurring: true,
                status: { $in: ['paid', 'sent'] }
            }).populate('student residence');

            for (const invoice of recurringInvoices) {
                try {
                    await this.createNextRecurringInvoice(invoice);
                } catch (error) {
                    console.error(`Error creating recurring invoice for ${invoice.invoiceNumber}:`, error);
                }
            }

            console.log('Recurring invoices generation completed');
        } catch (error) {
            console.error('Error generating recurring invoices:', error);
        }
    }

    // Create next recurring invoice
    async createNextRecurringInvoice(originalInvoice) {
        try {
            // Calculate next billing period
            const nextBillingStart = new Date(originalInvoice.billingEndDate);
            nextBillingStart.setDate(nextBillingStart.getDate() + 1);

            const nextBillingEnd = new Date(nextBillingStart);
            nextBillingEnd.setMonth(nextBillingEnd.getMonth() + 1);
            nextBillingEnd.setDate(nextBillingEnd.getDate() - 1);

            const nextDueDate = new Date(nextBillingStart);
            nextDueDate.setDate(nextDueDate.getDate() + 7); // Due 7 days after billing start

            // Generate new invoice number
            const invoiceNumber = await Invoice.generateInvoiceNumber();

            // Create new invoice
            const newInvoice = new Invoice({
                invoiceNumber,
                student: originalInvoice.student._id,
                residence: originalInvoice.residence._id,
                room: originalInvoice.room,
                roomType: originalInvoice.roomType,
                billingPeriod: `${nextBillingStart.getFullYear()}-${String(nextBillingStart.getMonth() + 1).padStart(2, '0')}`,
                billingStartDate: nextBillingStart,
                billingEndDate: nextBillingEnd,
                dueDate: nextDueDate,
                charges: originalInvoice.charges,
                notes: originalInvoice.notes,
                terms: originalInvoice.terms,
                isRecurring: true,
                recurrenceRule: originalInvoice.recurrenceRule,
                lateFeeRate: originalInvoice.lateFeeRate,
                gracePeriod: originalInvoice.gracePeriod,
                createdBy: originalInvoice.createdBy,
                status: 'draft',
                auditLog: [{
                    action: 'created',
                    user: originalInvoice.createdBy,
                    details: 'Recurring invoice generated automatically'
                }]
            });

            await newInvoice.save();

            // Send notification to student
            if (originalInvoice.student.email) {
                await emailService.sendInvoiceNotification(
                    originalInvoice.student.email,
                    newInvoice,
                    originalInvoice.student
                );
            }

            console.log(`Created recurring invoice: ${newInvoice.invoiceNumber}`);
        } catch (error) {
            console.error('Error creating recurring invoice:', error);
            throw error;
        }
    }

    // Process overdue invoices
    async processOverdueInvoices() {
        try {
            const overdueInvoices = await Invoice.find({
                balanceDue: { $gt: 0 },
                dueDate: { $lt: new Date() },
                status: { $nin: ['paid', 'cancelled'] }
            }).populate('student residence');

            for (const invoice of overdueInvoices) {
                // Update status to overdue
                invoice.status = 'overdue';
                invoice.paymentStatus = 'overdue';
                await invoice.save();

                // Add late fees if applicable
                if (invoice.lateFeeRate > 0 && invoice.daysOverdue > invoice.gracePeriod) {
                    const lateFeeAmount = invoice.lateFeeAmount;
                    if (lateFeeAmount > 0) {
                        invoice.charges.push({
                            description: `Late Fee (${invoice.daysOverdue} days overdue)`,
                            amount: lateFeeAmount,
                            quantity: 1,
                            unitPrice: lateFeeAmount,
                            category: 'late_fee',
                            taxRate: 0,
                            notes: `Automatically added for ${invoice.daysOverdue} days overdue`
                        });
                        await invoice.save();
                    }
                }
            }

            console.log(`Processed ${overdueInvoices.length} overdue invoices`);
        } catch (error) {
            console.error('Error processing overdue invoices:', error);
        }
    }

    // Send due date reminders
    async sendDueDateReminders() {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

            const dueInvoices = await Invoice.find({
                dueDate: {
                    $gte: tomorrow,
                    $lt: dayAfterTomorrow
                },
                balanceDue: { $gt: 0 },
                status: { $nin: ['paid', 'cancelled'] }
            }).populate('student residence');

            for (const invoice of dueInvoices) {
                try {
                    // Send email reminder
                    if (invoice.student.email) {
                        await emailService.sendDueDateReminder(
                            invoice.student.email,
                            invoice,
                            invoice.student
                        );
                    }

                    // Send WhatsApp reminder
                    if (invoice.student.phone) {
                        await whatsappService.sendDueDateReminder(
                            invoice.student.phone,
                            invoice
                        );
                    }

                    // Record reminder
                    invoice.reminders.push({
                        type: 'due_date',
                        sentDate: new Date(),
                        sentVia: 'email',
                        recipient: invoice.student.email,
                        status: 'sent',
                        message: 'Payment due tomorrow'
                    });
                    invoice.lastReminderSent = new Date();
                    invoice.reminderCount += 1;
                    await invoice.save();

                } catch (error) {
                    console.error(`Error sending reminder for invoice ${invoice.invoiceNumber}:`, error);
                }
            }

            console.log(`Sent ${dueInvoices.length} due date reminders`);
        } catch (error) {
            console.error('Error sending due date reminders:', error);
        }
    }

    // Send overdue reminders
    async sendOverdueReminders() {
        try {
            const overdueInvoices = await Invoice.find({
                balanceDue: { $gt: 0 },
                dueDate: { $lt: new Date() },
                status: 'overdue'
            }).populate('student residence');

            for (const invoice of overdueInvoices) {
                try {
                    // Send email reminder
                    if (invoice.student.email) {
                        await emailService.sendOverdueReminder(
                            invoice.student.email,
                            invoice,
                            invoice.student
                        );
                    }

                    // Send WhatsApp reminder
                    if (invoice.student.phone) {
                        await whatsappService.sendOverdueReminder(
                            invoice.student.phone,
                            invoice
                        );
                    }

                    // Record reminder
                    invoice.reminders.push({
                        type: 'overdue',
                        sentDate: new Date(),
                        sentVia: 'email',
                        recipient: invoice.student.email,
                        status: 'sent',
                        message: `Payment overdue by ${invoice.daysOverdue} days`
                    });
                    invoice.lastReminderSent = new Date();
                    invoice.reminderCount += 1;
                    await invoice.save();

                } catch (error) {
                    console.error(`Error sending overdue reminder for invoice ${invoice.invoiceNumber}:`, error);
                }
            }

            console.log(`Sent ${overdueInvoices.length} overdue reminders`);
        } catch (error) {
            console.error('Error sending overdue reminders:', error);
        }
    }

    // Update invoice statuses
    async updateInvoiceStatuses() {
        try {
            const invoices = await Invoice.find({
                status: { $nin: ['paid', 'cancelled'] }
            });

            for (const invoice of invoices) {
                let statusChanged = false;

                // Check if paid
                if (invoice.balanceDue <= 0 && invoice.status !== 'paid') {
                    invoice.status = 'paid';
                    invoice.paymentStatus = 'paid';
                    statusChanged = true;
                }
                // Check if overdue
                else if (invoice.balanceDue > 0 && invoice.dueDate < new Date() && invoice.status !== 'overdue') {
                    invoice.status = 'overdue';
                    invoice.paymentStatus = 'overdue';
                    statusChanged = true;
                }
                // Check if partially paid
                else if (invoice.amountPaid > 0 && invoice.balanceDue > 0 && invoice.paymentStatus !== 'partial') {
                    invoice.paymentStatus = 'partial';
                    statusChanged = true;
                }

                if (statusChanged) {
                    await invoice.save();
                }
            }

            console.log('Invoice statuses updated');
        } catch (error) {
            console.error('Error updating invoice statuses:', error);
        }
    }

    // Generate weekly reports
    async generateWeeklyReports() {
        try {
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - 7);

            const weeklyStats = await Invoice.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startOfWeek }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalInvoices: { $sum: 1 },
                        totalAmount: { $sum: '$totalAmount' },
                        totalPaid: { $sum: '$amountPaid' },
                        totalOutstanding: { $sum: '$balanceDue' },
                        overdueAmount: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $gt: ['$balanceDue', 0] }, { $lt: ['$dueDate', new Date()] }] },
                                    '$balanceDue',
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);

            console.log('Weekly billing report generated:', weeklyStats[0]);
        } catch (error) {
            console.error('Error generating weekly reports:', error);
        }
    }

    // Manual trigger for testing
    async triggerDailyTasks() {
        await this.processDailyTasks();
    }

    async triggerWeeklyTasks() {
        await this.processWeeklyTasks();
    }

    async triggerMonthlyTasks() {
        await this.generateRecurringInvoices();
    }
}

module.exports = new AutomatedBillingService(); 