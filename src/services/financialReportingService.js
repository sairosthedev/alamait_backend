const TransactionEntry = require('../models/TransactionEntry');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Maintenance = require('../models/Maintenance');
const { Residence } = require('../models/Residence');
const IncomeStatementController = require('../controllers/finance/incomeStatementController');
const mongoose = require('mongoose');

/**
 * Financial Reporting Service
 * 
 * Generates comprehensive financial statements including:
 * - Income Statement (Profit & Loss)
 * - Balance Sheet
 * - Cash Flow Statement
 * - Trial Balance
 * - General Ledger
 * 
 * Supports both cash and accrual basis accounting
 */

class FinancialReportingService {
    
    /**
     * Generate Income Statement (Profit & Loss)
     * 
     * ACCRUAL BASIS: Shows income/expenses when earned/incurred
     * CASH BASIS: Shows income/expenses when cash is received/paid
     */
    static async generateIncomeStatement(period, basis = 'accrual', residenceId = null) {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating income statement for ${period} using ${basis.toUpperCase()} basis${residenceId ? ` for residence: ${residenceId}` : ''}`);
            
            if (basis === 'accrual') {
                console.log('🔵 ACCRUAL BASIS: Including income when earned, expenses when incurred');
                
                // For accrual basis, look at transaction entries with rental_accrual source for income
                // Also include forfeiture transactions and reversals (which are debits to income accounts)
                const accrualQuery = {
                    date: { $gte: startDate, $lte: endDate },
                    source: { $in: ['rental_accrual', 'manual', 'payment', 'rental_accrual_reversal'] },
                    status: 'posted'
                };
                
                // Add residence filtering if specified
                if (residenceId) {
                    accrualQuery.$or = [
                        { residence: residenceId },
                        { 'metadata.residenceId': residenceId }
                    ];
                }
                
                let accrualEntries = await TransactionEntry.find(accrualQuery).lean();
                
                // For accrual basis, include only expense accruals (and optionally manual adjustments)
                const expenseQuery = {
                    date: { $gte: startDate, $lte: endDate },
                    source: { $in: ['expense_accrual', 'manual'] },
                    status: 'posted'
                };
                
                // Add residence filtering if specified
                if (residenceId) {
                    expenseQuery.$or = [
                        { residence: residenceId },
                        { 'metadata.residenceId': residenceId }
                    ];
                }
                
                const expenseEntries = await TransactionEntry.find(expenseQuery).lean();
                
                console.log(`Found ${accrualEntries.length} rental accrual entries and ${expenseEntries.length} expense entries for accrual basis`);
                
                accrualEntries = this.netRentalAccrualEntries(accrualEntries);
                console.log(`📊 Rental accrual entries after netting reversals/negotiations: ${accrualEntries.length}`);
                
                let totalRevenue = 0;
                const revenueByAccount = {};
            const residences = new Set();
            
                // Process rental accruals (income when earned) and forfeitures (income when forfeited)
                accrualEntries.forEach(entry => {
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Income') {
                                // For income accounts: credits increase revenue, debits decrease revenue
                                const amount = (lineItem.credit || 0) - (lineItem.debit || 0);
                                totalRevenue += amount;
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                revenueByAccount[key] = (revenueByAccount[key] || 0) + amount;
                                
                                // Log forfeiture and reversal transactions for debugging
                                if (entry.metadata && entry.metadata.isForfeiture) {
                                    console.log(`🔄 Forfeiture transaction: ${entry.transactionId}, Amount: ${amount}, Account: ${lineItem.accountName}`);
                                }
                                if (entry.source === 'rental_accrual_reversal') {
                                    console.log(`🔄 Reversal transaction: ${entry.transactionId}, Amount: ${amount}, Account: ${lineItem.accountName}`);
                                }
                            }
                        });
                    }
                    
                    if (entry.residence) {
                        residences.add(entry.residence.toString());
                    }
                });
                
                // Process expenses when incurred (accrual basis)
                let totalExpenses = 0;
                const expensesByAccount = {};
                
                expenseEntries.forEach(entry => {
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Expense') {
                                const amount = lineItem.debit || 0;
                                totalExpenses += amount;
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                expensesByAccount[key] = (expensesByAccount[key] || 0) + amount;
                        }
                    });
                }
                    
                    if (entry.residence) {
                        residences.add(entry.residence.toString());
                    }
            });
            
            const netIncome = totalRevenue - totalExpenses;
            
                // Create monthly breakdown for revenue
                const monthlyRevenue = {};
                accrualEntries.forEach(entry => {
                    const entryDate = new Date(entry.date);
                    const monthKey = entryDate.getMonth() + 1; // 1-12
                    
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Income') {
                                // For income accounts: credits increase revenue, debits decrease revenue
                                const amount = (lineItem.credit || 0) - (lineItem.debit || 0);
                                if (!monthlyRevenue[monthKey]) {
                                    monthlyRevenue[monthKey] = {};
                                }
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                monthlyRevenue[monthKey][key] = (monthlyRevenue[monthKey][key] || 0) + amount;
                            }
                        });
                    }
                });
                
                // Create monthly breakdown for expenses
                const monthlyExpenses = {};
                expenseEntries.forEach(entry => {
                    const entryDate = new Date(entry.date);
                    const monthKey = entryDate.getMonth() + 1; // 1-12
                    
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Expense') {
                                const amount = lineItem.debit || 0;
                                if (!monthlyExpenses[monthKey]) {
                                    monthlyExpenses[monthKey] = {};
                                }
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                monthlyExpenses[monthKey][key] = (monthlyExpenses[monthKey][key] || 0) + amount;
                            }
                        });
                    }
                });
            
            return {
                period,
                basis,
                revenue: {
                        ...revenueByAccount,
                        monthly: monthlyRevenue,
                    total_revenue: totalRevenue
                },
                expenses: {
                        ...expensesByAccount,
                        monthly: monthlyExpenses,
                        total_expenses: totalExpenses
                    },
                    net_income: netIncome,
                    gross_profit: totalRevenue - totalExpenses,
                    operating_income: totalRevenue - totalExpenses,
                    residences_included: residences.size > 0,
                    residences_processed: Array.from(residences),
                    transaction_count: accrualEntries.length + expenseEntries.length,
                    accounting_notes: {
                        accrual_basis: "Income/expenses shown when earned/incurred",
                        includes_rental_accruals: true,
                        includes_expenses_incurred: true,
                        includes_cash_payments: false,
                        source_filter: "Includes rental accrual entries and manual expense entries",
                        note: "Based on rental accrual entries and manual expense entries from transactionentries collection"
                    }
                };
                
            } else {
                console.log('🟢 CASH BASIS: Including only actual cash receipts and payments');
                
                // For cash basis, use the transaction entries with payment source
                const paymentQuery = {
                    date: { $gte: startDate, $lte: endDate },
                    source: 'payment',
                    status: 'posted'
                };
                
                // Add residence filtering if specified
                if (residenceId) {
                    paymentQuery.$or = [
                        { residence: residenceId },
                        { 'metadata.residenceId': residenceId }
                    ];
                }
                
                const paymentEntries = await TransactionEntry.find(paymentQuery);
                
                const expenseQuery = {
                    date: { $gte: startDate, $lte: endDate },
                    source: { $in: ['expense_payment', 'vendor_payment', 'expense_accrual'] },
                    status: 'posted'
                };
                
                // Add residence filtering if specified
                if (residenceId) {
                    expenseQuery.$or = [
                        { residence: residenceId },
                        { 'metadata.residenceId': residenceId }
                    ];
                }
                
                const expenseEntries = await TransactionEntry.find(expenseQuery);
                
                console.log(`Found ${paymentEntries.length} payment entries and ${expenseEntries.length} expense entries for cash basis`);
                
                // Process payment entries - look for cash inflows (debits to cash accounts)
                let totalRevenue = 0;
                const revenueByAccount = {};
                const residences = new Set();
                
                paymentEntries.forEach(entry => {
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            // Cash accounts: 1001 (Bank), 1002 (Cash on Hand), 1011 (Admin Petty Cash)
                            if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
                                const amount = lineItem.debit; // Cash received (debit to cash account)
                                totalRevenue += amount;
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                revenueByAccount[key] = (revenueByAccount[key] || 0) + amount;
                            }
                        });
                    }
                    
                    if (entry.residence) {
                        residences.add(entry.residence.toString());
                    }
                });
                
                // Process expense entries - look for cash outflows (credits to cash accounts)
                let totalExpenses = 0;
                const expensesByAccount = {};
                
                // Also look for cash outflows in ALL entries (not just expense_payment/vendor_payment)
                const allCashOutflowEntries = await TransactionEntry.find({
                    date: { $gte: startDate, $lte: endDate },
                    status: 'posted'
                });
                
                allCashOutflowEntries.forEach(entry => {
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            // Cash accounts: 1001 (Bank), 1002 (Cash on Hand), 1011 (Admin Petty Cash)
                            if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.credit > 0) {
                                const amount = lineItem.credit; // Cash paid (credit to cash account)
                                totalExpenses += amount;
                                
                                const key = `Cash Outflow - ${entry.description}`;
                                expensesByAccount[key] = (expensesByAccount[key] || 0) + amount;
                            }
                        });
                    }
                });
                
                // Create monthly breakdown for revenue (cash inflows)
                const monthlyRevenue = {};
                paymentEntries.forEach(entry => {
                    const entryDate = new Date(entry.date);
                    const monthKey = entryDate.getMonth() + 1; // 1-12
                    
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
                                const amount = lineItem.debit;
                                if (!monthlyRevenue[monthKey]) {
                                    monthlyRevenue[monthKey] = {};
                                }
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                monthlyRevenue[monthKey][key] = (monthlyRevenue[monthKey][key] || 0) + amount;
                            }
                        });
                    }
                });
                
                // Create monthly breakdown for expenses (cash outflows)
                const monthlyExpenses = {};
                // Initialize monthlyBreakdown array for expense details (12 months, 0-indexed)
                const monthlyBreakdown = Array(12).fill(null).map(() => ({ expense_details: [] }));
                
                allCashOutflowEntries.forEach(entry => {
                    const entryDate = new Date(entry.date);
                    const monthKey = entryDate.getMonth() + 1; // 1-12
                    
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.credit > 0) {
                                const amount = lineItem.credit;
                                if (!monthlyExpenses[monthKey]) {
                                    monthlyExpenses[monthKey] = {};
                                }
                                
                                const key = `Cash Outflow - ${entry.description}`;
                                monthlyExpenses[monthKey][key] = (monthlyExpenses[monthKey][key] || 0) + amount;

                                // Record individual expense detail using the actual paid date
                                const monthIndex = monthKey - 1; // Convert to 0-indexed
                                if (!monthlyBreakdown[monthIndex]) {
                                    monthlyBreakdown[monthIndex] = { expense_details: [] };
                                }
                                if (!monthlyBreakdown[monthIndex].expense_details) {
                                    monthlyBreakdown[monthIndex].expense_details = [];
                                }
                                monthlyBreakdown[monthIndex].expense_details.push({
                                    transactionId: entry.transactionId,
                                    date: entry.date,
                                    description: entry.description,
                                    accountCode: lineItem.accountCode,
                                    accountName: lineItem.accountName,
                                    amount
                                });
                            }
                        });
                    }
                });
                
                const netIncome = totalRevenue - totalExpenses;
                
                return {
                    period,
                    basis,
                    revenue: {
                        ...revenueByAccount,
                        monthly: monthlyRevenue,
                        total_revenue: totalRevenue
                    },
                    expenses: {
                        ...expensesByAccount,
                        monthly: monthlyExpenses,
                    total_expenses: totalExpenses
                },
                net_income: netIncome,
                gross_profit: totalRevenue,
                operating_income: netIncome,
                    residences_included: residences.size > 0,
                residences_processed: Array.from(residences),
                    transaction_count: paymentEntries.length + expenseEntries.length,
                    accounting_notes: {
                        accrual_basis: "Income/expenses shown when cash received/paid",
                        includes_rental_accruals: false,
                        includes_cash_payments: true,
                        source_filter: "Only cash movements",
                        note: "Based on payment and expense entries from transactionentries collection"
                    }
                };
            }
            
        } catch (error) {
            console.error('Error generating income statement:', error);
            throw error;
        }
    }

    static netRentalAccrualEntries(entries = []) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return [];
        }
        
        const accrualMap = new Map();
        const negotiationAdjustments = new Map();
        const reversalAccrualIds = new Set();
        const passthrough = [];
        
        entries.forEach(entry => {
            const entryId = this.getTransactionEntryId(entry);
            const originalAccrualId = entry?.metadata?.originalAccrualId
                ? String(entry.metadata.originalAccrualId)
                : null;
            
            if (this.isAccrualReversal(entry)) {
                if (originalAccrualId) {
                    reversalAccrualIds.add(originalAccrualId);
                }
                return; // remove reversals entirely
            }
            
            if (this.isNegotiationAdjustmentEntry(entry) && originalAccrualId) {
                if (!negotiationAdjustments.has(originalAccrualId)) {
                    negotiationAdjustments.set(originalAccrualId, []);
                }
                negotiationAdjustments.get(originalAccrualId).push(entry);
                return;
            }
            
            if (this.isRentalAccrualEntry(entry) && entryId) {
                accrualMap.set(entryId, entry);
                return;
            }
            
            passthrough.push(entry);
        });
        
        const processed = [...passthrough];
        
        accrualMap.forEach((accrualEntry, accrualId) => {
            if (reversalAccrualIds.has(accrualId)) {
                return;
            }
            
            if (negotiationAdjustments.has(accrualId)) {
                const merged = this.applyNegotiationAdjustments(accrualEntry, negotiationAdjustments.get(accrualId));
                processed.push(merged);
                negotiationAdjustments.delete(accrualId);
            } else {
                processed.push(accrualEntry);
            }
        });
        
        negotiationAdjustments.forEach(adjustments => {
            processed.push(...adjustments);
        });
        
        processed.sort((a, b) => new Date(a.date) - new Date(b.date));
        return processed;
    }
    
    static getTransactionEntryId(entry) {
        if (!entry) return null;
        if (entry._id) return entry._id.toString();
        if (entry.id) return entry.id.toString();
        if (entry.transactionId) return entry.transactionId;
        return null;
    }
    
    static isRentalAccrualEntry(entry = {}) {
        const source = entry.source || '';
        const metadataType = entry.metadata?.type || '';
        return source === 'rental_accrual' ||
            metadataType === 'monthly_rent_accrual' ||
            metadataType === 'lease_start';
    }
    
    static isAccrualReversal(entry = {}) {
        const source = (entry.source || '').toLowerCase();
        const metadataType = (entry.metadata?.type || '').toLowerCase();
        const transactionType = (entry.metadata?.transactionType || '').toLowerCase();
        const description = (entry.description || '').toLowerCase();
        return source.includes('reversal') ||
            metadataType.includes('reversal') ||
            transactionType.includes('reversal') ||
            description.includes('reversal');
    }
    
    static isNegotiationAdjustmentEntry(entry = {}) {
        const transactionType = (entry.metadata?.transactionType || '').toLowerCase();
        const description = (entry.description || '').toLowerCase();
        return transactionType === 'negotiated_payment_adjustment' ||
            description.includes('negotiated payment') ||
            description.includes('negotiated rent') ||
            description.includes('negotiated discount');
    }
    
    static applyNegotiationAdjustments(accrualEntry, adjustments = []) {
        if (!accrualEntry) {
                    return null;
        }
        
        const mergedEntry = JSON.parse(JSON.stringify(accrualEntry));
        const adjustmentTotals = new Map();
        
        adjustments.forEach(adj => {
            (adj.entries || []).forEach(line => {
                const key = line.accountCode;
                if (!key) return;
                const net = (line.debit || 0) - (line.credit || 0);
                if (net === 0) return;
                
                if (!adjustmentTotals.has(key)) {
                    adjustmentTotals.set(key, {
                        net: 0,
                        accountName: line.accountName,
                        accountType: line.accountType
                    });
                }
                adjustmentTotals.get(key).net += net;
            });
        });
        
        mergedEntry.entries = (mergedEntry.entries || []).map(entry => {
            const adj = adjustmentTotals.get(entry.accountCode);
            if (!adj) {
                return entry;
            }
            
            const updated = { ...entry };
            updated.debit = updated.debit || 0;
            updated.credit = updated.credit || 0;
            
            if (adj.net > 0) {
                const reduce = adj.net;
                if (updated.credit >= reduce) {
                    updated.credit -= reduce;
                } else {
                    const remaining = reduce - updated.credit;
                    updated.credit = 0;
                    updated.debit += remaining;
                }
            } else if (adj.net < 0) {
                const reduce = Math.abs(adj.net);
                if (updated.debit >= reduce) {
                    updated.debit -= reduce;
                } else {
                    const remaining = reduce - updated.debit;
                    updated.debit = 0;
                    updated.credit += remaining;
                }
            }
            
            adjustmentTotals.delete(entry.accountCode);
            return updated;
        });
        
        adjustmentTotals.forEach((adj, accountCode) => {
            mergedEntry.entries.push({
                accountCode,
                accountName: adj.accountName || accountCode,
                accountType: adj.accountType || 'Income',
                debit: adj.net > 0 ? adj.net : 0,
                credit: adj.net < 0 ? Math.abs(adj.net) : 0,
                description: 'Negotiation adjustment (net effect)'
            });
        });
        
        mergedEntry.totalDebit = mergedEntry.entries.reduce((sum, line) => sum + (line.debit || 0), 0);
        mergedEntry.totalCredit = mergedEntry.entries.reduce((sum, line) => sum + (line.credit || 0), 0);
        mergedEntry.metadata = mergedEntry.metadata || {};
        mergedEntry.metadata.negotiatedAdjustmentCount = adjustments.length;
        mergedEntry.metadata.negotiatedDiscountTotal = adjustments.reduce((sum, adj) => {
            return sum + (adj.entries || []).reduce((inner, line) => {
                return inner + (line.debit || 0) - (line.credit || 0);
            }, 0);
        }, 0);
        
        return mergedEntry;
    }

    /**
     * Generate Comprehensive Monthly Income Statement (Profit & Loss by Month)
     * 
     * ACCRUAL BASIS: Shows income/expenses when earned/incurred by month
     * CASH BASIS: Shows income/expenses when cash is received/paid by month
     */
    static async generateComprehensiveMonthlyIncomeStatement(period, basis = 'accrual', residence = null) {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating comprehensive monthly income statement for ${period} using ${basis.toUpperCase()} basis`);
            
            if (basis === 'accrual') {
                console.log('🔵 ACCRUAL BASIS: Including income when earned, expenses when incurred by month');
                
                // Use EXACT same method as account details - query per month
                const monthlyBreakdown = {};
                const monthNames = [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                ];
                const allAccountCodes = ['4001', '4002']; // Rental and Admin income
                
                // Process each month separately (same as account details)
                for (let month = 1; month <= 12; month++) {
                    const monthIndex = month - 1; // 0-based
                    const monthName = monthNames[monthIndex];
                    const startOfMonth = new Date(Date.UTC(parseInt(period), monthIndex, 1, 0, 0, 0, 0));
                    const endOfMonth = new Date(Date.UTC(parseInt(period), monthIndex + 1, 0, 23, 59, 59, 999));
                    
                    console.log(`\n📅 Processing ${monthName} ${period}...`);
                    
                    // Build query EXACTLY like account details
                    const query = {
                        $or: [
                            {
                                date: { $gte: startOfMonth, $lte: endOfMonth },
                                status: 'posted',
                                'entries.accountCode': { $in: allAccountCodes }
                            },
                            {
                                'metadata.accrualMonth': month,
                                'metadata.accrualYear': parseInt(period),
                                status: 'posted',
                                'entries.accountCode': { $in: allAccountCodes }
                            },
                            {
                                'metadata.monthSettled': `${period}-${String(month).padStart(2, '0')}`,
                                status: 'posted',
                                'entries.accountCode': { $in: allAccountCodes }
                            },
                            {
                                source: 'rental_accrual',
                                'metadata.accrualMonth': month,
                                'metadata.accrualYear': parseInt(period),
                                status: 'posted',
                                'entries.accountCode': { $in: allAccountCodes }
                            },
                            {
                                source: 'rental_accrual',
                                'metadata.type': 'lease_start',
                                'metadata.accrualMonth': month,
                                'metadata.accrualYear': parseInt(period),
                                status: 'posted',
                                'entries.accountCode': { $in: allAccountCodes }
                            },
                            {
                                source: 'rental_accrual',
                                description: { $regex: /lease start/i },
                                date: { $gte: startOfMonth, $lte: endOfMonth },
                                status: 'posted',
                                'entries.accountCode': { $in: allAccountCodes }
                            },
                            {
                                source: 'rental_accrual',
                                'metadata.type': 'monthly_rent_accrual',
                                'metadata.accrualMonth': month,
                                'metadata.accrualYear': parseInt(period),
                                status: 'posted',
                                'entries.accountCode': { $in: allAccountCodes }
                            },
                            {
                                'metadata.month': `${period}-${String(month).padStart(2, '0')}`,
                                status: 'posted',
                                'entries.accountCode': { $in: allAccountCodes }
                            },
                            {
                                'metadata.originalAccrualId': { $exists: true },
                                'metadata.accrualMonth': month,
                                'metadata.accrualYear': parseInt(period),
                                status: 'posted',
                                'entries.accountCode': { $in: allAccountCodes }
                            },
                            {
                                source: 'manual',
                                'metadata.accrualMonth': month,
                                'metadata.accrualYear': parseInt(period),
                                status: 'posted',
                                'entries.accountCode': { $in: allAccountCodes }
                            }
                        ]
                    };
                    
                    // Add residence filter if specified (same as account details)
                    if (residence) {
                        // Try both ObjectId and string for residence field
                        const residenceId = mongoose.Types.ObjectId.isValid(residence) 
                            ? new mongoose.Types.ObjectId(residence) 
                            : residence;
                        
                        query.$or = query.$or.map(condition => ({
                            $and: [
                                condition,
                                {
                                    $or: [
                                        { residence: residenceId },
                                        { residence: residence }, // Also try as string
                                        { 'metadata.residenceId': residence },
                                        { 'metadata.residence': residence }
                                    ]
                                }
                            ]
                        }));
                    }
                    
                    // Get transactions for this month
                    const monthTransactions = await TransactionEntry.find(query).lean();
                    console.log(`  Found ${monthTransactions.length} raw transactions for ${monthName}`);
                    
                    // Apply same netting logic as account details
                    const processedTransactions = IncomeStatementController.removeReversalsAndCollapseNegotiations(
                        monthTransactions,
                        '4001'
                    );
                    console.log(`  After netting: ${processedTransactions.length} transactions`);
                    
                    // Calculate revenue (same as account details)
                    let totalRentalIncome = 0;
                    let totalAdminIncome = 0;
                    const revenueByAccount = {};
                    
                    for (const entry of processedTransactions) {
                        if (entry.entries && Array.isArray(entry.entries)) {
                            for (const subEntry of entry.entries) {
                                if (subEntry.accountCode === '4001') {
                                    const amount = (subEntry.credit || 0) - (subEntry.debit || 0);
                                    totalRentalIncome += amount;
                                    revenueByAccount['4001'] = (revenueByAccount['4001'] || 0) + amount;
                                } else if (subEntry.accountCode === '4002') {
                                    const amount = (subEntry.credit || 0) - (subEntry.debit || 0);
                                    totalAdminIncome += amount;
                                    revenueByAccount['4002'] = (revenueByAccount['4002'] || 0) + amount;
                                }
                            }
                        }
                    }
                    
                    const totalRevenue = totalRentalIncome + totalAdminIncome;
                    
                    // Get expenses for this month
                    let expenseQuery = {
                        'entries.accountType': 'Expense',
                        date: { $gte: startOfMonth, $lte: endOfMonth },
                        status: 'posted'
                    };
                    
                    if (residence) {
                        // Try both ObjectId and string for residence field
                        const residenceId = mongoose.Types.ObjectId.isValid(residence) 
                            ? new mongoose.Types.ObjectId(residence) 
                            : residence;
                        
                        expenseQuery = {
                            $and: [
                                {
                                    'entries.accountType': 'Expense',
                                    date: { $gte: startOfMonth, $lte: endOfMonth },
                                    status: 'posted'
                                },
                                {
                                    $or: [
                                        { residence: residenceId },
                                        { residence: residence }, // Also try as string
                                        { 'metadata.residenceId': residence },
                                        { 'metadata.residence': residence }
                                    ]
                                }
                            ]
                        };
                    }
                    
                    const expenseEntries = await TransactionEntry.find(expenseQuery).lean();
                    let totalExpenses = 0;
                    const expensesByAccount = {};
                    
                    for (const entry of expenseEntries) {
                        if (entry.entries && Array.isArray(entry.entries)) {
                            for (const subEntry of entry.entries) {
                                if (subEntry.accountType === 'Expense' && subEntry.debit > 0) {
                                    const amount = subEntry.debit;
                                    totalExpenses += amount;
                                    const key = `${subEntry.accountCode} - ${subEntry.accountName}`;
                                    expensesByAccount[key] = (expensesByAccount[key] || 0) + amount;
                                }
                            }
                        }
                    }
                    
                    const netIncome = totalRevenue - totalExpenses;
                    
                    monthlyBreakdown[monthIndex] = {
                        month: monthName,
                        monthNumber: month,
                        revenue: revenueByAccount,
                        expenses: expensesByAccount,
                        total_revenue: totalRevenue,
                        total_expenses: totalExpenses,
                        net_income: netIncome
                    };
                    
                    console.log(`  ✅ ${monthName}: Revenue $${totalRevenue} (Rental: $${totalRentalIncome}, Admin: $${totalAdminIncome}), Expenses $${totalExpenses}, Net $${netIncome}`);
                }
            
            
            // Calculate year totals
            const yearTotals = {
                total_revenue: monthNames.reduce((sum, month, index) => sum + (monthlyBreakdown[index]?.total_revenue || 0), 0),
                total_expenses: monthNames.reduce((sum, month, index) => sum + (monthlyBreakdown[index]?.total_expenses || 0), 0),
                net_income: monthNames.reduce((sum, month, index) => sum + (monthlyBreakdown[index]?.net_income || 0), 0)
            };
            
            console.log(`\n📊 Year Totals: Revenue $${yearTotals.total_revenue}, Expenses $${yearTotals.total_expenses}, Net $${yearTotals.net_income}`);
                
                return {
                    period,
                    basis,
                    monthly_breakdown: monthlyBreakdown,
                    year_totals: yearTotals,
                    month_names: monthNames,
                    residences_included: true,
                    data_sources: ['TransactionEntry'],
                    accounting_notes: {
                        accrual_basis: "Income/expenses shown when earned/incurred by month",
                        includes_rental_accruals: true,
                        includes_cash_payments: false,
                        source_filter: "Excludes cash receipts (payments)",
                        note: "Based on rental accrual entries from transactionentries collection"
                    }
                };
                
            } else {
                console.log('🟢 CASH BASIS: Including income/expenses when cash received/paid by month');
                
                // For cash basis, group payments and expenses by month
                const paymentQuery = {
                    date: { $gte: startDate, $lte: endDate },
                    source: 'payment',
                    status: 'posted'
                };
                
                const expenseQuery = {
                    date: { $gte: startDate, $lte: endDate },
                    source: { $in: ['expense_payment', 'vendor_payment'] },
                    status: 'posted'
                };
                
                // Add residence filter if specified
                if (residence) {
                    paymentQuery.residence = new mongoose.Types.ObjectId(residence);
                    expenseQuery.residence = new mongoose.Types.ObjectId(residence);
                    console.log(`🔍 Filtering cash basis entries by residence: ${residence}`);
                }
                
                const paymentEntries = await TransactionEntry.find(paymentQuery);
                const expenseEntries = await TransactionEntry.find(expenseQuery);
                
                // Initialize monthly breakdown
                const monthlyBreakdown = {};
                const monthNames = [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                ];
                
                monthNames.forEach((month, index) => {
                    monthlyBreakdown[index] = {
                        month,
                        monthNumber: index + 1,
                        revenue: {},
                        expenses: {},
                total_revenue: 0,
                total_expenses: 0,
                net_income: 0,
                        residences: [],
                        transaction_count: 0
                    };
                });
                
                // Process payment entries by month
                paymentEntries.forEach(entry => {
                    const entryDate = new Date(entry.date);
                    const monthIndex = entryDate.getMonth();
                    
                    if (entry.entries && Array.isArray(entry.entries)) {
                        // For cash basis, look at cash account debits (money received)
                        entry.entries.forEach(lineItem => {
                            // Cash basis: Recognize income when cash is received
                            if (lineItem.accountType === 'Asset' && lineItem.accountCode && lineItem.accountCode.startsWith('10') && lineItem.debit > 0) {
                                // This is cash received - determine revenue category from payment metadata
                                let revenueCategory = 'Other Income';
                                let revenueAccount = '4000';
                                
                                // Check if this is a student payment with components
                                if (entry.metadata && entry.metadata.paymentComponents) {
                                    const components = entry.metadata.paymentComponents;
                                    
                                    if (components.rent && components.rent > 0) {
                                        revenueCategory = 'Rental Income';
                                        revenueAccount = '4001';
                                    } else if (components.admin && components.admin > 0) {
                                        revenueCategory = 'Administrative Income';
                                        revenueAccount = '4002';
                                    } else if (components.deposit && components.deposit > 0) {
                                        revenueCategory = 'Security Deposit';
                                        revenueAccount = '2020';
                                    }
                                }
                                
                                // For cash basis, recognize the full cash amount as income
                                const amount = lineItem.debit;
                                monthlyBreakdown[monthIndex].total_revenue += amount;
                                
                                const key = `${revenueAccount} - ${revenueCategory}`;
                                monthlyBreakdown[monthIndex].revenue[key] = 
                                    (monthlyBreakdown[monthIndex].revenue[key] || 0) + amount;
                                
                                console.log(`💰 Cash basis: Recognized $${amount} as ${revenueCategory} for month ${monthIndex + 1}`);
                            }
                        });
                    }
                    
                    if (entry.residence) {
                        monthlyBreakdown[monthIndex].residences.push(entry.residence.toString());
                    }
                    
                    monthlyBreakdown[monthIndex].transaction_count++;
                });
                
                // Process expense entries by month
                expenseEntries.forEach(entry => {
                    const entryDate = new Date(entry.date);
                    const monthIndex = entryDate.getMonth();
                    
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Expense') {
                                const amount = lineItem.debit || 0;
                                monthlyBreakdown[monthIndex].total_expenses += amount;
                                
                                // Group by account code only to net all transactions for the same account
                                const key = lineItem.accountCode;
                                monthlyBreakdown[monthIndex].expenses[key] = 
                                    (monthlyBreakdown[monthIndex].expenses[key] || 0) + amount;
                            }
                        });
                    }
                    
                    monthlyBreakdown[monthIndex].transaction_count++;
                });
                

                // Calculate net income for each month
                monthNames.forEach((month, index) => {
                    monthlyBreakdown[index].net_income = 
                        monthlyBreakdown[index].total_revenue - monthlyBreakdown[index].total_expenses;
                });
                
                // Calculate year totals
                const yearTotals = {
                    total_revenue: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].total_revenue, 0),
                    total_expenses: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].total_expenses, 0),
                    net_income: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].net_income, 0),
                    total_transactions: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].transaction_count, 0)
                };
            
            return {
                period,
                basis,
                    monthly_breakdown: monthlyBreakdown,
                year_totals: yearTotals,
                month_names: monthNames,
                residences_included: true,
                    data_sources: ['TransactionEntry'],
                    accounting_notes: {
                        accrual_basis: "Income/expenses shown when cash received/paid by month",
                        includes_rental_accruals: false,
                        includes_cash_payments: true,
                        source_filter: "Only cash movements",
                        note: "Based on payment and expense entries from transactionentries collection"
                    }
                };
            }
            
        } catch (error) {
            console.error('Error generating comprehensive monthly income statement:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Income Statement (Profit & Loss by Month)
     */
    static async generateMonthlyIncomeStatement(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating monthly income statement for ${period} from ${startDate} to ${endDate}`);
            
            // Get all transaction entries for the period
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            }).populate('entries');
            
            console.log(`Found ${entries.length} transaction entries for the period`);
            
            // Initialize monthly data structure
            const monthlyData = {
                january: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                february: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                march: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                april: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                may: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                june: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                july: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                august: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                september: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                october: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                november: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                december: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 }
            };
            
            const monthNames = [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'
            ];
            
            // Process each transaction entry
            entries.forEach(entry => {
                const month = entry.date.getMonth(); // 0-11
                const monthName = monthNames[month];
                
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    if (accountType === 'Income' || accountType === 'income') {
                        const key = `${accountCode} - ${accountName}`;
                        if (!monthlyData[monthName].revenue[key]) {
                            monthlyData[monthName].revenue[key] = 0;
                        }
                        monthlyData[monthName].revenue[key] += debit; // Income increases with debit in this system
                        monthlyData[monthName].total_revenue += debit; // Income increases with debit in this system
                    } else if (accountType === 'Expense' || accountType === 'expense') {
                        const key = `${accountCode} - ${accountName}`;
                        if (!monthlyData[monthName].expenses[key]) {
                            monthlyData[monthName].expenses[key] = 0;
                        }
                        monthlyData[monthName].expenses[key] += debit - credit;
                        monthlyData[monthName].total_expenses += debit - credit;
                    }
                });
                
                // Calculate net income for this month
                monthlyData[monthName].net_income = 
                    monthlyData[monthName].total_revenue - monthlyData[monthName].total_expenses;
            });
            
            // Calculate yearly totals
            const yearlyTotals = {
                revenue: {},
                expenses: {},
                total_revenue: 0,
                total_expenses: 0,
                net_income: 0
            };
            
            // Aggregate all months
            monthNames.forEach(monthName => {
                const monthData = monthlyData[monthName];
                
                // Aggregate revenue accounts
                Object.keys(monthData.revenue).forEach(account => {
                    if (!yearlyTotals.revenue[account]) yearlyTotals.revenue[account] = 0;
                    yearlyTotals.revenue[account] += monthData.revenue[account];
                });
                
                // Aggregate expense accounts
                Object.keys(monthData.expenses).forEach(account => {
                    if (!yearlyTotals.expenses[account]) yearlyTotals.expenses[account] = 0;
                    yearlyTotals.expenses[account] += monthData.expenses[account];
                });
                
                yearlyTotals.total_revenue += monthData.total_revenue;
                yearlyTotals.total_expenses += monthData.total_expenses;
            });
            
            yearlyTotals.net_income = yearlyTotals.total_revenue - yearlyTotals.total_expenses;
            
            return {
                period,
                basis,
                monthly_breakdown: monthlyData,
                yearly_totals: {
                    ...yearlyTotals,
                    gross_profit: yearlyTotals.total_revenue,
                    operating_income: yearlyTotals.net_income
                },
                summary: {
                    total_months_with_data: monthNames.filter(month => 
                        monthlyData[month].total_revenue > 0 || monthlyData[month].total_expenses > 0
                    ).length,
                    best_month: monthNames.reduce((best, month) => 
                        monthlyData[month].net_income > monthlyData[best].net_income ? month : best
                    ),
                    worst_month: monthNames.reduce((worst, month) => 
                        monthlyData[month].net_income < monthlyData[worst].net_income ? month : worst
                    ),
                    average_monthly_revenue: yearlyTotals.total_revenue / 12,
                    average_monthly_expenses: yearlyTotals.total_expenses / 12,
                    average_monthly_net_income: yearlyTotals.net_income / 12
                }
            };
            
        } catch (error) {
            console.error('Error generating monthly income statement:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Income Statement (Profit & Loss by Month) with Residence Filtering
     */
    static async generateResidenceFilteredMonthlyIncomeStatement(period, residenceId, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating residence-filtered monthly income statement for ${period}, residence: ${residenceId}`);
            
            // Handle residence parameter - could be ObjectId or residence name
            let actualResidenceId = residenceId;
            let residenceInfo = null;
            
            // Check if residenceId is a valid ObjectId
            if (!mongoose.Types.ObjectId.isValid(residenceId)) {
                // If not a valid ObjectId, treat it as a residence name and look it up
                console.log(`Residence parameter "${residenceId}" is not a valid ObjectId, searching by name...`);
                residenceInfo = await Residence.findOne({ name: { $regex: new RegExp(residenceId, 'i') } });
                
                if (!residenceInfo) {
                    throw new Error(`Residence not found: ${residenceId}`);
                }
                
                actualResidenceId = residenceInfo._id;
                console.log(`Found residence: ${residenceInfo.name} (ID: ${actualResidenceId})`);
            } else {
                // If it's a valid ObjectId, get residence info for logging
                residenceInfo = await Residence.findById(residenceId).select('name');
                if (!residenceInfo) {
                    throw new Error(`Residence not found with ID: ${residenceId}`);
                }
                actualResidenceId = new mongoose.Types.ObjectId(residenceId);
                console.log(`Using residence: ${residenceInfo.name} (ID: ${actualResidenceId})`);
            }
            
            // Get all transaction entries for the period, filtered by residence
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                residence: actualResidenceId // Use actual ObjectId
            }).populate('entries');
            
            console.log(`Found ${entries.length} transaction entries for the period and residence ${residenceId}`);
            
            // Initialize monthly data structure
            const monthlyData = {
                january: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                february: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                march: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                april: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                may: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                june: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                july: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                august: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                september: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                october: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                november: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                december: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 }
            };
            
            const monthNames = [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'
            ];
            
            // Process each transaction entry
            entries.forEach(entry => {
                const month = entry.date.getMonth(); // 0-11
                const monthName = monthNames[month];
                
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    if (accountType === 'Income' || accountType === 'income') {
                        const key = `${accountCode} - ${accountName}`;
                        if (!monthlyData[monthName].revenue[key]) {
                            monthlyData[monthName].revenue[key] = 0;
                        }
                        monthlyData[monthName].revenue[key] += debit; // Income increases with debit in this system
                        monthlyData[monthName].total_revenue += debit; // Income increases with debit in this system
                    } else if (accountType === 'Expense' || accountType === 'expense') {
                        const key = `${accountCode} - ${accountName}`;
                        if (!monthlyData[monthName].expenses[key]) {
                            monthlyData[monthName].expenses[key] = 0;
                        }
                        monthlyData[monthName].expenses[key] += debit - credit;
                        monthlyData[monthName].total_expenses += debit - credit;
                    }
                });
                
                // Calculate net income for this month
                monthlyData[monthName].net_income = 
                    monthlyData[monthName].total_revenue - monthlyData[monthName].total_expenses;
            });
            
            // Calculate yearly totals
            const yearlyTotals = {
                revenue: {},
                expenses: {},
                total_revenue: 0,
                total_expenses: 0,
                net_income: 0
            };
            
            // Aggregate all months
            monthNames.forEach(monthName => {
                const monthData = monthlyData[monthName];
                
                // Aggregate revenue accounts
                Object.keys(monthData.revenue).forEach(account => {
                    if (!yearlyTotals.revenue[account]) yearlyTotals.revenue[account] = 0;
                    yearlyTotals.revenue[account] += monthData.revenue[account];
                });
                
                // Aggregate expense accounts
                Object.keys(monthData.expenses).forEach(account => {
                    if (!yearlyTotals.expenses[account]) yearlyTotals.expenses[account] = 0;
                    yearlyTotals.expenses[account] += monthData.expenses[account];
                });
                
                yearlyTotals.total_revenue += monthData.total_revenue;
                yearlyTotals.total_expenses += monthData.total_expenses;
            });
            
            yearlyTotals.net_income = yearlyTotals.total_revenue - yearlyTotals.total_expenses;
            
            console.log(`Residence: ${residenceInfo?.name}, Yearly Revenue: $${yearlyTotals.total_revenue}, Expenses: $${yearlyTotals.total_expenses}, Net Income: $${yearlyTotals.net_income}`);
            
            return {
                period,
                residence: {
                    id: actualResidenceId,
                    name: residenceInfo?.name || 'Unknown',
                    originalParameter: residenceId
                },
                basis,
                monthly_breakdown: monthlyData,
                yearly_totals: {
                    ...yearlyTotals,
                    gross_profit: yearlyTotals.total_revenue,
                    operating_income: yearlyTotals.net_income
                }
            };
            
        } catch (error) {
            console.error('Error generating residence-filtered monthly income statement:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Expenses Breakdown
     */
    static async generateMonthlyExpenses(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating monthly expenses for ${period} from ${startDate} to ${endDate}`);
            
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            }).populate('entries');
            
            const monthNames = [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'
            ];
            
            // Initialize monthly expense structure
            const monthlyExpenses = {};
            monthNames.forEach(month => {
                monthlyExpenses[month] = {
                    expenses: {},
                    total_expenses: 0,
                    expense_count: 0,
                    categories: {}
                };
            });
            
            // Process expenses by month
            entries.forEach(entry => {
                const month = entry.date.getMonth();
                const monthName = monthNames[month];
                
                entry.entries.forEach(line => {
                    if (line.accountType === 'Expense' || line.accountType === 'expense') {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const amount = line.debit - line.credit;
                        
                        const key = `${accountCode} - ${accountName}`;
                        
                        if (!monthlyExpenses[monthName].expenses[key]) {
                            monthlyExpenses[monthName].expenses[key] = 0;
                        }
                        
                        monthlyExpenses[monthName].expenses[key] += amount;
                        monthlyExpenses[monthName].total_expenses += amount;
                        monthlyExpenses[monthName].expense_count += 1;
                        
                        // Categorize by expense type
                        const category = this.getExpenseCategory(accountCode);
                        if (!monthlyExpenses[monthName].categories[category]) {
                            monthlyExpenses[monthName].categories[category] = 0;
                        }
                        monthlyExpenses[monthName].categories[category] += amount;
                    }
                });
            });
            
            // Calculate yearly totals
            const yearlyTotals = {
                expenses: {},
                categories: {},
                total_expenses: 0,
                total_transactions: 0
            };
            
            monthNames.forEach(monthName => {
                const monthData = monthlyExpenses[monthName];
                
                Object.keys(monthData.expenses).forEach(expense => {
                    if (!yearlyTotals.expenses[expense]) yearlyTotals.expenses[expense] = 0;
                    yearlyTotals.expenses[expense] += monthData.expenses[expense];
                });
                
                Object.keys(monthData.categories).forEach(category => {
                    if (!yearlyTotals.categories[category]) yearlyTotals.categories[category] = 0;
                    yearlyTotals.categories[category] += monthData.categories[category];
                });
                
                yearlyTotals.total_expenses += monthData.total_expenses;
                yearlyTotals.total_transactions += monthData.expense_count;
            });
            
            return {
                period,
                basis,
                monthly_breakdown: monthlyExpenses,
                yearly_totals: yearlyTotals,
                summary: {
                    average_monthly_expenses: yearlyTotals.total_expenses / 12,
                    highest_expense_month: monthNames.reduce((highest, month) => 
                        monthlyExpenses[month].total_expenses > monthlyExpenses[highest].total_expenses ? month : highest
                    ),
                    lowest_expense_month: monthNames.reduce((lowest, month) => 
                        monthlyExpenses[month].total_expenses < monthlyExpenses[lowest].total_expenses ? month : lowest
                    ),
                    top_expense_category: Object.entries(yearlyTotals.categories)
                        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'
                }
            };
            
        } catch (error) {
            console.error('Error generating monthly expenses:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Cash Flow
     */
    static async generateMonthlyCashFlow(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating monthly cash flow for ${period} from ${startDate} to ${endDate}`);
            
            // For cash basis, we need to get transactions with proper date handling
            let entries = [];
            
            if (basis === 'cash') {
                console.log('🔵 CASH BASIS: Using paidDate for accurate cash flow timing');
                
                // Get expense payments using paidDate from Expense collection
                const Expense = require('../models/finance/Expense');
                const paidExpenses = await Expense.find({
                    paidDate: { $gte: startDate, $lte: endDate },
                    paymentStatus: 'Paid'
                }).populate('residence');
                
                // Get payment transactions and update their dates to use actual payment dates
                const paymentQuery = {
                    source: {
                        $in: [
                            'rental_payment',      // When rent is actually received
                            'expense_payment',     // When expenses are actually paid
                            'manual',              // Manual cash transactions
                            'payment_collection',  // Cash payments
                            'bank_transfer',       // Bank transfers
                            'payment',             // Cash payments (rent, deposits, etc.)
                            'advance_payment',     // Advance payments from students
                            'debt_settlement',     // Debt settlement payments
                            'current_payment'      // Current period payments
                        ]
                    },
                    // Exclude forfeiture transactions as they don't involve cash movement
                    'metadata.isForfeiture': { $ne: true }
                };
                
                const paymentEntries = await TransactionEntry.find(paymentQuery).populate('entries');
                
                // Update payment entries to use actual payment dates for cashflow accuracy
                const Payment = require('../models/Payment');
                for (const entry of paymentEntries) {
                    let payment = null;
                    
                    // Try to find payment by sourceId first
                    if (entry.sourceId) {
                        try {
                            payment = await Payment.findById(entry.sourceId);
                        } catch (error) {
                            console.log(`⚠️ Could not find payment by sourceId for entry ${entry._id}:`, error.message);
                        }
                    }
                    
                    // If not found by sourceId, try to find by reference (payment ID)
                    if (!payment && entry.reference) {
                        try {
                            payment = await Payment.findById(entry.reference);
                        } catch (error) {
                            console.log(`⚠️ Could not find payment by reference for entry ${entry._id}:`, error.message);
                        }
                    }
                    
                    // If not found by reference, try to find by metadata.paymentId
                    if (!payment && entry.metadata && entry.metadata.paymentId) {
                        try {
                            payment = await Payment.findById(entry.metadata.paymentId);
                        } catch (error) {
                            console.log(`⚠️ Could not find payment by metadata.paymentId for entry ${entry._id}:`, error.message);
                        }
                    }
                    
                    // If payment found, update the entry date to use the actual payment date
                    if (payment && payment.date) {
                        const originalDate = entry.date;
                        entry.date = new Date(payment.date);
                        console.log(`📅 Updated transaction ${entry._id} date from ${originalDate} to payment date: ${payment.date}`);
                    }
                }
                
                // Filter entries to only include those within the date range after date correction
                const filteredEntries = paymentEntries.filter(entry => {
                    return entry.date >= startDate && entry.date <= endDate;
                });
                
                // Combine and process entries with proper date handling
                entries = [...filteredEntries];
                
                // Add expense entries with paidDate
                for (const expense of paidExpenses) {
                    // Find corresponding transaction entries for this expense
                    const expenseEntries = await TransactionEntry.find({
                        sourceId: expense._id,
                        source: 'expense_payment'
                    }).populate('entries');
                    
                    // Update the date to use paidDate for cashflow accuracy
                    expenseEntries.forEach(entry => {
                        if (expense.paidDate) {
                            entry.date = expense.paidDate;
                        }
                    });
                    
                    entries.push(...expenseEntries);
                }
                
            } else {
                // Accrual basis: include all transactions with original dates (exclude forfeiture transactions - no cash movement)
                console.log('🔵 ACCRUAL BASIS: Including all transactions');
                const query = {
                    date: { $gte: startDate, $lte: endDate },
                    // Exclude forfeiture transactions as they don't involve cash movement
                    'metadata.isForfeiture': { $ne: true }
                };
                entries = await TransactionEntry.find(query).populate('entries');
            }
            
            const monthNames = [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'
            ];
            
            // Initialize monthly cash flow structure with account breakdowns
            const monthlyCashFlow = {};
            monthNames.forEach(month => {
                monthlyCashFlow[month] = {
                    operating_activities: { 
                        inflows: 0, 
                        outflows: 0, 
                        net: 0,
                        breakdown: {} // Account-level breakdown
                    },
                    investing_activities: { 
                        inflows: 0, 
                        outflows: 0, 
                        net: 0,
                        breakdown: {} // Account-level breakdown
                    },
                    financing_activities: { 
                        inflows: 0, 
                        outflows: 0, 
                        net: 0,
                        breakdown: {} // Account-level breakdown
                    },
                    net_cash_flow: 0,
                    opening_balance: 0,
                    closing_balance: 0
                };
            });
            
            // Helper function to get effective date for cashflow reporting
            const getEffectiveDate = (entry) => {
                // For cash basis, prioritize paidDate when available
                if (basis === 'cash' && entry.metadata && entry.metadata.paidDate) {
                    return new Date(entry.metadata.paidDate);
                }
                return entry.date;
            };

            // Process cash flows by month
            entries.forEach(entry => {
                const effectiveDate = getEffectiveDate(entry);
                const month = effectiveDate.getMonth();
                const monthName = monthNames[month];
                
                // Skip if no entries or entries is not an array
                if (!entry.entries || !Array.isArray(entry.entries)) {
                    console.log(`⚠️  Skipping transaction ${entry._id}: no valid entries`);
                    return;
                }
                
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    // For cash basis, we need to show the cash impact of all transactions
                    // The key is that we're already filtering by payment sources above,
                    // so these transactions represent actual cash movements
                    
                    // Skip accrual-only transactions (like rental_accrual) for cash basis
                    if (basis === 'cash' && entry.source === 'rental_accrual') {
                            return;
                    }
                    
                    // Determine activity type and cash flow
                    const activityType = this.getCashFlowActivityType(accountCode, accountType);
                    
                    // Calculate cash flow for cash accounts only
                    const cashFlow = this.calculateCashFlow(accountType, debit, credit, accountCode, accountName);
                    
                    if (activityType === 'operating') {
                        if (cashFlow > 0) {
                            monthlyCashFlow[monthName].operating_activities.inflows += cashFlow;
                            
                            // Determine the appropriate account code based on transaction description
                            let categoryAccountCode = accountCode;
                            let categoryAccountName = accountName;
                            
                            // For cash accounts, determine the actual income/expense category
                            if (accountCode === '1000' && entry.description) {
                                const desc = entry.description.toLowerCase();
                                if (desc.includes('admin') || desc.includes('advance_admin')) {
                                    categoryAccountCode = '4002'; // Administrative Fees
                                    categoryAccountName = 'Administrative Fees';
                                } else if (desc.includes('rent') || desc.includes('rental') || desc.includes('accommodation')) {
                                    categoryAccountCode = '4001'; // Rental Income
                                    categoryAccountName = 'Rental Income';
                                } else if (desc.includes('deposit') || desc.includes('security')) {
                                    categoryAccountCode = '2020'; // Tenant Security Deposits
                                    categoryAccountName = 'Tenant Security Deposits';
                                } else if (desc.includes('advance') || desc.includes('prepayment')) {
                                    categoryAccountCode = '2200'; // Advance Payment Liability
                                    categoryAccountName = 'Advance Payment Liability';
                                } else if (desc.includes('utilities') || desc.includes('electricity') || desc.includes('water')) {
                                    categoryAccountCode = '4004'; // Utilities Income
                                    categoryAccountName = 'Utilities Income';
                                } else if (desc.includes('forfeit') || desc.includes('no-show')) {
                                    categoryAccountCode = '4003'; // Forfeited Deposits Income
                                    categoryAccountName = 'Forfeited Deposits Income';
                                }
                            }
                            
                            // Track account breakdown for inflows - use category account code as primary key
                            const key = `${categoryAccountCode}`;
                            if (!monthlyCashFlow[monthName].operating_activities.breakdown[key]) {
                                monthlyCashFlow[monthName].operating_activities.breakdown[key] = { 
                                    inflows: 0, 
                                    outflows: 0,
                                    accountName: categoryAccountName, // Store the category name for display
                                    accountCode: categoryAccountCode,  // Store the category code for display
                                    transactionDetails: [] // Store individual transaction details
                                };
                            }
                            monthlyCashFlow[monthName].operating_activities.breakdown[key].inflows += cashFlow;
                            
                            // Add transaction detail for drill-down functionality
                            monthlyCashFlow[monthName].operating_activities.breakdown[key].transactionDetails.push({
                                transactionId: entry.transactionId,
                                date: entry.date,
                                amount: cashFlow,
                                description: entry.description,
                                debtorName: line.accountName.includes('-') ? line.accountName.split('-')[1]?.trim() : 'N/A',
                                reference: entry.reference,
                                type: 'inflow'
                            });
                        } else {
                            monthlyCashFlow[monthName].operating_activities.outflows += Math.abs(cashFlow);
                            
                            // Determine the appropriate account code based on transaction description for outflows
                            let categoryAccountCode = accountCode;
                            let categoryAccountName = accountName;
                            
                            // For cash accounts, determine the actual expense category
                            if (accountCode === '1000' && entry.description) {
                                const desc = entry.description.toLowerCase();
                                if (desc.includes('maintenance') || desc.includes('repair') || desc.includes('service')) {
                                    categoryAccountCode = '5001'; // Maintenance Expenses
                                    categoryAccountName = 'Maintenance Expenses';
                                } else if (desc.includes('utilities') || desc.includes('electricity') || desc.includes('water')) {
                                    categoryAccountCode = '5002'; // Utilities Expenses
                                    categoryAccountName = 'Utilities Expenses';
                                } else if (desc.includes('cleaning') || desc.includes('housekeeping')) {
                                    categoryAccountCode = '5003'; // Cleaning Expenses
                                    categoryAccountName = 'Cleaning Expenses';
                                } else if (desc.includes('security') || desc.includes('guard')) {
                                    categoryAccountCode = '5004'; // Security Expenses
                                    categoryAccountName = 'Security Expenses';
                                } else if (desc.includes('management') || desc.includes('admin')) {
                                    categoryAccountCode = '5005'; // Management Expenses
                                    categoryAccountName = 'Management Expenses';
                                } else if (desc.includes('insurance')) {
                                    categoryAccountCode = '5006'; // Insurance Expenses
                                    categoryAccountName = 'Insurance Expenses';
                                } else if (desc.includes('tax')) {
                                    categoryAccountCode = '5007'; // Property Tax Expenses
                                    categoryAccountName = 'Property Tax Expenses';
                                } else if (desc.includes('marketing') || desc.includes('advertising')) {
                                    categoryAccountCode = '5008'; // Marketing Expenses
                                    categoryAccountName = 'Marketing Expenses';
                                } else if (desc.includes('professional') || desc.includes('legal') || desc.includes('consulting')) {
                                    categoryAccountCode = '5009'; // Professional Fees
                                    categoryAccountName = 'Professional Fees';
                                } else if (desc.includes('office') || desc.includes('supplies')) {
                                    categoryAccountCode = '5010'; // Office Expenses
                                    categoryAccountName = 'Office Expenses';
                                }
                            }
                            
                            // Track account breakdown for outflows - use category account code as primary key
                            const key = `${categoryAccountCode}`;
                            if (!monthlyCashFlow[monthName].operating_activities.breakdown[key]) {
                                monthlyCashFlow[monthName].operating_activities.breakdown[key] = { 
                                    inflows: 0, 
                                    outflows: 0,
                                    accountName: categoryAccountName, // Store the category name for display
                                    accountCode: categoryAccountCode,  // Store the category code for display
                                    transactionDetails: [] // Store individual transaction details
                                };
                            }
                            monthlyCashFlow[monthName].operating_activities.breakdown[key].outflows += Math.abs(cashFlow);
                            
                            // Add transaction detail for drill-down functionality
                            monthlyCashFlow[monthName].operating_activities.breakdown[key].transactionDetails.push({
                                transactionId: entry.transactionId,
                                date: entry.date,
                                amount: Math.abs(cashFlow),
                                description: entry.description,
                                debtorName: line.accountName.includes('-') ? line.accountName.split('-')[1]?.trim() : 'N/A',
                                reference: entry.reference,
                                type: 'outflow'
                            });
                        }
                        monthlyCashFlow[monthName].operating_activities.net += cashFlow;
                    } else if (activityType === 'investing') {
                        if (cashFlow > 0) {
                            monthlyCashFlow[monthName].investing_activities.inflows += cashFlow;
                            // Track account breakdown for inflows - use account code as primary key to avoid duplicates
                            const key = `${accountCode}`;
                            if (!monthlyCashFlow[monthName].investing_activities.breakdown[key]) {
                                monthlyCashFlow[monthName].investing_activities.breakdown[key] = { 
                                    inflows: 0, 
                                    outflows: 0,
                                    accountName: accountName // Store the name for display
                                };
                            }
                            monthlyCashFlow[monthName].investing_activities.breakdown[key].inflows += cashFlow;
                        } else {
                            monthlyCashFlow[monthName].investing_activities.outflows += Math.abs(cashFlow);
                            // Track account breakdown for outflows - use account code as primary key to avoid duplicates
                            const key = `${accountCode}`;
                            if (!monthlyCashFlow[monthName].investing_activities.breakdown[key]) {
                                monthlyCashFlow[monthName].investing_activities.breakdown[key] = { 
                                    inflows: 0, 
                                    outflows: 0,
                                    accountName: accountName // Store the name for display
                                };
                            }
                            monthlyCashFlow[monthName].investing_activities.breakdown[key].outflows += Math.abs(cashFlow);
                        }
                        monthlyCashFlow[monthName].investing_activities.net += cashFlow;
                    } else if (activityType === 'financing') {
                        if (cashFlow > 0) {
                            monthlyCashFlow[monthName].financing_activities.inflows += cashFlow;
                            // Track account breakdown for inflows - use account code as primary key to avoid duplicates
                            const key = `${accountCode}`;
                            if (!monthlyCashFlow[monthName].financing_activities.breakdown[key]) {
                                monthlyCashFlow[monthName].financing_activities.breakdown[key] = { 
                                    inflows: 0, 
                                    outflows: 0,
                                    accountName: accountName // Store the name for display
                                };
                            }
                            monthlyCashFlow[monthName].financing_activities.breakdown[key].inflows += cashFlow;
                        } else {
                            monthlyCashFlow[monthName].financing_activities.outflows += Math.abs(cashFlow);
                            // Track account breakdown for outflows - use account code as primary key to avoid duplicates
                            const key = `${accountCode}`;
                            if (!monthlyCashFlow[monthName].financing_activities.breakdown[key]) {
                                monthlyCashFlow[monthName].financing_activities.breakdown[key] = { 
                                    inflows: 0, 
                                    outflows: 0,
                                    accountName: accountName // Store the name for display
                                };
                            }
                            monthlyCashFlow[monthName].financing_activities.breakdown[key].outflows += Math.abs(cashFlow);
                        }
                        monthlyCashFlow[monthName].financing_activities.net += cashFlow;
                    }
                });
                
                // Calculate net cash flow for the month
                const monthData = monthlyCashFlow[monthName];
                monthData.net_cash_flow = 
                    monthData.operating_activities.net + 
                    monthData.investing_activities.net + 
                    monthData.financing_activities.net;
            });
            
            // Calculate running balances
            let runningBalance = 0;
            monthNames.forEach(monthName => {
                monthlyCashFlow[monthName].opening_balance = runningBalance;
                runningBalance += monthlyCashFlow[monthName].net_cash_flow;
                monthlyCashFlow[monthName].closing_balance = runningBalance;
            });
            
            // Calculate yearly totals with account breakdowns
            const yearlyTotals = {
                operating_activities: { 
                    inflows: 0, 
                    outflows: 0, 
                    net: 0,
                    breakdown: {} // Account-level breakdown
                },
                investing_activities: { 
                    inflows: 0, 
                    outflows: 0, 
                    net: 0,
                    breakdown: {} // Account-level breakdown
                },
                financing_activities: { 
                    inflows: 0, 
                    outflows: 0, 
                    net: 0,
                    breakdown: {} // Account-level breakdown
                },
                net_cash_flow: 0
            };
            
            monthNames.forEach(monthName => {
                const monthData = monthlyCashFlow[monthName];
                
                // Aggregate operating activities
                yearlyTotals.operating_activities.inflows += monthData.operating_activities.inflows;
                yearlyTotals.operating_activities.outflows += monthData.operating_activities.outflows;
                yearlyTotals.operating_activities.net += monthData.operating_activities.net;
                
                // Aggregate operating account breakdowns
                Object.entries(monthData.operating_activities.breakdown).forEach(([account, amounts]) => {
                    if (!yearlyTotals.operating_activities.breakdown[account]) {
                        yearlyTotals.operating_activities.breakdown[account] = { 
                            inflows: 0, 
                            outflows: 0,
                            accountName: amounts.accountName, // Preserve account name
                            accountCode: amounts.accountCode,  // Preserve account code
                            transactionDetails: [] // Initialize transaction details array
                        };
                    }
                    yearlyTotals.operating_activities.breakdown[account].inflows += amounts.inflows;
                    yearlyTotals.operating_activities.breakdown[account].outflows += amounts.outflows;
                    
                    // Aggregate transaction details
                    if (amounts.transactionDetails) {
                        yearlyTotals.operating_activities.breakdown[account].transactionDetails.push(...amounts.transactionDetails);
                    }
                });
                
                // Aggregate investing activities
                yearlyTotals.investing_activities.inflows += monthData.investing_activities.inflows;
                yearlyTotals.investing_activities.outflows += monthData.investing_activities.outflows;
                yearlyTotals.investing_activities.net += monthData.investing_activities.net;
                
                // Aggregate investing account breakdowns
                Object.entries(monthData.investing_activities.breakdown).forEach(([account, amounts]) => {
                    if (!yearlyTotals.investing_activities.breakdown[account]) {
                        yearlyTotals.investing_activities.breakdown[account] = { 
                            inflows: 0, 
                            outflows: 0,
                            accountName: amounts.accountName, // Preserve account name
                            accountCode: amounts.accountCode  // Preserve account code
                        };
                    }
                    yearlyTotals.investing_activities.breakdown[account].inflows += amounts.inflows;
                    yearlyTotals.investing_activities.breakdown[account].outflows += amounts.outflows;
                });
                
                // Aggregate financing activities
                yearlyTotals.financing_activities.inflows += monthData.financing_activities.inflows;
                yearlyTotals.financing_activities.outflows += monthData.financing_activities.outflows;
                yearlyTotals.financing_activities.net += monthData.financing_activities.net;
                
                // Aggregate financing account breakdowns
                Object.entries(monthData.financing_activities.breakdown).forEach(([account, amounts]) => {
                    if (!yearlyTotals.financing_activities.breakdown[account]) {
                        yearlyTotals.financing_activities.breakdown[account] = { 
                            inflows: 0, 
                            outflows: 0,
                            accountName: amounts.accountName, // Preserve account name
                            accountCode: amounts.accountCode  // Preserve account code
                        };
                    }
                    yearlyTotals.financing_activities.breakdown[account].inflows += amounts.inflows;
                    yearlyTotals.financing_activities.breakdown[account].outflows += amounts.outflows;
                });
                
                yearlyTotals.net_cash_flow += monthData.net_cash_flow;
            });
            
            return {
                period,
                basis,
                monthly_breakdown: monthlyCashFlow,
                yearly_totals: yearlyTotals,
                summary: {
                    best_cash_flow_month: monthNames.reduce((best, month) => 
                        monthlyCashFlow[month].net_cash_flow > monthlyCashFlow[best].net_cash_flow ? month : best
                    ),
                    worst_cash_flow_month: monthNames.reduce((worst, month) => 
                        monthlyCashFlow[month].net_cash_flow < monthlyCashFlow[worst].net_cash_flow ? month : worst
                    ),
                    average_monthly_cash_flow: yearlyTotals.net_cash_flow / 12,
                    ending_cash_balance: runningBalance
                }
            };
            
        } catch (error) {
            console.error('Error generating monthly cash flow:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Balance Sheet
     */
    static async generateMonthlyBalanceSheet(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating monthly balance sheet for ${period} from ${startDate} to ${endDate}`);
            
            const monthNames = [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'
            ];
            
            // Initialize monthly balance sheet structure
            const monthlyBalanceSheet = {};
            monthNames.forEach(month => {
                monthlyBalanceSheet[month] = {
                    assets: { current: {}, non_current: {}, total: 0 },
                    liabilities: { current: {}, non_current: {}, total: 0 },
                    equity: { total: 0 },
                    total_assets: 0,
                    total_liabilities: 0,
                    net_worth: 0
                };
            });
            
            // Calculate balance sheet for each month end
            for (let i = 0; i < monthNames.length; i++) {
                const monthName = monthNames[i];
                const monthEndDate = new Date(`${period}-${String(i + 1).padStart(2, '0')}-${new Date(period, i + 1, 0).getDate()}`);
                
                // Get all transactions up to month end, but use monthSettled for payments
                const monthKey = `${period}-${String(i + 1).padStart(2, '0')}`;
                
                // For balance sheet, we need to include:
                // 1. All accruals up to month end (these create the obligations)
                // 2. All payments with monthSettled <= current month (these settle the obligations)
                // 3. All other transactions up to month end (non-payment transactions)
                
                const accrualQuery = {
                    source: 'rental_accrual',
                    date: { $lte: monthEndDate },
                    status: 'posted'
                };
                
                const paymentQuery = {
                    source: { $in: ['payment', 'expense_payment', 'vendor_payment'] },
                    $or: [
                        { 'metadata.monthSettled': { $lte: monthKey } }, // For rental payments
                        { date: { $lte: monthEndDate } } // For expense payments (use transaction date)
                    ],
                    status: 'posted'
                };
                
                const otherQuery = {
                    source: { $nin: ['rental_accrual', 'payment', 'expense_payment', 'vendor_payment'] },
                    date: { $lte: monthEndDate },
                    status: 'posted'
                };
                
                // Get all relevant transactions
                const [accrualEntries, paymentEntries, otherEntries] = await Promise.all([
                    TransactionEntry.find(accrualQuery).populate('entries'),
                    TransactionEntry.find(paymentQuery).populate('entries'),
                    TransactionEntry.find(otherQuery).populate('entries')
                ]);
                
                const entries = [...accrualEntries, ...paymentEntries, ...otherEntries];
                
                // Calculate account balances
                const accountBalances = {};
                
                entries.forEach(entry => {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        const key = `${accountCode} - ${accountName}`;
                        if (!accountBalances[key]) {
                            accountBalances[key] = {
                                code: accountCode,
                                name: accountName,
                                type: accountType,
                                balance: 0,
                                debit_total: 0,
                                credit_total: 0
                            };
                        }
                        
                        // Track totals
                        accountBalances[key].debit_total += debit;
                        accountBalances[key].credit_total += credit;
                        
                        // Calculate balance based on account type
                        if (accountType === 'Asset' || accountType === 'Expense') {
                            accountBalances[key].balance += debit - credit;
                        } else {
                            accountBalances[key].balance += credit - debit;
                        }
                    });
                });
                
                // 🆕 FIX: Calculate monthSettled-based balances from the already filtered transactions
                try {
                    // Calculate AR balance from the filtered transactions
                    let arDebits = 0;
                    let arCredits = 0;
                    let cashByMonth = 0;
                    let depositsTotal = 0;
                    let deferredTotal = 0;
                    
                    // Process accrual entries (AR debits, deposits, deferred income)
                    accrualEntries.forEach(tx => {
                        tx.entries.forEach(line => {
                            if (line.accountCode && (line.accountCode.startsWith('1100-') || line.accountCode === '1100')) {
                                arDebits += Number(line.debit || 0);
                            } else if (line.accountCode && line.accountCode.startsWith('2020')) {
                                // Deposit accounts - include if transaction date is within month
                                depositsTotal += (line.credit || 0) - (line.debit || 0);
                            } else if (line.accountCode && line.accountCode.startsWith('2200')) {
                                // Deferred income accounts (Advance Payment Liability) from accruals
                                // Include all transactions up to month end (cumulative)
                                deferredTotal += (line.credit || 0) - (line.debit || 0);
                            }
                        });
                    });
                    
                    // Process payment entries (AR credits, cash, deposits, deferred)
                    paymentEntries.forEach(tx => {
                        const isAdvancePayment = tx.source === 'advance_payment';
                        let txDate = null;
                        let txMonthKey = null;
                        
                        if (isAdvancePayment) {
                            txDate = new Date(tx.date);
                            txMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                        }
                        
                        tx.entries.forEach(line => {
                            if (line.accountCode && (line.accountCode.startsWith('1100-') || line.accountCode === '1100')) {
                                arCredits += Number(line.credit || 0);
                            } else if (line.accountCode && line.accountCode.match(/^100[0-9]/)) {
                                // Cash accounts - for advance payments, use transaction date; for others, use monthSettled
                                if (isAdvancePayment) {
                                    // For advance payments, use transaction date to determine which month they belong to
                                    if (txMonthKey === monthKey) {
                                        cashByMonth += Number(line.debit || 0) - Number(line.credit || 0);
                                    }
                                } else if (tx.metadata?.monthSettled === monthKey) {
                                    cashByMonth += Number(line.debit || 0) - Number(line.credit || 0);
                                }
                            } else if (line.accountCode && line.accountCode.startsWith('2020')) {
                                // Deposit accounts - include if transaction date is within month
                                depositsTotal += (line.credit || 0) - (line.debit || 0);
                            } else if (line.accountCode && line.accountCode.startsWith('2200')) {
                                // Deferred income accounts (Advance Payment Liability)
                                // For advance payments, use transaction date; for others, include all up to month end
                                if (isAdvancePayment) {
                                    // Only include if transaction month matches current month
                                    if (txMonthKey === monthKey) {
                                deferredTotal += (line.credit || 0) - (line.debit || 0);
                                    }
                                } else {
                                    // For non-advance payments, include all (they're already filtered by date)
                                    deferredTotal += (line.credit || 0) - (line.debit || 0);
                                }
                            }
                        });
                    });
                    
                    // Also process other entries (advance_payment source transactions)
                    // This is where advance payments typically appear (not in paymentEntries)
                    const advancePaymentsInOther = otherEntries.filter(tx => tx.source === 'advance_payment');
                    console.log(`💳 Found ${advancePaymentsInOther.length} advance payment transactions in otherEntries for ${monthName} ${period}`);
                    
                    otherEntries.forEach(tx => {
                        const isAdvancePayment = tx.source === 'advance_payment';
                        let txDate = null;
                        let txMonthKey = null;
                        
                        if (isAdvancePayment) {
                            txDate = new Date(tx.date);
                            txMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                            console.log(`💳 Processing advance payment: ${tx.transactionId}, date: ${txDate.toISOString()}, txMonthKey: ${txMonthKey}, monthKey: ${monthKey}, match: ${txMonthKey === monthKey}`);
                        }
                        
                        tx.entries.forEach(line => {
                            if (line.accountCode && line.accountCode.startsWith('2200')) {
                                // Deferred income accounts (Advance Payment Liability) from other sources
                                // For advance payments, use transaction date; for others, include all up to month end
                                if (isAdvancePayment) {
                                    // Only include if transaction month matches current month
                                    if (txMonthKey === monthKey) {
                                        const amount = (line.credit || 0) - (line.debit || 0);
                                        deferredTotal += amount;
                                        console.log(`💳 Adding advance payment deferred income: ${tx.transactionId}, account: ${line.accountCode}, amount: ${amount}, new total: ${deferredTotal}`);
                                    } else {
                                        console.log(`💳 Skipping advance payment deferred income: ${tx.transactionId}, account: ${line.accountCode}, txMonthKey: ${txMonthKey}, monthKey: ${monthKey}, no match`);
                                    }
                                } else {
                                    // For non-advance payments, include all (they're already filtered by date)
                                deferredTotal += (line.credit || 0) - (line.debit || 0);
                                }
                            } else if (line.accountCode && line.accountCode.match(/^100[0-9]/) || line.accountCode === '1000') {
                                // Cash accounts - for advance payments, use transaction date
                                if (isAdvancePayment) {
                                    if (txMonthKey === monthKey) {
                                        const amount = Number(line.debit || 0) - Number(line.credit || 0);
                                        cashByMonth += amount;
                                        console.log(`💳 Adding advance payment cash: ${tx.transactionId}, account: ${line.accountCode}, amount: ${amount}, new total: ${cashByMonth}`);
                                    } else {
                                        console.log(`💳 Skipping advance payment cash: ${tx.transactionId}, account: ${line.accountCode}, txMonthKey: ${txMonthKey}, monthKey: ${monthKey}, no match`);
                                    }
                                }
                            }
                        });
                    });
                    
                    console.log(`💳 Summary for ${monthName} ${period}: deferredTotal=${deferredTotal}, cashByMonth=${cashByMonth}, advancePaymentsFound=${advancePaymentsInOther.length}`);
                    
                    const arByMonthOutstanding = arDebits - arCredits;
                } catch (error) {
                    console.error('Error reclassifying by monthSettled:', error.message);
                    // Fallback to cumulative balances
                    const sumBy = (predicate) => Object.values(accountBalances)
                        .filter(a => predicate(a))
                        .reduce((sum, a) => sum + (a.balance || 0), 0);
                    arByMonthOutstanding = sumBy(a => a.code && a.code.startsWith('1100'));
                    depositsTotal = sumBy(a => a.code && a.code.startsWith('2020'));
                    deferredTotal = sumBy(a => a.code && a.code.startsWith('2200'));
                }
                
                // Organize by balance sheet sections with monthSettled overrides
                Object.values(accountBalances).forEach(account => {
                    if (account.accountType === 'Asset' || account.accountType === 'asset') {
                        const isCurrent = this.isCurrentAsset(account.accountName);
                        const section = isCurrent ? 'current' : 'non_current';
                        
                        if (!monthlyBalanceSheet[monthName].assets[section][account.accountName]) {
                            monthlyBalanceSheet[monthName].assets[section][account.accountName] = 0;
                        }
                        
                        // 🆕 FIX: Override cash accounts with monthSettled-based calculation
                        if (account.code && account.code.match(/^100[0-9]/)) {
                            monthlyBalanceSheet[monthName].assets[section][account.accountName] = cashByMonth;
                        } else {
                            monthlyBalanceSheet[monthName].assets[section][account.accountName] = account.balance;
                        }
                        monthlyBalanceSheet[monthName].assets.total += monthlyBalanceSheet[monthName].assets[section][account.accountName];
                    } else if (account.accountType === 'Liability' || account.accountType === 'liability') {
                        const isCurrent = this.isCurrentLiability(account.accountName);
                        const section = isCurrent ? 'current' : 'non_current';
                        
                        if (!monthlyBalanceSheet[monthName].liabilities[section][account.accountName]) {
                            monthlyBalanceSheet[monthName].liabilities[section][account.accountName] = 0;
                        }
                        
                        // 🆕 FIX: Override deferred income accounts (2200) with monthSettled calculation
                        if (account.code && account.code.startsWith('2200')) {
                            let finalDeferredTotal = deferredTotal;
                            
                            // Safeguard: If deferredTotal is 0 but we found advance payments for this month, recalculate
                            // This catches cases where the calculation didn't work correctly
                            if (deferredTotal === 0) {
                                const advancePaymentsInMonth = otherEntries.filter(tx => {
                                    if (tx.source !== 'advance_payment') return false;
                                    const txDate = new Date(tx.date);
                                    const txMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                                    return txMonthKey === monthKey;
                                });
                                
                                if (advancePaymentsInMonth.length > 0) {
                                    console.log(`⚠️ WARNING: deferredTotal is 0 but found ${advancePaymentsInMonth.length} advance payments for ${monthName} ${period}. Recalculating...`);
                                    let recalculated = 0;
                                    advancePaymentsInMonth.forEach(tx => {
                                        console.log(`   Checking advance payment: ${tx.transactionId}, date: ${tx.date}`);
                                        tx.entries.forEach(line => {
                                            if (line.accountCode && line.accountCode.startsWith('2200')) {
                                                const amount = (line.credit || 0) - (line.debit || 0);
                                                recalculated += amount;
                                                console.log(`     Found 2200 entry: credit=${line.credit}, debit=${line.debit}, amount=${amount}, new total=${recalculated}`);
                                            }
                                        });
                                    });
                                    if (recalculated > 0) {
                                        console.log(`💳 Fixing deferred income: using recalculated value ${recalculated} instead of 0`);
                                        finalDeferredTotal = recalculated;
                                    } else {
                                        console.log(`⚠️ Recalculated deferred income is still 0 for ${monthName} ${period}. Check if advance payments have 2200 account entries.`);
                                    }
                                }
                            }
                            
                            console.log(`💳 Overriding deferred income (${account.code}) balance: ${finalDeferredTotal} (was: ${account.balance}) for ${monthName} ${period}`);
                            monthlyBalanceSheet[monthName].liabilities[section][account.accountName] = finalDeferredTotal;
                        } else {
                        monthlyBalanceSheet[monthName].liabilities[section][account.accountName] = account.balance;
                        }
                        monthlyBalanceSheet[monthName].liabilities.total += monthlyBalanceSheet[monthName].liabilities[section][account.accountName];
                    } else if (account.accountType === 'Equity' || account.accountType === 'equity') {
                        monthlyBalanceSheet[monthName].equity[account.accountName] = account.balance;
                        monthlyBalanceSheet[monthName].equity.total += account.balance;
                    }
                });

                // 🆕 FIX: Aggregate Accounts Payable with child accounts (robust database query)
                let accountsPayableTotal = 0;
                const apMainAccount = Object.values(accountBalances).find(acc => acc.code === '2000');
                if (apMainAccount) {
                    // Start with main account balance
                    accountsPayableTotal = apMainAccount.balance;
                    
                    try {
                        // Get all child accounts from database (same logic as other services)
                        const Account = require('../models/Account');
                        const mainAPAccount = await Account.findOne({ code: '2000' });
                        
                        if (mainAPAccount) {
                            console.log(`🔍 Found AP parent account 2000 with _id: ${mainAPAccount._id} (type: ${typeof mainAPAccount._id})`);
                            
                            // Get all child accounts of 2000 (handle both string and ObjectId)
                            const apChildAccounts = await Account.find({
                                $or: [
                                    { parentAccount: mainAPAccount._id },
                                    { parentAccount: mainAPAccount._id.toString() },
                                    { mainAPAccountCode: '2000' },
                                    { parent: '2000' }
                                ],
                                isActive: true
                            });

                            // Also include accounts that start with 200 but aren't 2000
                            const apSeriesAccounts = await Account.find({
                                code: { $regex: /^200(?!0$)/ }, // starts with 200 but not exactly 2000
                                type: 'Liability',
                                isActive: true
                            });

                            // Merge and remove duplicates by code
                            const allAPChildrenMap = new Map();
                            [...apChildAccounts, ...apSeriesAccounts].forEach(acc => {
                                allAPChildrenMap.set(acc.code, acc);
                            });
                            const allAPChildren = Array.from(allAPChildrenMap.values());

                            console.log(`🔗 Found ${allAPChildren.length} Accounts Payable child accounts for parent 2000:`);

                            // Aggregate child account balances into parent
                            let childTotal = 0;
                            allAPChildren.forEach(childAccount => {
                                // Check if child account has a balance in accountBalances
                                const childBalance = Object.values(accountBalances).find(acc => acc.code === childAccount.code);
                                if (childBalance && childAccount.code !== '2000') {
                                    accountsPayableTotal += childBalance.balance;
                                    childTotal += childBalance.balance;
                                    console.log(`   ↳ Aggregating ${childAccount.code} (${childAccount.name}): $${childBalance.balance.toFixed(2)}`);
                                }
                            });
                            
                            console.log(`📊 AP Aggregation for ${monthName}: Main $${apMainAccount.balance.toFixed(2)} + Children $${childTotal.toFixed(2)} = Total $${accountsPayableTotal.toFixed(2)}`);
                        }
                    } catch (error) {
                        console.error('❌ Error in AP aggregation:', error);
                        // Fallback to original logic if database query fails
                        const apChildAccounts = Object.values(accountBalances).filter(acc => 
                            acc.code && acc.code.match(/^200(?!0$)/) && acc.type === 'Liability'
                        );
                        
                        let childTotal = 0;
                        apChildAccounts.forEach(child => {
                            accountsPayableTotal += child.balance;
                            childTotal += child.balance;
                            console.log(`   ↳ Fallback aggregating ${child.code} (${child.name}): $${child.balance.toFixed(2)}`);
                        });
                        
                        console.log(`📊 AP Fallback Aggregation for ${monthName}: Main $${apMainAccount.balance.toFixed(2)} + Children $${childTotal.toFixed(2)} = Total $${accountsPayableTotal.toFixed(2)}`);
                    }
                }

                // Override standardized lines with monthSettled rollups
                if (!monthlyBalanceSheet[monthName].assets.current) monthlyBalanceSheet[monthName].assets.current = {};
                if (!monthlyBalanceSheet[monthName].liabilities.current) monthlyBalanceSheet[monthName].liabilities.current = {};
                monthlyBalanceSheet[monthName].assets.current['Accounts Receivable - Tenants (1100)'] = arByMonthOutstanding;
                monthlyBalanceSheet[monthName].liabilities.current['Tenant Deposits Held (2020)'] = depositsTotal;
                monthlyBalanceSheet[monthName].liabilities.current['Deferred Income - Tenant Advances (2200)'] = deferredTotal;
                
                // Debug logging for account 2200
                if (monthName.toLowerCase() === 'october' || monthKey === '2025-10') {
                    console.log(`📊 Account 2200 (Advance Payment Liability) for ${monthName} ${period}:`, {
                        deferredTotal: deferredTotal,
                        monthKey: monthKey,
                        monthEndDate: monthEndDate.toISOString(),
                        totalEntries: entries.length,
                        accrualEntries: accrualEntries.length,
                        paymentEntries: paymentEntries.length,
                        otherEntries: otherEntries.length,
                        accountBalance: Object.values(accountBalances).find(acc => acc.code === '2200')?.balance || 0
                    });
                }
                
                // 🆕 FIX: Override Accounts Payable with aggregated total
                monthlyBalanceSheet[monthName].liabilities.current['Accounts Payable (2000)'] = accountsPayableTotal;
                
                // 🆕 FIX: Recalculate total liabilities with aggregated AP
                const originalAPBalance = Object.values(accountBalances).find(acc => acc.code === '2000')?.balance || 0;
                const apChildBalances = Object.values(accountBalances).filter(acc => 
                    acc.code && acc.code.startsWith('2000') && acc.code !== '2000'
                ).reduce((sum, child) => sum + child.balance, 0);
                const apAdjustment = accountsPayableTotal - originalAPBalance;
                
                // Adjust total liabilities to account for AP aggregation
                monthlyBalanceSheet[monthName].liabilities.total += apAdjustment;
                
                console.log(`📊 AP Total Adjustment for ${monthName}: Original $${originalAPBalance} + Children $${apChildBalances} = New Total $${accountsPayableTotal}, Adjustment: $${apAdjustment}`);

                // Calculate net worth
                monthlyBalanceSheet[monthName].total_assets = monthlyBalanceSheet[monthName].assets.total;
                monthlyBalanceSheet[monthName].total_liabilities = monthlyBalanceSheet[monthName].liabilities.total;
                monthlyBalanceSheet[monthName].net_worth = 
                    monthlyBalanceSheet[monthName].total_assets - monthlyBalanceSheet[monthName].total_liabilities;
            }
            
            // Calculate yearly summary
            const yearlySummary = {
                average_total_assets: 0,
                average_total_liabilities: 0,
                average_net_worth: 0,
                highest_net_worth_month: '',
                lowest_net_worth_month: '',
                net_worth_growth: 0
            };
            
            let totalAssets = 0, totalLiabilities = 0, totalNetWorth = 0;
            let highestNetWorth = -Infinity, lowestNetWorth = Infinity;
            
            monthNames.forEach(monthName => {
                const monthData = monthlyBalanceSheet[monthName];
                
                totalAssets += monthData.total_assets;
                totalLiabilities += monthData.total_liabilities;
                totalNetWorth += monthData.net_worth;
                
                if (monthData.net_worth > highestNetWorth) {
                    highestNetWorth = monthData.net_worth;
                    yearlySummary.highest_net_worth_month = monthName;
                }
                
                if (monthData.net_worth < lowestNetWorth) {
                    lowestNetWorth = monthData.net_worth;
                    yearlySummary.lowest_net_worth_month = monthName;
                }
            });
            
            yearlySummary.average_total_assets = totalAssets / 12;
            yearlySummary.average_total_liabilities = totalLiabilities / 12;
            yearlySummary.average_net_worth = totalNetWorth / 12;
            
            // Calculate net worth growth (first month to last month)
            const firstMonth = monthlyBalanceSheet[monthNames[0]];
            const lastMonth = monthlyBalanceSheet[monthNames[monthNames.length - 1]];
            yearlySummary.net_worth_growth = lastMonth.net_worth - firstMonth.net_worth;
            
            return {
                period,
                basis,
                monthly_breakdown: monthlyBalanceSheet,
                yearly_summary: yearlySummary
            };
            
        } catch (error) {
            console.error('Error generating monthly balance sheet:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Trial Balance
     */
    static async generateMonthlyTrialBalance(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating monthly trial balance for ${period} from ${startDate} to ${endDate}`);
            
            const monthNames = [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'
            ];
            
            // Initialize monthly trial balance structure
            const monthlyTrialBalance = {};
            monthNames.forEach(month => {
                monthlyTrialBalance[month] = {
                    accounts: {},
                    total_debits: 0,
                    total_credits: 0,
                    balance: 0
                };
            });
            
            // Calculate trial balance for each month end
            for (let i = 0; i < monthNames.length; i++) {
                const monthName = monthNames[i];
                const monthEndDate = new Date(`${period}-${String(i + 1).padStart(2, '0')}-${new Date(period, i + 1, 0).getDate()}`);
                
                // Get all transactions up to month end
                const entries = await TransactionEntry.find({
                    date: { $lte: monthEndDate }
                }).populate('entries');
                
                // Calculate account balances
                const accountBalances = {};
                
                entries.forEach(entry => {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        const key = `${accountCode} - ${accountName}`;
                        if (!accountBalances[key]) {
                            accountBalances[key] = {
                                accountCode,
                                accountName,
                                accountType,
                                debit: 0,
                                credit: 0,
                                balance: 0
                            };
                        }
                        
                        accountBalances[key].debit += debit;
                        accountBalances[key].credit += credit;
                        
                        // Calculate balance based on account type
                        if (accountType === 'Asset' || accountType === 'asset') {
                            accountBalances[key].balance += debit - credit;
                        } else if (accountType === 'Liability' || accountType === 'liability') {
                            accountBalances[key].balance += credit - debit;
                        } else if (accountType === 'Equity' || accountType === 'equity') {
                            accountBalances[key].balance += credit - debit;
                        } else if (accountType === 'Income' || accountType === 'income') {
                            accountBalances[key].balance += credit - debit;
                        } else if (accountType === 'Expense' || accountType === 'expense') {
                            accountBalances[key].balance += debit - credit;
                        }
                    });
                });
                
                // Add accounts to monthly trial balance
                Object.values(accountBalances).forEach(account => {
                    monthlyTrialBalance[monthName].accounts[account.accountName] = {
                        accountCode: account.accountCode,
                        accountType: account.accountType,
                        debit: account.debit,
                        credit: account.credit,
                        balance: account.balance
                    };
                    
                    monthlyTrialBalance[monthName].total_debits += account.debit;
                    monthlyTrialBalance[monthName].total_credits += account.credit;
                });
                
                // Calculate balance (should be 0 if balanced)
                monthlyTrialBalance[monthName].balance = 
                    monthlyTrialBalance[monthName].total_debits - monthlyTrialBalance[monthName].total_credits;
            }
            
            // Calculate yearly summary
            const yearlySummary = {
                average_total_debits: 0,
                average_total_credits: 0,
                average_balance: 0,
                balanced_months: 0,
                unbalanced_months: 0
            };
            
            let totalDebits = 0, totalCredits = 0, totalBalance = 0;
            let balancedMonths = 0;
            
            monthNames.forEach(monthName => {
                const monthData = monthlyTrialBalance[monthName];
                
                totalDebits += monthData.total_debits;
                totalCredits += monthData.total_credits;
                totalBalance += Math.abs(monthData.balance);
                
                if (Math.abs(monthData.balance) < 0.01) { // Consider balanced if difference is less than 1 cent
                    balancedMonths += 1;
                }
            });
            
            yearlySummary.average_total_debits = totalDebits / 12;
            yearlySummary.average_total_credits = totalCredits / 12;
            yearlySummary.average_balance = totalBalance / 12;
            yearlySummary.balanced_months = balancedMonths;
            yearlySummary.unbalanced_months = 12 - balancedMonths;
            
            return {
                period,
                basis,
                monthly_breakdown: monthlyTrialBalance,
                yearly_summary: yearlySummary
            };
            
        } catch (error) {
            console.error('Error generating monthly trial balance:', error);
            throw error;
        }
    }
    
    /**
     * Generate Balance Sheet - FIXED VERSION
     * Now includes ALL accounts from chart of accounts, even with zero balances
     */
    static async generateBalanceSheet(asOf, basis = 'cash') {
        try {
            // Parse date string - handle both ISO strings and date strings
            // If it's just a date string like "2025-10-31", parse it as UTC to avoid timezone issues
            let asOfDate;
            if (typeof asOf === 'string' && asOf.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // Date string without time - parse as UTC midnight
                asOfDate = new Date(asOf + 'T00:00:00.000Z');
            } else {
                asOfDate = new Date(asOf);
            }
            
            console.log(`🔧 Generating FIXED balance sheet as of ${asOfDate.toISOString()} (from input: ${asOf})`);
            
            // Get ALL accounts from chart of accounts
            const Account = require('../models/Account');
            const allAccounts = await Account.find({ isActive: true }).sort({ code: 1 });
            console.log(`📋 Found ${allAccounts.length} active accounts in chart of accounts`);
            
            // Get all transaction entries up to the specified date
            // Use same simple logic as filtered version - no special filtering
            const entries = await TransactionEntry.find({
                date: { $lte: asOfDate },
                status: 'posted',
                voided: { $ne: true }
            });
            
            console.log(`📋 Found ${entries.length} transaction entries up to ${asOfDate.toISOString()}`);
            
            // Calculate account balances (same logic as filtered version - was working correctly)
            let accountBalances = {};
            
            entries.forEach(entry => {
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        const key = `${accountCode} - ${accountName}`;
                        if (!accountBalances[key]) {
                            accountBalances[key] = {
                                code: accountCode,
                                name: accountName,
                                type: accountType,
                                balance: 0,
                                debit_total: 0,
                                credit_total: 0
                            };
                        }
                        
                        accountBalances[key].debit_total += debit;
                        accountBalances[key].credit_total += credit;
                        
                            if (accountType === 'Asset' || accountType === 'Expense') {
                            accountBalances[key].balance += debit - credit;
                            } else {
                            accountBalances[key].balance += credit - debit;
                        }
                    });
                }
            });
            
            // Aggregate parent-child accounts (specifically to ensure AP uses children totals)
            try {
                accountBalances = await this.aggregateParentChildAccounts(accountBalances, allAccounts);
                console.log('✅ Aggregated parent-child accounts for unfiltered balance sheet');
            } catch (aggError) {
                console.error('⚠️ Error aggregating parent-child accounts for unfiltered balance sheet:', aggError.message);
            }
            
            // Group by account type with proper current/non-current asset separation
            const assets = {
                current_assets: {},
                non_current_assets: {}
            };
            const liabilities = {};
            const equity = {};
            const income = {};
            const expenses = {};
            
            // Import BalanceSheetService to use isCurrentAsset function
            const BalanceSheetService = require('./balanceSheetService');
            
            // Pre-set aggregated Accounts Payable (2000) before looping to avoid overwrites
            const apAggregatedKey = Object.keys(accountBalances).find(key => key.startsWith('2000 -'));
            if (apAggregatedKey) {
                const apAggregatedAccount = accountBalances[apAggregatedKey];
                liabilities[apAggregatedKey] = {
                    balance: apAggregatedAccount.balance,
                    debit_total: apAggregatedAccount.debit_total,
                    credit_total: apAggregatedAccount.credit_total,
                    code: '2000',
                    name: apAggregatedAccount.name
                };
                console.log(`✅ Pre-set aggregated Accounts Payable (2000): $${apAggregatedAccount.balance}`);
            }
            
            Object.values(accountBalances).forEach(account => {
                const key = `${account.code} - ${account.name}`;
                const accountCode = String(account.code);
                
                // Skip AP child accounts - their balances are already included in parent 2000
                if (this.isAccountsPayableChildAccount(accountCode, allAccounts)) {
                    console.log(`⏭️ Skipping AP child account ${accountCode} (${account.name}) in unfiltered balance sheet`);
                    return;
                }
                
                switch (account.type) {
                    case 'Asset':
                        const accountData = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        
                        // Determine if current or non-current asset
                        if (BalanceSheetService.isCurrentAsset(account.code, account.name)) {
                            assets.current_assets[key] = accountData;
                        } else {
                            assets.non_current_assets[key] = accountData;
                        }
                        break;
                    case 'Liability':
                        if (accountCode === '2000') {
                            const apKey = apAggregatedKey || key;
                            const finalBalance = apAggregatedKey ? accountBalances[apAggregatedKey].balance : account.balance;
                            
                            if (!liabilities[apKey]) {
                                liabilities[apKey] = {
                                    balance: finalBalance,
                                    debit_total: account.debit_total,
                                    credit_total: account.credit_total,
                                    code: account.code,
                                    name: account.name
                                };
                            } else if (Math.abs(liabilities[apKey].balance - finalBalance) > 0.01) {
                                console.log(`⚠️ Adjusting AP aggregated balance from $${liabilities[apKey].balance} to $${finalBalance}`);
                                liabilities[apKey].balance = finalBalance;
                            }
                        } else {
                        liabilities[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        }
                        break;
                    case 'Equity':
                        equity[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                    case 'Income':
                        income[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                    case 'Expense':
                        expenses[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                }
            });
            
            // Calculate totals
            const totalCurrentAssets = Object.values(assets.current_assets).reduce((sum, account) => sum + account.balance, 0);
            const totalNonCurrentAssets = Object.values(assets.non_current_assets).reduce((sum, account) => sum + account.balance, 0);
            const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
            const totalLiabilities = Object.values(liabilities).reduce((sum, account) => sum + account.balance, 0);
            const totalEquity = Object.values(equity).reduce((sum, account) => sum + account.balance, 0);
            const totalIncome = Object.values(income).reduce((sum, account) => sum + account.balance, 0);
            const totalExpenses = Object.values(expenses).reduce((sum, account) => sum + account.balance, 0);
            
            // Calculate retained earnings
            const retainedEarnings = totalIncome - totalExpenses;
            
            // Update the Retained Earnings account (3101) with the calculated value
            const retainedEarningsKey = Object.keys(equity).find(key => key.includes('3101'));
            if (retainedEarningsKey) {
                equity[retainedEarningsKey].balance = retainedEarnings;
            }
            
            console.log(`Balance Sheet Summary as of ${asOfDate}:`);
            console.log(`  Total Current Assets: $${totalCurrentAssets}`);
            console.log(`  Total Non-Current Assets: $${totalNonCurrentAssets}`);
            console.log(`  Total Assets: $${totalAssets}`);
            console.log(`  Total Liabilities: $${totalLiabilities}`);
            console.log(`  Total Equity: $${totalEquity + retainedEarnings}`);
            console.log(`  Retained Earnings: $${retainedEarnings}`);
            
            // Show detailed account breakdown
            console.log('\n📊 Detailed Account Breakdown:');
            console.log('CURRENT ASSETS:');
            Object.entries(assets.current_assets).forEach(([key, account]) => {
                console.log(`  ${key}: $${account.balance} (Dr: $${account.debit_total}, Cr: $${account.credit_total}, Net: $${account.debit_total - account.credit_total})`);
            });
            console.log(`  Total Current Assets: $${totalCurrentAssets}`);
            
            console.log('\nNON-CURRENT ASSETS:');
            Object.entries(assets.non_current_assets).forEach(([key, account]) => {
                console.log(`  ${key}: $${account.balance} (Dr: $${account.debit_total}, Cr: $${account.credit_total}, Net: $${account.debit_total - account.credit_total})`);
            });
            console.log(`  Total Non-Current Assets: $${totalNonCurrentAssets}`);
            
            console.log('LIABILITIES:');
            Object.entries(liabilities).forEach(([key, account]) => {
                console.log(`  ${key}: $${account.balance} (Dr: $${account.debit_total}, Cr: $${account.credit_total})`);
            });
            
            console.log('EQUITY:');
            Object.entries(equity).forEach(([key, account]) => {
                console.log(`  ${key}: $${account.balance} (Dr: $${account.debit_total}, Cr: $${account.credit_total})`);
            });
            
            console.log('INCOME:');
            Object.entries(income).forEach(([key, account]) => {
                console.log(`  ${key}: $${account.balance} (Dr: $${account.debit_total}, Cr: $${account.credit_total})`);
            });
            
            console.log('EXPENSES:');
            Object.entries(expenses).forEach(([key, account]) => {
                console.log(`  ${key}: $${account.balance} (Dr: $${account.debit_total}, Cr: $${account.credit_total})`);
            });
            
            return {
                asOf,
                basis,
                assets: {
                    current_assets: {
                        ...assets.current_assets,
                        total_current_assets: totalCurrentAssets
                    },
                    non_current_assets: {
                        ...assets.non_current_assets,
                        total_non_current_assets: totalNonCurrentAssets
                    },
                    total_assets: totalAssets
                },
                liabilities: {
                    ...liabilities,
                    total_liabilities: totalLiabilities
                },
                equity: {
                    ...equity,
                    retained_earnings: retainedEarnings,
                    total_equity: totalEquity + retainedEarnings
                },
                income: {
                    ...income,
                    total_income: totalIncome
                },
                expenses: {
                    ...expenses,
                    total_expenses: totalExpenses
                },
                accounting_equation: {
                    assets: totalAssets,
                    liabilities: totalLiabilities,
                    equity: totalEquity + retainedEarnings,
                    balanced: Math.abs((totalAssets - (totalLiabilities + totalEquity + retainedEarnings))) < 0.01
                },
                transaction_count: entries.length,
                account_details: accountBalances
            };
            
        } catch (error) {
            console.error('Error generating balance sheet:', error);
            throw error;
        }
    }
    
    /**
     * Generate Cash Flow Statement
     */
    static async generateCashFlowStatement(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating cash flow statement for ${period}`);
            
            // Get all transaction entries for the period (exclude forfeiture transactions - no cash movement)
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                // Exclude forfeiture transactions as they don't involve cash movement
                'metadata.isForfeiture': { $ne: true }
            }).populate('entries');
            
            console.log(`Found ${entries.length} transaction entries for ${period}`);
            
            // Calculate cash flows by source
            const operatingActivities = {
                cash_received_from_customers: 0,
                cash_paid_to_suppliers: 0,
                cash_paid_for_expenses: 0
            };
            
            const investingActivities = {
                purchase_of_equipment: 0,
                purchase_of_buildings: 0
            };
            
            const financingActivities = {
                owners_contribution: 0,
                loan_proceeds: 0
            };
            
            entries.forEach(entry => {
                const residence = entry.residence;
                const residenceName = residence ? (residence.name || residence.residenceName || 'Unknown Residence') : 'Unknown Residence';
                
                console.log(`Processing transaction: ${entry.source} - $${entry.totalDebit} at ${residenceName}`);
                
                // Process each entry line
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        console.log(`  Entry: ${accountCode} - ${accountName} (${accountType}): Dr. $${debit} Cr. $${credit}`);
                        
                        // Operating activities - cash accounts and income/expense
                        if (accountCode.startsWith('100') || accountCode.startsWith('101')) { // Cash accounts
                            if (entry.source === 'payment') {
                                operatingActivities.cash_received_from_customers += credit;
                            } else if (entry.source === 'expense_payment' || accountName.toLowerCase().includes('expense')) {
                                operatingActivities.cash_paid_for_expenses += debit;
                            }
                        }
                        
                        // Income accounts (credit increases income)
                        if (accountType === 'Income' || accountType === 'income') {
                            operatingActivities.cash_received_from_customers += credit;
                        }
                        
                        // Expense accounts (debit increases expenses)
                        if (accountType === 'Expense' || accountType === 'expense') {
                            operatingActivities.cash_paid_for_expenses += debit;
                        }
                        
                        // Investing activities
                        if (accountName.toLowerCase().includes('equipment') || accountName.toLowerCase().includes('furniture')) {
                            investingActivities.purchase_of_equipment += debit;
                        } else if (accountName.toLowerCase().includes('building') || accountName.toLowerCase().includes('construction')) {
                            investingActivities.purchase_of_buildings += debit;
                        }
                    });
                }
            });
            
            const netOperatingCashFlow = operatingActivities.cash_received_from_customers - 
                                       operatingActivities.cash_paid_to_suppliers - 
                                       operatingActivities.cash_paid_for_expenses;
            
            const netInvestingCashFlow = -(investingActivities.purchase_of_equipment + 
                                       investingActivities.purchase_of_buildings);
            
            const netFinancingCashFlow = financingActivities.owners_contribution + 
                                       financingActivities.loan_proceeds;
            
            const netChangeInCash = netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;
            
            console.log(`Cash Flow Summary for ${period}:`);
            console.log(`  Operating: $${netOperatingCashFlow}`);
            console.log(`  Investing: $${netInvestingCashFlow}`);
            console.log(`  Financing: $${netFinancingCashFlow}`);
            console.log(`  Net Change: $${netChangeInCash}`);
            
            return {
                period,
                basis,
                operating_activities: operatingActivities,
                investing_activities: investingActivities,
                financing_activities: financingActivities,
                net_change_in_cash: netChangeInCash,
                cash_at_beginning: 0, // Would need to calculate from previous period
                cash_at_end: netChangeInCash,
                residences_included: true,
                data_sources: ['TransactionEntry'],
                transaction_count: entries.length,
                residences_processed: entries.filter(e => e.residence).length
            };
            
        } catch (error) {
            console.error('Error generating cash flow statement:', error);
            throw error;
        }
    }
    
    /**
     * Generate Trial Balance
     */
    static async generateTrialBalance(asOf, basis = 'cash') {
        try {
            const asOfDate = new Date(asOf);
            
            console.log(`Generating trial balance as of ${asOfDate}`);
            
            // Get all transaction entries up to the specified date
            const entries = await TransactionEntry.find({
                date: { $lte: asOfDate }
            }).populate('entries');
            
            // Calculate account balances
            const accountBalances = {};
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    const key = `${accountCode} - ${accountName}`;
                    if (!accountBalances[key]) {
                        accountBalances[key] = {
                            code: accountCode,
                            name: accountName,
                            type: accountType,
                            debit: 0,
                            credit: 0
                        };
                    }
                    
                    accountBalances[key].debit += debit;
                    accountBalances[key].credit += credit;
                });
            });
            
            // Calculate net balances
            const trialBalance = Object.values(accountBalances).map(account => ({
                accountCode: account.code,
                accountName: account.name,
                accountType: account.type,
                debit: account.debit,
                credit: account.credit,
                balance: account.debit - account.credit
            }));
            
            const totalDebits = trialBalance.reduce((sum, account) => sum + account.debit, 0);
            const totalCredits = trialBalance.reduce((sum, account) => sum + account.credit, 0);
            
            return {
                asOf,
                basis,
                trial_balance: trialBalance,
                totals: {
                    total_debits: totalDebits,
                    total_credits: totalCredits,
                    balanced: Math.abs(totalDebits - totalCredits) < 0.01
                }
            };
            
        } catch (error) {
            console.error('Error generating trial balance:', error);
            throw error;
        }
    }
    
    /**
     * Generate General Ledger for specific account
     */
    static async generateGeneralLedger(accountCode, period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            // Get account details
            const account = await Account.findOne({ code: accountCode });
            if (!account) {
                throw new Error(`Account with code ${accountCode} not found`);
            }
            
            // Get opening balance
            const openingBalance = await this.getAccountBalance(accountCode, startDate, basis);
            
            // Get all transactions for this account
            const transactions = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                'entries.accountCode': accountCode
            }).sort({ date: 1 });
            
            // Build ledger entries
            const ledgerEntries = [];
            let runningBalance = openingBalance;
            
            for (const transaction of transactions) {
                const entry = transaction.entries.find(e => e.accountCode === accountCode);
                if (entry) {
                    const debit = entry.debit || 0;
                    const credit = entry.credit || 0;
                    
                    // Update running balance based on account type
                    if (['Asset', 'Expense'].includes(account.type)) {
                        runningBalance += debit - credit;
                    } else {
                        runningBalance += credit - debit;
                    }
                    
                    ledgerEntries.push({
                        date: transaction.date,
                        description: transaction.description,
                        reference: transaction.reference,
                        debit: debit,
                        credit: credit,
                        balance: runningBalance
                    });
                }
            }
            
            return {
                accountCode,
                accountName: account.name,
                accountType: account.type,
                period,
                basis,
                opening_balance: openingBalance,
                ledger_entries: ledgerEntries,
                closing_balance: runningBalance
            };
            
        } catch (error) {
            console.error('Error generating general ledger:', error);
            throw error;
        }
    }
    
    /**
     * Get account balances by type
     */
    static async getAccountBalancesByType(accountType, asOfDate, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $lte: asOfDate }
            }).populate('entries');
            
            const balances = {};
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    if (line.accountType === accountType) {
                        const key = `${line.accountCode} - ${line.accountName}`;
                        if (!balances[key]) balances[key] = 0;
                        
                        if (accountType === 'Asset' || accountType === 'Expense') {
                            balances[key] += (line.debit || 0) - (line.credit || 0);
                        } else {
                            balances[key] += (line.credit || 0) - (line.debit || 0);
                        }
                    }
                });
            });
            
            return balances;
        } catch (error) {
            console.error('Error getting account balances by type:', error);
            throw error;
        }
    }
    
    /**
     * Calculate account type total for a period
     */
    static async calculateAccountTypeTotal(accountType, startDate, endDate, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            }).populate('entries');
            
            const totals = {};
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    if (line.accountType === accountType) {
                        const key = `${line.accountCode} - ${line.accountName}`;
                        if (!totals[key]) totals[key] = 0;
                        
                        if (accountType === 'Income') {
                            totals[key] += (line.credit || 0) - (line.debit || 0);
                        } else if (accountType === 'Expense') {
                            totals[key] += (line.debit || 0) - (line.credit || 0);
                        }
                    }
                });
            });
            
            return totals;
        } catch (error) {
            console.error('Error calculating account type total:', error);
            throw error;
        }
    }
    
    /**
     * Get account balance for a specific account
     */
    static async getAccountBalance(accountCode, asOfDate, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $lte: asOfDate }
            }).populate('entries');
            
            let balance = 0;
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    if (line.accountCode === accountCode) {
                        if (line.accountType === 'Asset' || line.accountType === 'Expense') {
                            balance += (line.debit || 0) - (line.credit || 0);
                        } else {
                            balance += (line.credit || 0) - (line.debit || 0);
                        }
                    }
                });
            });
            
            return balance;
        } catch (error) {
            console.error('Error getting account balance:', error);
            throw error;
        }
    }
    
    /**
     * Calculate account total for a period
     */
    static async calculateAccountTotal(accountCode, startDate, endDate, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            }).populate('entries');
            
            let total = 0;
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    if (line.accountCode === accountCode) {
                        if (line.accountType === 'Income') {
                            total += (line.credit || 0) - (line.debit || 0);
                        } else if (line.accountType === 'Expense') {
                            total += (line.debit || 0) - (line.credit || 0);
                        }
                    }
                });
            });
            
            return total;
        } catch (error) {
            console.error('Error calculating account total:', error);
            throw error;
        }
    }
    
    /**
     * Calculate operating cash flows
     */
    static async calculateOperatingCashFlows(startDate, endDate, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                source: { $in: ['payment', 'expense_payment'] },
                // Exclude forfeiture transactions as they don't involve cash movement
                'metadata.isForfeiture': { $ne: true }
            }).populate('entries');
            
            let cashReceived = 0;
            let cashPaid = 0;
            
            entries.forEach(entry => {
                if (entry.source === 'payment') {
                    cashReceived += entry.totalCredit;
                } else if (entry.source === 'expense_payment') {
                    cashPaid += entry.totalDebit;
                }
            });
            
            return {
                cash_received: cashReceived,
                cash_paid: cashPaid,
                net_operating_cash_flow: cashReceived - cashPaid
            };
        } catch (error) {
            console.error('Error calculating operating cash flows:', error);
            throw error;
        }
    }
    
    /**
     * Calculate investing cash flows
     */
    static async calculateInvestingCashFlows(startDate, endDate, basis) {
        // Placeholder - would need specific logic for investing activities
        return {
            purchase_of_equipment: 0,
            purchase_of_buildings: 0,
            net_investing_cash_flow: 0
        };
    }
    
    /**
     * Calculate financing cash flows
     */
    static async calculateFinancingCashFlows(startDate, endDate, basis) {
        // Placeholder - would need specific logic for financing activities
        return {
            owners_contribution: 0,
            loan_proceeds: 0,
            net_financing_cash_flow: 0
        };
    }
    
    /**
     * Get cash balance at a specific date
     */
    static async getCashBalanceAtDate(date, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $lte: date },
                // Exclude forfeiture transactions as they don't involve cash movement
                'metadata.isForfeiture': { $ne: true }
            }).populate('entries');
            
            let cashBalance = 0;
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    if (line.accountCode.startsWith('100') || line.accountCode.startsWith('101')) {
                        cashBalance += (line.debit || 0) - (line.credit || 0);
                    }
                });
            });
            
            return cashBalance;
        } catch (error) {
            console.error('Error getting cash balance at date:', error);
            throw error;
        }
    }
    
    /**
     * Calculate payable payments
     */
    static async calculatePayablePayments(startDate, endDate, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                source: 'expense_payment'
            }).populate('entries');
            
            let totalPayments = 0;
            
            entries.forEach(entry => {
                totalPayments += entry.totalDebit;
            });
            
            return totalPayments;
        } catch (error) {
            console.error('Error calculating payable payments:', error);
            throw error;
        }
    }
    
    /**
     * Calculate direct expense payments
     */
    static async calculateDirectExpensePayments(startDate, endDate, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                source: 'expense_payment'
            }).populate('entries');
            
            let totalExpenses = 0;
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    if (line.accountType === 'Expense') {
                        totalExpenses += line.debit || 0;
                    }
                });
            });
            
            return totalExpenses;
        } catch (error) {
            console.error('Error calculating direct expense payments:', error);
            throw error;
        }
    }
    
    /**
     * Check if account is current asset
     */
    static isCurrentAsset(accountName) {
        const currentAssetKeywords = ['cash', 'bank', 'petty', 'receivable', 'inventory', 'prepaid'];
        return currentAssetKeywords.some(keyword => 
            accountName.toLowerCase().includes(keyword)
        );
    }
    
    /**
     * Check if account is current liability
     */
    static isCurrentLiability(accountName) {
        const currentLiabilityKeywords = ['payable', 'accrued', 'short-term'];
        return currentLiabilityKeywords.some(keyword => 
            accountName.toLowerCase().includes(keyword)
        );
    }

    // Helper methods for categorization
    static getExpenseCategory(accountCode) {
        if (accountCode.startsWith('5001')) return 'Maintenance';
        if (accountCode.startsWith('5002')) return 'Utilities';
        if (accountCode.startsWith('5003')) return 'Insurance';
        if (accountCode.startsWith('5004')) return 'Property Management';
        if (accountCode.startsWith('5005')) return 'Administrative';
        return 'Other';
    }

    static getCashFlowActivityType(accountCode, accountType) {
        // Convert to string if it's a number
        accountCode = String(accountCode);
        
        // CASH FLOW ACTIVITY CLASSIFICATION - Only for actual cash movements
        
        // Operating Activities - Only actual cash accounts and cash-related operations
        if (/^(100|101|102|103)/.test(accountCode)) {
            // Cash accounts (1000-1039) - actual cash movements
            return 'operating';
        }
        
        // Special case: Security deposits are financing (cash received as deposits)
        if (accountCode.startsWith('2020')) {
            return 'financing';
        }
        
        // Financing Activities - Cash-related liabilities (loans, advances)
        if (/^(20|21|22)/.test(accountCode)) {
            // Cash-related liabilities (bank loans, cash advances, deposits)
            return 'financing';
        }
        
        // Investing Activities - Only if it's actual cash investment/divestment
        if (/^(15|16|17|18|19)/.test(accountCode)) {
            // Long-term cash investments
            return 'investing';
        }
        
        // DO NOT classify revenue (40xx) or expense (50xx) accounts
        // These represent revenue earned/expenses incurred, not cash movements
        // Cashflow should only show when cash actually changes hands
        
        return 'operating'; // Default fallback for cash accounts
    }

    // Enhanced helper method for better account classification - CASH FLOW ONLY
    static classifyCashFlowActivity(accountCode, accountName) {
        // Only classify actual cash movements, not revenue earned or expenses incurred
        if (/^(100|101|102|103)/.test(accountCode)) return 'operating'; // Cash accounts
        if (/^(20|21|22)/.test(accountCode)) return 'financing'; // Cash-related liabilities
        if (/^(15|16|17|18|19)/.test(accountCode)) return 'investing'; // Cash investments
        if (accountName.toLowerCase().includes('deposit')) return 'financing';
        
        // DO NOT classify revenue (4xxx) or expense (5xxx) accounts
        // These don't represent cash movements
        return 'operating'; // Default for cash accounts only
    }

    // Security deposit tracking
    static trackSecurityDeposits(entries) {
        const deposits = {
            received: 0,
            refunded: 0,
            forfeited: 0,
            current_liability: 0
        };
        
        entries.forEach(entry => {
            entry.entries.forEach(line => {
                if (line.accountName.toLowerCase().includes('deposit')) {
                    if (line.accountType === 'Liability') {
                        if (line.credit > 0) deposits.received += line.credit;
                        if (line.debit > 0) deposits.refunded += line.debit;
                        deposits.current_liability += (line.credit - line.debit);
                    } else if (line.accountType === 'Income' && line.credit > 0) {
                        deposits.forfeited += line.credit;
                    }
                }
            });
        });
        
        return deposits;
    }

    // Add validation method
    static async validateCashFlow(period) {
        try {
            const cashFlow = await this.generateMonthlyCashFlow(period);
            
            // Basic validation checks
            const validation = {
                isBalanced: true,
                issues: [],
                warnings: []
            };

            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                              'july', 'august', 'september', 'october', 'november', 'december'];

            // Check if cash flows balance
            monthNames.forEach(month => {
                const monthData = cashFlow.monthly_breakdown[month];
                if (monthData) {
                    const calculatedNet = monthData.operating_activities.net + monthData.investing_activities.net + monthData.financing_activities.net;
                    
                    if (Math.abs(calculatedNet - monthData.net_cash_flow) > 0.01) {
                        validation.isBalanced = false;
                        validation.issues.push(`${month}: Net cash flow mismatch - calculated: ${calculatedNet}, recorded: ${monthData.net_cash_flow}`);
                    }
                }
            });

            // Check for unusual patterns
            if (cashFlow.yearly_totals.operating_activities.outflows > cashFlow.yearly_totals.operating_activities.inflows * 2) {
                validation.warnings.push('Operating outflows significantly exceed inflows - check for unusual expenses');
            }

            if (cashFlow.yearly_totals.financing_activities.net > cashFlow.yearly_totals.operating_activities.net * 3) {
                validation.warnings.push('Financing activities dominate cash flow - review business model');
            }

            return validation;

        } catch (error) {
            console.error('Error validating cash flow:', error);
            throw error;
        }
    }

    static calculateCashFlow(accountType, debit, credit, accountCode, accountName) {
        // CASH FLOW: Only actual cash movements, NOT revenue earned or expenses incurred
        // Only include cash accounts (1000-1999) for true cash basis reporting
        
        if (accountType === 'Asset' || accountType === 'asset') {
            // Only include actual cash accounts (1000-1999)
            if (accountCode && /^10/.test(accountCode)) {
                return debit - credit; // Debit = cash inflow (+), Credit = cash outflow (-)
            }
            // Skip non-cash assets (like Accounts Receivable, Property, Equipment)
            return 0;
        } else if (accountType === 'Liability' || accountType === 'liability') {
            // For cash basis, we need to show the cash impact of liability changes
            // But we should only show this if it represents actual cash movement
            // For advance payments, the cash is already captured in the Cash account entry
            // So we skip liability entries to avoid double-counting
            return 0;
        } else if (accountType === 'Income' || accountType === 'income') {
            // For cash basis, income accounts represent cash received
            // But we should only show this if it represents actual cash movement
            // The cash is already captured in the Cash account entry
            // So we skip income entries to avoid double-counting
            return 0;
        } else if (accountType === 'Expense' || accountType === 'expense') {
            // For cash basis, expense accounts represent cash paid
            // But we should only show this if it represents actual cash movement
            // The cash is already captured in the Cash account entry
            // So we skip expense entries to avoid double-counting
            return 0;
        }
        
        return 0;
    }

    /**
     * RESIDENCE-FILTERED FINANCIAL REPORTS
     */

    /**
     * Generate Residence-Filtered Income Statement
     */
    static async generateResidenceFilteredIncomeStatement(period, residenceId, basis = 'cash') {
        try {
            console.log(`Generating residence-filtered income statement for ${period}, residence: ${residenceId}, basis: ${basis}`);
            
            // Use the main generateIncomeStatement method with residence filtering
            const incomeStatement = await this.generateIncomeStatement(period, basis, residenceId);
            
            return incomeStatement;
            
        } catch (error) {
            console.error('Error generating residence-filtered income statement:', error);
            throw error;
        }
    }

    /**
     * Generate Residence-Filtered Balance Sheet
     */
    static async generateResidenceFilteredBalanceSheet(asOf, residenceId, basis = 'cash') {
        try {
            const asOfDate = new Date(asOf);
            
            console.log(`Generating residence-filtered balance sheet as of ${asOfDate}, residence: ${residenceId}`);
            
            // Handle residence parameter - could be ObjectId or residence name
            let actualResidenceId = residenceId;
            let residenceInfo = null;
            
            // Check if residenceId is a valid ObjectId
            if (!mongoose.Types.ObjectId.isValid(residenceId)) {
                // If not a valid ObjectId, treat it as a residence name and look it up
                console.log(`Residence parameter "${residenceId}" is not a valid ObjectId, searching by name...`);
                residenceInfo = await Residence.findOne({ name: { $regex: new RegExp(residenceId, 'i') } });
                
                if (!residenceInfo) {
                    throw new Error(`Residence not found: ${residenceId}`);
                }
                
                actualResidenceId = residenceInfo._id;
                console.log(`Found residence: ${residenceInfo.name} (ID: ${actualResidenceId})`);
            } else {
                // If it's a valid ObjectId, get residence info for logging
                residenceInfo = await Residence.findById(residenceId).select('name');
                if (!residenceInfo) {
                    throw new Error(`Residence not found with ID: ${residenceId}`);
                }
                actualResidenceId = new mongoose.Types.ObjectId(residenceId);
                console.log(`Using residence: ${residenceInfo.name} (ID: ${actualResidenceId})`);
            }
            
            // Get transaction entries for the specific residence up to the date
            // Check both residence field and metadata fields (like income statement does)
            const entries = await TransactionEntry.find({
                date: { $lte: asOfDate },
                $or: [
                    { residence: actualResidenceId },
                    { 'metadata.residenceId': actualResidenceId.toString() },
                    { 'metadata.residence': actualResidenceId.toString() }
                ]
            }).populate('residence');
            
            console.log(`Found ${entries.length} transaction entries for residence ${residenceId}`);
            
            // Get all accounts for aggregation
            const Account = require('../models/Account');
            const allAccounts = await Account.find({ isActive: true }).sort({ code: 1 });
            
            // Calculate account balances (original filtered version logic - was working correctly)
            let accountBalances = {};
            
            entries.forEach(entry => {
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        const key = `${accountCode} - ${accountName}`;
                        if (!accountBalances[key]) {
                            accountBalances[key] = {
                                code: accountCode,
                                name: accountName,
                                type: accountType,
                                balance: 0,
                                debit_total: 0,
                                credit_total: 0
                            };
                        }
                        
                        accountBalances[key].debit_total += debit;
                        accountBalances[key].credit_total += credit;
                        
                        if (accountType === 'Asset' || accountType === 'Expense') {
                            accountBalances[key].balance += debit - credit;
                        } else {
                            accountBalances[key].balance += credit - debit;
                        }
                    });
                }
            });
            
            // CRITICAL: Aggregate parent-child accounts BEFORE building structure
            try {
                accountBalances = await this.aggregateParentChildAccounts(accountBalances, allAccounts);
                console.log(`✅ Aggregated parent-child accounts for residence-filtered balance sheet`);
            } catch (aggError) {
                console.error('⚠️ Error in aggregation, continuing with original balances:', aggError.message);
            }
            
            // Group by account type and calculate totals
            const assets = {};
            const liabilities = {};
            const equity = {};
            const income = {};
            const expenses = {};
            
            // CRITICAL: First, explicitly set Accounts Payable from aggregatedBalances
            const apAccountKey = Object.keys(accountBalances).find(key => key.startsWith('2000 -'));
            if (apAccountKey) {
                const apAccount = accountBalances[apAccountKey];
                const finalAPBalance = apAccount.balance; // This is the aggregated balance (parent + children)
                const apKey = `2000 - ${apAccount.name}`;
                liabilities[apKey] = {
                    balance: finalAPBalance,
                    debit_total: apAccount.debit_total,
                    credit_total: apAccount.credit_total,
                    code: '2000',
                    name: apAccount.name
                };
                console.log(`✅ PRE-SET Accounts Payable (2000) from aggregatedBalances: $${finalAPBalance}`);
            }
            
            Object.values(accountBalances).forEach(account => {
                const key = `${account.code} - ${account.name}`;
                const accountCode = String(account.code);
                
                // CRITICAL: Skip child accounts of Accounts Payable (2000) - their balances are already aggregated into parent
                if (this.isAccountsPayableChildAccount(accountCode, allAccounts)) {
                    console.log(`⏭️  Skipping AP child account ${accountCode} (${account.name}) - balance already aggregated into parent 2000`);
                    return; // Skip this account entirely
                }
                
                switch (account.type) {
                    case 'Asset':
                        assets[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                    case 'Liability':
                        // CRITICAL: For account 2000, skip if already pre-set (to avoid overwriting aggregated balance)
                        if (accountCode === '2000') {
                            const apKey = `2000 - ${account.name}`;
                            if (!liabilities[apKey]) {
                                // If not pre-set, use aggregated balance from accountBalances
                                const apAccountDirect = accountBalances[key];
                                const finalAPBalance = apAccountDirect ? apAccountDirect.balance : account.balance;
                                liabilities[apKey] = {
                                    balance: finalAPBalance,
                                    debit_total: account.debit_total,
                                    credit_total: account.credit_total,
                                    code: account.code,
                                    name: account.name
                                };
                                console.log(`✅ Set Accounts Payable (2000) in loop: $${finalAPBalance}`);
                            } else {
                                // Already pre-set, verify it has the correct aggregated balance
                                const apAccountDirect = accountBalances[key];
                                const finalAPBalance = apAccountDirect ? apAccountDirect.balance : account.balance;
                                if (Math.abs(liabilities[apKey].balance - finalAPBalance) > 0.01) {
                                    console.log(`⚠️ Fixing AP balance mismatch: was $${liabilities[apKey].balance}, should be $${finalAPBalance}`);
                                    liabilities[apKey].balance = finalAPBalance;
                                }
                            }
                        } else {
                            // Other liabilities - add normally
                        liabilities[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        }
                        break;
                    case 'Equity':
                        equity[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                    case 'Income':
                        income[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                    case 'Expense':
                        expenses[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                }
            });
            
            // CRITICAL FIX: Ensure Accounts Payable balance is ALWAYS set correctly from aggregatedBalances
            const finalAPAccountKeys = Object.keys(accountBalances).filter(key => key.startsWith('2000 -'));
            if (finalAPAccountKeys.length > 0) {
                const finalAPAccountKey = finalAPAccountKeys[0];
                const finalAPAccount = accountBalances[finalAPAccountKey];
                const finalAggregatedBalance = finalAPAccount.balance;
                
                // Find the AP entry in liabilities (might have different name format)
                const apKeyInLiabilities = Object.keys(liabilities).find(key => key.startsWith('2000 -'));
                
                if (apKeyInLiabilities) {
                    // Update existing entry with aggregated balance
                    const oldBalance = liabilities[apKeyInLiabilities].balance;
                    liabilities[apKeyInLiabilities].balance = finalAggregatedBalance;
                    console.log(`✅ Accounts Payable (2000) FINAL AGGREGATED BALANCE: $${finalAggregatedBalance} (was $${oldBalance})`);
                    
                    if (Math.abs(oldBalance - finalAggregatedBalance) > 0.01) {
                        console.log(`⚠️ FIXED: AP balance was incorrect! Updated from $${oldBalance} to $${finalAggregatedBalance}`);
                    }
                } else {
                    // Not found, add it using the key from accountBalances
                    liabilities[finalAPAccountKey] = {
                        balance: finalAggregatedBalance,
                        debit_total: finalAPAccount.debit_total,
                        credit_total: finalAPAccount.credit_total,
                        code: '2000',
                        name: finalAPAccount.name
                    };
                    console.log(`✅ Added Accounts Payable (2000) with aggregated balance: $${finalAggregatedBalance}`);
                }
            } else {
                console.log(`⚠️ WARNING: Account 2000 NOT FOUND in accountBalances when doing final verification!`);
            }
            
            const totalAssets = Object.values(assets).reduce((sum, account) => sum + account.balance, 0);
            const totalLiabilities = Object.values(liabilities).reduce((sum, account) => sum + account.balance, 0);
            const totalEquity = Object.values(equity).reduce((sum, account) => sum + account.balance, 0);
            const totalIncome = Object.values(income).reduce((sum, account) => sum + account.balance, 0);
            const totalExpenses = Object.values(expenses).reduce((sum, account) => sum + account.balance, 0);
            const retainedEarnings = totalIncome - totalExpenses;
            
            return {
                asOf,
                basis,
                residence: {
                    id: actualResidenceId,
                    name: residenceInfo?.name || 'Unknown',
                    originalParameter: residenceId
                },
                assets: {
                    ...assets,
                    total_assets: totalAssets
                },
                liabilities: {
                    ...liabilities,
                    total_liabilities: totalLiabilities
                },
                equity: {
                    ...equity,
                    retained_earnings: retainedEarnings,
                    total_equity: totalEquity + retainedEarnings
                },
                income: {
                    ...income,
                    total_income: totalIncome
                },
                expenses: {
                    ...expenses,
                    total_expenses: totalExpenses
                },
                accounting_equation: {
                    assets: totalAssets,
                    liabilities: totalLiabilities,
                    equity: totalEquity + retainedEarnings,
                    balanced: Math.abs((totalAssets - (totalLiabilities + totalEquity + retainedEarnings))) < 0.01
                },
                transaction_count: entries.length
            };
            
        } catch (error) {
            console.error('Error generating residence-filtered balance sheet:', error);
            throw error;
        }
    }

    /**
     * Generate Residence-Filtered Cash Flow Statement
     */
    static async generateResidenceFilteredCashFlowStatement(period, residenceId, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating residence-filtered cash flow statement for ${period}, residence: ${residenceId}`);
            
            // Handle residence parameter - could be ObjectId or residence name
            let actualResidenceId = residenceId;
            let residenceInfo = null;
            
            // Check if residenceId is a valid ObjectId
            if (!mongoose.Types.ObjectId.isValid(residenceId)) {
                // If not a valid ObjectId, treat it as a residence name and look it up
                console.log(`Residence parameter "${residenceId}" is not a valid ObjectId, searching by name...`);
                residenceInfo = await Residence.findOne({ name: { $regex: new RegExp(residenceId, 'i') } });
                
                if (!residenceInfo) {
                    throw new Error(`Residence not found: ${residenceId}`);
                }
                
                actualResidenceId = residenceInfo._id;
                console.log(`Found residence: ${residenceInfo.name} (ID: ${actualResidenceId})`);
            } else {
                // If it's a valid ObjectId, get residence info for logging
                residenceInfo = await Residence.findById(residenceId).select('name');
                if (!residenceInfo) {
                    throw new Error(`Residence not found with ID: ${residenceId}`);
                }
                actualResidenceId = new mongoose.Types.ObjectId(residenceId);
                console.log(`Using residence: ${residenceInfo.name} (ID: ${actualResidenceId})`);
            }
            
            // Get transaction entries for the specific residence
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                residence: actualResidenceId
            }).populate('residence');
            
            console.log(`Found ${entries.length} transaction entries for residence ${residenceId}`);
            
            // Initialize monthly breakdown structure
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                               'july', 'august', 'september', 'october', 'november', 'december'];
            
            const monthlyBreakdown = {};
            monthNames.forEach(month => {
                monthlyBreakdown[month] = {
                    operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} },
                    investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} },
                    financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} },
                    net_cash_flow: 0,
                    opening_balance: 0,
                    closing_balance: 0
                };
            });
            
            // Process entries by month
            entries.forEach(entry => {
                const entryDate = new Date(entry.date);
                const monthIndex = entryDate.getMonth();
                const monthName = monthNames[monthIndex];
                
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        // Only process cash accounts for cash flow
                        if (accountCode && /^10/.test(accountCode)) {
                            const cashFlow = this.calculateCashFlow(accountType, debit, credit, accountCode, accountName);
                            const activityType = this.getCashFlowActivityType(accountCode, accountType);
                            
                            // Track account breakdown
                            const key = `${accountCode}`;
                            if (activityType === 'operating') {
                                if (!monthlyBreakdown[monthName].operating_activities.breakdown[key]) {
                                    monthlyBreakdown[monthName].operating_activities.breakdown[key] = {
                                        inflows: 0, outflows: 0,
                                        accountName: accountName,
                                        accountCode: accountCode
                                    };
                                }
                                
                                if (cashFlow > 0) {
                                    monthlyBreakdown[monthName].operating_activities.inflows += cashFlow;
                                    monthlyBreakdown[monthName].operating_activities.breakdown[key].inflows += cashFlow;
                                } else {
                                    monthlyBreakdown[monthName].operating_activities.outflows += Math.abs(cashFlow);
                                    monthlyBreakdown[monthName].operating_activities.breakdown[key].outflows += Math.abs(cashFlow);
                                }
                            } else if (activityType === 'investing') {
                                if (!monthlyBreakdown[monthName].investing_activities.breakdown[key]) {
                                    monthlyBreakdown[monthName].investing_activities.breakdown[key] = {
                                        inflows: 0, outflows: 0,
                                        accountName: accountName,
                                        accountCode: accountCode
                                    };
                                }
                                
                                if (cashFlow > 0) {
                                    monthlyBreakdown[monthName].investing_activities.inflows += cashFlow;
                                    monthlyBreakdown[monthName].investing_activities.breakdown[key].inflows += cashFlow;
                                } else {
                                    monthlyBreakdown[monthName].investing_activities.outflows += Math.abs(cashFlow);
                                    monthlyBreakdown[monthName].investing_activities.breakdown[key].outflows += Math.abs(cashFlow);
                                }
                            } else if (activityType === 'financing') {
                                if (!monthlyBreakdown[monthName].financing_activities.breakdown[key]) {
                                    monthlyBreakdown[monthName].financing_activities.breakdown[key] = {
                                        inflows: 0, outflows: 0,
                                        accountName: accountName,
                                        accountCode: accountCode
                                    };
                                }
                                
                                if (cashFlow > 0) {
                                    monthlyBreakdown[monthName].financing_activities.inflows += cashFlow;
                                    monthlyBreakdown[monthName].financing_activities.breakdown[key].inflows += cashFlow;
                                } else {
                                    monthlyBreakdown[monthName].financing_activities.outflows += Math.abs(cashFlow);
                                    monthlyBreakdown[monthName].financing_activities.breakdown[key].outflows += Math.abs(cashFlow);
                                }
                            }
                        }
                    });
                }
            });
            
            // Calculate monthly nets and running balances
            let runningBalance = 0;
            monthNames.forEach(month => {
                const monthData = monthlyBreakdown[month];
                
                // Calculate nets
                monthData.operating_activities.net = monthData.operating_activities.inflows - monthData.operating_activities.outflows;
                monthData.investing_activities.net = monthData.investing_activities.inflows - monthData.investing_activities.outflows;
                monthData.financing_activities.net = monthData.financing_activities.inflows - monthData.financing_activities.outflows;
                
                // Calculate net cash flow for the month
                monthData.net_cash_flow = monthData.operating_activities.net + monthData.investing_activities.net + monthData.financing_activities.net;
                
                // Calculate opening and closing balances
                monthData.opening_balance = runningBalance;
                runningBalance += monthData.net_cash_flow;
                monthData.closing_balance = runningBalance;
            });
            
            // Calculate yearly totals
            const yearlyTotals = {
                operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} },
                investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} },
                financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }
            };
            
            // Aggregate yearly totals and breakdowns
            monthNames.forEach(month => {
                const monthData = monthlyBreakdown[month];
                
                // Operating activities
                yearlyTotals.operating_activities.inflows += monthData.operating_activities.inflows;
                yearlyTotals.operating_activities.outflows += monthData.operating_activities.outflows;
                yearlyTotals.operating_activities.net += monthData.operating_activities.net;
                
                // Investing activities
                yearlyTotals.investing_activities.inflows += monthData.investing_activities.inflows;
                yearlyTotals.investing_activities.outflows += monthData.investing_activities.outflows;
                yearlyTotals.investing_activities.net += monthData.investing_activities.net;
                
                // Financing activities
                yearlyTotals.financing_activities.inflows += monthData.financing_activities.inflows;
                yearlyTotals.financing_activities.outflows += monthData.financing_activities.outflows;
                yearlyTotals.financing_activities.net += monthData.financing_activities.net;
                
                // Aggregate breakdowns
                Object.entries(monthData.operating_activities.breakdown).forEach(([account, amounts]) => {
                    if (!yearlyTotals.operating_activities.breakdown[account]) {
                        yearlyTotals.operating_activities.breakdown[account] = {
                            inflows: 0, outflows: 0,
                            accountName: amounts.accountName,
                            accountCode: amounts.accountCode
                        };
                    }
                    yearlyTotals.operating_activities.breakdown[account].inflows += amounts.inflows;
                    yearlyTotals.operating_activities.breakdown[account].outflows += amounts.outflows;
                });
                
                Object.entries(monthData.investing_activities.breakdown).forEach(([account, amounts]) => {
                    if (!yearlyTotals.investing_activities.breakdown[account]) {
                        yearlyTotals.investing_activities.breakdown[account] = {
                            inflows: 0, outflows: 0,
                            accountName: amounts.accountName,
                            accountCode: amounts.accountCode
                        };
                    }
                    yearlyTotals.investing_activities.breakdown[account].inflows += amounts.inflows;
                    yearlyTotals.investing_activities.breakdown[account].outflows += amounts.outflows;
                });
                
                Object.entries(monthData.financing_activities.breakdown).forEach(([account, amounts]) => {
                    if (!yearlyTotals.financing_activities.breakdown[account]) {
                        yearlyTotals.financing_activities.breakdown[account] = {
                            inflows: 0, outflows: 0,
                            accountName: amounts.accountName,
                            accountCode: amounts.accountCode
                        };
                    }
                    yearlyTotals.financing_activities.breakdown[account].inflows += amounts.inflows;
                    yearlyTotals.financing_activities.breakdown[account].outflows += amounts.outflows;
                });
            });
            
            // Calculate final net cash flow
            const netCashFlow = yearlyTotals.operating_activities.net + 
                               yearlyTotals.investing_activities.net + 
                               yearlyTotals.financing_activities.net;
            
            return {
                period,
                basis,
                residence: {
                    id: actualResidenceId,
                    name: residenceInfo?.name || 'Unknown',
                    originalParameter: residenceId
                },
                monthly_breakdown: monthlyBreakdown,
                yearly_totals: yearlyTotals,
                net_cash_flow: netCashFlow,
                opening_balance: monthlyBreakdown.january.opening_balance,
                closing_balance: monthlyBreakdown.december.closing_balance,
                summary: {
                    best_cash_flow_month: monthNames.reduce((best, month) => 
                        monthlyBreakdown[month].net_cash_flow > monthlyBreakdown[best].net_cash_flow ? month : best
                    ),
                    worst_cash_flow_month: monthNames.reduce((worst, month) => 
                        monthlyBreakdown[month].net_cash_flow < monthlyBreakdown[worst].net_cash_flow ? month : worst
                    ),
                    total_transactions: entries.length
                }
            };
            
        } catch (error) {
            console.error('Error generating residence-filtered cash flow statement:', error);
            throw error;
        }
    }

    /**
     * Generate Comprehensive Monthly Balance Sheet
     * 
     * Similar to income statement, shows balance sheet data broken down by month
     * Shows how assets, liabilities, and equity change month by month
     */
    static async generateComprehensiveMonthlyBalanceSheet(period, basis = 'cash', residence = null) {
        try {
            // Check cache first
            const { cache } = require('../utils/cache');
            const cacheKey = `comprehensive-balance-sheet:${period}:${basis}:${residence || 'all'}`;
            const cached = cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating comprehensive monthly balance sheet for ${period} using ${basis.toUpperCase()} basis`);
            
            // Initialize monthly breakdown
            const monthlyBreakdown = {};
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            
            monthNames.forEach((month, index) => {
                monthlyBreakdown[index] = {
                    month,
                    monthNumber: index + 1,
                    assets: {},
                    liabilities: {},
                    equity: {},
                    total_assets: 0,
                    total_liabilities: 0,
                    total_equity: 0,
                    residences: [],
                    transaction_count: 0,
                    accounting_equation_balanced: false
                };
            });
            
            // Process each month to build monthly balance sheet (like income statement)
            for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
                const monthStartDate = new Date(period, monthIndex, 1); // First day of the month
                const monthEndDate = new Date(period, monthIndex + 1, 0); // Last day of the month
                
                console.log(`Processing balance sheet for ${monthNames[monthIndex]} (${monthStartDate.toLocaleDateString()} to ${monthEndDate.toLocaleDateString()})`);
                
                // Get transaction entries for THIS MONTH ONLY (like income statement)
                // Use proper date range to avoid timezone issues
                const query = {
                    date: { 
                        $gte: new Date(period, monthIndex, 1, 0, 0, 0, 0), // Start of month
                        $lt: new Date(period, monthIndex + 1, 1, 0, 0, 0, 0) // Start of next month
                    }
                };
                
                if (residence) {
                    query.residence = new mongoose.Types.ObjectId(residence);
                }
                
                // OPTIMIZED: Use lean() and aggregation instead of populate()
                const entries = await TransactionEntry.find(query).lean();
                
                // OPTIMIZED: Batch fetch residences if needed
                const residenceIds = [...new Set(entries.map(e => e.residence).filter(Boolean))];
                const residenceMap = new Map();
                if (residenceIds.length > 0) {
                    const Residence = require('../models/Residence');
                    const residences = await Residence.find({ _id: { $in: residenceIds } })
                        .select('_id name')
                        .lean();
                    residences.forEach(r => {
                        residenceMap.set(r._id.toString(), r.name || 'Unknown Residence');
                    });
                }
                
                console.log(`Found ${entries.length} transaction entries up to ${monthNames[monthIndex]}`);
                
                // Calculate account balances for this month
                const accountBalances = {};
                const residences = new Set();
                
                entries.forEach(entry => {
                    const residenceId = entry.residence?.toString() || entry.residence;
                    const residenceName = residenceMap.get(residenceId) || 'Unknown Residence';
                    residences.add(residenceName);
                    
                    if (entry.entries && entry.entries.length > 0) {
                        entry.entries.forEach(line => {
                            const accountCode = line.accountCode;
                            const accountName = line.accountName;
                            const accountType = line.accountType;
                            const debit = line.debit || 0;
                            const credit = line.credit || 0;
                            
                            const key = `${accountCode} - ${accountName}`;
                            if (!accountBalances[key]) {
                                accountBalances[key] = {
                                    code: accountCode,
                                    name: accountName,
                                    type: accountType,
                                    balance: 0,
                                    debit_total: 0,
                                    credit_total: 0
                                };
                            }
                            
                            // Track totals
                            accountBalances[key].debit_total += debit;
                            accountBalances[key].credit_total += credit;
                            
                            // Calculate balance based on account type
                            if (accountType === 'Asset' || accountType === 'Expense') {
                                accountBalances[key].balance += debit - credit;
                            } else {
                                accountBalances[key].balance += credit - debit;
                            }
                        });
                    }
                });
                
                // Group by account type for this month
                const assets = {};
                const liabilities = {};
                const equity = {};
                const income = {};
                const expenses = {};
                
                Object.values(accountBalances).forEach(account => {
                    const key = `${account.code} - ${account.name}`;
                    switch (account.type) {
                        case 'Asset':
                            assets[key] = {
                                balance: account.balance,
                                debit_total: account.debit_total,
                                credit_total: account.credit_total,
                                code: account.code,
                                name: account.name
                            };
                            break;
                        case 'Liability':
                            liabilities[key] = {
                                balance: account.balance,
                                debit_total: account.debit_total,
                                credit_total: account.credit_total,
                                code: account.code,
                                name: account.name
                            };
                            break;
                        case 'Equity':
                            equity[key] = {
                                balance: account.balance,
                                debit_total: account.debit_total,
                                credit_total: account.credit_total,
                                code: account.code,
                                name: account.name
                            };
                            break;
                        case 'Income':
                            income[key] = {
                                balance: account.balance,
                                debit_total: account.debit_total,
                                credit_total: account.credit_total,
                                code: account.code,
                                name: account.name
                            };
                            break;
                        case 'Expense':
                            expenses[key] = {
                                balance: account.balance,
                                debit_total: account.debit_total,
                                credit_total: account.credit_total,
                                code: account.code,
                                name: account.name
                            };
                            break;
                    }
                });
                
                // Calculate monthly changes (not cumulative balances)
                const monthlyAssetChanges = Object.values(assets).reduce((sum, account) => sum + account.balance, 0);
                const monthlyLiabilityChanges = Object.values(liabilities).reduce((sum, account) => sum + account.balance, 0);
                const monthlyEquityChanges = Object.values(equity).reduce((sum, account) => sum + account.balance, 0);
                const monthlyIncome = Object.values(income).reduce((sum, account) => sum + account.balance, 0);
                const monthlyExpenses = Object.values(expenses).reduce((sum, account) => sum + account.balance, 0);
                
                // Calculate monthly retained earnings change
                const monthlyRetainedEarnings = monthlyIncome - monthlyExpenses;
                
                // Store monthly data (showing monthly changes, not cumulative balances)
                monthlyBreakdown[monthIndex].assets = assets;
                monthlyBreakdown[monthIndex].liabilities = liabilities;
                monthlyBreakdown[monthIndex].equity = {
                    ...equity,
                    retained_earnings: monthlyRetainedEarnings
                };
                monthlyBreakdown[monthIndex].total_assets = monthlyAssetChanges;
                monthlyBreakdown[monthIndex].total_liabilities = monthlyLiabilityChanges;
                monthlyBreakdown[monthIndex].total_equity = monthlyEquityChanges + monthlyRetainedEarnings;
                monthlyBreakdown[monthIndex].residences = Array.from(residences);
                monthlyBreakdown[monthIndex].transaction_count = entries.length;
                monthlyBreakdown[monthIndex].accounting_equation_balanced = 
                    Math.abs((monthlyAssetChanges - (monthlyLiabilityChanges + monthlyEquityChanges + monthlyRetainedEarnings))) < 0.01;
                
                console.log(`  ${monthNames[monthIndex]} Balance Sheet Changes:`);
                console.log(`    Asset Changes: $${monthlyAssetChanges.toFixed(2)}`);
                console.log(`    Liability Changes: $${monthlyLiabilityChanges.toFixed(2)}`);
                console.log(`    Equity Changes: $${(monthlyEquityChanges + monthlyRetainedEarnings).toFixed(2)}`);
                console.log(`    Balanced: ${monthlyBreakdown[monthIndex].accounting_equation_balanced ? '✅' : '❌'}`);
            }
            
            // Calculate year-end totals (sum of all monthly changes)
            const yearEndTotals = {
                total_assets: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].total_assets, 0),
                total_liabilities: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].total_liabilities, 0),
                total_equity: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].total_equity, 0),
                total_transactions: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].transaction_count, 0),
                accounting_equation_balanced: Math.abs((monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].total_assets, 0) - 
                    (monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].total_liabilities, 0) + 
                     monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].total_equity, 0)))) < 0.01
            };
            
            const result = {
                period,
                basis,
                monthly_breakdown: monthlyBreakdown,
                year_end_totals: yearEndTotals,
                month_names: monthNames,
                residences_included: true,
                data_sources: ['TransactionEntry'],
                accounting_notes: {
                    basis: `${basis.toUpperCase()} basis balance sheet`,
                    includes_all_transactions: true,
                    monthly_changes: true,
                    note: "Shows monthly balance sheet changes (like income statement), not cumulative balances"
                }
            };
            
            // Cache the result for 5 minutes
            cache.set(cacheKey, result, 300000);
            return result;
            
        } catch (error) {
            console.error('Error generating comprehensive monthly balance sheet:', error);
            throw error;
        }
    }

    /**
     * 🆕 NEW: Generate Detailed Cash Flow Statement with comprehensive breakdowns
     * Uses the EnhancedCashFlowService for detailed income and expense analysis
     */
    static async generateDetailedCashFlowStatement(period, basis = 'cash', residenceId = null) {
        try {
            console.log(`💰 Generating Detailed Cash Flow Statement for ${period} (${basis} basis)${residenceId ? ` - Residence: ${residenceId}` : ''}`);
            
            // Use the enhanced cash flow service for detailed breakdowns
            const EnhancedCashFlowService = require('./enhancedCashFlowService');
            const detailedCashFlow = await EnhancedCashFlowService.generateDetailedCashFlowStatement(period, basis, residenceId);
            
            return detailedCashFlow;
            
        } catch (error) {
            console.error('Error generating detailed cash flow statement:', error);
            throw error;
        }
    }

    /**
     * Generate Residence-Filtered Monthly Balance Sheet
     */
    static async generateResidenceFilteredMonthlyBalanceSheet(period, residenceId, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating residence-filtered monthly balance sheet for ${period}, residence: ${residenceId}`);
            
            // Handle residence parameter - could be ObjectId or residence name
            let actualResidenceId = residenceId;
            let residenceInfo = null;
            
            // Check if residenceId is a valid ObjectId
            if (!mongoose.Types.ObjectId.isValid(residenceId)) {
                // If not a valid ObjectId, treat it as a residence name and look it up
                console.log(`Residence parameter "${residenceId}" is not a valid ObjectId, searching by name...`);
                residenceInfo = await Residence.findOne({ name: { $regex: new RegExp(residenceId, 'i') } });
                
                if (!residenceInfo) {
                    throw new Error(`Residence not found: ${residenceId}`);
                }
                
                actualResidenceId = residenceInfo._id;
                console.log(`Found residence: ${residenceInfo.name} (ID: ${actualResidenceId})`);
            } else {
                // If it's a valid ObjectId, get residence info for logging
                residenceInfo = await Residence.findById(residenceId).select('name');
                if (!residenceInfo) {
                    throw new Error(`Residence not found with ID: ${residenceId}`);
                }
                actualResidenceId = new mongoose.Types.ObjectId(residenceId);
                console.log(`Using residence: ${residenceInfo.name} (ID: ${actualResidenceId})`);
            }
            
            // Initialize monthly breakdown
            const monthlyBreakdown = {};
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            
            monthNames.forEach((month, index) => {
                monthlyBreakdown[index] = {
                    month,
                    monthNumber: index + 1,
                    assets: {},
                    liabilities: {},
                    equity: {},
                    total_assets: 0,
                    total_liabilities: 0,
                    total_equity: 0,
                    residences: [residenceInfo.name],
                    transaction_count: 0,
                    accounting_equation_balanced: false
                };
            });
            
            // Get ALL accounts to identify non-current asset accounts
            // Import BalanceSheetService to use isCurrentAsset function
            const BalanceSheetService = require('./balanceSheetService');
            const allAccountsForFilter = await Account.find().sort({ code: 1 });
            
            // Identify non-current asset account codes
            // Use both isCurrentAsset check AND category field for more reliable identification
            const nonCurrentAssetCodes = [];
            allAccountsForFilter.forEach(account => {
                if (account.type === 'Asset') {
                    // Check if it's a fixed asset by category
                    const isFixedAsset = account.category === 'Fixed Assets' || account.category === 'Other Assets';
                    // Check if it's non-current by name/code logic
                    const isNonCurrentByName = !BalanceSheetService.isCurrentAsset(account.code, account.name);
                    
                    if (isFixedAsset || isNonCurrentByName) {
                        nonCurrentAssetCodes.push(String(account.code));
                        console.log(`🏢 Identified non-current asset: ${account.code} - ${account.name} (category: ${account.category})`);
                    }
                }
            });
            console.log(`🏢 Found ${nonCurrentAssetCodes.length} non-current asset accounts: ${nonCurrentAssetCodes.slice(0, 10).join(', ')}${nonCurrentAssetCodes.length > 10 ? '...' : ''}`);
            
            // Process each month to build monthly balance sheet
            for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
                const monthStartDate = new Date(period, monthIndex, 1);
                const monthEndDate = new Date(period, monthIndex + 1, 0);
                
                console.log(`Processing balance sheet for ${monthNames[monthIndex]} (cumulative up to ${monthEndDate.toLocaleDateString()})`);
                
                // Get ALL transaction entries up to month end (CUMULATIVE) for balance sheet
                // Balance sheet shows balances as of month end, which requires all transactions from beginning
                // Include transactions that match residence OR affect non-current asset accounts
                const residenceConditions = [
                    { residence: actualResidenceId },
                    { residence: actualResidenceId.toString() },
                    { 'metadata.residenceId': actualResidenceId.toString() },
                    { 'metadata.residence': actualResidenceId.toString() }
                ];
                
                // Build conditions for transactions affecting non-current asset accounts
                // IMPORTANT: Non-current assets must ALSO have a matching residence field
                // This ensures that when filtering by residence, only non-current assets belonging to that residence are included
                const nonCurrentAssetConditions = [];
                if (nonCurrentAssetCodes.length > 0) {
                    // Non-current asset transactions must have a matching residence field
                    nonCurrentAssetConditions.push({
                        $and: [
                            { 'entries.accountCode': { $in: nonCurrentAssetCodes } },
                            {
                                $or: [
                                    { residence: actualResidenceId },
                                    { residence: actualResidenceId.toString() },
                                    { 'metadata.residenceId': actualResidenceId.toString() },
                                    { 'metadata.residence': actualResidenceId.toString() }
                                ]
                            }
                        ]
                    });
                }
                
                // Combine: include transactions that match residence OR affect non-current assets with matching residence
                const combinedConditions = [...residenceConditions];
                if (nonCurrentAssetConditions.length > 0) {
                    combinedConditions.push(...nonCurrentAssetConditions);
                }
                
                const query = {
                    date: { 
                        $lte: monthEndDate  // All transactions up to and including month end (cumulative)
                    },
                    status: 'posted',  // Only include posted transactions
                    $or: combinedConditions
                };
                
                const entries = await TransactionEntry.find(query).populate('residence');
                
                console.log(`Found ${entries.length} cumulative transaction entries up to ${monthNames[monthIndex]} end for residence ${residenceId}`);
                
                // Calculate account balances for this month (cumulative up to month end)
                let accountBalances = {};
                
                entries.forEach(entry => {
                    if (entry.entries && entry.entries.length > 0) {
                        entry.entries.forEach(line => {
                            const accountCode = line.accountCode;
                            const accountName = line.accountName;
                            const accountType = line.accountType;
                            const debit = line.debit || 0;
                            const credit = line.credit || 0;
                            
                            const key = `${accountCode} - ${accountName}`;
                            if (!accountBalances[key]) {
                                accountBalances[key] = {
                                    code: accountCode,
                                    name: accountName,
                                    type: accountType,
                                    balance: 0,
                                    debit_total: 0,
                                    credit_total: 0
                                };
                            }
                            
                            accountBalances[key].debit_total += debit;
                            accountBalances[key].credit_total += credit;
                            
                            if (accountType === 'Asset' || accountType === 'Expense') {
                                accountBalances[key].balance += debit - credit;
                            } else {
                                accountBalances[key].balance += credit - debit;
                            }
                        });
                    }
                });
                
                // Debug: Log CBZ/Bank account balances for October
                if (monthIndex === 9) { // October is month 9 (0-indexed)
                    const cbzAccounts = Object.keys(accountBalances).filter(key => 
                        key.includes('1001') || key.includes('10003') || 
                        key.toLowerCase().includes('cbz') || key.toLowerCase().includes('bank')
                    );
                    console.log(`🔍 CBZ/Bank accounts for October (cumulative up to ${monthEndDate.toLocaleDateString()}):`);
                    cbzAccounts.forEach(key => {
                        const acc = accountBalances[key];
                        console.log(`   ${key}: Balance = $${acc.balance.toFixed(2)}, Debits = $${acc.debit_total.toFixed(2)}, Credits = $${acc.credit_total.toFixed(2)}`);
                    });
                }
                
                // CRITICAL: Aggregate parent-child accounts BEFORE building structure
                // Get all accounts for reference - declare outside try-catch so it's accessible later
                const Account = require('../models/Account');
                let allAccountsForMonth = [];
                try {
                    allAccountsForMonth = await Account.find({ isActive: true }).sort({ code: 1 });
                    accountBalances = await this.aggregateParentChildAccounts(accountBalances, allAccountsForMonth);
                } catch (aggError) {
                    console.error(`⚠️ Error in aggregation for ${monthNames[monthIndex]}, continuing with original balances:`, aggError.message);
                    // Continue with original balances if aggregation fails
                    // If allAccountsForMonth fetch failed, try to get it again
                    if (allAccountsForMonth.length === 0) {
                        try {
                            allAccountsForMonth = await Account.find({ isActive: true }).sort({ code: 1 });
                        } catch (fetchError) {
                            console.error(`⚠️ Failed to fetch accounts for ${monthNames[monthIndex]}:`, fetchError.message);
                        }
                    }
                }
                
                // Group by account type for this month
                const assets = {};
                const liabilities = {};
                const equity = {};
                
                // CRITICAL: First, explicitly set Accounts Payable from aggregatedBalances
                const apAccountKey = Object.keys(accountBalances).find(key => key.startsWith('2000 -'));
                if (apAccountKey) {
                    const apAccount = accountBalances[apAccountKey];
                    const finalAPBalance = apAccount.balance; // This is the aggregated balance (parent + children)
                    const apKey = `2000 - ${apAccount.name}`;
                    liabilities[apKey] = {
                        balance: finalAPBalance,
                        debit_total: apAccount.debit_total,
                        credit_total: apAccount.credit_total,
                        code: '2000',
                        name: apAccount.name
                    };
                    console.log(`✅ PRE-SET Accounts Payable (2000) for ${monthNames[monthIndex]}: $${finalAPBalance}`);
                }
                
                Object.values(accountBalances).forEach(account => {
                    const key = `${account.code} - ${account.name}`;
                    const accountCode = String(account.code);
                    
                    // CRITICAL: Skip child accounts of Accounts Payable (2000) - their balances are already aggregated into parent
                    if (allAccountsForMonth && allAccountsForMonth.length > 0 && this.isAccountsPayableChildAccount(accountCode, allAccountsForMonth)) {
                        console.log(`⏭️  Skipping AP child account ${accountCode} (${account.name}) for ${monthNames[monthIndex]} - balance already aggregated into parent 2000`);
                        return; // Skip this account entirely
                    }
                    
                    switch (account.type) {
                        case 'Asset':
                            assets[key] = {
                                balance: account.balance,
                                debit_total: account.debit_total,
                                credit_total: account.credit_total,
                                code: account.code,
                                name: account.name
                            };
                            break;
                        case 'Liability':
                            // CRITICAL: For account 2000, skip if already pre-set (to avoid overwriting aggregated balance)
                            if (accountCode === '2000') {
                                // Check if AP was already set in pre-set step
                                const apKey = `2000 - ${account.name}`;
                                if (!liabilities[apKey]) {
                                    // If not pre-set, use aggregated balance from accountBalances
                                    const apAccountDirect = accountBalances[key];
                                    const finalAPBalance = apAccountDirect ? apAccountDirect.balance : account.balance;
                                    liabilities[apKey] = {
                                        balance: finalAPBalance,
                                        debit_total: account.debit_total,
                                        credit_total: account.credit_total,
                                        code: account.code,
                                        name: account.name
                                    };
                                    console.log(`✅ Set Accounts Payable (2000) in loop for ${monthNames[monthIndex]}: $${finalAPBalance}`);
                                } else {
                                    // Already pre-set, just verify it has the correct aggregated balance
                                    const apAccountDirect = accountBalances[key];
                                    const finalAPBalance = apAccountDirect ? apAccountDirect.balance : account.balance;
                                    if (Math.abs(liabilities[apKey].balance - finalAPBalance) > 0.01) {
                                        console.log(`⚠️ Fixing AP balance mismatch for ${monthNames[monthIndex]}: was $${liabilities[apKey].balance}, should be $${finalAPBalance}`);
                                        liabilities[apKey].balance = finalAPBalance;
                                    }
                                }
                            } else {
                                // Other liabilities - add normally
                            liabilities[key] = {
                                balance: account.balance,
                                debit_total: account.debit_total,
                                credit_total: account.credit_total,
                                code: account.code,
                                name: account.name
                            };
                            }
                            break;
                        case 'Equity':
                            equity[key] = {
                                balance: account.balance,
                                debit_total: account.debit_total,
                                credit_total: account.credit_total,
                                code: account.code,
                                name: account.name
                            };
                            break;
                    }
                });
                
                // CRITICAL FIX: Ensure Accounts Payable balance is ALWAYS set correctly from aggregatedBalances
                // Find ALL keys that start with "2000 -" in case there are multiple (shouldn't be, but just in case)
                const finalAPAccountKeys = Object.keys(accountBalances).filter(key => key.startsWith('2000 -'));
                if (finalAPAccountKeys.length > 0) {
                    // Use the first one (should only be one)
                    const finalAPAccountKey = finalAPAccountKeys[0];
                    const finalAPAccount = accountBalances[finalAPAccountKey];
                    const finalAggregatedBalance = finalAPAccount.balance;
                    
                    // Find the AP entry in liabilities (might have different name format)
                    const apKeyInLiabilities = Object.keys(liabilities).find(key => key.startsWith('2000 -'));
                    
                    if (apKeyInLiabilities) {
                        // Update existing entry with aggregated balance
                        const oldBalance = liabilities[apKeyInLiabilities].balance;
                        liabilities[apKeyInLiabilities].balance = finalAggregatedBalance;
                        console.log(`✅ Accounts Payable (2000) FINAL AGGREGATED BALANCE for ${monthNames[monthIndex]}: $${finalAggregatedBalance} (was $${oldBalance})`);
                        
                        if (Math.abs(oldBalance - finalAggregatedBalance) > 0.01) {
                            console.log(`⚠️ FIXED: AP balance was incorrect! Updated from $${oldBalance} to $${finalAggregatedBalance}`);
                        }
                    } else {
                        // Not found, add it using the key from accountBalances
                        liabilities[finalAPAccountKey] = {
                            balance: finalAggregatedBalance,
                            debit_total: finalAPAccount.debit_total,
                            credit_total: finalAPAccount.credit_total,
                            code: '2000',
                            name: finalAPAccount.name
                        };
                        console.log(`✅ Added Accounts Payable (2000) with aggregated balance for ${monthNames[monthIndex]}: $${finalAggregatedBalance}`);
                    }
                } else {
                    console.log(`⚠️ WARNING: Account 2000 NOT FOUND in accountBalances for ${monthNames[monthIndex]} when doing final verification!`);
                }
                
                // Calculate totals for this month
                const totalAssets = Object.values(assets).reduce((sum, account) => sum + account.balance, 0);
                const totalLiabilities = Object.values(liabilities).reduce((sum, account) => sum + account.balance, 0);
                const explicitEquity = Object.values(equity).reduce((sum, account) => sum + account.balance, 0);
                
                // Calculate implied equity from accounting equation: Equity = Assets - Liabilities
                const calculatedEquity = totalAssets - totalLiabilities;
                const retainedEarnings = calculatedEquity - explicitEquity;
                
                // Add retained earnings to equity if it's positive
                if (retainedEarnings > 0) {
                    equity['Retained Earnings'] = {
                        balance: retainedEarnings,
                        debit_total: 0,
                        credit_total: retainedEarnings,
                        code: '3101',
                        name: 'Retained Earnings'
                    };
                }
                
                const totalEquity = calculatedEquity;
                
                // Update monthly breakdown
                monthlyBreakdown[monthIndex].assets = assets;
                monthlyBreakdown[monthIndex].liabilities = liabilities;
                monthlyBreakdown[monthIndex].equity = equity;
                monthlyBreakdown[monthIndex].total_assets = totalAssets;
                monthlyBreakdown[monthIndex].total_liabilities = totalLiabilities;
                monthlyBreakdown[monthIndex].total_equity = totalEquity;
                monthlyBreakdown[monthIndex].transaction_count = entries.length;
                monthlyBreakdown[monthIndex].accounting_equation_balanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;
                
                console.log(`  ${monthNames[monthIndex]} Balance Sheet Changes:`);
                console.log(`    Asset Changes: $${totalAssets.toFixed(2)}`);
                console.log(`    Liability Changes: $${totalLiabilities.toFixed(2)}`);
                console.log(`    Equity Changes: $${totalEquity.toFixed(2)}`);
                console.log(`    Balanced: ${monthlyBreakdown[monthIndex].accounting_equation_balanced ? '✅' : '❌'}`);
            }
            
            // Calculate annual summary
            const annualSummary = {
                totalAnnualAssets: Object.values(monthlyBreakdown).reduce((sum, month) => sum + month.total_assets, 0) / 12,
                totalAnnualLiabilities: Object.values(monthlyBreakdown).reduce((sum, month) => sum + month.total_liabilities, 0) / 12,
                totalAnnualEquity: Object.values(monthlyBreakdown).reduce((sum, month) => sum + month.total_equity, 0) / 12
            };
            
            return {
                success: true,
                data: {
                    monthly: monthlyBreakdown,
                    annualSummary
                },
                message: `Monthly balance sheet breakdown generated for ${period} (${basis} basis) - Residence: ${residenceInfo.name}`
            };
            
        } catch (error) {
            console.error('Error generating residence-filtered monthly balance sheet:', error);
            throw error;
        }
    }
    
    /**
     * Aggregate parent-child accounts (similar to simpleBalanceSheetService)
     * Aggregates child account balances into parent accounts (e.g., 2000 + children)
     * @param {Object} accountBalances - Object of account balances (key: "code - name", value: account data)
     * @param {Array} allAccounts - Array of all Account documents from database
     * @returns {Object} Aggregated account balances
     */
    static async aggregateParentChildAccounts(accountBalances, allAccounts) {
        const aggregatedBalances = { ...accountBalances }; // Copy all accounts
        
        try {
            const Account = require('../models/Account');
            
            // --- ACCOUNTS PAYABLE (2000) AGGREGATION ---
            const apParentAccount = await Account.findOne({ code: '2000' });
            if (apParentAccount) {
                console.log(`🔍 Found AP parent account 2000 with _id: ${apParentAccount._id}`);
                
                // Get all child accounts that explicitly have parentAccount = apParentAccount._id
                const apChildAccounts = await Account.find({
                    parentAccount: apParentAccount._id,
                    isActive: true
                });
                
                console.log(`🔗 Found ${apChildAccounts.length} explicit child accounts for AP parent 2000`);
                apChildAccounts.forEach(child => {
                    console.log(`   ✅ AP Child: ${child.code} - ${child.name} (parentAccount: ${child.parentAccount})`);
                });
                
                // Find the parent account in accountBalances (key format: "2000 - Account Name")
                const parentAccountKey = Object.keys(aggregatedBalances).find(key => key.startsWith('2000 -'));
                if (parentAccountKey) {
                    const parentAccount = aggregatedBalances[parentAccountKey];
                    console.log(`📊 AP Parent Account (2000) BEFORE aggregation: Balance = $${parentAccount.balance.toFixed(2)}, Debits = $${parentAccount.debit_total.toFixed(2)}, Credits = $${parentAccount.credit_total.toFixed(2)}`);
                    
                    let totalChildBalance = 0;
                    apChildAccounts.forEach(childAccount => {
                        const childCode = String(childAccount.code);
                        // Find child account in accountBalances (key format: "code - name")
                        const childAccountKey = Object.keys(aggregatedBalances).find(key => key.startsWith(`${childCode} -`));
                        
                        if (childAccountKey && childCode !== '2000') {
                            const childBalance = aggregatedBalances[childAccountKey];
                            totalChildBalance += childBalance.balance;
                            console.log(`   💰 Aggregating explicit AP child ${childCode} (${childAccount.name}): $${childBalance.balance.toFixed(2)}`);
                        }
                    });
                    
                    // Add the aggregated child balances to parent
                    const originalAPBalance = parentAccount.balance;
                    parentAccount.balance = originalAPBalance + totalChildBalance;
                    
                    console.log(`📊 Accounts Payable (2000): Original = $${originalAPBalance.toFixed(2)}, Added from children = $${totalChildBalance.toFixed(2)}, Final = $${parentAccount.balance.toFixed(2)}`);
                } else {
                    console.log(`⚠️ WARNING: AP Parent Account (2000) NOT FOUND in accountBalances!`);
                    console.log(`   Available account keys:`, Object.keys(aggregatedBalances).filter(k => k.includes('2000')).slice(0, 10));
                }
            }
            
            // --- ACCOUNTS RECEIVABLE (1100) AGGREGATION ---
            const arParentAccount = await Account.findOne({ code: '1100' });
            if (arParentAccount) {
                console.log(`🔍 Found AR parent account 1100 with _id: ${arParentAccount._id}`);
                
                const arChildAccounts = await Account.find({
                    parentAccount: arParentAccount._id,
                    isActive: true
                });
                
                console.log(`🔗 Found ${arChildAccounts.length} explicit child accounts for AR parent 1100`);
                arChildAccounts.forEach(child => {
                    console.log(`   ✅ AR Child: ${child.code} - ${child.name} (parentAccount: ${child.parentAccount})`);
                });
                
                const parentAccountKey = Object.keys(aggregatedBalances).find(key => key.startsWith('1100 -'));
                if (parentAccountKey) {
                    const parentAccount = aggregatedBalances[parentAccountKey];
                    let totalChildBalance = 0;
                    
                    arChildAccounts.forEach(childAccount => {
                        const childCode = String(childAccount.code);
                        const childAccountKey = Object.keys(aggregatedBalances).find(key => key.startsWith(`${childCode} -`));
                        
                        if (childAccountKey && childCode !== '1100') {
                            const childBalance = aggregatedBalances[childAccountKey];
                            totalChildBalance += childBalance.balance;
                            console.log(`   💰 Aggregating explicit AR child ${childCode} (${childAccount.name}): $${childBalance.balance.toFixed(2)}`);
                        }
                    });
                    
                    const originalARBalance = parentAccount.balance;
                    parentAccount.balance = originalARBalance + totalChildBalance;
                    
                    console.log(`📊 Accounts Receivable (1100): Original = $${originalARBalance.toFixed(2)}, Added from children = $${totalChildBalance.toFixed(2)}, Final = $${parentAccount.balance.toFixed(2)}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Error aggregating parent-child accounts:', error);
            // Don't throw - return the original balances if aggregation fails
            console.log('⚠️ Returning original balances due to aggregation error');
        }
        
        return aggregatedBalances;
    }
    
    /**
     * Check if an account code is a child account of Accounts Payable (2000)
     * @param {string} accountCode - The account code to check
     * @param {Array} allAccounts - Array of all Account documents
     * @returns {boolean} True if it's an AP child account
     */
    static isAccountsPayableChildAccount(accountCode, allAccounts) {
        if (!allAccounts || !Array.isArray(allAccounts)) {
            return false;
        }
        
        const account = allAccounts.find(acc => String(acc.code) === String(accountCode));
        
        if (account && account.parentAccount) {
            // Check if the parent account is 2000
            const parentAccount = allAccounts.find(acc => String(acc.code) === '2000');
            if (parentAccount && account.parentAccount.toString() === parentAccount._id.toString()) {
                return true;
            }
        }
        
        return false;
    }
}

module.exports = FinancialReportingService; 