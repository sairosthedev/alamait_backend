const Debtor = require('../../models/Debtor');
const User = require('../../models/User');
const Account = require('../../models/Account');
const Transaction = require('../../models/Transaction');
const TransactionEntry = require('../../models/TransactionEntry');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');
const Residence = require('../../models/Residence');
const Application = require('../../models/Application');
const Booking = require('../../models/Booking');
const { createDebtorForStudent } = require('../../services/debtorService');

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

        // Get debtors with full population
        const debtors = await Debtor.find(query)
            .populate('user', 'firstName lastName email phone')
            .populate('residence', 'name address roomPrice')
            .populate('application', 'startDate endDate roomNumber status')
            .populate('payments', 'date amount rentAmount adminFee deposit status')
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
            .populate('residence', 'name address roomPrice')
            .populate('application', 'startDate endDate roomNumber status')
            .populate('payments', 'date amount rentAmount adminFee deposit status')
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
		const mongoose = require('mongoose');
		const DoubleEntryAccountingService = require('../../services/doubleEntryAccountingService');
		const paymentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
		const pseudoPayment = {
			_id: new mongoose.Types.ObjectId(),
			paymentId: paymentId || `PAY-${Date.now()}`,
			student: debtor.user,
			user: debtor.user,
			residence: debtor.residence,
			totalAmount: amount,
			method: paymentMethod || 'Bank Transfer',
			date: new Date(),
			paymentMonth,
			payments: [{ type: 'rent', amount }]
		};

		// Use the new advance balance handling method for better payment processing
		await DoubleEntryAccountingService.recordStudentRentPaymentWithAdvanceHandling(pseudoPayment, req.user);

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

// Get comprehensive debtor data with all related collections
exports.getDebtorComprehensiveData = async (req, res) => {
    try {
        const { id } = req.params;
        const { includeHistory = true, months = 12 } = req.query;

        const debtor = await Debtor.findById(id)
            .populate('user', 'firstName lastName email phone')
            .populate('residence', 'name address city state zipCode')
            .populate('createdBy', 'firstName lastName email');

        if (!debtor) {
            return res.status(404).json({
                success: false,
                message: 'Debtor not found'
            });
        }

        // Get all payments for this debtor (student)
        const payments = await Payment.find({
            student: debtor.user._id
        })
        .populate('residence', 'name address')
        .populate('student', 'firstName lastName email')
        .sort({ date: -1 });

        // Get all transactions related to this debtor
        const transactions = await Transaction.find({
            $or: [
                { 'entries.account': debtor.accountCode },
                { 'entries.debtorId': debtor._id },
                { reference: { $regex: debtor.debtorCode, $options: 'i' } }
            ]
        })
        .populate('entries')
        .populate('residence', 'name address')
        .sort({ date: -1 });

        // Get residence details
        const residence = await Residence.findById(debtor.residence)
            .populate('rooms');

        // Get application data for this student
        const applications = await Application.find({
            student: debtor.user._id
        })
        .populate('residence', 'name address')
        .sort({ createdAt: -1 });

        // Get booking data for this student
        const bookings = await Booking.find({
            student: debtor.user._id
        })
        .populate('residence', 'name address')
        .populate('room')
        .sort({ startDate: -1 });

        // Calculate payment statistics
        const paymentStats = calculatePaymentStatistics(payments, months);
        
        // Calculate transaction statistics
        const transactionStats = calculateTransactionStatistics(transactions, months);

        // Get room details if available
        const roomDetails = residence?.rooms?.find(room => 
            room.roomNumber === debtor.roomNumber
        );

        const response = {
            success: true,
            debtor: {
                ...debtor.toObject(),
                roomDetails
            },
            residence: residence,
            payments: {
                data: includeHistory ? payments : [],
                statistics: paymentStats
            },
            transactions: {
                data: includeHistory ? transactions : [],
                statistics: transactionStats
            },
            applications: includeHistory ? applications : [],
            bookings: includeHistory ? bookings : [],
            summary: {
                totalPayments: payments.length,
                totalTransactions: transactions.length,
                totalApplications: applications.length,
                totalBookings: bookings.length,
                currentBalance: debtor.currentBalance,
                totalOwed: debtor.totalOwed,
                totalPaid: debtor.totalPaid,
                overdueAmount: debtor.overdueAmount,
                daysOverdue: debtor.daysOverdue
            }
        };

        res.status(200).json(response);

    } catch (error) {
        console.error('Error fetching comprehensive debtor data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching comprehensive debtor data',
            error: error.message
        });
    }
};

// Get all debtors with comprehensive data mapping
exports.getAllDebtorsComprehensive = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            residence,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            overdue,
            includeDetails = false
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

        // Get debtors with basic population
        const debtors = await Debtor.find(query)
            .populate('user', 'firstName lastName email phone')
            .populate('residence', 'name address city')
            .populate('createdBy', 'firstName lastName email')
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .skip(skip)
            .limit(parseInt(limit));

        // If includeDetails is true, fetch additional data for each debtor
        let debtorsWithDetails = debtors;
        if (includeDetails === 'true') {
            debtorsWithDetails = await Promise.all(
                debtors.map(async (debtor) => {
                    // Get recent payments (last 5)
                    const recentPayments = await Payment.find({
                        student: debtor.user._id
                    })
                    .sort({ date: -1 })
                    .limit(5);

                    // Get recent transactions (last 5)
                    const recentTransactions = await Transaction.find({
                        $or: [
                            { 'entries.account': debtor.accountCode },
                            { 'entries.debtorId': debtor._id }
                        ]
                    })
                    .sort({ date: -1 })
                    .limit(5);

                    // Get current application
                    const currentApplication = await Application.findOne({
                        student: debtor.user._id,
                        status: 'approved'
                    })
                    .populate('residence', 'name address');

                    // Get current booking
                    const currentBooking = await Booking.findOne({
                        student: debtor.user._id,
                        status: 'active'
                    })
                    .populate('residence', 'name address')
                    .populate('room');

                    return {
                        ...debtor.toObject(),
                        recentPayments,
                        recentTransactions,
                        currentApplication,
                        currentBooking
                    };
                })
            );
        }

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

        const overdueCount = await Debtor.countDocuments({
            ...query,
            currentBalance: { $gt: 0 }
        });

        res.status(200).json({
            success: true,
            debtors: debtorsWithDetails,
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
                totalDebtors: total,
                overdueCount
            }
        });

    } catch (error) {
        console.error('Error fetching comprehensive debtors:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching comprehensive debtors',
            error: error.message
        });
    }
};

// Get debtor payment history with detailed mapping
exports.getDebtorPaymentHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate, status, method } = req.query;

        const debtor = await Debtor.findById(id)
            .populate('user', 'firstName lastName email phone');

        if (!debtor) {
            return res.status(404).json({
                success: false,
                message: 'Debtor not found'
            });
        }

        // Build payment query
        const paymentQuery = { student: debtor.user._id };
        
        if (startDate && endDate) {
            paymentQuery.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        if (status) paymentQuery.status = status;
        if (method) paymentQuery.method = method;

        const payments = await Payment.find(paymentQuery)
            .populate('residence', 'name address')
            .populate('student', 'firstName lastName email')
            .sort({ date: -1 });

        // Calculate payment statistics
        const totalAmount = payments.reduce((sum, payment) => sum + payment.totalAmount, 0);
        const confirmedPayments = payments.filter(p => p.status === 'Confirmed');
        const pendingPayments = payments.filter(p => p.status === 'Pending');
        
        const methodBreakdown = payments.reduce((acc, payment) => {
            acc[payment.method] = (acc[payment.method] || 0) + payment.totalAmount;
            return acc;
        }, {});

        const monthlyBreakdown = payments.reduce((acc, payment) => {
            const month = new Date(payment.date).toISOString().slice(0, 7); // YYYY-MM
            acc[month] = (acc[month] || 0) + payment.totalAmount;
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            debtor: {
                _id: debtor._id,
                debtorCode: debtor.debtorCode,
                name: debtor.contactInfo.name,
                email: debtor.contactInfo.email
            },
            payments,
            statistics: {
                totalPayments: payments.length,
                totalAmount,
                confirmedAmount: confirmedPayments.reduce((sum, p) => sum + p.totalAmount, 0),
                pendingAmount: pendingPayments.reduce((sum, p) => sum + p.totalAmount, 0),
                methodBreakdown,
                monthlyBreakdown
            }
        });

    } catch (error) {
        console.error('Error fetching debtor payment history:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching debtor payment history',
            error: error.message
        });
    }
};

// Create debtor for existing student who doesn't have one
exports.createDebtorForExistingStudent = async (req, res) => {
    try {
        const { userId } = req.params;
        const { residenceId, roomNumber } = req.body;

        // Check if user exists and is a student
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
                message: 'User is not a student'
            });
        }

        // Check if debtor already exists
        const existingDebtor = await Debtor.findOne({ user: userId });
        if (existingDebtor) {
            return res.status(400).json({
                success: false,
                message: 'Debtor account already exists for this student'
            });
        }

        // Create debtor
        const debtor = await createDebtorForStudent(user, {
            residenceId,
            roomNumber,
            createdBy: req.user._id
        });

        res.status(201).json({
            success: true,
            message: 'Debtor account created successfully',
            debtor: {
                _id: debtor._id,
                debtorCode: debtor.debtorCode,
                accountCode: debtor.accountCode,
                status: debtor.status,
                user: {
                    _id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email
                }
            }
        });

    } catch (error) {
        console.error('Error creating debtor for existing student:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating debtor account',
            error: error.message
        });
    }
};

// Bulk create debtors for all students without debtor accounts
exports.bulkCreateDebtors = async (req, res) => {
    try {
        const { createDebtorsForAllStudents } = require('../../services/debtorService');
        
        const result = await createDebtorsForAllStudents({
            createdBy: req.user._id
        });
        
        res.status(200).json({
            success: true,
            message: `Successfully created ${result.createdDebtors.length} debtor accounts`,
            summary: {
                totalCreated: result.createdDebtors.length,
                totalErrors: result.errors.length,
                createdDebtors: result.createdDebtors.map(debtor => ({
                    _id: debtor._id,
                    debtorCode: debtor.debtorCode,
                    accountCode: debtor.accountCode,
                    user: debtor.user
                })),
                errors: result.errors
            }
        });
    } catch (error) {
        console.error('Error in bulk debtor creation:', error);
        res.status(500).json({
            success: false,
            message: 'Error in bulk debtor creation',
            error: error.message
        });
    }
};

// Sync payment history for a specific debtor
exports.syncDebtorPaymentHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const { forceUpdate = false } = req.query;
        
        const PaymentHistorySyncService = require('../../services/paymentHistorySyncService');
        
        const result = await PaymentHistorySyncService.syncDebtorPaymentHistory(id, forceUpdate === 'true');
        
        res.status(200).json({
            success: true,
            message: result.message,
            result
        });
        
    } catch (error) {
        console.error('Error syncing debtor payment history:', error);
        res.status(500).json({
            success: false,
            message: 'Error syncing payment history',
            error: error.message
        });
    }
};

// Sync payment history for all debtors
exports.syncAllDebtorsPaymentHistory = async (req, res) => {
    try {
        const { forceUpdate = false } = req.query;
        
        const PaymentHistorySyncService = require('../../services/paymentHistorySyncService');
        
        const result = await PaymentHistorySyncService.syncAllDebtorsPaymentHistory(forceUpdate === 'true');
        
        res.status(200).json({
            success: true,
            message: 'Payment history sync completed for all debtors',
            result
        });
        
    } catch (error) {
        console.error('Error syncing all debtors payment history:', error);
        res.status(500).json({
            success: false,
            message: 'Error syncing all debtors payment history',
            error: error.message
        });
    }
};

// Validate payment history for a debtor
exports.validateDebtorPaymentHistory = async (req, res) => {
    try {
        const { id } = req.params;
        
        const PaymentHistorySyncService = require('../../services/paymentHistorySyncService');
        
        const validation = await PaymentHistorySyncService.validatePaymentHistory(id);
        
        res.status(200).json({
            success: true,
            message: 'Payment history validation completed',
            validation
        });
        
    } catch (error) {
        console.error('Error validating debtor payment history:', error);
        res.status(500).json({
            success: false,
            message: 'Error validating payment history',
            error: error.message
        });
    }
};

/**
 * Bulk create debtor accounts for students without debtors
 */
exports.bulkCreateDebtorsForStudents = async (req, res) => {
    try {
        const { createDebtorsForAllStudents } = require('../../services/debtorService');
        
        const result = await createDebtorsForAllStudents({
            createdBy: req.user._id
        });
        
        res.json({
            success: true,
            message: `Successfully created ${result.createdDebtors.length} debtor accounts`,
            created: result.createdDebtors.length,
            errors: result.errors.length,
            details: {
                createdDebtors: result.createdDebtors.map(d => ({
                    debtorCode: d.debtorCode,
                    accountCode: d.accountCode,
                    user: d.user
                })),
                errors: result.errors
            }
        });
    } catch (error) {
        console.error('Error in bulkCreateDebtorsForStudents:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create debtor accounts',
            details: error.message 
        });
    }
};

/**
 * Check which students don't have debtor accounts
 */
exports.checkStudentsWithoutDebtors = async (req, res) => {
    try {
        const User = require('../../models/User');
        const Debtor = require('../../models/Debtor');
        
        // Find all students
        const students = await User.find({ role: 'student' });
        
        const studentsWithoutDebtors = [];
        const studentsWithDebtors = [];
        
        // Check each student for debtor account
        for (const student of students) {
            const debtor = await Debtor.findOne({ user: student._id });
            if (debtor) {
                studentsWithDebtors.push({
                    studentId: student._id,
                    email: student.email,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    debtorCode: debtor.debtorCode,
                    accountCode: debtor.accountCode
                });
            } else {
                studentsWithoutDebtors.push({
                    studentId: student._id,
                    email: student.email,
                    firstName: student.firstName,
                    lastName: student.lastName
                });
            }
        }
        
        res.json({
            success: true,
            summary: {
                totalStudents: students.length,
                withDebtors: studentsWithDebtors.length,
                withoutDebtors: studentsWithoutDebtors.length
            },
            studentsWithoutDebtors,
            studentsWithDebtors
        });
    } catch (error) {
        console.error('Error in checkStudentsWithoutDebtors:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to check students',
            details: error.message 
        });
    }
};

// Helper function to calculate payment statistics
const calculatePaymentStatistics = (payments, months = 12) => {
    const now = new Date();
    const monthsAgo = new Date(now.getFullYear(), now.getMonth() - months, 1);
    
    const recentPayments = payments.filter(payment => 
        new Date(payment.date) >= monthsAgo
    );

    const totalAmount = recentPayments.reduce((sum, payment) => sum + payment.totalAmount, 0);
    const confirmedPayments = recentPayments.filter(p => p.status === 'Confirmed');
    const pendingPayments = recentPayments.filter(p => p.status === 'Pending');

    const methodBreakdown = recentPayments.reduce((acc, payment) => {
        acc[payment.method] = (acc[payment.method] || 0) + payment.totalAmount;
        return acc;
    }, {});

    return {
        totalPayments: recentPayments.length,
        totalAmount,
        confirmedAmount: confirmedPayments.reduce((sum, p) => sum + p.totalAmount, 0),
        pendingAmount: pendingPayments.reduce((sum, p) => sum + p.totalAmount, 0),
        methodBreakdown,
        averagePayment: recentPayments.length > 0 ? totalAmount / recentPayments.length : 0
    };
};

// Helper function to calculate transaction statistics
const calculateTransactionStatistics = (transactions, months = 12) => {
    const now = new Date();
    const monthsAgo = new Date(now.getFullYear(), now.getMonth() - months, 1);
    
    const recentTransactions = transactions.filter(transaction => 
        new Date(transaction.date) >= monthsAgo
    );

    const totalDebit = recentTransactions.reduce((sum, transaction) => {
        return sum + (transaction.entries?.reduce((entrySum, entry) => 
            entrySum + (entry.debit || 0), 0) || 0);
    }, 0);

    const totalCredit = recentTransactions.reduce((sum, transaction) => {
        return sum + (transaction.entries?.reduce((entrySum, entry) => 
            entrySum + (entry.credit || 0), 0) || 0);
    }, 0);

    const typeBreakdown = recentTransactions.reduce((acc, transaction) => {
        acc[transaction.type] = (acc[transaction.type] || 0) + 1;
        return acc;
    }, {});

    return {
        totalTransactions: recentTransactions.length,
        totalDebit,
        totalCredit,
        netAmount: totalDebit - totalCredit,
        typeBreakdown,
        averageTransaction: recentTransactions.length > 0 ? 
            (totalDebit + totalCredit) / recentTransactions.length : 0
    };
}; 