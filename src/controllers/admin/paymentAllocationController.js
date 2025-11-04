const { validationResult } = require('express-validator');
const PaymentAllocationService = require('../../services/paymentAllocationService');
const EnhancedPaymentAllocationService = require('../../services/enhancedPaymentAllocationService');
const Payment = require('../../models/Payment');
const Debtor = require('../../models/Debtor');
const TransactionEntry = require('../../models/TransactionEntry');
const User = require('../../models/User');
const { Residence } = require('../../models/Residence');
const Lease = require('../../models/Lease');
const mongoose = require('mongoose');

/**
 * Payment Allocation Controller
 * Handles automatic allocation of payments to oldest outstanding balances first (FIFO)
 */

// Get student's accounts receivable balances for payment allocation
const getStudentARBalances = async (req, res) => {
    try {
        // Set longer timeout for this complex operation
        req.setTimeout(300000); // 5 minutes
        res.setTimeout(300000); // 5 minutes
        
        const { studentId } = req.params;
        
        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        console.log(`🔍 Getting AR balances for user: ${studentId}`);

        // Get user's AR balances using the enhanced service
        // Force fresh data fetch - no caching
        const arBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);
        
        console.log(`📊 AR Balances result:`, {
            found: arBalances ? arBalances.length : 0,
            isEmpty: !arBalances || arBalances.length === 0,
            studentId
        });

        if (!arBalances || arBalances.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No outstanding balances found for this student',
                data: {
                    studentId,
                    totalBalance: 0,
                    monthlyBalances: [],
                    summary: {
                        monthsWithBalance: 0,
                        totalOwing: 0,
                        oldestBalance: null
                    }
                }
            });
        }

        // Calculate total balance from enhanced service format
        const totalBalance = arBalances.reduce((sum, item) => sum + item.totalOutstanding, 0);

        // Convert enhanced service format to API response format
        const monthlyBalances = arBalances.map(item => ({
            monthKey: item.monthKey,
            year: item.year,
            month: item.month,
            monthName: item.monthName,
            balance: item.totalOutstanding,
            originalDebt: item.rent.owed + item.adminFee.owed + item.deposit.owed,
            paidAmount: item.rent.paid + item.adminFee.paid + item.deposit.paid,
            transactionId: item.transactionId,
            date: item.date,
            accountCode: `1100-${studentId}`,
            accountName: `Accounts Receivable - Student`,
            source: item.source,
            metadata: item.metadata
        }));

        res.status(200).json({
            success: true,
            message: 'Student AR balances retrieved successfully',
            data: {
                studentId,
                totalBalance,
                monthlyBalances: monthlyBalances,
                summary: {
                    monthsWithBalance: arBalances.length,
                    totalOwing: totalBalance,
                    oldestBalance: arBalances.length > 0 ? arBalances[0].monthKey : null,
                    newestBalance: arBalances.length > 0 ? arBalances[arBalances.length - 1].monthKey : null
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting student AR balances:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve student AR balances',
            error: error.message
        });
    }
};

// Get payment allocation summary for a student
const getPaymentAllocationSummary = async (req, res) => {
    try {
        const { studentId } = req.params;
        
        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: 'Student ID is required'
            });
        }

        console.log(`📊 Getting payment allocation summary for student: ${studentId}`);

        const summary = await PaymentAllocationService.getAllocationSummary(studentId);

        res.status(200).json({
            success: true,
            message: 'Payment allocation summary retrieved successfully',
            data: summary
        });

    } catch (error) {
        console.error('❌ Error getting payment allocation summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve payment allocation summary',
            error: error.message
        });
    }
};

// Manually allocate a payment to specific months
const manuallyAllocatePayment = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { paymentId, allocations } = req.body;

        if (!paymentId || !allocations || !Array.isArray(allocations)) {
            return res.status(400).json({
                success: false,
                message: 'Payment ID and allocations array are required'
            });
        }

        console.log(`🎯 Manually allocating payment ${paymentId}:`, allocations);

        // Get the payment
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Validate total allocation amount matches payment amount
        const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
        if (Math.abs(totalAllocated - payment.totalAmount) > 0.01) {
            return res.status(400).json({
                success: false,
                message: `Total allocation amount ($${totalAllocated.toFixed(2)}) must match payment amount ($${payment.totalAmount.toFixed(2)})`
            });
        }

        // Process each allocation
        const allocationResults = [];
        for (const allocation of allocations) {
            const { monthKey, amount, transactionId } = allocation;

            if (amount <= 0) continue;

            // Update the AR transaction
            const updated = await PaymentAllocationService.updateARTransaction(
                transactionId,
                amount,
                payment.toObject(),
                0 // We'll calculate the current balance in the service
            );

            allocationResults.push({
                month: monthKey,
                amountAllocated: amount,
                transactionId: transactionId,
                allocationType: 'manual_allocation'
            });
        }

        // Create allocation record
        const allocationRecord = await PaymentAllocationService.createAllocationRecord(
            paymentId,
            payment.student.toString(),
            allocationResults,
            payment.toObject()
        );

        res.status(200).json({
            success: true,
            message: 'Payment manually allocated successfully',
            data: {
                paymentId,
                totalAllocated,
                allocations: allocationResults,
                allocationRecord
            }
        });

    } catch (error) {
        console.error('❌ Error manually allocating payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to manually allocate payment',
            error: error.message
        });
    }
};

// Auto-allocate a payment using FIFO principle
const autoAllocatePayment = async (req, res) => {
    try {
        const { paymentId } = req.params;

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: 'Payment ID is required'
            });
        }

        console.log(`🚀 Auto-allocating payment: ${paymentId}`);

        // Get the payment
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Prepare payment data for ENHANCED allocation (normalize per-item dates)
        const normalizedPayments = Array.isArray(payment.payments)
            ? payment.payments.map(p => ({ ...p.toObject?.() || p, date: p?.date || payment.date }))
            : [];

        const allocationData = {
            paymentId: payment._id.toString(),
            studentId: payment.student.toString(),
            totalAmount: payment.totalAmount,
            payments: normalizedPayments,
            residence: payment.residence?.toString?.() || payment.residence,
            paymentMonth: payment.paymentMonth,
            rentAmount: payment.rentAmount || 0,
            adminFee: payment.adminFee || 0,
            deposit: payment.deposit || 0,
            method: payment.method,
            date: payment.date
        };

        // Use Enhanced allocator so TransactionEntry dates/months come from paid dates
        const EnhancedPaymentAllocationService = require('../../services/enhancedPaymentAllocationService');
        const allocationResult = await EnhancedPaymentAllocationService.smartFIFOAllocation(allocationData);

        if (!allocationResult.success) {
            return res.status(400).json({
                success: false,
                message: allocationResult.message,
                error: allocationResult.error
            });
        }

        res.status(200).json({
            success: true,
            message: 'Payment auto-allocated successfully',
            data: allocationResult
        });

    } catch (error) {
        console.error('❌ Error auto-allocating payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to auto-allocate payment',
            error: error.message
        });
    }
};

// Get payment allocation history for a student
const getPaymentAllocationHistory = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { startDate, endDate, limit = 50 } = req.query;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: 'Student ID is required'
            });
        }

        console.log(`📜 Getting payment allocation history for student: ${studentId}`);

        // Build query for allocation transactions
        const query = {
            'entries.accountCode': { $regex: `^1100-${studentId}` },
            source: { $in: ['payment', 'manual'] }
        };

        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Get allocation transactions
        const allocationTransactions = await TransactionEntry.find(query)
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .populate('sourceId', 'paymentId totalAmount method');

        // Group by payment and format results
        const allocationHistory = [];
        const paymentGroups = {};

        allocationTransactions.forEach(transaction => {
            const paymentId = transaction.metadata?.paymentAllocation?.paymentId || 
                             transaction.reference || 
                             transaction.transactionId;

            if (!paymentGroups[paymentId]) {
                paymentGroups[paymentId] = {
                    paymentId,
                    date: transaction.date,
                    totalAmount: 0,
                    allocations: [],
                    paymentMethod: transaction.entries.find(e => e.accountCode === '1000')?.description || 'Unknown'
                };
            }

            // Find the AR allocation entry
            const arEntry = transaction.entries.find(e => 
                e.accountCode.startsWith('1100-') && e.credit > 0
            );

            if (arEntry) {
                const monthKey = arEntry.accountCode.split('-').slice(1, 3).join('-');
                paymentGroups[paymentId].allocations.push({
                    month: monthKey,
                    amount: arEntry.credit,
                    transactionId: transaction._id,
                    date: transaction.date
                });
                paymentGroups[paymentId].totalAmount += arEntry.credit;
            }
        });

        // Convert to array and sort by date
        const historyArray = Object.values(paymentGroups).sort((a, b) => b.date - a.date);

        res.status(200).json({
            success: true,
            message: 'Payment allocation history retrieved successfully',
            data: {
                studentId,
                totalPayments: historyArray.length,
                totalAllocated: historyArray.reduce((sum, payment) => sum + payment.totalAmount, 0),
                history: historyArray
            }
        });

    } catch (error) {
        console.error('❌ Error getting payment allocation history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve payment allocation history',
            error: error.message
        });
    }
};

// Get payment coverage analysis for a student
const getPaymentCoverageAnalysis = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { asOfDate } = req.query;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: 'Student ID is required'
            });
        }

        console.log(`📊 Getting payment coverage analysis for student: ${studentId}`);

        const coverage = await PaymentAllocationService.getStudentPaymentCoverage(studentId, asOfDate);

        res.status(200).json({
            success: true,
            message: 'Payment coverage analysis retrieved successfully',
            data: coverage
        });

    } catch (error) {
        console.error('❌ Error getting payment coverage analysis:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve payment coverage analysis',
            error: error.message
        });
    }
};

// Get general outstanding balances summary for admin dashboard
const getOutstandingBalancesSummary = async (req, res) => {
    try {
        // Set longer timeout for this complex operation
        req.setTimeout(300000); // 5 minutes
        res.setTimeout(300000); // 5 minutes
        
        const { residence, startDate, endDate } = req.query;

        console.log(`📊 Getting outstanding balances summary`);

        // Build query for AR transactions
        const query = {
            'entries.accountCode': { $regex: '^1100-' },
            'entries.accountType': 'asset',
            'entries.debit': { $gt: 0 }
        };

        if (residence) {
            query.residence = new mongoose.Types.ObjectId(residence);
        }

        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Get all AR transactions
        const arTransactions = await TransactionEntry.find(query)
            .populate('residence', 'name')
            .sort({ date: 1 });

        // Calculate summary statistics
        let totalOutstanding = 0;
        let totalStudents = 0;
        let totalTransactions = 0;
        const studentBalances = {};

        arTransactions.forEach(transaction => {
            const arEntry = transaction.entries.find(e => 
                e.accountCode.startsWith('1100-') && e.debit > 0
            );

            if (arEntry) {
                const studentId = arEntry.accountCode.split('-')[4];
                const remainingBalance = arEntry.debit;

                if (remainingBalance > 0) {
                    if (!studentBalances[studentId]) {
                        studentBalances[studentId] = 0;
                        totalStudents++;
                    }
                    studentBalances[studentId] += remainingBalance;
                    totalOutstanding += remainingBalance;
                    totalTransactions++;
                }
            }
        });

        // Get residence breakdown
        const residenceBreakdown = await TransactionEntry.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'residences',
                    localField: 'residence',
                    foreignField: '_id',
                    as: 'residenceDetails'
                }
            },
            {
                $group: {
                    _id: '$residence',
                    residenceName: { $first: { $arrayElemAt: ['$residenceDetails.name', 0] } },
                    totalOutstanding: { $sum: '$totalDebit' },
                    studentCount: { $addToSet: '$metadata.studentId' }
                }
            },
            {
                $project: {
                    residenceName: 1,
                    totalOutstanding: 1,
                    studentCount: { $size: '$studentCount' }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            message: 'Outstanding balances summary retrieved successfully',
            data: {
                summary: {
                    totalOutstanding,
                    totalStudents,
                    totalTransactions,
                    averagePerStudent: totalStudents > 0 ? totalOutstanding / totalStudents : 0
                },
                residenceBreakdown,
                filters: {
                    residence: residence || 'all',
                    startDate,
                    endDate
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting outstanding balances summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve outstanding balances summary',
            error: error.message
        });
    }
};

// Get AR invoices (accruals) for all students
const getARInvoices = async (req, res) => {
    try {
        const { studentId, residence, startDate, endDate, limit = 100, page = 1 } = req.query;

        console.log(`📄 Getting AR invoices`);

        // Build query for accrual transactions
        const query = {
            source: 'rental_accrual',
            'entries.accountCode': { $regex: '^1100-' }
        };

        if (studentId) {
            query['metadata.studentId'] = studentId;
        }

        if (residence) {
            query.residence = new mongoose.Types.ObjectId(residence);
        }

        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get accrual transactions
        const accrualTransactions = await TransactionEntry.find(query)
            .populate('residence', 'name')
            .populate('sourceId', 'firstName lastName')
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const totalCount = await TransactionEntry.countDocuments(query);

        // Format invoices
        const invoices = accrualTransactions.map(transaction => {
            const arEntry = transaction.entries.find(e => e.accountCode.startsWith('1100-'));
            const incomeEntry = transaction.entries.find(e => e.accountCode.startsWith('400'));
            
            return {
                invoiceId: transaction._id,
                transactionId: transaction.transactionId,
                date: transaction.date,
                studentId: transaction.metadata?.studentId,
                studentName: transaction.metadata?.studentName || 'Unknown',
                residence: transaction.residence?.name || 'Unknown',
                description: transaction.description,
                totalAmount: transaction.totalDebit,
                arAmount: arEntry?.debit || 0,
                incomeAmount: incomeEntry?.credit || 0,
                status: transaction.status,
                monthKey: transaction.metadata?.monthKey,
                paymentStatus: 'pending' // You can enhance this based on payment allocation
            };
        });

        res.status(200).json({
            success: true,
            message: 'AR invoices retrieved successfully',
            data: {
                invoices,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    totalCount,
                    limit: parseInt(limit)
                },
                filters: {
                    studentId: studentId || 'all',
                    residence: residence || 'all',
                    startDate,
                    endDate
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting AR invoices:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve AR invoices',
            error: error.message
        });
    }
};

// Get all students with outstanding balances for admin dashboard (OPTIMIZED VERSION)
const getStudentsWithOutstandingBalances = async (req, res) => {
    try {
        const { residence, limit = 20, sortBy = 'totalBalance', sortOrder = 'desc' } = req.query;

        console.log(`👥 Getting students with outstanding balances (OPTIMIZED method)`);

        // Use aggregation pipeline for much faster processing
        const pipeline = [
            // Match AR transactions (both debits and credits)
            {
                $match: {
                    'entries.accountCode': { $regex: '^1100-' },
                    'entries.accountType': 'Asset',
                    ...(residence && { residence: new mongoose.Types.ObjectId(residence) })
                }
            },
            // Unwind entries to process each AR entry
            { $unwind: '$entries' },
            // Match only AR entries
            {
                $match: {
                    'entries.accountCode': { $regex: '^1100-' },
                    'entries.accountType': 'Asset'
                }
            },
            // Extract student ID from account code
            {
                $addFields: {
                    studentId: { $arrayElemAt: [{ $split: ['$entries.accountCode', '-'] }, 1] }
                }
            },
            // Group by student ID to calculate NET outstanding balance
            {
                $group: {
                    _id: '$studentId',
                    totalDebits: { $sum: { $ifNull: ['$entries.debit', 0] } },      // AR accruals (what's owed)
                    totalCredits: { $sum: { $ifNull: ['$entries.credit', 0] } },   // Payments (what's paid)
                    transactionCount: { $sum: 1 },
                    latestTransaction: { $max: '$date' },
                    residence: { $first: '$residence' }
                }
            },
            // Calculate net outstanding balance
            {
                $addFields: {
                    totalBalance: { $subtract: ['$totalDebits', '$totalCredits'] }
                }
            },
            // Only include students with positive outstanding balances
            {
                $match: {
                    totalBalance: { $gt: 0 }
                }
            },
            // Sort by total balance
            { $sort: { totalBalance: -1 } },
            // Limit results
            { $limit: parseInt(limit) || 20 }
        ];

        console.log(`🔍 Running optimized aggregation pipeline...`);
        const studentBalances = await TransactionEntry.aggregate(pipeline);

        console.log(`🔍 Found ${studentBalances.length} students with outstanding balances`);

        // Get debtor information in batch for better performance
        const studentIds = studentBalances.map(s => s._id);
        const Debtor = require('../../models/Debtor');
        
        const debtors = await Debtor.find({
            $or: [
                { user: { $in: studentIds } },
                { user: { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) } },
                { accountCode: { $in: studentIds.map(id => `1100-${id}`) } }
            ]
        });

        // Create a map for quick lookup
        const debtorMap = new Map();
        debtors.forEach(debtor => {
            const userId = debtor.user?.toString();
            const accountCode = debtor.accountCode;
            if (userId) debtorMap.set(userId, debtor);
            if (accountCode && accountCode.startsWith('1100-')) {
                const studentId = accountCode.split('-')[1];
                debtorMap.set(studentId, debtor);
            }
        });

        // Build response with optimized data
        const studentsWithOutstanding = studentBalances.map(student => {
            const debtor = debtorMap.get(student._id);
            return {
                studentId: student._id,
                residence: student.residence,
                totalBalance: student.totalBalance, // Use calculated net balance from aggregation
                transactionCount: student.transactionCount,
                latestTransaction: student.latestTransaction,
                hasDebtorAccount: !!debtor,
                debtorCode: debtor?.debtorCode || null
            };
        });

        console.log(`📊 Found ${studentsWithOutstanding.length} students with outstanding balances`);

        // Sort by specified criteria
        const sortMultiplier = sortOrder === 'desc' ? -1 : 1;
        studentsWithOutstanding.sort((a, b) => {
            if (sortBy === 'totalBalance') {
                return (a.totalBalance - b.totalBalance) * sortMultiplier;
            } else if (sortBy === 'transactionCount') {
                return (a.transactionCount - b.transactionCount) * sortMultiplier;
            } else if (sortBy === 'latestTransaction') {
                return (new Date(a.latestTransaction) - new Date(b.latestTransaction)) * sortMultiplier;
            }
            return 0;
        });

        // Apply limit
        const limitedStudents = studentsWithOutstanding.slice(0, parseInt(limit));

        // Get student details for the results (including expired students)
        const finalStudentIds = limitedStudents.map(s => s.studentId);
        const { getStudentInfo } = require('../../utils/studentUtils');
        
        // Get student details for all students (active and expired)
        const studentsWithDetails = await Promise.all(
            limitedStudents.map(async (student) => {
                const studentInfo = await getStudentInfo(student.studentId);
                console.log(`🔍 Student ${student.studentId}:`, {
                    found: !!studentInfo,
                    isExpired: studentInfo?.isExpired,
                    name: studentInfo ? `${studentInfo.firstName} ${studentInfo.lastName}` : 'Unknown',
                    email: studentInfo?.email,
                    balance: student.totalBalance
                });
                return {
                    ...student,
                    studentDetails: studentInfo ? {
                        firstName: studentInfo.firstName,
                        lastName: studentInfo.lastName,
                        email: studentInfo.email,
                        phone: studentInfo.phone,
                        isExpired: studentInfo.isExpired,
                        expiredAt: studentInfo.expiredAt,
                        expirationReason: studentInfo.expirationReason
                    } : null
                };
            })
        );

        // Add debug logging to see what we're returning
        const expiredCount = studentsWithDetails.filter(s => s.studentDetails?.isExpired).length;
        const activeCount = studentsWithDetails.filter(s => !s.studentDetails?.isExpired).length;
        
        console.log(`📊 Outstanding balances summary: ${studentsWithDetails.length} total students (${activeCount} active, ${expiredCount} expired)`);
        
        res.status(200).json({
            success: true,
            message: 'Students with outstanding balances retrieved successfully',
            data: {
                totalStudents: studentsWithDetails.length,
                totalOutstanding: studentsWithDetails.reduce((sum, s) => sum + s.totalBalance, 0),
                students: studentsWithDetails,
                // Add summary for debugging
                summary: {
                    activeStudents: activeCount,
                    expiredStudents: expiredCount,
                    totalStudents: studentsWithDetails.length
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting students with outstanding balances:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve students with outstanding balances',
            error: error.message
        });
    }
};

// Get students with outstanding balances organized by month
const getStudentsWithOutstandingBalancesByMonth = async (req, res) => {
    try {
        const { residence, limit = 20, sortBy = 'totalBalance', sortOrder = 'desc' } = req.query;

        console.log(`👥 Getting students with outstanding balances by month (MONTHLY BREAKDOWN)`);

        // Use aggregation pipeline to get monthly breakdown
        const pipeline = [
            // Match AR transactions (both debits and credits)
            {
                $match: {
                    'entries.accountCode': { $regex: '^1100-' },
                    'entries.accountType': 'Asset',
                    ...(residence && { residence: new mongoose.Types.ObjectId(residence) })
                }
            },
            // Unwind entries to process each AR entry
            { $unwind: '$entries' },
            // Match only AR entries
            {
                $match: {
                    'entries.accountCode': { $regex: '^1100-' },
                    'entries.accountType': 'Asset'
                }
            },
            // Extract student ID from account code and create month key
            {
                $addFields: {
                    studentId: { $arrayElemAt: [{ $split: ['$entries.accountCode', '-'] }, 1] },
                    monthKey: {
                        $dateToString: {
                            format: "%Y-%m",
                            date: "$date"
                        }
                    },
                    year: { $year: "$date" },
                    month: { $month: "$date" }
                }
            },
            // Group by student ID and month to get monthly balances
            {
                $group: {
                    _id: {
                        studentId: '$studentId',
                        monthKey: '$monthKey',
                        year: '$year',
                        month: '$month'
                    },
                    monthlyDebits: { $sum: { $ifNull: ['$entries.debit', 0] } },
                    monthlyCredits: { $sum: { $ifNull: ['$entries.credit', 0] } },
                    transactionCount: { $sum: 1 },
                    latestTransaction: { $max: '$date' },
                    residence: { $first: '$residence' }
                }
            },
            // Calculate net monthly balance
            {
                $addFields: {
                    monthlyBalance: { $subtract: ['$monthlyDebits', '$monthlyCredits'] }
                }
            },
            // Only include months with positive balances
            {
                $match: {
                    monthlyBalance: { $gt: 0 }
                }
            },
            // Group by student to get all their monthly balances
            {
                $group: {
                    _id: '$_id.studentId',
                    monthlyBalances: {
                        $push: {
                            monthKey: '$_id.monthKey',
                            year: '$_id.year',
                            month: '$_id.month',
                            balance: '$monthlyBalance',
                            transactionCount: '$transactionCount',
                            latestTransaction: '$latestTransaction'
                        }
                    },
                    totalBalance: { $sum: '$monthlyBalance' },
                    totalTransactions: { $sum: '$transactionCount' },
                    latestTransaction: { $max: '$latestTransaction' },
                    residence: { $first: '$residence' }
                }
            },
            // Sort by total balance
            { $sort: { totalBalance: -1 } }
            // Note: Don't limit here - we need all students to process invoices
            // Limit will be applied later after invoice processing
        ];

        console.log(`🔍 Running monthly breakdown aggregation pipeline...`);
        const studentBalances = await TransactionEntry.aggregate(pipeline);

        console.log(`🔍 Found ${studentBalances.length} students with outstanding balances`);
        
        // Debug: Log November balances specifically
        studentBalances.forEach(student => {
            const novBalances = student.monthlyBalances?.filter(mb => mb.monthKey === '2025-11' || mb.month === 11);
            if (novBalances && novBalances.length > 0) {
                console.log(`📅 November 2025 balances for student ${student._id}:`, novBalances);
            }
        });

        // Get debtor information in batch for better performance
        const studentIds = studentBalances.map(s => s._id);
        const Debtor = require('../../models/Debtor');
        
        const debtors = await Debtor.find({
            $or: [
                { user: { $in: studentIds } },
                { user: { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) } },
                { accountCode: { $in: studentIds.map(id => `1100-${id}`) } }
            ]
        });

        // Create a map for quick lookup
        const debtorMap = new Map();
        debtors.forEach(debtor => {
            const userId = debtor.user?.toString();
            const accountCode = debtor.accountCode;
            if (userId) debtorMap.set(userId, debtor);
            if (accountCode && accountCode.startsWith('1100-')) {
                const studentId = accountCode.split('-')[1];
                debtorMap.set(studentId, debtor);
            }
        });

        // Build response with monthly breakdown data
        const studentsWithMonthlyBalances = studentBalances.map(student => {
            const debtor = debtorMap.get(student._id);
            
            // Sort monthly balances by date (newest first)
            const sortedMonthlyBalances = student.monthlyBalances.sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                return b.month - a.month;
            });

            return {
                studentId: student._id,
                residence: student.residence,
                totalBalance: debtor?.currentBalance || student.totalBalance,
                totalTransactions: student.totalTransactions,
                latestTransaction: student.latestTransaction,
                hasDebtorAccount: !!debtor,
                debtorCode: debtor?.debtorCode || null,
                monthlyBalances: sortedMonthlyBalances
            };
        });

        console.log(`📊 Found ${studentsWithMonthlyBalances.length} students with monthly outstanding balances`);

        // Get invoices for ALL students BEFORE limiting (batch query for performance)
        const Invoice = require('../../models/Invoice');
        const allStudentObjectIds = studentsWithMonthlyBalances.map(s => {
            const id = s.studentId || s._id;
            return new mongoose.Types.ObjectId(id);
        });
        
        // Get invoices for all students (not just limited ones)
        const allInvoices = await Invoice.find({
            student: { $in: allStudentObjectIds },
            status: { $ne: 'cancelled' } // Exclude cancelled invoices
        }).sort({ billingStartDate: 1 }).lean();
        
        // Group invoices by student and month
        const invoicesByStudentAndMonth = new Map();
        allInvoices.forEach(invoice => {
            const studentId = invoice.student.toString();
            
            // Determine month key from various date fields
            let monthKey = null;
            if (invoice.billingPeriod && typeof invoice.billingPeriod === 'string' && invoice.billingPeriod.match(/^\d{4}-\d{2}$/)) {
                // billingPeriod is already in YYYY-MM format
                monthKey = invoice.billingPeriod;
            } else if (invoice.billingStartDate) {
                const billingDate = new Date(invoice.billingStartDate);
                monthKey = `${billingDate.getFullYear()}-${String(billingDate.getMonth() + 1).padStart(2, '0')}`;
            } else if (invoice.issueDate) {
                const issueDate = new Date(invoice.issueDate);
                monthKey = `${issueDate.getFullYear()}-${String(issueDate.getMonth() + 1).padStart(2, '0')}`;
            } else if (invoice.billingPeriod) {
                // Try to parse billingPeriod as a date string
                try {
                    const billingDate = new Date(invoice.billingPeriod);
                    if (!isNaN(billingDate.getTime())) {
                        monthKey = `${billingDate.getFullYear()}-${String(billingDate.getMonth() + 1).padStart(2, '0')}`;
                    }
                } catch (e) {
                    console.warn(`Could not parse billingPeriod for invoice ${invoice.invoiceNumber}:`, invoice.billingPeriod);
                }
            }
            
            // Skip if we couldn't determine month key
            if (!monthKey) {
                console.warn(`Could not determine month key for invoice ${invoice.invoiceNumber}`);
                return;
            }
            
            if (!invoicesByStudentAndMonth.has(studentId)) {
                invoicesByStudentAndMonth.set(studentId, new Map());
            }
            const studentInvoices = invoicesByStudentAndMonth.get(studentId);
            
            if (!studentInvoices.has(monthKey)) {
                studentInvoices.set(monthKey, []);
            }
            studentInvoices.get(monthKey).push({
                invoiceId: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                totalAmount: invoice.totalAmount,
                amountPaid: invoice.amountPaid || 0,
                balanceDue: invoice.balanceDue || invoice.totalAmount - (invoice.amountPaid || 0),
                status: invoice.status,
                paymentStatus: invoice.paymentStatus,
                issueDate: invoice.issueDate,
                dueDate: invoice.dueDate,
                billingPeriod: invoice.billingPeriod,
                billingStartDate: invoice.billingStartDate,
                billingEndDate: invoice.billingEndDate
            });
        });

        // Debug: Log November invoices specifically
        const novInvoices = allInvoices.filter(inv => {
            const monthKey = inv.billingPeriod && typeof inv.billingPeriod === 'string' && inv.billingPeriod.match(/^\d{4}-\d{2}$/) 
                ? inv.billingPeriod 
                : inv.billingStartDate 
                    ? `${new Date(inv.billingStartDate).getFullYear()}-${String(new Date(inv.billingStartDate).getMonth() + 1).padStart(2, '0')}`
                    : inv.issueDate 
                        ? `${new Date(inv.issueDate).getFullYear()}-${String(new Date(inv.issueDate).getMonth() + 1).padStart(2, '0')}`
                        : null;
            return monthKey === '2025-11';
        });
        if (novInvoices.length > 0) {
            console.log(`📅 November 2025 invoices found: ${novInvoices.length}`, novInvoices.map(inv => ({
                invoiceNumber: inv.invoiceNumber,
                student: inv.student,
                totalAmount: inv.totalAmount,
                balanceDue: inv.balanceDue,
                billingPeriod: inv.billingPeriod,
                billingStartDate: inv.billingStartDate
            })));
        }

        // Now enhance ALL students with invoices (not just limited ones)
        const studentsWithInvoices = studentsWithMonthlyBalances.map(student => {
            const studentId = student.studentId || student._id;
            const studentInvoices = invoicesByStudentAndMonth.get(studentId) || new Map();
            
            // Enhance monthly balances with invoices
            const monthlyBalancesWithInvoices = student.monthlyBalances.map(monthBalance => {
                const monthKey = monthBalance.monthKey;
                const invoices = studentInvoices.get(monthKey) || [];
                
                // Calculate totals from invoices
                const invoiceTotal = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
                const invoicePaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
                const invoiceOutstanding = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0);
                
                // Month name for display
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                   'July', 'August', 'September', 'October', 'November', 'December'];
                const monthName = monthNames[monthBalance.month - 1];
                
                // Combined balance: use transaction balance or invoice outstanding, whichever is higher
                // This ensures we capture both transaction-based and invoice-based outstanding
                const combinedBalance = Math.max(monthBalance.balance, invoiceOutstanding);
                
                return {
                    ...monthBalance,
                    monthName: monthName,
                    balance: combinedBalance, // Use combined balance
                    originalBalance: monthBalance.balance, // Keep original transaction balance
                    invoices: invoices,
                    invoiceCount: invoices.length,
                    invoiceTotal: invoiceTotal,
                    invoicePaid: invoicePaid,
                    invoiceOutstanding: invoiceOutstanding,
                    originalDebt: Math.max(invoiceTotal, monthBalance.balance), // Total original amount
                    paidAmount: invoicePaid // Total paid amount
                };
            });
            
            // Also include months that only have invoices (no transactions)
            const invoiceMonthKeys = Array.from(studentInvoices.keys());
            invoiceMonthKeys.forEach(monthKey => {
                // Check if this month already exists in monthlyBalances
                const exists = monthlyBalancesWithInvoices.some(mb => mb.monthKey === monthKey);
                if (!exists) {
                    const invoices = studentInvoices.get(monthKey);
                    const [year, month] = monthKey.split('-').map(Number);
                    
                    // Calculate totals from invoices
                    const invoiceTotal = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
                    const invoicePaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
                    const invoiceOutstanding = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0);
                    
                    // Month name for display
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                       'July', 'August', 'September', 'October', 'November', 'December'];
                    const monthName = monthNames[month - 1];
                    
                    monthlyBalancesWithInvoices.push({
                        monthKey: monthKey,
                        year: year,
                        month: month,
                        monthName: monthName,
                        balance: invoiceOutstanding, // Use invoice outstanding as balance
                        originalBalance: 0, // No transaction balance
                        transactionCount: 0,
                        latestTransaction: invoices[invoices.length - 1]?.issueDate || null,
                        invoices: invoices,
                        invoiceCount: invoices.length,
                        invoiceTotal: invoiceTotal,
                        invoicePaid: invoicePaid,
                        invoiceOutstanding: invoiceOutstanding,
                        originalDebt: invoiceTotal,
                        paidAmount: invoicePaid,
                        hasTransactions: false
                    });
                }
            });
            
            // Sort by date (newest first)
            monthlyBalancesWithInvoices.sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                return b.month - a.month;
            });
            
            // Recalculate total balance from enhanced monthly balances
            const recalculatedTotalBalance = monthlyBalancesWithInvoices.reduce((sum, mb) => sum + mb.balance, 0);
            
            return {
                ...student,
                studentId: studentId,
                monthlyBalances: monthlyBalancesWithInvoices,
                totalBalance: recalculatedTotalBalance, // Use recalculated balance
                totalInvoices: allInvoices.filter(inv => inv.student && inv.student.toString() === studentId).length,
                totalInvoiceAmount: allInvoices
                    .filter(inv => inv.student && inv.student.toString() === studentId)
                    .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0),
                totalInvoiceOutstanding: allInvoices
                    .filter(inv => inv.student && inv.student.toString() === studentId)
                    .reduce((sum, inv) => sum + (inv.balanceDue || inv.totalAmount - (inv.amountPaid || 0)), 0)
            };
        });

        // Sort by specified criteria
        const sortMultiplier = sortOrder === 'desc' ? -1 : 1;
        studentsWithInvoices.sort((a, b) => {
            if (sortBy === 'totalBalance') {
                return (a.totalBalance - b.totalBalance) * sortMultiplier;
            } else if (sortBy === 'totalTransactions') {
                return (a.totalTransactions - b.totalTransactions) * sortMultiplier;
            } else if (sortBy === 'latestTransaction') {
                return (new Date(a.latestTransaction) - new Date(b.latestTransaction)) * sortMultiplier;
            }
            return 0;
        });

        // Apply limit AFTER processing all students with invoices
        const limitedStudents = studentsWithInvoices.slice(0, parseInt(limit));

        // Get student details for the limited results (including expired students)
        const { getStudentInfo } = require('../../utils/studentUtils');
        
        // Get student details for all limited students (active and expired)
        const studentsWithDetails = await Promise.all(
            limitedStudents.map(async (student) => {
                const studentId = student.studentId || student._id;
                const studentInfo = await getStudentInfo(studentId);
                
                // Debug: Check November specifically
                const novBalance = student.monthlyBalances?.find(mb => mb.monthKey === '2025-11' || mb.month === 11);
                if (novBalance) {
                    console.log(`📅 Student ${studentId} - November 2025:`, {
                        monthKey: novBalance.monthKey,
                        balance: novBalance.balance,
                        invoiceCount: novBalance.invoiceCount,
                        invoiceOutstanding: novBalance.invoiceOutstanding,
                        originalBalance: novBalance.originalBalance,
                        invoices: novBalance.invoices?.map(inv => ({
                            invoiceNumber: inv.invoiceNumber,
                            totalAmount: inv.totalAmount,
                            balanceDue: inv.balanceDue
                        }))
                    });
                }
                
                console.log(`🔍 Student ${studentId}:`, {
                    found: !!studentInfo,
                    isExpired: studentInfo?.isExpired,
                    name: studentInfo ? `${studentInfo.firstName} ${studentInfo.lastName}` : 'Unknown',
                    email: studentInfo?.email,
                    balance: student.totalBalance,
                    monthlyCount: student.monthlyBalances?.length || 0,
                    invoiceCount: student.totalInvoices || 0
                });
                
                return {
                    ...student,
                    studentDetails: studentInfo ? {
                        firstName: studentInfo.firstName,
                        lastName: studentInfo.lastName,
                        email: studentInfo.email,
                        phone: studentInfo.phone,
                        isExpired: studentInfo.isExpired,
                        expiredAt: studentInfo.expiredAt,
                        expirationReason: studentInfo.expirationReason
                    } : null
                };
            })
        );

        // Add debug logging to see what we're returning
        const expiredCount = studentsWithDetails.filter(s => s.studentDetails?.isExpired).length;
        const activeCount = studentsWithDetails.filter(s => !s.studentDetails?.isExpired).length;
        
        // Calculate monthly summary totals
        const monthlySummary = {};
        studentsWithDetails.forEach(student => {
            if (student.monthlyBalances) {
                student.monthlyBalances.forEach(monthBalance => {
                    const monthKey = monthBalance.monthKey;
                    if (!monthlySummary[monthKey]) {
                        monthlySummary[monthKey] = {
                            monthKey: monthKey,
                            year: monthBalance.year,
                            month: monthBalance.month,
                            monthName: monthBalance.monthName,
                            totalOutstanding: 0,
                            totalOriginalDebt: 0,
                            totalPaid: 0,
                            studentCount: 0,
                            invoiceCount: 0
                        };
                    }
                    monthlySummary[monthKey].totalOutstanding += monthBalance.balance || 0;
                    monthlySummary[monthKey].totalOriginalDebt += monthBalance.originalDebt || 0;
                    monthlySummary[monthKey].totalPaid += monthBalance.paidAmount || 0;
                    monthlySummary[monthKey].studentCount += 1;
                    monthlySummary[monthKey].invoiceCount += monthBalance.invoiceCount || 0;
                });
            }
        });
        
        // Convert to array and sort by month
        const monthlySummaryArray = Object.values(monthlySummary).sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });
        
        // Log November specifically
        const novSummary = monthlySummaryArray.find(m => m.monthKey === '2025-11' || m.month === 11);
        if (novSummary) {
            console.log(`📅 November 2025 Summary:`, {
                monthKey: novSummary.monthKey,
                monthName: novSummary.monthName,
                totalOutstanding: novSummary.totalOutstanding,
                totalOriginalDebt: novSummary.totalOriginalDebt,
                totalPaid: novSummary.totalPaid,
                studentCount: novSummary.studentCount,
                invoiceCount: novSummary.invoiceCount
            });
        }
        
        console.log(`📊 Monthly outstanding balances summary: ${studentsWithDetails.length} total students (${activeCount} active, ${expiredCount} expired)`);
        
        res.status(200).json({
            success: true,
            message: 'Students with monthly outstanding balances retrieved successfully',
            data: {
                totalStudents: studentsWithDetails.length,
                totalOutstanding: studentsWithDetails.reduce((sum, s) => sum + s.totalBalance, 0),
                students: studentsWithDetails,
                monthlySummary: monthlySummaryArray, // Add monthly breakdown summary
                // Add summary for debugging
                summary: {
                    activeStudents: activeCount,
                    expiredStudents: expiredCount,
                    totalStudents: studentsWithDetails.length
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting students with monthly outstanding balances:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve students with monthly outstanding balances',
            error: error.message
        });
    }
};

module.exports = {
    getStudentARBalances,
    getPaymentAllocationSummary,
    manuallyAllocatePayment,
    autoAllocatePayment,
    getPaymentAllocationHistory,
    getPaymentCoverageAnalysis,
    getStudentsWithOutstandingBalances,
    getStudentsWithOutstandingBalancesByMonth,
    getOutstandingBalancesSummary,
    getARInvoices
};

