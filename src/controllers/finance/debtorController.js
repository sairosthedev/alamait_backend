const Debtor = require('../../models/Debtor');
const User = require('../../models/User');
const Account = require('../../models/Account');
const Transaction = require('../../models/Transaction');
const TransactionEntry = require('../../models/TransactionEntry');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');
const { Residence } = require('../../models/Residence');
const Application = require('../../models/Application');
const Booking = require('../../models/Booking');
const { createDebtorForStudent } = require('../../services/debtorService');
const DebtorTransactionSyncService = require('../../services/debtorTransactionSyncService');

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

        // Enhance debtor data with student information (including expired students)
        const { getStudentInfo } = require('../../utils/studentUtils');
        const enhancedDebtors = await Promise.all(debtors.map(async (debtor) => {
            const debtorObj = debtor.toObject();
            
            // Get student info (including expired students)
            if (debtor.user) {
                const studentInfo = await getStudentInfo(debtor.user._id);
                if (studentInfo) {
                    debtorObj.studentInfo = studentInfo;
                    // If student is expired, add expiration info
                    if (studentInfo.isExpired) {
                        debtorObj.isExpired = true;
                        debtorObj.expiredAt = studentInfo.expiredAt;
                        debtorObj.expirationReason = studentInfo.expirationReason;
                    } else {
                        debtorObj.isExpired = false;
                    }
                }
            }
            
            return debtorObj;
        }));

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
            debtors: enhancedDebtors,
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

        // First get the debtor without population to preserve the original user ObjectId
        const debtorRaw = await Debtor.findById(id);
        
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
        const transactionQuery = {
            $or: [
                { 'entries.accountCode': debtor.accountCode },
                { sourceId: debtor._id },
                { 'metadata.debtorId': debtor._id }
            ]
        };

        // Only add studentId query if user exists and is populated
        if (debtor.user && debtor.user._id) {
            transactionQuery.$or.push({ 'metadata.studentId': debtor.user._id.toString() });
        } else if (debtorRaw.user && typeof debtorRaw.user === 'object' && debtorRaw.user.toString) {
            // If user is an ObjectId but not populated (expired student), use the ObjectId directly
            transactionQuery.$or.push({ 'metadata.studentId': debtorRaw.user.toString() });
        }

        const transactions = await TransactionEntry.find(transactionQuery)
        .sort({ date: -1 });

        // Get recent invoices (only if user exists)
        let invoices = [];
        if (debtor.user && debtor.user._id) {
            invoices = await Invoice.find({
                student: debtor.user._id
            })
            .sort({ createdAt: -1 })
            .limit(10);
        } else if (debtorRaw.user && typeof debtorRaw.user === 'object' && debtorRaw.user.toString) {
            // If user is an ObjectId but not populated (expired student), use the ObjectId directly
            invoices = await Invoice.find({
                student: debtorRaw.user.toString()
            })
            .sort({ createdAt: -1 })
            .limit(10);
        }

        // Get recent payments (only if user exists)
        let payments = [];
        if (debtor.user && debtor.user._id) {
            payments = await Payment.find({
                student: debtor.user._id
            })
            .sort({ paymentDate: -1 })
            .limit(10);
        } else if (debtorRaw.user && typeof debtorRaw.user === 'object' && debtorRaw.user.toString) {
            // If user is an ObjectId but not populated (expired student), use the ObjectId directly
            payments = await Payment.find({
                student: debtorRaw.user.toString()
            })
            .sort({ paymentDate: -1 })
            .limit(10);
        }

        // Enhance debtor with student information (including expired students)
        const { getStudentInfo } = require('../../utils/studentUtils');
        let enhancedDebtor = debtor.toObject();
        
        // Get student info (including expired students) if user exists
        let studentId = null;
        if (debtor.user && debtor.user._id) {
            studentId = debtor.user._id;
        } else if (debtorRaw.user && typeof debtorRaw.user === 'object' && debtorRaw.user.toString) {
            // If user is an ObjectId but not populated (expired student), use the ObjectId directly
            studentId = debtorRaw.user.toString();
        }

        if (studentId) {
            const studentInfo = await getStudentInfo(studentId);
            if (studentInfo) {
                enhancedDebtor.studentInfo = studentInfo;
                // If student is expired, add expiration info
                if (studentInfo.isExpired) {
                    enhancedDebtor.isExpired = true;
                    enhancedDebtor.expiredAt = studentInfo.expiredAt;
                    enhancedDebtor.expirationReason = studentInfo.expirationReason;
                } else {
                    enhancedDebtor.isExpired = false;
                }
            }
        } else {
            // If no user, try to get student info from debtor's accountCode or other identifiers
            enhancedDebtor.isExpired = true;
            enhancedDebtor.studentInfo = null;
        }

        res.status(200).json({
            success: true,
            debtor: enhancedDebtor,
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

		await DoubleEntryAccountingService.recordStudentRentPayment(pseudoPayment, req.user);

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

        // Get all payments for this debtor (student) - only if user exists
        let payments = [];
        if (debtor.user && debtor.user._id) {
            payments = await Payment.find({
                student: debtor.user._id
            })
            .populate('residence', 'name address')
            .populate('student', 'firstName lastName email')
            .sort({ date: -1 });
        }

        // Get all transactions related to this debtor
        const transactionQuery = {
            $or: [
                { 'entries.accountCode': debtor.accountCode },
                { sourceId: debtor._id },
                { 'metadata.debtorId': debtor._id }
            ]
        };

        // Only add studentId query if user exists
        if (debtor.user && debtor.user._id) {
            transactionQuery.$or.push({ 'metadata.studentId': debtor.user._id.toString() });
        }

        const transactions = await TransactionEntry.find(transactionQuery)
        .sort({ date: -1 });

        // Get residence details
        const residence = await Residence.findById(debtor.residence)
            .populate('rooms');

        // Get application data for this student - only if user exists
        let applications = [];
        if (debtor.user && debtor.user._id) {
            applications = await Application.find({
                student: debtor.user._id
            })
            .populate('residence', 'name address')
            .sort({ createdAt: -1 });
        }

        // Get booking data for this student - only if user exists
        let bookings = [];
        if (debtor.user && debtor.user._id) {
            bookings = await Booking.find({
                student: debtor.user._id
            })
            .populate('residence', 'name address')
            .populate('room')
            .sort({ startDate: -1 });
        }

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

        // Enhance debtor data with student information (including expired students)
        const { getStudentInfo } = require('../../utils/studentUtils');
        const enhancedDebtors = await Promise.all(debtors.map(async (debtor) => {
            const debtorObj = debtor.toObject();
            
            // Get student info (including expired students)
            if (debtor.user) {
                const studentInfo = await getStudentInfo(debtor.user._id);
                if (studentInfo) {
                    debtorObj.studentInfo = studentInfo;
                    // If student is expired, add expiration info
                    if (studentInfo.isExpired) {
                        debtorObj.isExpired = true;
                        debtorObj.expiredAt = studentInfo.expiredAt;
                        debtorObj.expirationReason = studentInfo.expirationReason;
                    } else {
                        debtorObj.isExpired = false;
                    }
                }
            }
            
            return debtorObj;
        }));

        // If includeDetails is true, fetch additional data for each debtor
        let debtorsWithDetails = enhancedDebtors;
        if (includeDetails === 'true') {
            debtorsWithDetails = await Promise.all(
                enhancedDebtors.map(async (debtor) => {
                    // Get recent payments (last 5) - only if user exists
                    let recentPayments = [];
                    if (debtor.user && debtor.user._id) {
                        recentPayments = await Payment.find({
                            student: debtor.user._id
                        })
                        .sort({ date: -1 })
                        .limit(5);
                    }

                    // Get recent transactions (last 5)
                    const transactionQuery = {
                        $or: [
                            { 'entries.accountCode': debtor.accountCode },
                            { sourceId: debtor._id },
                            { 'metadata.debtorId': debtor._id }
                        ]
                    };

                    // Only add studentId query if user exists
                    if (debtor.user && debtor.user._id) {
                        transactionQuery.$or.push({ 'metadata.studentId': debtor.user._id.toString() });
                    }

                    const recentTransactions = await TransactionEntry.find(transactionQuery)
                    .sort({ date: -1 })
                    .limit(5);

                    // Get current application - only if user exists
                    let currentApplication = null;
                    if (debtor.user && debtor.user._id) {
                        currentApplication = await Application.findOne({
                            student: debtor.user._id,
                            status: 'approved'
                        })
                        .populate('residence', 'name address');
                    }

                    // Get current booking - only if user exists
                    let currentBooking = null;
                    if (debtor.user && debtor.user._id) {
                        currentBooking = await Booking.findOne({
                            student: debtor.user._id,
                            status: 'active'
                        })
                        .populate('residence', 'name address')
                        .populate('room');
                    }

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

// Get debtor transactions
exports.getDebtorTransactions = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate, type, limit = 50 } = req.query;

        const debtor = await Debtor.findById(id)
            .populate('user', 'firstName lastName email phone');

        if (!debtor) {
            return res.status(404).json({
                success: false,
                message: 'Debtor not found'
            });
        }

        // Build transaction query
        const transactionQuery = {
            $or: [
                { 'entries.accountCode': debtor.accountCode },
                { sourceId: debtor._id },
                { 'metadata.debtorId': debtor._id }
            ]
        };

        // Only add studentId query if user exists
        if (debtor.user && debtor.user._id) {
            transactionQuery.$or.push({ 'metadata.studentId': debtor.user._id.toString() });
        }

        // Add date filters if provided
        if (startDate || endDate) {
            transactionQuery.date = {};
            if (startDate) transactionQuery.date.$gte = new Date(startDate);
            if (endDate) transactionQuery.date.$lte = new Date(endDate);
        }

        // Add type filter if provided
        if (type && type !== 'all') {
            if (type === 'accrual') {
                transactionQuery.source = 'rental_accrual';
            } else if (type === 'payment') {
                transactionQuery.source = 'payment';
            } else {
                transactionQuery.source = type;
            }
        }

        // Get transactions
        const transactions = await TransactionEntry.find(transactionQuery)
            .sort({ date: -1 })
            .limit(parseInt(limit));

        // Calculate transaction statistics
        let totalAccruals = 0;
        let totalPayments = 0;
        let totalDebit = 0;
        let totalCredit = 0;

        transactions.forEach(transaction => {
            const debitEntry = transaction.entries.find(e => e.accountCode === debtor.accountCode);
            const amount = debitEntry ? debitEntry.debit : 0;
            const creditAmount = debitEntry ? debitEntry.credit : 0;

            totalDebit += amount;
            totalCredit += creditAmount;

            if (transaction.source === 'rental_accrual') {
                totalAccruals += amount;
            } else if (transaction.source === 'payment') {
                totalPayments += creditAmount;
            }
        });

        // Group transactions by month
        const monthlyBreakdown = transactions.reduce((acc, transaction) => {
            const month = new Date(transaction.date).toISOString().slice(0, 7); // YYYY-MM
            if (!acc[month]) {
                acc[month] = {
                    accruals: 0,
                    payments: 0,
                    net: 0,
                    transactions: []
                };
            }

            const debitEntry = transaction.entries.find(e => e.accountCode === debtor.accountCode);
            const amount = debitEntry ? debitEntry.debit : 0;
            const creditAmount = debitEntry ? debitEntry.credit : 0;

            if (transaction.source === 'rental_accrual') {
                acc[month].accruals += amount;
            } else if (transaction.source === 'payment') {
                acc[month].payments += creditAmount;
            }

            acc[month].net = acc[month].accruals - acc[month].payments;
            acc[month].transactions.push({
                id: transaction._id,
                date: transaction.date,
                description: transaction.description,
                source: transaction.source,
                amount: amount || creditAmount,
                type: amount > 0 ? 'debit' : 'credit'
            });

            return acc;
        }, {});

        res.status(200).json({
            success: true,
            debtor: {
                _id: debtor._id,
                debtorCode: debtor.debtorCode,
                name: debtor.contactInfo.name,
                email: debtor.contactInfo.email,
                accountCode: debtor.accountCode
            },
            transactions: transactions.map(tx => {
                const debitEntry = tx.entries.find(e => e.accountCode === debtor.accountCode);
                const amount = debitEntry ? debitEntry.debit : 0;
                const creditAmount = debitEntry ? debitEntry.credit : 0;
                
                return {
                    _id: tx._id,
                    transactionId: tx.transactionId,
                    date: tx.date,
                    description: tx.description,
                    source: tx.source,
                    sourceId: tx.sourceId,
                    sourceModel: tx.sourceModel,
                    amount: amount || creditAmount,
                    type: amount > 0 ? 'debit' : 'credit',
                    metadata: tx.metadata
                };
            }),
            statistics: {
                totalTransactions: transactions.length,
                totalAccruals,
                totalPayments,
                totalDebit,
                totalCredit,
                netAmount: totalDebit - totalCredit,
                monthlyBreakdown
            }
        });

    } catch (error) {
        console.error('Error fetching debtor transactions:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching debtor transactions',
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

// Sync debtor totals with AR data
exports.syncDebtorWithAR = async (req, res) => {
    try {
        const { id } = req.params;
        const { syncAll = false } = req.query;

        const { syncDebtorTotalsWithAR } = require('../../services/debtorService');

        let result;
        if (syncAll === 'true') {
            console.log('🔄 Syncing all debtors with AR data...');
            result = await syncDebtorTotalsWithAR();
        } else if (id) {
            console.log(`🔄 Syncing debtor ${id} with AR data...`);
            result = await syncDebtorTotalsWithAR(id);
        } else {
            return res.status(400).json({
                success: false,
                message: 'Either debtor ID or syncAll=true is required'
            });
        }

        res.status(200).json({
            success: true,
            message: syncAll === 'true' ? 'All debtors synced with AR data' : 'Debtor synced with AR data',
            data: result
        });

    } catch (error) {
        console.error('Error syncing debtor with AR:', error);
        res.status(500).json({
            success: false,
            message: 'Error syncing debtor with AR data',
            error: error.message
        });
    }
};

/**
 * 🆕 NEW: Get debtors collection report with AR data linkage
 * Provides paginated debtor reports with AR transaction data
 */
exports.getDebtorsCollectionReport = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { debtorCode: { $regex: search, $options: 'i' } },
                { 'contactInfo.name': { $regex: search, $options: 'i' } },
                { 'contactInfo.email': { $regex: search, $options: 'i' } }
            ];
        }

        // Get debtors with pagination
        const debtors = await Debtor.find(query)
            .populate('user', 'firstName lastName email phone')
            .populate('residence', 'name address')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Get total count
        const totalDebtors = await Debtor.countDocuments(query);

        // Get AR data for each debtor
        const debtorsWithARData = [];

        for (const debtor of debtors) {
            if (debtor.accountCode) {
                // Get AR transactions for this debtor
                const arTransactions = await TransactionEntry.find({
                    'entries.accountCode': debtor.accountCode
                }).sort({ date: 1 }).lean();

                let totalExpected = 0;
                let totalPaid = 0;

                arTransactions.forEach(transaction => {
                    transaction.entries.forEach(entry => {
                        if (entry.accountCode === debtor.accountCode) {
                            if (transaction.source === 'rental_accrual') {
                                totalExpected += entry.debit || 0;
                            } else if (transaction.source === 'payment') {
                                totalPaid += entry.credit || 0;
                            }
                        }
                    });
                });

                const currentBalance = totalExpected - totalPaid;

                debtorsWithARData.push({
                    ...debtor,
                    totalExpected,
                    totalPaid,
                    currentBalance,
                    paymentRate: totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0,
                    arTransactionCount: arTransactions.length
                });
            } else {
                debtorsWithARData.push({
                    ...debtor,
                    totalExpected: 0,
                    totalPaid: 0,
                    currentBalance: 0,
                    paymentRate: 0,
                    arTransactionCount: 0
                });
            }
        }

        res.status(200).json({
            success: true,
            data: {
                debtors: debtorsWithARData,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalDebtors / limit),
                    totalDebtors,
                    hasNextPage: page * limit < totalDebtors,
                    hasPrevPage: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Error getting debtors collection report:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving debtors collection report',
            error: error.message
        });
    }
};

/**
 * 🆕 NEW: Get debtor collection summary
 * Provides overall debtor collection statistics
 */
exports.getDebtorCollectionSummary = async (req, res) => {
    try {
        const { getDebtorCollectionSummary } = require('../../services/debtorService');
        const summary = await getDebtorCollectionSummary();

        res.status(200).json({
            success: true,
            data: summary
        });

    } catch (error) {
        console.error('Error getting debtor collection summary:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving debtor collection summary',
            error: error.message
        });
    }
}; 

// Get detailed debtor information including enhanced months tracking
exports.getDebtorDetails = async (req, res) => {
  try {
    const { debtorId } = req.params;
    
    // Find the debtor
    const debtor = await Debtor.findById(debtorId);
    if (!debtor) {
      return res.status(404).json({ success: false, error: 'Debtor not found' });
    }
    
    // Get enhanced months tracking breakdown
    const studentId = debtor.user.toString();
    const monthsBreakdown = await DebtorTransactionSyncService.getDetailedMonthsBreakdown(studentId);
    
    // Get payments and transactions
    const payments = await Payment.find({ student: studentId }).sort({ date: -1 });
    
    // Get all transactions for this debtor using multiple criteria
    const transactions = await TransactionEntry.find({
      $or: [
        { 'entries.accountCode': debtor.accountCode },
        { sourceId: debtor._id },
        { 'metadata.studentId': studentId },
        { 'metadata.debtorId': debtor._id }
      ]
    }).sort({ date: -1 });
    
    // Get allocation data for transaction history
    const allocationData = debtor.allocation || {};
    
    // Prepare response with enhanced months tracking
    const response = {
      success: true,
      debtor: {
        ...debtor.toObject(),
        // Include enhanced months tracking data
        monthsAccrued: debtor.monthsAccrued || [],
        monthsPaid: debtor.monthsPaid || [],
        monthsAccruedSummary: debtor.monthsAccruedSummary || {},
        monthsPaidSummary: debtor.monthsPaidSummary || {},
        monthlyPayments: debtor.monthlyPayments || [],
        // Include allocation data for transaction history
        allocation: allocationData
      },
      payments: payments,
      transactions: transactions,
      monthsBreakdown: monthsBreakdown.success ? monthsBreakdown.breakdown : null,
      // Enhanced data for ledger display
      ledgerData: {
        monthsAccrued: debtor.monthsAccrued || [],
        monthsPaid: debtor.monthsPaid || [],
        monthlyPayments: debtor.monthlyPayments || [],
        allocation: allocationData
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error fetching debtor details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch debtor details' });
  }
}; 