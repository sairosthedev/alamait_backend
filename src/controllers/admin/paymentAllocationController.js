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
                message: 'Student ID is required'
            });
        }

        console.log(`🔍 Getting AR balances for student: ${studentId}`);

        // Get student's AR balances using the enhanced service
        const arBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);

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

// Get all students with outstanding balances for admin dashboard
const getStudentsWithOutstandingBalances = async (req, res) => {
    try {
        // Set longer timeout for this complex operation
        req.setTimeout(300000); // 5 minutes
        res.setTimeout(300000); // 5 minutes
        
        const { residence, limit = 100, sortBy = 'totalBalance', sortOrder = 'desc' } = req.query;

        console.log(`👥 Getting students with outstanding balances (enhanced method)`);

        // First, get all students who have AR transactions
        const query = {
            'entries.accountCode': { $regex: '^1100-' },
            'entries.accountType': 'Asset',
            'entries.debit': { $gt: 0 }
        };

        if (residence) {
            query.residence = new mongoose.Types.ObjectId(residence);
        }

        // Get all AR transactions to find unique student IDs
        const arTransactions = await TransactionEntry.find(query)
            .populate('residence', 'name')
            .sort({ date: 1 });

        // Extract unique student IDs
        const studentIds = new Set();
        arTransactions.forEach(transaction => {
            const arEntry = transaction.entries.find(e => 
                e.accountCode.startsWith('1100-') && e.debit > 0
            );
            if (arEntry) {
                // Account code format is: 1100-{studentId}
                const studentId = arEntry.accountCode.split('-')[1];
                studentIds.add(studentId);
            }
        });

        console.log(`🔍 Found ${studentIds.size} unique students with AR transactions`);
        console.log(`🔍 Student IDs:`, Array.from(studentIds).slice(0, 10)); // Show first 10 IDs

        // Get detailed outstanding balances for each student (limit to prevent timeout)
        const studentsWithOutstanding = [];
        const maxStudents = Math.min(parseInt(limit), 50); // Limit to 50 students max to prevent timeout
        const studentIdsArray = Array.from(studentIds).slice(0, maxStudents);
        
        console.log(`🔍 Processing ${studentIdsArray.length} students (limited to prevent timeout)`);
        
        for (let i = 0; i < studentIdsArray.length; i++) {
            const studentId = studentIdsArray[i];
            
            // Progress indicator
            if (i % 10 === 0) {
                console.log(`📊 Processing student ${i + 1}/${studentIdsArray.length}: ${studentId}`);
            }
            
            try {
                // Get debtor information to get the actual current balance (includes negotiated payments and reversals)
                const Debtor = require('../../models/Debtor');
                let debtor = null;
                
                // Optimized debtor lookup - try the most likely first
                debtor = await Debtor.findOne({ 
                    $or: [
                        { user: studentId },
                        { user: new mongoose.Types.ObjectId(studentId) },
                        { accountCode: `1100-${studentId}` }
                    ]
                });
                
                if (debtor) {
                    // Get residence information from first transaction
                    const studentTransaction = arTransactions.find(t => 
                        t.entries.some(e => e.accountCode.includes(studentId))
                    );
                    
                    // Get the original accrual transaction for this student
                    const originalAccrual = arTransactions.find(t => 
                        t.entries.some(e => e.accountCode === `1100-${studentId}` && e.debit > 0)
                    );
                    
                    // Create a simplified monthly balance structure
                    const monthlyBalances = [];
                    if (originalAccrual) {
                        // Extract month from original accrual
                        const accrualDate = new Date(originalAccrual.date);
                        const monthKey = `${accrualDate.getFullYear()}-${String(accrualDate.getMonth() + 1).padStart(2, '0')}`;
                        
                        // Get original debt amount from the accrual
                        const originalDebtEntry = originalAccrual.entries.find(e => 
                            e.accountCode === `1100-${studentId}` && e.debit > 0
                        );
                        const originalDebt = originalDebtEntry ? originalDebtEntry.debit : 0;
                        
                        monthlyBalances.push({
                            month: monthKey,
                            balance: debtor.currentBalance, // Current balance after negotiations/reversals
                            originalDebt: originalDebt,
                            transactionId: originalAccrual._id
                        });
                    }

                    studentsWithOutstanding.push({
                        studentId,
                        residence: studentTransaction?.residence,
                        totalBalance: debtor.currentBalance,
                        monthlyBalances,
                        oldestBalance: monthlyBalances.length > 0 ? monthlyBalances[0].month : null,
                        newestBalance: monthlyBalances.length > 0 ? monthlyBalances[monthlyBalances.length - 1].month : null,
                        monthsWithBalance: monthlyBalances.length
                    });
                }
            } catch (error) {
                console.error(`❌ Error getting outstanding balances for student ${studentId}:`, error);
                // Continue with other students
            }
        }

        console.log(`📊 Found ${studentsWithOutstanding.length} students (including those with $0 balance)`);
        
        // Also check for expired students who might have outstanding balances but no AR transactions
        console.log('🔍 Checking for expired students with outstanding balances...');
        const ExpiredStudent = require('../../models/ExpiredStudent');
        const expiredStudents = await ExpiredStudent.find({});
        
        for (const expiredStudent of expiredStudents) {
            try {
                // Handle cases where student data might be missing
                const studentData = expiredStudent.student || expiredStudent;
                const studentId = studentData._id || studentData;
                
                if (!studentId) {
                    console.log('⚠️ Skipping expired student with missing ID');
                    continue;
                }
                
                const debtor = await Debtor.findOne({ user: studentId });
                
                if (debtor && debtor.currentBalance > 0) {
                    // Check if this student is already in our list
                    const alreadyIncluded = studentsWithOutstanding.find(s => s.studentId === studentId.toString());
                    if (!alreadyIncluded) {
                        const firstName = studentData.firstName || 'Unknown';
                        const lastName = studentData.lastName || 'Student';
                        console.log(`🔴 Found expired student with outstanding balance: ${firstName} ${lastName} - $${debtor.currentBalance}`);
                        
                        // Get residence information (try to find from any transaction or use default)
                        const studentTransaction = arTransactions.find(t => 
                            t.entries.some(e => e.accountCode.includes(studentId))
                        );
                        
                        studentsWithOutstanding.push({
                            studentId: studentId.toString(),
                            totalBalance: debtor.currentBalance,
                            monthlyBalances: debtor.monthlyBalances || [],
                            residence: studentTransaction?.residence || null,
                            isExpiredStudent: true // Flag to identify this came from expired students
                        });
                    }
                }
            } catch (error) {
                const studentEmail = expiredStudent?.student?.email || expiredStudent?.email || 'Unknown';
                console.error(`❌ Error processing expired student ${studentEmail}:`, error.message);
            }
        }
        
        console.log(`📊 Total students with outstanding balances (including expired): ${studentsWithOutstanding.length}`);

        // Sort by specified criteria
        const sortMultiplier = sortOrder === 'desc' ? -1 : 1;
        studentsWithOutstanding.sort((a, b) => {
            if (sortBy === 'totalBalance') {
                return (a.totalBalance - b.totalBalance) * sortMultiplier;
            } else if (sortBy === 'oldestBalance') {
                return (a.oldestBalance.localeCompare(b.oldestBalance)) * sortMultiplier;
            } else if (sortBy === 'monthsWithBalance') {
                return (a.monthsWithBalance - b.monthsWithBalance) * sortMultiplier;
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

module.exports = {
    getStudentARBalances,
    getPaymentAllocationSummary,
    manuallyAllocatePayment,
    autoAllocatePayment,
    getPaymentAllocationHistory,
    getPaymentCoverageAnalysis,
    getStudentsWithOutstandingBalances,
    getOutstandingBalancesSummary,
    getARInvoices
};

