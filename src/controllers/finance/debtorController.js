const Debtor = require('../../models/Debtor');
const User = require('../../models/User');
const Account = require('../../models/Account');
const Transaction = require('../../models/Transaction');
const TransactionEntry = require('../../models/TransactionEntry');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');

// Create a new debtor account for a student/tenant
exports.createDebtor = async (req, res) => {
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
                message: 'Only students can be debtors'
            });
        }

        // Check if debtor account already exists
        const existingDebtor = await Debtor.findOne({ user: userId });
        if (existingDebtor) {
            return res.status(400).json({
                success: false,
                message: 'Debtor account already exists for this user'
            });
        }

        // Generate codes
        const debtorCode = await Debtor.generateDebtorCode();
        const accountCode = await Debtor.generateAccountCode();

        // Create debtor account
        const debtor = new Debtor({
            debtorCode,
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
        });

        await debtor.save();

        // Create corresponding account in chart of accounts
        const account = new Account({
            code: accountCode,
            name: `Accounts Receivable - ${user.firstName} ${user.lastName}`,
            type: 'Asset',
            description: `Accounts receivable for ${user.firstName} ${user.lastName}`,
            isActive: true,
            parentAccount: '1100', // Accounts Receivable - Tenants
            createdBy: req.user._id
        });

        await account.save();

        // Populate user details
        await debtor.populate('user', 'firstName lastName email phone');
        await debtor.populate('residence', 'name address');

        res.status(201).json({
            success: true,
            message: 'Debtor account created successfully',
            debtor
        });

    } catch (error) {
        console.error('Error creating debtor:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating debtor account',
            error: error.message
        });
    }
};

// Get all debtors with filtering and pagination
exports.getAllDebtors = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            residence,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            overdue
        } = req.query;

        // Build query
        const query = {};

        if (status) query.status = status;
        if (residence) query.residence = residence;
        if (overdue === 'true') query.currentBalance = { $gt: 0 };

        // Search functionality
        if (search) {
            query.$or = [
                { 'contactInfo.name': { $regex: search, $options: 'i' } },
                { 'contactInfo.email': { $regex: search, $options: 'i' } },
                { debtorCode: { $regex: search, $options: 'i' } },
                { accountCode: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Debtor.countDocuments(query);

        // Get debtors with population
        const debtors = await Debtor.find(query)
            .populate('user', 'firstName lastName email phone')
            .populate('residence', 'name address')
            .populate('createdBy', 'firstName lastName email')
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Calculate summary statistics
        const totalOwed = await Debtor.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$totalOwed' } } }
        ]);

        const totalPaid = await Debtor.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$totalPaid' } } }
        ]);

        const totalBalance = await Debtor.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$currentBalance' } } }
        ]);

        res.status(200).json({
            success: true,
            debtors,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            },
            summary: {
                totalOwed: totalOwed[0]?.total || 0,
                totalPaid: totalPaid[0]?.total || 0,
                totalBalance: totalBalance[0]?.total || 0,
                totalDebtors: total
            }
        });

    } catch (error) {
        console.error('Error fetching debtors:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching debtors',
            error: error.message
        });
    }
};

// Get debtor by ID
exports.getDebtorById = async (req, res) => {
    try {
        const { id } = req.params;

        const debtor = await Debtor.findById(id)
            .populate('user', 'firstName lastName email phone')
            .populate('residence', 'name address')
            .populate('createdBy', 'firstName lastName email')
            .populate('updatedBy', 'firstName lastName email');

        if (!debtor) {
            return res.status(404).json({
                success: false,
                message: 'Debtor not found'
            });
        }

        // Get recent transactions
        const transactions = await Transaction.find({
            $or: [
                { 'entries.account': debtor.accountCode },
                { 'entries.debtorId': debtor._id }
            ]
        })
        .populate('entries.account')
        .sort({ date: -1 })
        .limit(10);

        // Get recent invoices
        const invoices = await Invoice.find({
            student: debtor.user._id
        })
        .sort({ createdAt: -1 })
        .limit(10);

        // Get recent payments
        const payments = await Payment.find({
            student: debtor.user._id
        })
        .sort({ paymentDate: -1 })
        .limit(10);

        res.status(200).json({
            success: true,
            debtor,
            transactions,
            invoices,
            payments
        });

    } catch (error) {
        console.error('Error fetching debtor:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching debtor',
            error: error.message
        });
    }
};

// Update debtor account
exports.updateDebtor = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, creditLimit, paymentTerms, notes, residence, roomNumber } = req.body;

        const debtor = await Debtor.findById(id);
        if (!debtor) {
            return res.status(404).json({
                success: false,
                message: 'Debtor not found'
            });
        }

        // Update fields
        if (status) debtor.status = status;
        if (creditLimit !== undefined) debtor.creditLimit = creditLimit;
        if (paymentTerms) debtor.paymentTerms = paymentTerms;
        if (notes !== undefined) debtor.notes = notes;
        if (residence) debtor.residence = residence;
        if (roomNumber) debtor.roomNumber = roomNumber;

        debtor.updatedBy = req.user._id;
        await debtor.save();

        // Recalculate balance
        debtor.calculateBalance();
        await debtor.save();

        await debtor.populate('user', 'firstName lastName email phone');
        await debtor.populate('residence', 'name address');

        res.status(200).json({
            success: true,
            message: 'Debtor updated successfully',
            debtor
        });

    } catch (error) {
        console.error('Error updating debtor:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating debtor',
            error: error.message
        });
    }
};

// Add charge to debtor (when invoice is created)
exports.addCharge = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, description, invoiceId } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required'
            });
        }

        const debtor = await Debtor.findById(id);
        if (!debtor) {
            return res.status(404).json({
                success: false,
                message: 'Debtor not found'
            });
        }

        // Add charge
        await debtor.addCharge(amount, description);

        // Create transaction entry for double-entry bookkeeping
        const transaction = new Transaction({
            date: new Date(),
            description: description || `Charge added to ${debtor.contactInfo.name}`,
            reference: invoiceId || `INV-${Date.now()}`,
            type: 'invoice',
            createdBy: req.user._id
        });

        await transaction.save();

        // Create transaction entries
        const entries = [
            {
                transaction: transaction._id,
                account: debtor.accountCode, // Accounts Receivable
                debit: amount,
                credit: 0,
                description: description || 'Rent charge',
                debtorId: debtor._id
            },
            {
                transaction: transaction._id,
                account: '4000', // Rental Income
                debit: 0,
                credit: amount,
                description: description || 'Rent income'
            }
        ];

        await TransactionEntry.insertMany(entries);

        await debtor.populate('user', 'firstName lastName email phone');

        res.status(200).json({
            success: true,
            message: 'Charge added successfully',
            debtor,
            transaction: transaction._id
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

// Add payment to debtor (when payment is received)
exports.addPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, description, paymentMethod, paymentId } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required'
            });
        }

        const debtor = await Debtor.findById(id);
        if (!debtor) {
            return res.status(404).json({
                success: false,
                message: 'Debtor not found'
            });
        }

        // Add payment
        await debtor.addPayment(amount, description);

        // Create transaction entry for double-entry bookkeeping
        const transaction = new Transaction({
            date: new Date(),
            description: description || `Payment received from ${debtor.contactInfo.name}`,
            reference: paymentId || `PAY-${Date.now()}`,
            type: 'payment',
            createdBy: req.user._id
        });

        await transaction.save();

        // Create transaction entries
        const entries = [
            {
                transaction: transaction._id,
                account: '1000', // Bank - Main Account
                debit: amount,
                credit: 0,
                description: description || 'Payment received',
                paymentMethod
            },
            {
                transaction: transaction._id,
                account: debtor.accountCode, // Accounts Receivable
                debit: 0,
                credit: amount,
                description: description || 'Payment received',
                debtorId: debtor._id
            }
        ];

        await TransactionEntry.insertMany(entries);

        await debtor.populate('user', 'firstName lastName email phone');

        res.status(200).json({
            success: true,
            message: 'Payment added successfully',
            debtor,
            transaction: transaction._id
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

// Get debtor balance and history
exports.getDebtorBalance = async (req, res) => {
    try {
        const { id } = req.params;

        const debtor = await Debtor.findById(id)
            .populate('user', 'firstName lastName email phone')
            .populate('residence', 'name address');

        if (!debtor) {
            return res.status(404).json({
                success: false,
                message: 'Debtor not found'
            });
        }

        // Get transaction history
        const transactions = await Transaction.find({
            $or: [
                { 'entries.account': debtor.accountCode },
                { 'entries.debtorId': debtor._id }
            ]
        })
        .populate('entries.account')
        .sort({ date: -1 });

        // Get invoice history
        const invoices = await Invoice.find({
            student: debtor.user._id
        })
        .sort({ createdAt: -1 });

        // Get payment history
        const payments = await Payment.find({
            student: debtor.user._id
        })
        .sort({ paymentDate: -1 });

        res.status(200).json({
            success: true,
            debtor,
            transactions,
            invoices,
            payments,
            summary: {
                totalOwed: debtor.totalOwed,
                totalPaid: debtor.totalPaid,
                currentBalance: debtor.currentBalance,
                overdueAmount: debtor.overdueAmount,
                daysOverdue: debtor.daysOverdue
            }
        });

    } catch (error) {
        console.error('Error fetching debtor balance:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching debtor balance',
            error: error.message
        });
    }
};

// Delete debtor account
exports.deleteDebtor = async (req, res) => {
    try {
        const { id } = req.params;

        const debtor = await Debtor.findById(id);
        if (!debtor) {
            return res.status(404).json({
                success: false,
                message: 'Debtor not found'
            });
        }

        // Check if debtor has outstanding balance
        if (debtor.currentBalance > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete debtor with outstanding balance'
            });
        }

        await Debtor.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Debtor deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting debtor:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting debtor',
            error: error.message
        });
    }
}; 