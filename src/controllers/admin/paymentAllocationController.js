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

        // 🆕 CRITICAL FIX: Find debtor first - handle user ID, application ID, or debtor ID
        const Debtor = require('../../models/Debtor');
        const Application = require('../../models/Application');
        const mongoose = require('mongoose');
        let actualUserId = studentId;
        let debtor = null;
        
        // 🆕 CRITICAL: First check if the provided ID is a debtor ID (from account code)
        // Account codes are in format 1100-{debtorId}, so if someone provides the debtor ID directly, use it
        if (mongoose.Types.ObjectId.isValid(studentId)) {
            debtor = await Debtor.findById(studentId).select('accountCode _id user debtorCode application').lean();
            if (debtor) {
                console.log(`✅ Found debtor by debtor ID: ${debtor.debtorCode}`);
                console.log(`   Account Code: ${debtor.accountCode} (format: 1100-{debtorId})`);
                actualUserId = debtor.user?.toString() || studentId;
            }
        }
        
        // If not found by debtor ID, check if it's an application ID
        if (!debtor) {
            const application = await Application.findById(studentId).select('student').lean();
            if (application && application.student) {
                actualUserId = application.student.toString();
                console.log(`📋 Provided ID is an Application ID, using student ID: ${actualUserId}`);
                
                // Find debtor by user ID
                debtor = await Debtor.findOne({ user: actualUserId }).select('accountCode _id user debtorCode application').lean();
                
                // Also try finding by application ID
                if (!debtor) {
                    debtor = await Debtor.findOne({ application: studentId }).select('accountCode _id user debtorCode application').lean();
                }
            } else {
                // Try finding by user ID directly
                debtor = await Debtor.findOne({ user: studentId }).select('accountCode _id user debtorCode application').lean();
            }
        }
        
        // Try fuzzy matching as last resort
        if (!debtor) {
            const allDebtors = await Debtor.find({}).select('accountCode _id user debtorCode application').lean();
            for (const d of allDebtors) {
                if (d.user && d.user.toString() === actualUserId) {
                    debtor = d;
                    break;
                }
                if (d.application && d.application.toString() === studentId) {
                    debtor = d;
                    break;
                }
            }
        }
        
        if (debtor) {
            console.log(`✅ Found debtor: ${debtor.debtorCode}`);
            console.log(`   Account Code: ${debtor.accountCode} (format: 1100-{debtorId})`);
            console.log(`   Debtor ID: ${debtor._id}`);
            console.log(`   User ID: ${debtor.user}`);
            console.log(`   Using debtor account code for AR balance queries`);
            
            // 🆕 CRITICAL: Use the actual user ID from debtor for queries
            actualUserId = debtor.user.toString();
        } else {
            console.warn(`⚠️ No debtor found for student ${studentId} (actualUserId: ${actualUserId})`);
            console.warn(`   Will attempt to find via transactions or create debtor`);
        }

        // Get user's AR balances using the enhanced service
        // Force fresh data fetch - no caching
        // The service will use debtor.accountCode (1100-{debtorId}) to find accruals
        // Use actualUserId (from debtor if found, otherwise original studentId)
        const arBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(actualUserId);
        
        console.log(`📊 AR Balances result:`, {
            found: arBalances ? arBalances.length : 0,
            isEmpty: !arBalances || arBalances.length === 0,
            studentId
        });

        if (!arBalances || arBalances.length === 0) {
            // 🆕 Include debtor info in response even if no balances found
            const debtorInfo = debtor ? {
                debtorId: debtor._id.toString(),
                debtorCode: debtor.debtorCode,
                accountCode: debtor.accountCode,
                userId: debtor.user?.toString()
            } : null;
            
            return res.status(200).json({
                success: true,
                message: 'No outstanding balances found for this student',
                data: {
                    studentId,
                    actualUserId: actualUserId !== studentId ? actualUserId : undefined,
                    debtor: debtorInfo,
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

        // 🆕 CRITICAL FIX: Get debtor account code (use debtor ID format, not student ID)
        // Use the debtor we already found, or try to find it again
        const finalDebtor = debtor || await Debtor.findOne({ user: actualUserId }).select('accountCode _id debtorCode').lean();
        const debtorAccountCode = finalDebtor?.accountCode || `1100-${actualUserId}`;
        const debtorId = finalDebtor?._id?.toString() || null;
        
        console.log(`📊 Using debtor account code in response: ${debtorAccountCode}`);
        if (debtorId) {
            console.log(`   Debtor ID: ${debtorId}`);
            console.log(`   Account Code Format: 1100-{debtorId} (correct)`);
            console.log(`   This matches accrual account codes`);
        } else {
            console.warn(`⚠️ No debtor found - using fallback account code format`);
        }

        // Convert enhanced service format to API response format
        const monthlyBalances = arBalances.map(item => {
            // 🆕 Calculate original debt (before negotiated discounts) and negotiated discount
            const originalRentOwed = item.rent.originalOwed || item.rent.owed; // Use originalOwed if available, fallback to owed
            const negotiatedDiscount = item.rent.negotiatedDiscount || 0; // Get negotiated discount amount
            const originalDebt = originalRentOwed + item.adminFee.owed + item.deposit.owed; // Original debt before discounts
            
            return {
                monthKey: item.monthKey,
                year: item.year,
                month: item.month,
                monthName: item.monthName,
                balance: item.totalOutstanding, // Net balance after discounts and payments
                originalDebt: originalDebt, // Original accrual amount (before negotiated discounts)
                negotiatedDiscount: negotiatedDiscount, // 🆕 Negotiated discount amount
                paidAmount: item.rent.paid + item.adminFee.paid + item.deposit.paid,
                transactionId: item.transactionId,
                date: item.date,
                accountCode: debtorAccountCode, // 🆕 CRITICAL: Use debtor account code (1100-{debtorId})
                accountName: `Accounts Receivable - ${finalDebtor?.debtorCode || 'Student'}`,
                debtorId: debtorId, // Include debtor ID in response
                source: item.source,
                metadata: item.metadata
            };
        });

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

        // Validate residence ID if provided
        let residenceFilter = {};
        if (residence) {
            if (!mongoose.Types.ObjectId.isValid(residence)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid residence ID format',
                    error: 'Residence ID must be a valid MongoDB ObjectId'
                });
            }
            residenceFilter = { residence: new mongoose.Types.ObjectId(residence) };
        }

        // Use aggregation pipeline for much faster processing
        const pipeline = [
            // Match AR transactions (both debits and credits)
            {
                $match: {
                    'entries.accountCode': { $regex: '^1100-' },
                    'entries.accountType': 'Asset',
                    ...residenceFilter
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
        const studentIds = studentBalances.map(s => s._id).filter(id => id); // Filter out null/undefined
        const Debtor = require('../../models/Debtor');
        
        // Validate and convert student IDs to ObjectIds, filtering out invalid ones
        const validStudentObjectIds = studentIds
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));
        
        const debtors = await Debtor.find({
            $or: [
                { user: { $in: validStudentObjectIds } },
                { accountCode: { $in: studentIds.filter(id => id).map(id => `1100-${id}`) } }
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
                // Validate studentId before calling getStudentInfo
                if (!student.studentId || !mongoose.Types.ObjectId.isValid(student.studentId)) {
                    console.warn(`⚠️ Invalid studentId: ${student.studentId}`);
                    return {
                        ...student,
                        studentDetails: null
                    };
                }
                
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

        console.log(`👥 Getting students with outstanding balances by month (using debtor logic)`);

        // Get all AR transactions for all students
        // Use same calculation logic as balance sheet: cumulative balances by transaction date up to month end
        const transactionQuery = {
            'entries.accountCode': { $regex: '^1100-' },
            'entries.accountType': 'Asset',
            status: 'posted'
        };
        
        // Apply residence filter if provided (check both top-level residence and metadata)
        if (residence) {
            // Validate residence ID before using it
            if (!mongoose.Types.ObjectId.isValid(residence)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid residence ID format',
                    error: 'Residence ID must be a valid MongoDB ObjectId'
                });
            }
            
            const residenceId = new mongoose.Types.ObjectId(residence);
            // Use $and to combine residence filter with other conditions
            transactionQuery.$and = [
                { 'entries.accountCode': { $regex: '^1100-' } },
                { 'entries.accountType': 'Asset' },
                { status: 'posted' },
                {
                    $or: [
                        { residence: residenceId },
                        { residence: residence }, // Also try as string
                        { 'metadata.residenceId': residence },
                        { 'metadata.residence': residenceId },
                        { 'metadata.residence': residence } // Also try as string
                    ]
                }
            ];
        }
        
        const allARTransactions = await TransactionEntry.find(transactionQuery).sort({ date: 1 }).lean();

        console.log(`📊 Found ${allARTransactions.length} AR transactions${residence ? ` for residence ${residence}` : ''}`);
        
        // Track residence per student from transactions
        const studentResidenceMap = new Map();

        // Process transactions to calculate cumulative balances by month (like balance sheet)
        // For each month, calculate cumulative balance up to the end of that month
        // This matches balance sheet logic: cumulative debits - cumulative credits up to month end
        const monthlyData = {}; // { studentId: { monthKey: { accruals, payments, outstanding } } }
        const allMonthKeysSet = new Set(); // Track all months we've seen
        
        // First pass: collect all unique months from transactions and track residence per student
        allARTransactions.forEach(transaction => {
            const txDate = new Date(transaction.date);
            const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
            allMonthKeysSet.add(monthKey);
            
            // Track residence from transaction
            const txResidence = transaction.residence || 
                              transaction.metadata?.residenceId || 
                              transaction.metadata?.residence;
            
            transaction.entries.forEach(entry => {
                if (entry.accountCode && entry.accountCode.startsWith('1100-') && 
                    entry.accountType === 'Asset') {
                    const studentId = entry.accountCode.split('-')[1];
                    if (studentId && txResidence && !studentResidenceMap.has(studentId)) {
                        studentResidenceMap.set(studentId, txResidence);
                    }
                }
            });
        });
        
        const allMonthKeys = Array.from(allMonthKeysSet).sort();
        
        // Second pass: for each student, calculate cumulative balance at end of each month
        allARTransactions.forEach(transaction => {
            transaction.entries.forEach(entry => {
                if (entry.accountCode && entry.accountCode.startsWith('1100-') && 
                    entry.accountType === 'Asset') {
                    const studentId = entry.accountCode.split('-')[1];
                    
                    if (!studentId) return;
                    
                    // Apply residence filter if provided (check student's residence matches)
                    if (residence) {
                        const studentResidence = studentResidenceMap.get(studentId);
                        if (studentResidence && studentResidence.toString() !== residence) {
                            return; // Skip if student's residence doesn't match filter
                        }
                    }
                    
                    if (!monthlyData[studentId]) {
                        monthlyData[studentId] = {};
                    }
                    
                    // For each month, calculate cumulative balance up to that month end
                    // This matches balance sheet logic: only include transactions dated <= month end
                    const txDate = new Date(transaction.date);
                    const txMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                    
                    allMonthKeys.forEach(monthKey => {
                        // Calculate month end date for comparison
                        // JavaScript Date months are 0-indexed, so month 10 = November, month 10 day 0 = last day of October
                        const [year, month] = monthKey.split('-').map(Number);
                        const monthEndDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of the month (month is 1-based, Date uses 0-based)
                        
                        // Only include transactions dated <= month end (like balance sheet)
                        if (txDate <= monthEndDate) {
                            if (!monthlyData[studentId][monthKey]) {
                                monthlyData[studentId][monthKey] = {
                                    monthKey,
                                    year,
                                    month,
                                    accruals: 0,
                                    payments: 0,
                                    outstanding: 0,
                                    transactionCount: 0,
                                    latestTransaction: null
                                };
                            }
                            
                            const monthData = monthlyData[studentId][monthKey];
                            
                            // Process based on transaction source (same as balance sheet)
                            if (transaction.source === 'rental_accrual' || transaction.source === 'lease_start') {
                                // Accrual: increases what's owed
                                monthData.accruals += entry.debit || 0;
                            } else if (transaction.source === 'payment' || transaction.source === 'accounts_receivable_collection') {
                                // Payment: increases what's paid
                                monthData.payments += entry.credit || 0;
                            } else if (transaction.source === 'manual') {
                                // Manual transactions: handle based on type
                                if (transaction.metadata?.type === 'negotiated_payment_adjustment' || 
                                    transaction.metadata?.type === 'security_deposit_reversal') {
                                    // Reduces what's owed
                                    monthData.accruals -= entry.credit || 0;
                                } else {
                                    // Other manual: debits increase, credits decrease
                                    monthData.accruals += (entry.debit || 0) - (entry.credit || 0);
                                }
                            }
                            
                            // Update transaction count and latest transaction for this month
                            if (txMonthKey === monthKey) {
                                monthData.transactionCount++;
                                if (!monthData.latestTransaction || txDate > new Date(monthData.latestTransaction)) {
                                    monthData.latestTransaction = transaction.date;
                                }
                            }
                        }
                    });
                }
            });
        });

        // Calculate outstanding for each month (like balance sheet: cumulative debits - cumulative credits)
        Object.keys(monthlyData).forEach(studentId => {
            Object.keys(monthlyData[studentId]).forEach(monthKey => {
                const monthData = monthlyData[studentId][monthKey];
                monthData.outstanding = Math.max(0, monthData.accruals - monthData.payments);
            });
        });

        // Convert to array format similar to aggregation result
        const studentBalances = Object.keys(monthlyData).map(studentId => {
            const studentMonths = monthlyData[studentId];
            const monthlyBalances = Object.values(studentMonths)
                .filter(m => m.outstanding > 0) // Only include months with outstanding > 0
                .map(m => ({
                    monthKey: m.monthKey,
                    year: m.year,
                    month: m.month,
                    balance: m.outstanding,
                    debits: m.accruals,
                    credits: m.payments,
                    transactionCount: m.transactionCount,
                    latestTransaction: m.latestTransaction
                }))
                .sort((a, b) => {
                    if (a.year !== b.year) return b.year - a.year;
                    return b.month - a.month;
                });

            const totalBalance = monthlyBalances.reduce((sum, m) => sum + m.balance, 0);
            const totalTransactions = monthlyBalances.reduce((sum, m) => sum + m.transactionCount, 0);
            const latestTransaction = monthlyBalances.length > 0 ? monthlyBalances[0].latestTransaction : null;

            return {
                _id: studentId,
                monthlyBalances,
                totalBalance,
                totalTransactions,
                latestTransaction,
                residence: studentResidenceMap.get(studentId) || null
            };
        }).filter(s => {
            // Filter by residence if provided
            if (residence) {
                const studentResidence = s.residence;
                if (!studentResidence || studentResidence.toString() !== residence) {
                    return false; // Exclude if residence doesn't match
                }
            }
            // Only include students with outstanding balance
            return s.totalBalance > 0;
        }).sort((a, b) => b.totalBalance - a.totalBalance);

        console.log(`📊 Processed ${studentBalances.length} students with outstanding balances`);

        console.log(`🔍 Found ${studentBalances.length} students with outstanding balances`);
        
        // Debug: Log November balances specifically from transactions
        const novStudentsFromTransactions = studentBalances.filter(student => {
            const novBalances = student.monthlyBalances?.filter(mb => mb.monthKey === '2025-11' || mb.month === 11);
            return novBalances && novBalances.length > 0 && (novBalances[0].balance || 0) > 0;
        });
        console.log(`📅 November 2025: ${novStudentsFromTransactions.length} students with transactions (balance > 0)`);
        novStudentsFromTransactions.forEach(student => {
            const novBalance = student.monthlyBalances.find(mb => mb.monthKey === '2025-11' || mb.month === 11);
            console.log(`  - Student ${student._id}: balance = ${novBalance?.balance || 0}, transactions = ${novBalance?.transactionCount || 0}`);
        });

        // Get debtor information in batch for better performance
        const studentIds = studentBalances.map(s => s._id).filter(id => id); // Filter out null/undefined
        const Debtor = require('../../models/Debtor');
        
        // Validate and convert student IDs to ObjectIds, filtering out invalid ones
        const validStudentObjectIds = studentIds
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));
        
        const debtors = await Debtor.find({
            $or: [
                { user: { $in: validStudentObjectIds } },
                { accountCode: { $in: studentIds.filter(id => id).map(id => `1100-${id}`) } }
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
        const allStudentObjectIds = studentsWithMonthlyBalances
            .map(s => s.studentId || s._id)
            .filter(id => id && mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));
        
        // Get invoices for all students (not just limited ones)
        const allInvoices = allStudentObjectIds.length > 0 ? await Invoice.find({
            student: { $in: allStudentObjectIds },
            status: { $ne: 'cancelled' } // Exclude cancelled invoices
        }).sort({ billingStartDate: 1 }).lean() : [];
        
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
            
            // Group by student
            const novInvoicesByStudent = new Map();
            novInvoices.forEach(inv => {
                const studentId = inv.student?.toString();
                if (!novInvoicesByStudent.has(studentId)) {
                    novInvoicesByStudent.set(studentId, []);
                }
                novInvoicesByStudent.get(studentId).push(inv);
            });
            console.log(`📅 November 2025: ${novInvoicesByStudent.size} unique students with invoices`);
            novInvoicesByStudent.forEach((invoices, studentId) => {
                const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.balanceDue || inv.totalAmount - (inv.amountPaid || 0)), 0);
                console.log(`  - Student ${studentId}: ${invoices.length} invoice(s), total outstanding = ${totalOutstanding}`);
            });
        }

        // Now enhance ALL students with invoices (not just limited ones)
        // Note: Payments are already accounted for in the debtor logic above
        const studentsWithInvoices = studentsWithMonthlyBalances.map(student => {
            const studentId = student.studentId || student._id;
            const studentInvoices = invoicesByStudentAndMonth.get(studentId) || new Map();
            
            // Enhance monthly balances with invoices and payments
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
                
                // Outstanding balance is already calculated correctly using debtor logic:
                // outstanding = accruals - payments (where payments are allocated by monthSettled)
                // Use invoice outstanding if available (it may be more accurate), otherwise use transaction balance
                const outstandingBalance = invoiceOutstanding > 0 && invoiceOutstanding > monthBalance.balance 
                    ? invoiceOutstanding 
                    : monthBalance.balance; // Already calculated as accruals - payments
                
                return {
                    ...monthBalance,
                    monthName: monthName,
                    balance: outstandingBalance, // Outstanding (already calculated as accruals - payments)
                    originalBalance: monthBalance.debits || monthBalance.balance, // Original accruals
                    accruals: monthBalance.debits || 0, // Total accruals for this month
                    payments: monthBalance.credits || 0, // Total payments for this month
                    invoices: invoices,
                    invoiceCount: invoices.length,
                    invoiceTotal: invoiceTotal,
                    invoicePaid: invoicePaid,
                    invoiceOutstanding: invoiceOutstanding,
                    originalDebt: Math.max(invoiceTotal, monthBalance.debits || monthBalance.balance), // Total original amount
                    paidAmount: invoicePaid + (monthBalance.credits || 0) // Total paid (invoice + transaction payments)
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
                    
                    // For invoice-only months, use invoice outstanding as balance
                    // (payments would have been processed in the main transaction loop)
                    monthlyBalancesWithInvoices.push({
                        monthKey: monthKey,
                        year: year,
                        month: month,
                        monthName: monthName,
                        balance: invoiceOutstanding, // Outstanding from invoice
                        originalBalance: 0, // No transaction balance
                        accruals: 0, // No accruals from transactions
                        payments: 0, // Payments would be in transaction data if any
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

        // Get student details for ALL students (for monthly view) - don't limit yet
        const { getStudentInfo } = require('../../utils/studentUtils');
        
        console.log(`📊 Getting student details for ${studentsWithInvoices.length} students (for monthly view)`);
        
        // Get student details for ALL students (active and expired) - needed for monthly view
        const allStudentsWithDetails = await Promise.all(
            studentsWithInvoices.map(async (student) => {
                const studentId = student.studentId || student._id;
                
                // Validate studentId before calling getStudentInfo
                if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
                    console.warn(`⚠️ Invalid studentId: ${studentId}`);
                    return {
                        ...student,
                        studentDetails: null
                    };
                }
                
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
        const expiredCount = allStudentsWithDetails.filter(s => s.studentDetails?.isExpired).length;
        const activeCount = allStudentsWithDetails.filter(s => !s.studentDetails?.isExpired).length;
        
        console.log(`📊 Total students with outstanding balances: ${allStudentsWithDetails.length} (${activeCount} active, ${expiredCount} expired)`);
        
        // Create monthly view: Group students by month
        // Structure: { "2025-10": { monthKey, year, month, monthName, students: [...], totals: {...} } }
        // IMPORTANT: Use ALL students for monthly view, not limited ones
        const monthlyView = {};
        
        allStudentsWithDetails.forEach(student => {
            if (student.monthlyBalances && student.monthlyBalances.length > 0) {
                student.monthlyBalances.forEach(monthBalance => {
                    // Only include months with actual outstanding balance > 0
                    const balance = monthBalance.balance || 0;
                    const invoiceOutstanding = monthBalance.invoiceOutstanding || 0;
                    const actualBalance = Math.max(balance, invoiceOutstanding);
                    
                    if (actualBalance <= 0) {
                        return; // Skip months with no outstanding balance
                    }
                    
                    const monthKey = monthBalance.monthKey;
                    
                    // Verify monthKey is valid and matches the year/month
                    if (!monthKey || !monthKey.match(/^\d{4}-\d{2}$/)) {
                        console.warn(`⚠️ Invalid monthKey for student ${student.studentId}: ${monthKey}`);
                        return;
                    }
                    
                    // Verify monthKey matches year and month
                    const [year, month] = monthKey.split('-').map(Number);
                    if (year !== monthBalance.year || month !== monthBalance.month) {
                        console.warn(`⚠️ MonthKey mismatch for student ${student.studentId}: monthKey=${monthKey}, year=${monthBalance.year}, month=${monthBalance.month}`);
                        return;
                    }
                    
                    // Initialize month if it doesn't exist
                    if (!monthlyView[monthKey]) {
                        monthlyView[monthKey] = {
                            monthKey: monthKey,
                            year: monthBalance.year,
                            month: monthBalance.month,
                            monthName: monthBalance.monthName,
                            students: [],
                            studentIds: new Set(), // Track unique students
                            totals: {
                                totalOutstanding: 0,
                                totalOriginalDebt: 0,
                                totalPaid: 0,
                                studentCount: 0,
                                invoiceCount: 0,
                                transactionCount: 0
                            }
                        };
                    }
                    
                    // Add student to this month's list (only if not already added)
                    const monthData = monthlyView[monthKey];
                    const studentId = student.studentId || student._id;
                    
                    // Check if student already exists in this month (avoid duplicates)
                    if (!monthData.studentIds.has(studentId)) {
                        monthData.studentIds.add(studentId);
                        
                        monthData.students.push({
                            studentId: studentId,
                            residence: student.residence,
                            studentDetails: student.studentDetails,
                            hasDebtorAccount: student.hasDebtorAccount,
                            debtorCode: student.debtorCode,
                            // Month-specific balance data
                            monthBalance: {
                                monthKey: monthBalance.monthKey,
                                year: monthBalance.year,
                                month: monthBalance.month,
                                monthName: monthBalance.monthName,
                                balance: actualBalance, // Use actual balance
                                originalBalance: monthBalance.originalBalance || 0,
                                transactionCount: monthBalance.transactionCount || 0,
                                latestTransaction: monthBalance.latestTransaction,
                                // Invoice details for this month
                                invoices: monthBalance.invoices || [],
                                invoiceCount: monthBalance.invoiceCount || 0,
                                invoiceTotal: monthBalance.invoiceTotal || 0,
                                invoicePaid: monthBalance.invoicePaid || 0,
                                invoiceOutstanding: monthBalance.invoiceOutstanding || 0,
                                originalDebt: monthBalance.originalDebt || 0,
                                paidAmount: monthBalance.paidAmount || 0
                            }
                        });
                        
                        // Update totals for this month (only count once per student)
                        monthData.totals.totalOutstanding += actualBalance;
                        monthData.totals.totalOriginalDebt += monthBalance.originalDebt || 0;
                        monthData.totals.totalPaid += monthBalance.paidAmount || 0;
                        monthData.totals.studentCount += 1; // Count unique students
                        monthData.totals.invoiceCount += monthBalance.invoiceCount || 0;
                        monthData.totals.transactionCount += monthBalance.transactionCount || 0;
                    } else {
                        // Student already added, but update their balance if this one is higher
                        const existingStudentIndex = monthData.students.findIndex(s => 
                            (s.studentId || s._id) === studentId
                        );
                        if (existingStudentIndex >= 0) {
                            const existingStudent = monthData.students[existingStudentIndex];
                            const existingBalance = existingStudent.monthBalance.balance || 0;
                            
                            if (actualBalance > existingBalance) {
                                // Update with higher balance
                                monthData.totals.totalOutstanding -= existingBalance;
                                monthData.totals.totalOutstanding += actualBalance;
                                
                                existingStudent.monthBalance.balance = actualBalance;
                                existingStudent.monthBalance.invoiceOutstanding = invoiceOutstanding;
                                existingStudent.monthBalance.invoices = monthBalance.invoices || [];
                                existingStudent.monthBalance.invoiceCount = monthBalance.invoiceCount || 0;
                                existingStudent.monthBalance.invoiceTotal = monthBalance.invoiceTotal || 0;
                                existingStudent.monthBalance.invoicePaid = monthBalance.invoicePaid || 0;
                            }
                        }
                    }
                });
            }
        });
        
        // Clean up studentIds Set (not needed in response)
        Object.values(monthlyView).forEach(month => {
            delete month.studentIds;
        });
        
        // Convert monthly view to array and sort by month (newest first)
        const monthlyViewArray = Object.values(monthlyView).sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });
        
        // Sort students within each month by balance (highest first)
        monthlyViewArray.forEach(monthData => {
            monthData.students.sort((a, b) => {
                return (b.monthBalance.balance || 0) - (a.monthBalance.balance || 0);
            });
        });
        
        // VALIDATION: Recalculate totals from actual student balances to ensure accuracy
        monthlyViewArray.forEach(monthData => {
            const recalculatedTotals = {
                totalOutstanding: 0,
                totalOriginalDebt: 0,
                totalPaid: 0,
                studentCount: monthData.students.length, // Count unique students
                invoiceCount: 0,
                transactionCount: 0
            };
            
            monthData.students.forEach(student => {
                const balance = student.monthBalance.balance || 0;
                recalculatedTotals.totalOutstanding += balance;
                recalculatedTotals.totalOriginalDebt += student.monthBalance.originalDebt || 0;
                recalculatedTotals.totalPaid += student.monthBalance.paidAmount || 0;
                recalculatedTotals.invoiceCount += student.monthBalance.invoiceCount || 0;
                recalculatedTotals.transactionCount += student.monthBalance.transactionCount || 0;
            });
            
            // Update totals with recalculated values
            monthData.totals = recalculatedTotals;
            
            // Log if there's a discrepancy
            if (Math.abs(monthData.totals.totalOutstanding - recalculatedTotals.totalOutstanding) > 0.01) {
                console.warn(`⚠️ Month ${monthData.monthKey} total mismatch:`, {
                    original: monthData.totals.totalOutstanding,
                    recalculated: recalculatedTotals.totalOutstanding,
                    difference: monthData.totals.totalOutstanding - recalculatedTotals.totalOutstanding
                });
            }
        });
        
        // Calculate overall totals across all months (using ALL students)
        const overallTotals = {
            totalOutstanding: allStudentsWithDetails.reduce((sum, s) => sum + s.totalBalance, 0),
            totalStudents: allStudentsWithDetails.length,
            totalMonths: monthlyViewArray.length,
            activeStudents: activeCount,
            expiredStudents: expiredCount
        };
        
        // Log October specifically with detailed breakdown
        const octMonth = monthlyViewArray.find(m => m.monthKey === '2025-10' || m.month === 10);
        if (octMonth) {
            console.log(`📅 October 2025 Monthly View DETAILED:`, {
                monthKey: octMonth.monthKey,
                monthName: octMonth.monthName,
                studentCount: octMonth.students.length,
                totalOutstanding: octMonth.totals.totalOutstanding,
                totalOriginalDebt: octMonth.totals.totalOriginalDebt,
                totalPaid: octMonth.totals.totalPaid,
                invoiceCount: octMonth.totals.invoiceCount,
                transactionCount: octMonth.totals.transactionCount,
                breakdown: {
                    studentsWithTransactions: octMonth.students.filter(s => (s.monthBalance.originalBalance || 0) > 0).length,
                    studentsWithInvoicesOnly: octMonth.students.filter(s => (s.monthBalance.originalBalance || 0) === 0 && (s.monthBalance.invoiceOutstanding || 0) > 0).length,
                    studentsWithBoth: octMonth.students.filter(s => (s.monthBalance.originalBalance || 0) > 0 && (s.monthBalance.invoiceOutstanding || 0) > 0).length
                },
                students: octMonth.students.map(s => ({
                    studentId: s.studentId,
                    name: s.studentDetails ? `${s.studentDetails.firstName} ${s.studentDetails.lastName}` : 'Unknown',
                    balance: s.monthBalance.balance,
                    originalBalance: s.monthBalance.originalBalance,
                    transactionCount: s.monthBalance.transactionCount,
                    invoiceCount: s.monthBalance.invoiceCount,
                    invoiceOutstanding: s.monthBalance.invoiceOutstanding,
                    monthKey: s.monthBalance.monthKey,
                    hasTransactions: (s.monthBalance.originalBalance || 0) > 0,
                    hasInvoices: (s.monthBalance.invoiceOutstanding || 0) > 0
                }))
            });
            
            // Check if we should filter out students with zero October balance
            const studentsWithNonZeroBalance = octMonth.students.filter(s => (s.monthBalance.balance || 0) > 0);
            console.log(`⚠️ October Balance Check:`, {
                totalStudentsInList: octMonth.students.length,
                studentsWithBalanceGreaterThanZero: studentsWithNonZeroBalance.length,
                studentsWithZeroBalance: octMonth.students.length - studentsWithNonZeroBalance.length
            });
        }
        
        // Log November specifically with detailed breakdown
        const novMonth = monthlyViewArray.find(m => m.monthKey === '2025-11' || m.month === 11);
        if (novMonth) {
            console.log(`📅 November 2025 Monthly View DETAILED:`, {
                monthKey: novMonth.monthKey,
                monthName: novMonth.monthName,
                studentCount: novMonth.students.length,
                totalOutstanding: novMonth.totals.totalOutstanding,
                totalOriginalDebt: novMonth.totals.totalOriginalDebt,
                totalPaid: novMonth.totals.totalPaid,
                invoiceCount: novMonth.totals.invoiceCount,
                transactionCount: novMonth.totals.transactionCount,
                breakdown: {
                    studentsWithTransactions: novMonth.students.filter(s => (s.monthBalance.originalBalance || 0) > 0).length,
                    studentsWithInvoicesOnly: novMonth.students.filter(s => (s.monthBalance.originalBalance || 0) === 0 && (s.monthBalance.invoiceOutstanding || 0) > 0).length,
                    studentsWithBoth: novMonth.students.filter(s => (s.monthBalance.originalBalance || 0) > 0 && (s.monthBalance.invoiceOutstanding || 0) > 0).length
                },
                students: novMonth.students.map(s => ({
                    studentId: s.studentId,
                    name: s.studentDetails ? `${s.studentDetails.firstName} ${s.studentDetails.lastName}` : 'Unknown',
                    balance: s.monthBalance.balance,
                    originalBalance: s.monthBalance.originalBalance,
                    transactionCount: s.monthBalance.transactionCount,
                    invoiceCount: s.monthBalance.invoiceCount,
                    invoiceOutstanding: s.monthBalance.invoiceOutstanding,
                    invoiceTotal: s.monthBalance.invoiceTotal,
                    invoicePaid: s.monthBalance.invoicePaid,
                    hasTransactions: (s.monthBalance.originalBalance || 0) > 0,
                    hasInvoices: (s.monthBalance.invoiceOutstanding || 0) > 0,
                    invoices: s.monthBalance.invoices?.map(inv => ({
                        invoiceNumber: inv.invoiceNumber,
                        totalAmount: inv.totalAmount,
                        amountPaid: inv.amountPaid,
                        balanceDue: inv.balanceDue,
                        billingPeriod: inv.billingPeriod
                    })) || []
                }))
            });
            
            // Verify sum
            const calculatedTotal = novMonth.students.reduce((sum, s) => sum + (s.monthBalance.balance || 0), 0);
            console.log(`📊 November Total Verification:`, {
                fromTotals: novMonth.totals.totalOutstanding,
                fromStudentsSum: calculatedTotal,
                difference: novMonth.totals.totalOutstanding - calculatedTotal,
                expectedTotal: 52 // User mentioned this should be 52
            });
            
            // Check if we should filter out students with zero November balance
            const studentsWithNonZeroBalance = novMonth.students.filter(s => (s.monthBalance.balance || 0) > 0);
            console.log(`⚠️ November Balance Check:`, {
                totalStudentsInList: novMonth.students.length,
                studentsWithBalanceGreaterThanZero: studentsWithNonZeroBalance.length,
                studentsWithZeroBalance: novMonth.students.length - studentsWithNonZeroBalance.length
            });
        }
        
        console.log(`📊 Monthly outstanding balances view: ${monthlyViewArray.length} months with outstanding balances`);
        console.log(`📊 Total students in monthly view: ${allStudentsWithDetails.length} (${activeCount} active, ${expiredCount} expired)`);
        
        res.status(200).json({
            success: true,
            message: 'Students with monthly outstanding balances retrieved successfully',
            data: {
                // Overall summary (from ALL students)
                summary: overallTotals,
                // Monthly view: organized by month, each month contains ALL students who owe
                monthlyView: monthlyViewArray,
                // Legacy format: students organized by student (all students, no limit)
                students: allStudentsWithDetails,
                // Monthly summary (totals per month)
                monthlySummary: monthlyViewArray.map(month => ({
                    monthKey: month.monthKey,
                    year: month.year,
                    month: month.month,
                    monthName: month.monthName,
                    ...month.totals
                }))
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

