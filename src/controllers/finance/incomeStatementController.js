const TransactionEntry = require('../../models/TransactionEntry');
const Account = require('../../models/Account');
const IncomeStatement = require('../../models/finance/IncomeStatement');
const { validateMongoId } = require('../../utils/validators');
const { createAuditLog } = require('../../utils/auditLogger');
const AuditLog = require('../../models/AuditLog');

class IncomeStatementController {
    
    /**
     * Get account display name for income statement accounts
     */
    static getAccountDisplayName(accountCode) {
        const accountNames = {
            '4001': 'Rental Income - School Accommodation',
            '4002': 'Rental Income - Private Accommodation', 
            '4003': 'Admin Fees Income',
            '4004': 'Utilities Income',
            '4005': 'Forfeit Income',
            '4006': 'Other Income',
            '5001': 'Maintenance Expenses',
            '5002': 'Cleaning Expenses',
            '5003': 'Utilities - Electricity',
            '5004': 'Utilities - Water',
            '5005': 'Utilities - Gas',
            '5006': 'Utilities - Internet',
            '5007': 'Security Expenses',
            '5008': 'Administrative Expenses',
            '5009': 'Other Operating Expenses',
            '5010': 'Marketing Expenses',
            '5011': 'Legal Expenses',
            '5012': 'Insurance Expenses'
        };
        
        return accountNames[accountCode] || `Account ${accountCode}`;
    }

    /**
     * Get detailed transactions for a specific account and month for income statement drill-down
     * GET /api/finance/income-statement/account-details?period=2025&month=july&accountCode=4001
     */
    static async getAccountTransactionDetails(req, res) {
        try {
            const { period, month, accountCode, residenceId, sourceType } = req.query;
            
            console.log(`📋 Income Statement Drill-down Query parameters:`, { period, month, accountCode, residenceId, sourceType });
            
            if (!period || !month || !accountCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Period, month, and accountCode parameters are required'
                });
            }
            
            // Convert month name to month number
            const monthNames = {
                'january': 0, 'february': 1, 'march': 2, 'april': 3,
                'may': 4, 'june': 5, 'july': 6, 'august': 7,
                'september': 8, 'october': 9, 'november': 10, 'december': 11
            };
            
            const monthNumber = monthNames[month.toLowerCase()];
            if (monthNumber === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid month name. Use full month names like "january", "february", etc.'
                });
            }
            
            // For income statement, we need data for the specific month only
            // Create dates in UTC to avoid timezone issues
            const startOfMonth = new Date(Date.UTC(parseInt(period), monthNumber, 1, 0, 0, 0, 0));
            const endOfMonth = new Date(Date.UTC(parseInt(period), monthNumber + 1, 0, 23, 59, 59, 999));
            
            console.log(`🔍 Searching for transactions for account ${accountCode} in ${month} ${period}`);
            console.log(`📅 Date range: ${startOfMonth.toLocaleDateString()} to ${endOfMonth.toLocaleDateString()}`);
            
            // Check if this is a parent account that should include child accounts
            const mainAccount = await Account.findOne({ code: accountCode });
            let childAccounts = [];
            let allAccountCodes = [accountCode];
            
            if (mainAccount && (accountCode.startsWith('400') || accountCode.startsWith('500'))) {
                console.log(`🔗 Found parent account ${accountCode}, looking for child accounts...`);
                
                // Find child accounts for income or expense accounts
                childAccounts = await Account.find({
                    parentAccount: mainAccount._id,
                    isActive: true,
                    type: mainAccount.type
                }).select('code name type category');
                
                // Add child account codes to the search
                allAccountCodes = [accountCode, ...childAccounts.map(child => child.code)];
                
                console.log(`📊 Found ${childAccounts.length} child accounts for ${accountCode}:`, 
                    childAccounts.map(c => `${c.code} - ${c.name}`));
            }
            
            // Build comprehensive query for the specific month - handle ALL possible transaction structures
            const query = {
                $or: [
                    // Actual transactions created in the month
                    {
                        date: { 
                            $gte: startOfMonth,
                            $lte: endOfMonth
                        },
                        status: 'posted',
                        'entries.accountCode': { $in: allAccountCodes }
                    },
                    // All transactions with accrual metadata for this month
                    {
                        'metadata.accrualMonth': monthNumber,
                        'metadata.accrualYear': parseInt(period),
                        status: 'posted',
                        'entries.accountCode': { $in: allAccountCodes }
                    },
                    // Transactions with monthSettled metadata (your payment structure)
                    {
                        'metadata.monthSettled': `${period}-${String(monthNumber + 1).padStart(2, '0')}`,
                        status: 'posted',
                        'entries.accountCode': { $in: allAccountCodes }
                    },
                    // Rental accrual transactions for this month
                    {
                        source: 'rental_accrual',
                        'metadata.accrualMonth': monthNumber,
                        'metadata.accrualYear': parseInt(period),
                        status: 'posted',
                        'entries.accountCode': { $in: allAccountCodes }
                    },
                    // Lease start transactions for this month
                    {
                        source: 'rental_accrual',
                        'metadata.type': 'lease_start',
                        'metadata.accrualMonth': monthNumber,
                        'metadata.accrualYear': parseInt(period),
                        status: 'posted',
                        'entries.accountCode': { $in: allAccountCodes }
                    },
                    // Monthly rent accruals for this month (exclude wrong accrual month)
                    {
                        source: 'rental_accrual',
                        'metadata.type': 'monthly_rent_accrual',
                        'metadata.accrualMonth': monthNumber + 1, // Convert 0-based to 1-based
                        'metadata.accrualYear': parseInt(period),
                        status: 'posted',
                        'entries.accountCode': { $in: allAccountCodes }
                    },
                    // Any transaction with month metadata for this month (exclude wrong month metadata)
                    {
                        'metadata.month': `${period}-${String(monthNumber + 1).padStart(2, '0')}`,
                        status: 'posted',
                        'entries.accountCode': { $in: allAccountCodes }
                    },
                    // Find original accruals that are referenced by adjustments (but only if they affect this month)
                    {
                        'metadata.originalAccrualId': { $exists: true },
                        'metadata.accrualMonth': monthNumber,
                        'metadata.accrualYear': parseInt(period),
                        status: 'posted',
                        'entries.accountCode': { $in: allAccountCodes }
                    },
                    // Manual transactions (negotiated payments, adjustments, etc.) for this month
                    {
                        source: 'manual',
                        'metadata.accrualMonth': monthNumber + 1, // Convert 0-based to 1-based
                        'metadata.accrualYear': parseInt(period),
                        status: 'posted',
                        'entries.accountCode': { $in: allAccountCodes }
                    }
                ]
            };
            
            // Skip the original accrual lookup for now to avoid including transactions from other months
            // This ensures we only get transactions that directly affect the selected month
            
            if (residenceId) {
                // Add residence filtering to each condition in the $or array
                query.$or = query.$or.map(condition => ({
                    ...condition,
                    $or: [
                        { residence: residenceId },
                        { 'metadata.residenceId': residenceId },
                        { 'metadata.residence': residenceId }
                    ]
                }));
            }
            
            console.log(`📊 Income Statement Query:`, JSON.stringify(query, null, 2));
            
            // Find all relevant transactions
            const transactions = await TransactionEntry.find(query)
                .populate('residence')
                .sort({ date: 1 });
            
            // Filter out transactions with wrong month metadata
            const filteredTransactions = transactions.filter(transaction => {
                // For monthly accruals, check if the month metadata matches the requested month
                if (transaction.metadata?.type === 'monthly_rent_accrual') {
                    const transactionMonth = transaction.metadata?.month;
                    const expectedMonth = `${period}-${String(monthNumber + 1).padStart(2, '0')}`;
                    return transactionMonth === expectedMonth;
                }
                
                // For lease start transactions, check if they're in the requested month
                if (transaction.metadata?.type === 'lease_start') {
                    const transactionMonth = transaction.metadata?.month;
                    const expectedMonth = `${period}-${String(monthNumber + 1).padStart(2, '0')}`;
                    return transactionMonth === expectedMonth;
                }
                
                // For negotiated payment adjustments, check if they're for the requested month
                if (transaction.metadata?.transactionType === 'negotiated_payment_adjustment') {
                    const accrualMonth = transaction.metadata?.accrualMonth;
                    const accrualYear = transaction.metadata?.accrualYear;
                    return accrualMonth === (monthNumber + 1) && accrualYear === parseInt(period);
                }
                
                // For other transactions, include them if they're dated in the requested month
                const transactionDate = new Date(transaction.date);
                const transactionYear = transactionDate.getFullYear();
                const transactionMonth = transactionDate.getMonth() + 1;
                return transactionYear === parseInt(period) && transactionMonth === (monthNumber + 1);
            });
            
            console.log(`📈 Found ${filteredTransactions.length} transactions for account ${accountCode} in ${month} ${period}`);
            
            // Extract account-specific transactions (including child accounts)
            const accountTransactions = [];
            let totalDebits = 0;
            let totalCredits = 0;
            const uniqueStudents = new Set();
            const accountBreakdown = {}; // Track transactions by account code
            
            filteredTransactions.forEach(transaction => {
                // Filter entries for all relevant account codes (parent + children)
                const relevantEntries = transaction.entries.filter(entry => 
                    allAccountCodes.includes(entry.accountCode)
                );
                
                relevantEntries.forEach(entry => {
                    const debitAmount = entry.debit || 0;
                    const creditAmount = entry.credit || 0;
                    
                    // Apply sourceType filtering if specified
                    if (sourceType) {
                        const description = transaction.description?.toLowerCase() || '';
                        const sourceTypeLower = sourceType.toLowerCase();
                        
                        let shouldInclude = false;
                        
                        if (sourceTypeLower === 'rental' || sourceTypeLower === 'rental income') {
                            shouldInclude = description.includes('rent') || description.includes('rental') || 
                                          description.includes('accommodation');
                        } else if (sourceTypeLower === 'admin' || sourceTypeLower === 'admin fees') {
                            shouldInclude = description.includes('admin') || description.includes('fee');
                        } else if (sourceTypeLower === 'utilities' || sourceTypeLower === 'utilities income') {
                            shouldInclude = description.includes('utilities') || description.includes('electricity') || 
                                          description.includes('water') || description.includes('gas');
                        } else if (sourceTypeLower === 'expenses' || sourceTypeLower === 'operating expenses') {
                            shouldInclude = description.includes('expense') || description.includes('maintenance') || 
                                          description.includes('cleaning') || description.includes('utilities');
                        } else if (sourceTypeLower === 'maintenance') {
                            shouldInclude = description.includes('maintenance') || description.includes('repair') || 
                                          description.includes('fix');
                        } else if (sourceTypeLower === 'cleaning') {
                            shouldInclude = description.includes('cleaning') || description.includes('housekeeping');
                        }
                        
                        if (!shouldInclude) {
                            return; // Skip this transaction if it doesn't match the sourceType filter
                        }
                    }
                    
                    totalDebits += debitAmount;
                    totalCredits += creditAmount;
                    
                    // Track breakdown by account code
                    if (!accountBreakdown[entry.accountCode]) {
                        accountBreakdown[entry.accountCode] = {
                            totalDebits: 0,
                            totalCredits: 0,
                            transactionCount: 0
                        };
                    }
                    accountBreakdown[entry.accountCode].totalDebits += debitAmount;
                    accountBreakdown[entry.accountCode].totalCredits += creditAmount;
                    accountBreakdown[entry.accountCode].transactionCount += 1;
                    
                    // Get student information if available
                    let studentName = 'N/A';
                    let debtorName = 'N/A';
                    
                    if (transaction.metadata?.studentName) {
                        studentName = transaction.metadata.studentName;
                        uniqueStudents.add(studentName);
                    } else if (transaction.metadata?.debtorName) {
                        debtorName = transaction.metadata.debtorName;
                        uniqueStudents.add(debtorName);
                    }
                    
                    // Determine if this is a child account transaction
                    const isChildAccount = entry.accountCode !== accountCode;
                    const childAccountInfo = childAccounts.find(child => child.code === entry.accountCode);
                    
                    accountTransactions.push({
                        transactionId: transaction.transactionId || transaction._id,
                        date: transaction.date,
                        amount: debitAmount || creditAmount,
                        type: debitAmount > 0 ? 'debit' : 'credit',
                        description: transaction.description,
                        accountCode: entry.accountCode,
                        accountName: entry.accountName,
                        debtorName,
                        studentName,
                        reference: transaction.reference,
                        source: transaction.source,
                        // Income statement specific fields
                        netAmount: debitAmount - creditAmount, // Net effect on account
                        debit: debitAmount,
                        credit: creditAmount,
                        // Child account information
                        isChildAccount,
                        childAccountName: isChildAccount ? (childAccountInfo?.name || 'Unknown Child Account') : null,
                        parentAccountCode: isChildAccount ? accountCode : null,
                        // Additional metadata
                        residence: transaction.residence?.name || 'N/A',
                        metadata: transaction.metadata || {}
                    });
                });
            });
            
            // Sort transactions by date (newest first for income statement view)
            accountTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Calculate running balance for income statement accounts
            let runningBalance = 0;
            const isIncomeAccount = accountCode.startsWith('4');
            
            // For income statement, calculate the final balance based on account type
            accountTransactions.reverse(); // Reverse to calculate from oldest to newest
            accountTransactions.forEach(transaction => {
                if (isIncomeAccount) {
                    // Income: Credit increases, Debit decreases
                    runningBalance += (transaction.credit || 0) - (transaction.debit || 0);
                } else {
                    // Expenses: Debit increases, Credit decreases
                    runningBalance += (transaction.debit || 0) - (transaction.credit || 0);
                }
                transaction.runningBalance = runningBalance;
            });
            accountTransactions.reverse(); // Reverse back to newest first for display
            
            // Calculate child account summary
            const childAccountSummary = childAccounts.map(child => {
                const breakdown = accountBreakdown[child.code] || { totalDebits: 0, totalCredits: 0, transactionCount: 0 };
                return {
                    accountCode: child.code,
                    accountName: child.name,
                    totalDebits: breakdown.totalDebits,
                    totalCredits: breakdown.totalCredits,
                    transactionCount: breakdown.transactionCount,
                    netAmount: breakdown.totalDebits - breakdown.totalCredits
                };
            });
            
            const summary = {
                totalTransactions: accountTransactions.length,
                totalAmount: Math.abs(totalDebits - totalCredits),
                totalDebits,
                totalCredits,
                finalBalance: runningBalance,
                uniqueStudents: uniqueStudents.size,
                dateRange: {
                    start: startOfMonth.toISOString().split('T')[0],
                    end: endOfMonth.toISOString().split('T')[0]
                },
                // Child account information
                hasChildAccounts: childAccounts.length > 0,
                childAccountCount: childAccounts.length,
                childAccountSummary,
                accountBreakdown
            };
            
            console.log(`📊 Income Statement Summary for ${accountCode}:`, summary);
            
            res.json({
                success: true,
                data: {
                    accountCode,
                    accountName: IncomeStatementController.getAccountDisplayName(accountCode),
                    month,
                    period,
                    dateRange: {
                        start: startOfMonth.toISOString().split('T')[0],
                        end: endOfMonth.toISOString().split('T')[0]
                    },
                    sourceType: sourceType || null,
                    summary,
                    transactions: accountTransactions,
                    // Additional child account information with balances
                    childAccounts: childAccounts.map(child => {
                        // Calculate balance for this child account
                        let childBalance = 0;
                        let childDebits = 0;
                        let childCredits = 0;
                        
                        transactions.forEach(transaction => {
                            transaction.entries.forEach(entry => {
                                if (entry.accountCode === child.code) {
                                    const debit = entry.debit || 0;
                                    const credit = entry.credit || 0;
                                    childDebits += debit;
                                    childCredits += credit;
                                    
                                    // Balance based on account type: Income (credit - debit), Expenses (debit - credit)
                                    const isIncome = child.type === 'Income';
                                    if (isIncome) {
                                        childBalance += credit - debit;
                                    } else {
                                        childBalance += debit - credit;
                                    }
                                }
                            });
                        });
                        
                        return {
                            accountCode: child.code,
                            accountName: child.name,
                            accountType: child.type,
                            totalDebits: childDebits,
                            totalCredits: childCredits,
                            netBalance: childBalance,
                            transactionCount: accountBreakdown[child.code]?.transactionCount || 0
                        };
                    })
                },
                message: `Account details retrieved for ${IncomeStatementController.getAccountDisplayName(accountCode)} in ${month} ${period}`
            });
            
        } catch (error) {
            console.error('❌ Error getting income statement account details:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving account details',
                error: error.message
            });
        }
    }

    /**
     * Get all income statements
     */
    static async getAllIncomeStatements(req, res) {
        try {
            const {
                residence,
                period,
                status,
                startDate,
                endDate,
                page = 1,
                limit = 10,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = req.query;

            // Build filter object
            const filter = {};
            
            if (residence) {
                if (!validateMongoId(residence)) {
                    return res.status(400).json({ error: 'Invalid residence ID format' });
                }
                filter.residence = residence;
            }
            
            if (period) filter.period = period;
            if (status) filter.status = status;
            
            // Date filtering
            if (startDate || endDate) {
                filter.startDate = {};
                if (startDate) filter.startDate.$gte = new Date(startDate);
                if (endDate) filter.endDate.$lte = new Date(endDate);
            }

            // Sorting
            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

            // Pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);
            
            // Get income statements with pagination
            const incomeStatements = await IncomeStatement.find(filter)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .populate('residence', 'name')
                .populate('generatedBy', 'firstName lastName email')
                .populate('approvedBy', 'firstName lastName email');

            // Get total count for pagination
            const totalIncomeStatements = await IncomeStatement.countDocuments(filter);
            const totalPages = Math.ceil(totalIncomeStatements / parseInt(limit));

            res.json({
                success: true,
                data: incomeStatements,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalItems: totalIncomeStatements,
                    itemsPerPage: parseInt(limit)
                }
            });

        } catch (error) {
            console.error('Error fetching income statements:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching income statements',
                error: error.message
            });
        }
    }

    /**
     * Get income statement by ID
     */
    static async getIncomeStatementById(req, res) {
        try {
            const { id } = req.params;

            if (!validateMongoId(id)) {
                return res.status(400).json({ error: 'Invalid income statement ID format' });
            }

            const incomeStatement = await IncomeStatement.findById(id)
                .populate('residence', 'name')
                .populate('generatedBy', 'firstName lastName email')
                .populate('approvedBy', 'firstName lastName email');

            if (!incomeStatement) {
                return res.status(404).json({
                    success: false,
                    message: 'Income statement not found'
                });
            }

            res.json({
                success: true,
                data: incomeStatement
            });

        } catch (error) {
            console.error('Error fetching income statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching income statement',
                error: error.message
            });
        }
    }

    /**
     * Create new income statement
     */
    static async createIncomeStatement(req, res) {
        try {
            const {
                residence,
                period,
                startDate,
                endDate,
                revenue,
                expenses,
                totalRevenue,
                totalExpenses,
                netIncome,
                notes
            } = req.body;

            // Validate required fields
            if (!residence || !period || !startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Residence, period, startDate, and endDate are required'
                });
            }

            if (!validateMongoId(residence)) {
                return res.status(400).json({ error: 'Invalid residence ID format' });
            }

            // Generate unique report ID
            const reportId = `IS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            const incomeStatement = new IncomeStatement({
                residence,
                reportId,
                period,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                revenue: revenue || [],
                expenses: expenses || [],
                totalRevenue: totalRevenue || 0,
                totalExpenses: totalExpenses || 0,
                netIncome: netIncome || 0,
                generatedBy: req.user.id,
                notes
            });

            await incomeStatement.save();

            // Create audit log
            await createAuditLog({
                action: 'CREATE',
                entityType: 'IncomeStatement',
                entityId: incomeStatement._id,
                performedBy: req.user.id,
                details: `Created income statement ${reportId} for ${period}`,
                metadata: {
                    residence: incomeStatement.residence,
                    period: incomeStatement.period,
                    totalRevenue: incomeStatement.totalRevenue,
                    totalExpenses: incomeStatement.totalExpenses,
                    netIncome: incomeStatement.netIncome
                }
            });

            res.status(201).json({
                success: true,
                data: incomeStatement,
                message: 'Income statement created successfully'
            });

        } catch (error) {
            console.error('Error creating income statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating income statement',
                error: error.message
            });
        }
    }

    /**
     * Update income statement
     */
    static async updateIncomeStatement(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            if (!validateMongoId(id)) {
                return res.status(400).json({ error: 'Invalid income statement ID format' });
            }

            const incomeStatement = await IncomeStatement.findById(id);
            if (!incomeStatement) {
                return res.status(404).json({
                    success: false,
                    message: 'Income statement not found'
                });
            }

            // Update fields
            Object.keys(updateData).forEach(key => {
                if (updateData[key] !== undefined) {
                    incomeStatement[key] = updateData[key];
                }
            });

            incomeStatement.updatedAt = new Date();
            await incomeStatement.save();

            // Create audit log
            await createAuditLog({
                action: 'UPDATE',
                entityType: 'IncomeStatement',
                entityId: incomeStatement._id,
                performedBy: req.user.id,
                details: `Updated income statement ${incomeStatement.reportId}`,
                metadata: {
                    updatedFields: Object.keys(updateData),
                    residence: incomeStatement.residence,
                    period: incomeStatement.period
                }
            });

            res.json({
                success: true,
                data: incomeStatement,
                message: 'Income statement updated successfully'
            });

        } catch (error) {
            console.error('Error updating income statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating income statement',
                error: error.message
            });
        }
    }

    /**
     * Delete income statement
     */
    static async deleteIncomeStatement(req, res) {
        try {
            const { id } = req.params;

            if (!validateMongoId(id)) {
                return res.status(400).json({ error: 'Invalid income statement ID format' });
            }

            const incomeStatement = await IncomeStatement.findById(id);
            if (!incomeStatement) {
                return res.status(404).json({
                    success: false,
                    message: 'Income statement not found'
                });
            }

            // Create audit log before deletion
            await createAuditLog({
                action: 'DELETE',
                entityType: 'IncomeStatement',
                entityId: incomeStatement._id,
                performedBy: req.user.id,
                details: `Deleted income statement ${incomeStatement.reportId}`,
                metadata: {
                    residence: incomeStatement.residence,
                    period: incomeStatement.period,
                    totalRevenue: incomeStatement.totalRevenue,
                    totalExpenses: incomeStatement.totalExpenses,
                    netIncome: incomeStatement.netIncome
                }
            });

            await IncomeStatement.findByIdAndDelete(id);

            res.json({
                success: true,
                message: 'Income statement deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting income statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting income statement',
                error: error.message
            });
        }
    }

    /**
     * Approve income statement
     */
    static async approveIncomeStatement(req, res) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            if (!validateMongoId(id)) {
                return res.status(400).json({ error: 'Invalid income statement ID format' });
            }

            const incomeStatement = await IncomeStatement.findById(id);
            if (!incomeStatement) {
                return res.status(404).json({
                    success: false,
                    message: 'Income statement not found'
                });
            }

            incomeStatement.status = 'Published';
            incomeStatement.approvedBy = req.user.id;
            incomeStatement.approvedDate = new Date();
            if (notes) incomeStatement.notes = notes;

            await incomeStatement.save();

            // Create audit log
            await createAuditLog({
                action: 'APPROVE',
                entityType: 'IncomeStatement',
                entityId: incomeStatement._id,
                performedBy: req.user.id,
                details: `Approved income statement ${incomeStatement.reportId}`,
                metadata: {
                    residence: incomeStatement.residence,
                    period: incomeStatement.period,
                    approvedDate: incomeStatement.approvedDate,
                    notes: notes
                }
            });

            res.json({
                success: true,
                data: incomeStatement,
                message: 'Income statement approved successfully'
            });

        } catch (error) {
            console.error('Error approving income statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error approving income statement',
                error: error.message
            });
        }
    }
}

module.exports = IncomeStatementController;