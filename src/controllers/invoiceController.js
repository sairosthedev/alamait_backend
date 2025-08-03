const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Residence = require('../models/Residence');
const Payment = require('../models/Payment');
const { generateInvoicePdf } = require('../utils/invoicePdf');
const emailService = require('../services/emailService');
const whatsappService = require('../services/whatsappService');
const mongoose = require('mongoose');

// Create new invoice
exports.createInvoice = async (req, res) => {
    try {
        const user = req.user;
        const {
            student,
            residence,
            room,
            roomType,
            billingPeriod,
            billingStartDate,
            billingEndDate,
            dueDate,
            charges,
            notes,
            terms,
            isRecurring,
            recurrenceRule,
            lateFeeRate,
            gracePeriod
        } = req.body;

        // Validate required fields
        if (!student || !residence || !room || !billingPeriod || !dueDate) {
            return res.status(400).json({
                message: 'Missing required fields: student, residence, room, billingPeriod, dueDate'
            });
        }

        // Check if student exists
        const studentExists = await User.findById(student);
        if (!studentExists) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check if residence exists
        const residenceExists = await Residence.findById(residence);
        if (!residenceExists) {
            return res.status(404).json({ message: 'Residence not found' });
        }

        // Generate invoice number
        const invoiceNumber = await Invoice.generateInvoiceNumber();

        // Create invoice
        const invoice = new Invoice({
            invoiceNumber,
            student,
            residence,
            room,
            roomType,
            billingPeriod,
            billingStartDate: new Date(billingStartDate),
            billingEndDate: new Date(billingEndDate),
            dueDate: new Date(dueDate),
            charges,
            notes,
            terms,
            isRecurring,
            recurrenceRule,
            lateFeeRate: lateFeeRate || 0,
            gracePeriod: gracePeriod || 0,
            createdBy: user._id,
            auditLog: [{
                action: 'created',
                user: user._id,
                details: 'Invoice created manually'
            }]
        });

        const savedInvoice = await invoice.save();

        // Populate student and residence details
        await savedInvoice.populate('student', 'firstName lastName email phone');
        await savedInvoice.populate('residence', 'name address');

        res.status(201).json({
            message: 'Invoice created successfully',
            invoice: savedInvoice
        });

    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({
            message: 'Error creating invoice',
            error: error.message
        });
    }
};

// Get all invoices with filtering and pagination
exports.getAllInvoices = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            student,
            residence,
            room,
            billingPeriod,
            startDate,
            endDate,
            overdue,
            search,
            sortBy = 'dueDate',
            sortOrder = 'desc'
        } = req.query;

        // Build query
        const query = {};

        if (status) query.status = status;
        if (student) query.student = student;
        if (residence) query.residence = residence;
        if (room) query.room = { $regex: room, $options: 'i' };
        if (billingPeriod) query.billingPeriod = billingPeriod;

        // Date range filter
        if (startDate || endDate) {
            query.dueDate = {};
            if (startDate) query.dueDate.$gte = new Date(startDate);
            if (endDate) query.dueDate.$lte = new Date(endDate);
        }

        // Overdue filter
        if (overdue === 'true') {
            query.balanceDue = { $gt: 0 };
            query.dueDate = { $lt: new Date() };
            query.status = { $nin: ['paid', 'cancelled'] };
        }

        // Search filter
        if (search) {
            query.$or = [
                { invoiceNumber: { $regex: search, $options: 'i' } },
                { room: { $regex: search, $options: 'i' } },
                { billingPeriod: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute query with pagination
        const invoices = await Invoice.find(query)
            .populate('student', 'firstName lastName email phone')
            .populate('residence', 'name address')
            .populate('createdBy', 'firstName lastName')
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        // Get total count
        const total = await Invoice.countDocuments(query);

        // Calculate summary statistics
        const summary = await Invoice.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalInvoices: { $sum: 1 },
                    totalAmount: { $sum: '$totalAmount' },
                    totalPaid: { $sum: '$amountPaid' },
                    totalOutstanding: { $sum: '$balanceDue' }
                }
            }
        ]);

        res.status(200).json({
            invoices,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalInvoices: total,
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1
            },
            summary: summary[0] || {
                totalInvoices: 0,
                totalAmount: 0,
                totalPaid: 0,
                totalOutstanding: 0
            }
        });

    } catch (error) {
        console.error('Error getting invoices:', error);
        res.status(500).json({
            message: 'Error retrieving invoices',
            error: error.message
        });
    }
};

// Get invoice by ID
exports.getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('student', 'firstName lastName email phone')
            .populate('residence', 'name address')
            .populate('createdBy', 'firstName lastName')
            .populate('updatedBy', 'firstName lastName')
            .populate('payments.processedBy', 'firstName lastName');

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        res.status(200).json(invoice);

    } catch (error) {
        console.error('Error getting invoice:', error);
        res.status(500).json({
            message: 'Error retrieving invoice',
            error: error.message
        });
    }
};

// Update invoice
exports.updateInvoice = async (req, res) => {
    try {
        const user = req.user;
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Store previous values for audit
        const previousValues = invoice.toObject();

        // Update invoice
        Object.assign(invoice, req.body);
        invoice.updatedBy = user._id;

        // Add audit log
        invoice.auditLog.push({
            action: 'updated',
            user: user._id,
            details: 'Invoice updated',
            previousValues,
            newValues: req.body
        });

        await invoice.save();

        // Populate references
        await invoice.populate('student', 'firstName lastName email phone');
        await invoice.populate('residence', 'name address');

        res.status(200).json({
            message: 'Invoice updated successfully',
            invoice
        });

    } catch (error) {
        console.error('Error updating invoice:', error);
        res.status(500).json({
            message: 'Error updating invoice',
            error: error.message
        });
    }
};

// Delete invoice
exports.deleteInvoice = async (req, res) => {
    try {
        const user = req.user;
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Check if invoice can be deleted
        if (invoice.status === 'paid' || invoice.amountPaid > 0) {
            return res.status(400).json({
                message: 'Cannot delete invoice with payments'
            });
        }

        await Invoice.findByIdAndDelete(req.params.id);

        res.status(200).json({
            message: 'Invoice deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting invoice:', error);
        res.status(500).json({
            message: 'Error deleting invoice',
            error: error.message
        });
    }
};

// Record payment for invoice
exports.recordPayment = async (req, res) => {
    try {
        const user = req.user;
        const { paymentId, amount, paymentMethod, reference, notes } = req.body;

        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Validate payment amount
        if (amount <= 0) {
            return res.status(400).json({ message: 'Payment amount must be greater than 0' });
        }

        if (amount > invoice.balanceDue) {
            return res.status(400).json({ message: 'Payment amount cannot exceed balance due' });
        }

        // Create payment record
        const paymentRecord = {
            paymentId,
            amount,
            paymentDate: new Date(),
            paymentMethod,
            reference,
            status: 'confirmed',
            processedBy: user._id,
            notes
        };

        // Add payment to invoice
        invoice.addPayment(paymentRecord);
        await invoice.save();

        // Update payment status
        if (invoice.balanceDue <= 0) {
            invoice.status = 'paid';
            invoice.paymentStatus = 'paid';
        } else {
            invoice.paymentStatus = 'partial';
        }

        await invoice.save();

        // Send payment confirmation
        await invoice.populate('student', 'firstName lastName email phone');
        if (invoice.student.email) {
            await emailService.sendPaymentConfirmation(
                invoice.student.email,
                invoice,
                paymentRecord
            );
        }

        res.status(200).json({
            message: 'Payment recorded successfully',
            invoice
        });

    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({
            message: 'Error recording payment',
            error: error.message
        });
    }
};

// Send invoice reminder
exports.sendReminder = async (req, res) => {
    try {
        const user = req.user;
        const { type, sentVia, message } = req.body;

        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        await invoice.populate('student', 'firstName lastName email phone');

        // Create reminder record
        const reminderData = {
            type,
            sentDate: new Date(),
            sentVia,
            recipient: invoice.student.email || invoice.student.phone,
            status: 'sent',
            message
        };

        // Send reminder based on method
        let sent = false;
        if (sentVia === 'email' && invoice.student.email) {
            await emailService.sendInvoiceReminder(
                invoice.student.email,
                invoice,
                message
            );
            sent = true;
        } else if (sentVia === 'whatsapp' && invoice.student.phone) {
            await whatsappService.sendInvoiceReminder(
                invoice.student.phone,
                invoice,
                message
            );
            sent = true;
        }

        if (sent) {
            invoice.sendReminder({
                ...reminderData,
                sentBy: user._id
            });
            await invoice.save();
        }

        res.status(200).json({
            message: 'Reminder sent successfully',
            reminder: reminderData
        });

    } catch (error) {
        console.error('Error sending reminder:', error);
        res.status(500).json({
            message: 'Error sending reminder',
            error: error.message
        });
    }
};

// Generate invoice PDF
exports.generatePdf = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('student', 'firstName lastName email phone')
            .populate('residence', 'name address');

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        const pdfBuffer = await generateInvoicePdf(invoice, invoice.student);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            message: 'Error generating PDF',
            error: error.message
        });
    }
};

// Get overdue invoices
exports.getOverdueInvoices = async (req, res) => {
    try {
        const overdueInvoices = await Invoice.findOverdue()
            .populate('student', 'firstName lastName email phone')
            .populate('residence', 'name address')
            .sort({ dueDate: 1 });

        const summary = await Invoice.aggregate([
            {
                $match: {
                    balanceDue: { $gt: 0 },
                    dueDate: { $lt: new Date() },
                    status: { $nin: ['paid', 'cancelled'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOverdue: { $sum: 1 },
                    totalAmount: { $sum: '$balanceDue' },
                    averageDaysOverdue: { $avg: { $divide: [{ $subtract: [new Date(), '$dueDate'] }, 1000 * 60 * 60 * 24] } }
                }
            }
        ]);

        res.status(200).json({
            overdueInvoices,
            summary: summary[0] || {
                totalOverdue: 0,
                totalAmount: 0,
                averageDaysOverdue: 0
            }
        });

    } catch (error) {
        console.error('Error getting overdue invoices:', error);
        res.status(500).json({
            message: 'Error retrieving overdue invoices',
            error: error.message
        });
    }
};

// Get student invoice history
exports.getStudentInvoices = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const invoices = await Invoice.findByStudent(studentId)
            .populate('residence', 'name address')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Invoice.countDocuments({ student: studentId });

        // Calculate student summary
        const summary = await Invoice.aggregate([
            { $match: { student: new mongoose.Types.ObjectId(studentId) } },
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

        res.status(200).json({
            invoices,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalInvoices: total
            },
            summary: summary[0] || {
                totalInvoices: 0,
                totalAmount: 0,
                totalPaid: 0,
                totalOutstanding: 0,
                overdueAmount: 0
            }
        });

    } catch (error) {
        console.error('Error getting student invoices:', error);
        res.status(500).json({
            message: 'Error retrieving student invoices',
            error: error.message
        });
    }
};

// Bulk operations
exports.bulkSendReminders = async (req, res) => {
    try {
        const user = req.user;
        const { invoiceIds, message, sentVia } = req.body;

        const invoices = await Invoice.find({
            _id: { $in: invoiceIds },
            balanceDue: { $gt: 0 },
            status: { $nin: ['paid', 'cancelled'] }
        }).populate('student', 'firstName lastName email phone');

        const results = [];
        for (const invoice of invoices) {
            try {
                const reminderData = {
                    type: 'overdue',
                    sentDate: new Date(),
                    sentVia,
                    recipient: invoice.student.email || invoice.student.phone,
                    status: 'sent',
                    message
                };

                let sent = false;
                if (sentVia === 'email' && invoice.student.email) {
                    await emailService.sendInvoiceReminder(
                        invoice.student.email,
                        invoice,
                        message
                    );
                    sent = true;
                }

                if (sent) {
                    invoice.sendReminder({
                        ...reminderData,
                        sentBy: user._id
                    });
                    await invoice.save();
                }

                results.push({
                    invoiceId: invoice._id,
                    success: sent,
                    message: sent ? 'Reminder sent' : 'No valid contact method'
                });
            } catch (error) {
                results.push({
                    invoiceId: invoice._id,
                    success: false,
                    message: error.message
                });
            }
        }

        res.status(200).json({
            message: 'Bulk reminder operation completed',
            results
        });

    } catch (error) {
        console.error('Error in bulk reminder operation:', error);
        res.status(500).json({
            message: 'Error in bulk reminder operation',
            error: error.message
        });
    }
};

module.exports = exports; 