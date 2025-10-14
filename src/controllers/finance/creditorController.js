const Creditor = require('../../models/Creditor');
const User = require('../../models/User');
const Account = require('../../models/Account');
const Transaction = require('../../models/Transaction');
const TransactionEntry = require('../../models/TransactionEntry');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');

// Create a new creditor account for a student/tenant
exports.createCreditor = async (req, res) => {
    try {
        const { userId, residenceId, roomNumber, creditLimit, paymentTerms, notes } = req.body;

        // Validate user exists and is a student
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.role !== 'student') {
            return res.status(400).json({
                success: false,
                message: 'Only students can be set up as creditors'
            });
        }

        // Check if creditor account already exists
        const existingCreditor = await Creditor.findOne({ user: userId });
        if (existingCreditor) {
            return res.status(400).json({
                success: false,
                message: 'Creditor account already exists for this user'
            });
        }

        // Generate codes
        const creditorCode = await Creditor.generateCreditorCode();
        const accountCode = await Creditor.generateAccountCode();

        // Create creditor account
        const creditorData = {
            creditorCode,
            user: userId,
            accountCode,
            residence: residenceId,
            roomNumber,
            creditLimit: creditLimit || 0,
            paymentTerms: paymentTerms || 'monthly',
            notes,
            contactInfo: {
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                phone: user.phone
            },
            createdBy: req.user._id
        };

        const creditor = new Creditor(creditorData);
        await creditor.save();

        // Create corresponding account in chart of accounts
        const accountData = {
            code: accountCode,
            name: `Accounts Receivable - ${user.firstName} ${user.lastName}`,
            type: 'Asset',
            description: `Individual account receivable for ${user.firstName} ${user.lastName}`,
            isActive: true,
            parentAccount: '1100', // Parent: Accounts Receivable - Tenants
            creditorId: creditor._id
        };

        const account = new Account(accountData);
        await account.save();

        // Populate user and residence details
        await creditor.populate('user', 'firstName lastName email phone');
        await creditor.populate('residence', 'name address');

        res.status(201).json({
            success: true,
            message: 'Creditor account created successfully',
            creditor,
            account
        });

    } catch (error) {
        console.error('Error creating creditor:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating creditor account',
            error: error.message
        });
    }
};

// Get all creditors with filtering and pagination
exports.getAllCreditors = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            residence,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            overdueOnly = false
        } = req.query;

        // Build query
        const query = {};

        if (status) query.status = status;
        if (residence) query.residence = residence;
        if (overdueOnly === 'true') {
            query.currentBalance = { $gt: 0 };
            query.daysOverdue = { $gt: 0 };
        }

        // Search functionality
        if (search) {
            query.$or = [
                { 'contactInfo.name': { $regex: search, $options: 'i' } },
                { 'contactInfo.email': { $regex: search, $options: 'i' } },
                { creditorCode: { $regex: search, $options: 'i' } },
                { accountCode: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Creditor.countDocuments(query);

        // Get creditors with population
        const creditors = await Creditor.find(query)
            .populate('user', 'firstName lastName email phone')
            .populate('residence', 'name address')
            .populate('createdBy', 'firstName lastName email')
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Calculate summary statistics
        const summary = await Creditor.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalCreditors: { $sum: 1 },
                    totalBalance: { $sum: '$currentBalance' },
                    totalOwed: { $sum: '$totalOwed' },
                    totalPaid: { $sum: '$totalPaid' },
                    overdueAmount: { $sum: '$overdueAmount' },
                    activeCreditors: {
                        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                    },
                    overdueCreditors: {
                        $sum: { $cond: [{ $gt: ['$daysOverdue', 0] }, 1, 0] }
                    }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            creditors,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            },
            summary: summary[0] || {
                totalCreditors: 0,
                totalBalance: 0,
                totalOwed: 0,
                totalPaid: 0,
                overdueAmount: 0,
                activeCreditors: 0,
                overdueCreditors: 0
            }
        });

    } catch (error) {
        console.error('Error fetching creditors:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching creditors',
            error: error.message
        });
    }
};

// Get single creditor with detailed information
exports.getCreditorById = async (req, res) => {
    try {
        const { id } = req.params;

        const creditor = await Creditor.findById(id)
            .populate('user', 'firstName lastName email phone')
            .populate('residence', 'name address')
            .populate('createdBy', 'firstName lastName email')
            .populate('updatedBy', 'firstName lastName email');

        if (!creditor) {
            return res.status(404).json({
                success: false,
                message: 'Creditor not found'
            });
        }

        // Get recent transactions
        const recentTransactions = await TransactionEntry.find({
            accountCode: creditor.accountCode
        })
        .populate('transactionId')
        .sort({ date: -1 })
        .limit(10);

        // Get recent invoices
        const recentInvoices = await Invoice.find({
            student: creditor.user._id
        })
        .sort({ createdAt: -1 })
        .limit(5);

        // Get recent payments
        const recentPayments = await Payment.find({
            student: creditor.user._id
        })
        .sort({ paymentDate: -1 })
        .limit(5);

        res.status(200).json({
            success: true,
            creditor,
            recentTransactions,
            recentInvoices,
            recentPayments
        });

    } catch (error) {
        console.error('Error fetching creditor:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching creditor details',
            error: error.message
        });
    }
};

// Update creditor information
exports.updateCreditor = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const creditor = await Creditor.findById(id);
        if (!creditor) {
            return res.status(404).json({
                success: false,
                message: 'Creditor not found'
            });
        }

        // Update fields
        Object.keys(updateData).forEach(key => {
            if (key !== 'creditorCode' && key !== 'accountCode' && key !== 'user') {
                creditor[key] = updateData[key];
            }
        });

        creditor.updatedBy = req.user._id;
        await creditor.save();

        // Update corresponding account name if contact info changed
        if (updateData.contactInfo) {
            await Account.findOneAndUpdate(
                { code: creditor.accountCode },
                { 
                    name: `Accounts Receivable - ${creditor.contactInfo.name}`,
                    updatedAt: new Date()
                }
            );
        }

        await creditor.populate('user', 'firstName lastName email phone');
        await creditor.populate('residence', 'name address');

        res.status(200).json({
            success: true,
            message: 'Creditor updated successfully',
            creditor
        });

    } catch (error) {
        console.error('Error updating creditor:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating creditor',
            error: error.message
        });
    }
};

// Add charge to creditor (invoice creation)
exports.addCharge = async (req, res) => {
    try {
        const { creditorId, amount, description, invoiceId } = req.body;

        const creditor = await Creditor.findById(creditorId);
        if (!creditor) {
            return res.status(404).json({
                success: false,
                message: 'Creditor not found'
            });
        }

        // Add charge to creditor
        await creditor.addCharge(amount, description);

        // Create transaction entry for double-entry bookkeeping
        const transaction = new Transaction({
            date: new Date(),
            description: description || `Charge added to ${creditor.contactInfo.name}`,
            reference: invoiceId || `CR-${creditor.creditorCode}`,
            type: 'charge',
            amount: amount,
            createdBy: req.user._id
        });

        await transaction.save();

        // Create transaction entries
        const entries = [
            // Debit: Individual Accounts Receivable
            new TransactionEntry({
                transactionId: transaction._id,
                accountCode: creditor.accountCode,
                type: 'debit',
                amount: amount,
                description: `Charge: ${description}`,
                date: new Date()
            }),
            // Credit: Revenue (Rental Income)
            new TransactionEntry({
                transactionId: transaction._id,
                accountCode: '4000', // Rental Income - Residential
                type: 'credit',
                amount: amount,
                description: `Revenue from ${creditor.contactInfo.name}`,
                date: new Date()
            })
        ];

        await TransactionEntry.insertMany(entries);

        await creditor.populate('user', 'firstName lastName email phone');

        res.status(200).json({
            success: true,
            message: 'Charge added successfully',
            creditor,
            transaction
        });

    } catch (error) {
        console.error('Error adding charge:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding charge',
            error: error.message
        });
    }
};

// Add payment to creditor
exports.addPayment = async (req, res) => {
    try {
        const { creditorId, amount, paymentMethod, description, paymentId } = req.body;

        const creditor = await Creditor.findById(creditorId);
        if (!creditor) {
            return res.status(404).json({
                success: false,
                message: 'Creditor not found'
            });
        }

        // Add payment to creditor
        await creditor.addPayment(amount, description);

        // Create transaction entry for double-entry bookkeeping
        const transaction = new Transaction({
            date: new Date(),
            description: description || `Payment received from ${creditor.contactInfo.name}`,
            reference: paymentId || `PAY-${creditor.creditorCode}`,
            type: 'payment',
            amount: amount,
            createdBy: req.user._id
        });

        await transaction.save();

        // Create transaction entries
        const entries = [
            // Debit: Bank Account (or Cash)
            new TransactionEntry({
                transactionId: transaction._id,
                accountCode: '1000', // Bank - Main Account
                type: 'debit',
                amount: amount,
                description: `Payment from ${creditor.contactInfo.name}`,
                date: new Date()
            }),
            // Credit: Individual Accounts Receivable
            new TransactionEntry({
                transactionId: transaction._id,
                accountCode: creditor.accountCode,
                type: 'credit',
                amount: amount,
                description: `Payment: ${description}`,
                date: new Date()
            })
        ];

        await TransactionEntry.insertMany(entries);

        // Log payment addition in audit logs
        try {
            const { logPaymentOperation } = require('../../utils/auditLogger');
            await logPaymentOperation('creditor_payment', creditor, req.user._id, {
                creditorId: creditor._id,
                creditorName: creditor.contactInfo.name,
                amount: amount,
                paymentMethod: paymentMethod,
                description: description,
                paymentId: paymentId,
                transactionId: transaction._id,
                accountCode: creditor.accountCode
            });
            console.log(`📝 Creditor payment audit logged: ${creditor.contactInfo.name} - $${amount} by ${req.user.email}`);
        } catch (auditError) {
            console.error('❌ Failed to log creditor payment audit:', auditError.message);
        }

        await creditor.populate('user', 'firstName lastName email phone');

        res.status(200).json({
            success: true,
            message: 'Payment added successfully',
            creditor,
            transaction
        });

    } catch (error) {
        console.error('Error adding payment:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding payment',
            error: error.message
        });
    }
};

// Get creditor balance and transaction history
exports.getCreditorBalance = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const creditor = await Creditor.findById(id);
        if (!creditor) {
            return res.status(404).json({
                success: false,
                message: 'Creditor not found'
            });
        }

        // Build date filter
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.date = {};
            if (startDate) dateFilter.date.$gte = new Date(startDate);
            if (endDate) dateFilter.date.$lte = new Date(endDate);
        }

        // Get transaction history
        const transactions = await TransactionEntry.find({
            accountCode: creditor.accountCode,
            ...dateFilter
        })
        .populate('transactionId')
        .sort({ date: -1 });

        // Calculate running balance
        let runningBalance = 0;
        const balanceHistory = transactions.map(entry => {
            if (entry.type === 'debit') {
                runningBalance += entry.amount;
            } else {
                runningBalance -= entry.amount;
            }
            return {
                date: entry.date,
                description: entry.description,
                type: entry.type,
                amount: entry.amount,
                balance: runningBalance,
                transaction: entry.transactionId
            };
        });

        res.status(200).json({
            success: true,
            creditor,
            balanceHistory,
            currentBalance: creditor.currentBalance,
            totalOwed: creditor.totalOwed,
            totalPaid: creditor.totalPaid
        });

    } catch (error) {
        console.error('Error fetching creditor balance:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching creditor balance',
            error: error.message
        });
    }
};

// Bulk create creditors from existing students
exports.bulkCreateCreditors = async (req, res) => {
    try {
        const { residenceId } = req.body;

        // Find all students without creditor accounts
        const students = await User.find({ 
            role: 'student',
            residence: residenceId 
        });

        const createdCreditors = [];
        const errors = [];

        for (const student of students) {
            try {
                // Check if creditor already exists
                const existingCreditor = await Creditor.findOne({ user: student._id });
                if (existingCreditor) {
                    continue; // Skip if already exists
                }

                // Generate codes
                const creditorCode = await Creditor.generateCreditorCode();
                const accountCode = await Creditor.generateAccountCode();

                // Create creditor
                const creditorData = {
                    creditorCode,
                    user: student._id,
                    accountCode,
                    residence: student.residence,
                    roomNumber: student.currentRoom,
                    contactInfo: {
                        name: `${student.firstName} ${student.lastName}`,
                        email: student.email,
                        phone: student.phone
                    },
                    createdBy: req.user._id
                };

                const creditor = new Creditor(creditorData);
                await creditor.save();

                // Create corresponding account
                const accountData = {
                    code: accountCode,
                    name: `Accounts Receivable - ${student.firstName} ${student.lastName}`,
                    type: 'Asset',
                    description: `Individual account receivable for ${student.firstName} ${student.lastName}`,
                    isActive: true,
                    parentAccount: '1100',
                    creditorId: creditor._id
                };

                const account = new Account(accountData);
                await account.save();

                createdCreditors.push(creditor);
            } catch (error) {
                errors.push({
                    student: student.email,
                    error: error.message
                });
            }
        }

        res.status(200).json({
            success: true,
            message: `Created ${createdCreditors.length} creditor accounts`,
            createdCount: createdCreditors.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Error bulk creating creditors:', error);
        res.status(500).json({
            success: false,
            message: 'Error bulk creating creditors',
            error: error.message
        });
    }
}; 