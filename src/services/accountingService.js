const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');

class AccountingService {
    /**
     * Create monthly rent accruals (Accrual Basis)
     * This records income when earned, not when received
     */
    static async createMonthlyAccruals(month, year) {
        try {
            console.log(`🔄 Creating monthly accruals for ${month}/${year}...`);
            
            // Get all active students for this month
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            const activeStudents = await mongoose.connection.db
                .collection('applications')
                .find({
                    status: 'approved',
                    startDate: { $lte: monthEnd },
                    endDate: { $gte: monthStart },
                    paymentStatus: { $ne: 'cancelled' }
                }).toArray();
            
            console.log(`📊 Found ${activeStudents.length} active students for ${month}/${year}`);
            
            // Get residences for room pricing
            const residences = await mongoose.connection.db
                .collection('residences')
                .find({}).toArray();
            const residenceMap = {};
            residences.forEach(r => residenceMap[r._id.toString()] = r);
            
            let accrualsCreated = 0;
            
            for (const student of activeStudents) {
                // Check if accrual already exists
                const existingAccrual = await TransactionEntry.findOne({
                    'metadata.type': 'rent_accrual',
                    'metadata.studentId': student._id,
                    'metadata.accrualMonth': month,
                    'metadata.accrualYear': year,
                    status: 'posted'
                });
                
                if (existingAccrual) {
                    console.log(`⏭️  Accrual already exists for ${student.firstName} ${student.lastName}`);
                    continue;
                }
                
                // Get room pricing
                const residence = residenceMap[student.residence?.toString()];
                const allocatedRoom = student.allocatedRoom || student.preferredRoom;
                
                let monthlyRent = 200;
                let monthlyAdminFee = 20;
                
                if (residence && allocatedRoom && residence.rooms) {
                    const roomData = residence.rooms.find(room => 
                        room.roomNumber === allocatedRoom || 
                        room.name === allocatedRoom ||
                        room._id?.toString() === allocatedRoom
                    );
                    
                    if (roomData?.price) {
                    monthlyRent = roomData.price;
                    
                        // Billing structure based on residence
                    if (residence.name.includes('St Kilda')) {
                        const leaseStartMonth = new Date(student.startDate).getMonth() + 1;
                        const leaseStartYear = new Date(student.startDate).getFullYear();
                        
                        if (month === leaseStartMonth && year === leaseStartYear) {
                                monthlyAdminFee = 20;
                        } else {
                                monthlyAdminFee = 0;
                            }
                    } else if (residence.name.includes('Belvedere')) {
                        monthlyAdminFee = 0;
                    } else {
                        monthlyAdminFee = 0;
                    }
                }
                }
                
                const totalAccrued = monthlyRent + monthlyAdminFee;
                
                // Create accrual transaction
                const transaction = new Transaction({
                    transactionId: `ACC-${year}${month.toString().padStart(2, '0')}-${student._id.toString().slice(-6)}`,
                    date: new Date(year, month - 1, 1),
                    description: `Monthly Rent & Admin Accrual - ${student.firstName} ${student.lastName} - ${month}/${year}`,
                    type: 'accrual',
                    residence: student.residence || new mongoose.Types.ObjectId(),
                    createdBy: new mongoose.Types.ObjectId(),
                    amount: totalAccrued,
                    metadata: {
                        type: 'rent_accrual',
                        studentId: student._id,
                        studentName: `${student.firstName} ${student.lastName}`,
                        accrualMonth: month,
                        accrualYear: year,
                        monthlyRent,
                        monthlyAdminFee,
                        residence: residence?.name || 'Unknown'
                    }
                });
                
                await transaction.save();
                
                // Create double-entry accrual
                const accrualEntry = new TransactionEntry({
                    transactionId: transaction._id.toString(),
                    description: `Monthly Rent & Admin Accrual - ${student.firstName} ${student.lastName} - ${month}/${year}`,
                    date: new Date(year, month - 1, 1),
                    totalDebit: totalAccrued,
                    totalCredit: totalAccrued,
                    source: 'rental_accrual',
                    sourceModel: 'TransactionEntry',
                    sourceId: transaction._id,
                    createdBy: 'system@alamait.com',
                    residence: student.residence,
                    entries: [
                        {
                            accountCode: '1100',
                            accountName: 'Accounts Receivable - Tenants',
                            accountType: 'Asset',
                            debit: totalAccrued,
                            credit: 0,
                            description: `Rent & Admin Accrued - ${student.firstName} ${student.lastName}`
                        },
                        {
                            accountCode: '4000',
                            accountName: 'Rental Income',
                            accountType: 'Income',
                            debit: 0,
                            credit: monthlyRent,
                            description: `Monthly Rent Accrued - ${student.firstName} ${student.lastName}`
                        },
                        {
                            accountCode: '4100',
                            accountName: 'Administrative Income',
                            accountType: 'Income',
                            debit: 0,
                            credit: monthlyAdminFee,
                            description: `Monthly Admin Fee Accrued - ${student.firstName} ${student.lastName}`
                        }
                    ],
                    metadata: {
                        type: 'rent_accrual',
                        studentId: student._id,
                        studentName: `${student.firstName} ${student.lastName}`,
                        accrualMonth: month,
                        accrualYear: year,
                        monthlyRent,
                        monthlyAdminFee,
                        residence: residence?.name || 'Unknown',
                        residenceId: student.residence?.toString()
                    }
                });
                
                await accrualEntry.save();
                accrualsCreated++;
                console.log(`✅ Created accrual for ${student.firstName} ${student.lastName}: $${totalAccrued}`);
            }
            
            console.log(`🎉 Created ${accrualsCreated} monthly accruals for ${month}/${year}`);
            return { success: true, accrualsCreated, totalStudents: activeStudents.length };
            
        } catch (error) {
            console.error('❌ Error creating monthly accruals:', error);
            throw error;
        }
    }

    /**
     * Process rent payment (Cash Basis)
     * This reduces Accounts Receivable and increases Cash/Bank
     */
    static async processRentPayment(paymentData) {
        try {
            console.log(`💰 Processing rent payment for student: ${paymentData.studentName}`);
            
            const {
                studentId,
                studentName,
                residenceId,
                residenceName,
                paymentAmount,
                paymentMethod,
                paymentDate,
                month,
                year,
                description,
                createdBy
            } = paymentData;
            
            // Create payment transaction
            const transaction = new Transaction({
                transactionId: `PAY-${year}${month.toString().padStart(2, '0')}-${studentId.toString().slice(-6)}`,
                date: paymentDate,
                description: description || `Rent Payment - ${studentName} - ${month}/${year}`,
                type: 'payment',
                residence: residenceId,
                amount: paymentAmount,
                metadata: {
                    type: 'rent_payment',
                    studentId,
                    studentName,
                    paymentMethod,
                    month,
                    year,
                    residence: residenceName
                }
            });
            
            await transaction.save();
            
            // Create double-entry payment transaction
            const paymentEntry = new TransactionEntry({
                transactionId: transaction._id.toString(),
                description: description || `Rent Payment - ${studentName} - ${month}/${year}`,
                date: paymentDate,
                totalDebit: paymentAmount,
                totalCredit: paymentAmount,
                source: 'payment',
                sourceModel: 'TransactionEntry',
                sourceId: transaction._id,
                createdBy: createdBy || 'system@alamait.com',
                residence: residenceId,
                entries: [
                    {
                        accountCode: this.getCashAccountCode(paymentMethod),
                        accountName: this.getCashAccountName(paymentMethod),
                        accountType: 'Asset',
                        debit: paymentAmount,
                        credit: 0,
                        description: `Rent payment received - ${studentName}`
                    },
                    {
                        accountCode: '1100',
                        accountName: 'Accounts Receivable - Tenants',
                        accountType: 'Asset',
                        debit: 0,
                        credit: paymentAmount,
                        description: `Rent payment received - ${studentName}`
                    }
                ],
                metadata: {
                    type: 'rent_payment',
                    studentId,
                    studentName,
                    paymentMethod,
                    month,
                    year,
                    residence: residenceName,
                    residenceId: residenceId.toString()
                }
            });
            
            await paymentEntry.save();
            
            console.log(`✅ Processed rent payment: $${paymentAmount} for ${studentName}`);
            return { success: true, transactionId: transaction._id, paymentEntryId: paymentEntry._id };
            
        } catch (error) {
            console.error('❌ Error processing rent payment:', error);
            throw error;
        }
    }

    /**
     * Calculate student arrears (Outstanding receivables)
     */
    static async calculateStudentArrears(studentId, asOfDate = new Date()) {
        try {
            console.log(`📊 Calculating arrears for student: ${studentId}`);
            
            // Get all accruals for this student
            const accruals = await TransactionEntry.find({
                'metadata.type': 'rent_accrual',
                'metadata.studentId': studentId,
                date: { $lte: asOfDate },
                status: 'posted'
            });
            
            // Get all payments for this student
            const payments = await TransactionEntry.find({
                'metadata.type': 'rent_payment',
                'metadata.studentId': studentId,
                date: { $lte: asOfDate },
                status: 'posted'
            });
            
            let totalAccrued = 0;
            let totalPaid = 0;
            
            // Calculate total accrued
            for (const accrual of accruals) {
                if (accrual.entries && Array.isArray(accrual.entries)) {
                    for (const entry of accrual.entries) {
                        if (entry.accountCode === '1100') {
                            totalAccrued += entry.debit || 0;
                        }
                    }
                }
            }
            
            // Calculate total paid
            for (const payment of payments) {
                if (payment.entries && Array.isArray(payment.entries)) {
                    for (const entry of payment.entries) {
                        if (entry.accountCode === '1100') {
                            totalPaid += entry.credit || 0;
                        }
                    }
                }
            }
            
            const outstandingBalance = totalAccrued - totalPaid;
            
            return {
                studentId,
                totalAccrued,
                totalPaid,
                outstandingBalance,
                asOfDate,
                isInArrears: outstandingBalance > 0
            };
            
        } catch (error) {
            console.error('❌ Error calculating student arrears:', error);
            throw error;
        }
    }

    /**
     * Calculate residence arrears (All outstanding receivables for a residence)
     */
    static async calculateResidenceArrears(residenceId, asOfDate = new Date()) {
        try {
            console.log(`📊 Calculating arrears for residence: ${residenceId}`);
            
            // Get all accruals for this residence
            const accruals = await TransactionEntry.find({
                'metadata.type': 'rent_accrual',
                'metadata.residenceId': residenceId,
                date: { $lte: asOfDate },
                status: 'posted'
            });
            
            // Get all payments for this residence
            const payments = await TransactionEntry.find({
                'metadata.type': 'rent_payment',
                'metadata.residenceId': residenceId,
                date: { $lte: asOfDate },
                status: 'posted'
            });
            
            let totalAccrued = 0;
            let totalPaid = 0;
            
            // Calculate total accrued
            for (const accrual of accruals) {
                if (accrual.entries && Array.isArray(accrual.entries)) {
                    for (const entry of accrual.entries) {
                        if (entry.accountCode === '1100') {
                            totalAccrued += entry.debit || 0;
                        }
                    }
                }
            }
            
            // Calculate total paid
            for (const payment of payments) {
                if (payment.entries && Array.isArray(payment.entries)) {
                    for (const entry of payment.entries) {
                        if (entry.accountCode === '1100') {
                            totalPaid += entry.credit || 0;
                        }
                    }
                }
            }
            
            const outstandingBalance = totalAccrued - totalPaid;
            
            return {
                residenceId,
                totalAccrued,
                totalPaid,
                outstandingBalance,
                asOfDate,
                isInArrears: outstandingBalance > 0
            };
            
        } catch (error) {
            console.error('❌ Error calculating residence arrears:', error);
            throw error;
        }
    }

    /**
     * Generate comprehensive arrears report for all residences
     */
    static async generateArrearsReport(asOfDate = new Date()) {
        try {
            console.log(`📊 Generating comprehensive arrears report as of ${asOfDate.toDateString()}`);
            
            // Get all residences
            const residences = await mongoose.connection.db
                .collection('residences')
                .find({}).toArray();
            
            const arrearsReport = {
                asOfDate,
                residences: {},
                summary: {
                    totalResidences: residences.length,
                    totalOutstanding: 0,
                    residencesInArrears: 0
                }
            };
            
            for (const residence of residences) {
                const residenceId = residence._id.toString();
                const arrears = await this.calculateResidenceArrears(residenceId, asOfDate);
                
                arrearsReport.residences[residenceId] = {
                    ...arrears,
                    residenceDetails: {
                        id: residenceId,
                        name: residence.name,
                        address: residence.address || 'N/A',
                        type: residence.type || 'N/A'
                    }
                };
                
                if (arrears.isInArrears) {
                    arrearsReport.summary.residencesInArrears++;
                }
                arrearsReport.summary.totalOutstanding += arrears.outstandingBalance;
            }
            
            return arrearsReport;
            
        } catch (error) {
            console.error('❌ Error generating arrears report:', error);
            throw error;
        }
    }

    /**
     * Get cash account code based on payment method
     */
    static getCashAccountCode(paymentMethod) {
        const cashAccounts = {
            'ecocash': '1002',
            'innbucks': '1003', 
            'petty_cash': '1004',
            'bank_transfer': '1001',
            'cash': '1005'
        };
        return cashAccounts[paymentMethod] || '1001';
    }

    /**
     * Get cash account name based on payment method
     */
    static getCashAccountName(paymentMethod) {
        const cashAccountNames = {
            'ecocash': 'Ecocash',
            'innbucks': 'Innbucks',
            'petty_cash': 'Petty Cash',
            'bank_transfer': 'Bank Account',
            'cash': 'Cash on Hand'
        };
        return cashAccountNames[paymentMethod] || 'Bank Account';
    }
    
    /**
     * Generate Monthly Income Statement (Accrual Basis)
     */
    static async generateMonthlyIncomeStatement(month, year, residenceId = null) {
        try {
            // Handle annual summary (when month is null)
            if (month === null) {
                console.log(`📊 Generating Annual Income Statement for ${year}${residenceId ? ` - Residence: ${residenceId}` : ''}...`);
                
                const yearStart = new Date(year, 0, 1);
                const yearEnd = new Date(year, 11, 31);
                
                // Build query for all accrual entries in the year
                let query = {
                    'metadata.type': 'rent_accrual',
                    'metadata.accrualYear': year,
                    date: { $gte: yearStart, $lte: yearEnd }
                };
                
                // Add residence filtering if specified
                if (residenceId) {
                    query['residence'] = residenceId;
                }
                
                const accrualEntries = await TransactionEntry.find(query);
                
                console.log(`📊 Found ${accrualEntries.length} accrual entries for ${year}${residenceId ? ` - Residence: ${residenceId}` : ''}`);
                
                // Calculate totals from all accrual entries in the year
                let totalRentalIncome = 0;
                let totalAdminIncome = 0;
                
                for (const entry of accrualEntries) {
                    if (entry.entries && Array.isArray(entry.entries)) {
                        for (const subEntry of entry.entries) {
                            if (subEntry.accountCode === '4000') {
                                totalRentalIncome += subEntry.credit || 0;
                            } else if (subEntry.accountCode === '4100') {
                                totalAdminIncome += subEntry.credit || 0;
                            }
                        }
                    }
                }
                
                const totalRevenue = totalRentalIncome + totalAdminIncome;
                
                // Fetch expenses for the year
                let totalExpenses = 0;
                let expenseBreakdown = {};
                
                const expenseQuery = {
                    'entries.accountType': 'Expense',
                    date: { $gte: yearStart, $lte: yearEnd }
                };
                
                if (residenceId) {
                    expenseQuery['residence'] = residenceId;
                }
                
                const expenseEntries = await TransactionEntry.find(expenseQuery);
                
                for (const entry of expenseEntries) {
                    if (entry.entries && Array.isArray(entry.entries)) {
                        for (const subEntry of entry.entries) {
                            if (subEntry.accountType === 'Expense' && subEntry.debit > 0) {
                                const accountKey = `${subEntry.accountCode} - ${subEntry.accountName}`;
                                expenseBreakdown[accountKey] = (expenseBreakdown[accountKey] || 0) + subEntry.debit;
                                totalExpenses += subEntry.debit;
                            }
                        }
                    }
                }
                
                const netIncome = totalRevenue - totalExpenses;
                
                console.log(`📊 Annual Calculated: Rental $${totalRentalIncome}, Admin $${totalAdminIncome}, Total $${totalRevenue}`);
                
                return {
                    month: null,
                    year,
                    period: `${year}`,
                    residence: residenceId,
                    revenue: {
                        rentalIncome: totalRentalIncome,
                        adminIncome: totalAdminIncome,
                        total: totalRevenue
                    },
                    expenses: {
                        total: totalExpenses,
                        breakdown: expenseBreakdown
                    },
                    netIncome,
                    basis: 'accrual',
                    // Add monthly breakdown for annual summary
                    monthlyBreakdown: {
                        totalAnnualRevenue: totalRevenue,
                        totalAnnualExpenses: totalExpenses,
                        totalAnnualNetIncome: netIncome,
                        totalAccrualEntries: accrualEntries.length
                    }
                };
            }
            
            // Handle monthly summary (existing logic)
            console.log(`📊 Generating Income Statement for ${month}/${year}${residenceId ? ` - Residence: ${residenceId}` : ''}...`);
            
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            // Build query for accrual entries
            // Fix: Use metadata filters instead of date range for accruals
            let query = {
                'metadata.type': 'rent_accrual',
                'metadata.accrualMonth': month,
                'metadata.accrualYear': year
                // Removed date filter - accruals are identified by metadata, not date
            };
            
            // Add residence filtering if specified
            if (residenceId) {
                query['residence'] = residenceId;
            }
            
            const accrualEntries = await TransactionEntry.find(query);
            
            console.log(`📊 Found ${accrualEntries.length} accrual entries for ${month}/${year}${residenceId ? ` - Residence: ${residenceId}` : ''}`);
            
            // Calculate totals from accrual entries
            let totalRentalIncome = 0;
            let totalAdminIncome = 0;
            
            for (const entry of accrualEntries) {
                if (entry.entries && Array.isArray(entry.entries)) {
                    for (const subEntry of entry.entries) {
                        if (subEntry.accountCode === '4000') {
                            totalRentalIncome += subEntry.credit || 0;
                        } else if (subEntry.accountCode === '4100') {
                            totalAdminIncome += subEntry.credit || 0;
                        }
                    }
                }
            }
            
            const totalRevenue = totalRentalIncome + totalAdminIncome;
            
            // Fetch expenses for the month
            let totalExpenses = 0;
            let expenseBreakdown = {};
            
            // Fix: Properly filter expenses by month
            const expenseQuery = {
                'entries.accountType': 'Expense',
                date: { $gte: monthStart, $lte: monthEnd }
            };
            
            if (residenceId) {
                expenseQuery['residence'] = residenceId;
            }
            
            const expenseEntries = await TransactionEntry.find(expenseQuery);
            
            console.log(`📊 Found ${expenseEntries.length} expense entries for ${month}/${year} with date range: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);
            
            for (const entry of expenseEntries) {
                if (entry.entries && Array.isArray(entry.entries)) {
                    for (const subEntry of entry.entries) {
                        if (subEntry.accountType === 'Expense' && subEntry.debit > 0) {
                            const accountKey = `${subEntry.accountCode} - ${subEntry.accountName}`;
                            expenseBreakdown[accountKey] = (expenseBreakdown[accountKey] || 0) + subEntry.debit;
                            totalExpenses += subEntry.debit;
                        }
                    }
                }
            }
            
            console.log(`📊 Month ${month}/${year} expenses: $${totalExpenses} (${Object.keys(expenseBreakdown).length} categories)`);
            
            const netIncome = totalRevenue - totalExpenses;
            
            console.log(`📊 Calculated: Rental $${totalRentalIncome}, Admin $${totalAdminIncome}, Total $${totalRevenue}`);
            
            return {
                month,
                year,
                period: `${month}/${year}`,
                residence: residenceId,
                revenue: {
                    rentalIncome: totalRentalIncome,
                    adminIncome: totalAdminIncome,
                    total: totalRevenue
                },
                expenses: {
                    total: totalExpenses,
                    breakdown: expenseBreakdown
                },
                netIncome,
                basis: 'accrual',
                // Add summary for frontend compatibility
                summary: {
                    totalNetIncome: netIncome,
                    totalRevenue: totalRevenue,
                    totalExpenses: totalExpenses
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating income statement:', error);
            throw error;
        }
    }
    
    /**
     * Generate Monthly Balance Sheet (Accrual Basis)
     */
    static async generateMonthlyBalanceSheet(month, year, residenceId = null) {
        try {
            console.log(`📋 Generating Balance Sheet for ${month}/${year}${residenceId ? ` - Residence: ${residenceId}` : ''}...`);
            
            const monthEnd = new Date(year, month, 0);
            
            // Assets with account codes
            const bankBalance = await this.getAccountBalance('1001', monthEnd, residenceId);
            const ecocashBalance = await this.getAccountBalance('1002', monthEnd, residenceId);
            const innbucksBalance = await this.getAccountBalance('1003', monthEnd, residenceId);
            const pettyCashBalance = await this.getAccountBalance('1004', monthEnd, residenceId);
            const cashBalance = await this.getAccountBalance('1005', monthEnd, residenceId);
            // Fix: Calculate Accounts Receivable correctly (Accruals - Payments)
            const accountsReceivable = await this.getAccountsReceivableBalance(monthEnd, residenceId);
            
            const totalCashAndBank = bankBalance + ecocashBalance + innbucksBalance + pettyCashBalance + cashBalance;
            const totalAssets = totalCashAndBank + accountsReceivable;
            
            // Liabilities with account codes
            const accountsPayable = await this.getAccountBalance('2000', monthEnd, residenceId);
            const tenantDeposits = await this.getAccountBalance('2020', monthEnd, residenceId);
            const totalLiabilities = accountsPayable + tenantDeposits;
            
            // Equity with account codes
            const retainedEarnings = await this.getRetainedEarnings(monthEnd, residenceId);
            const totalEquity = retainedEarnings;
            
            // Verify: Assets = Liabilities + Equity
            const balanceCheck = Math.abs(totalAssets - (totalLiabilities + totalEquity));
            
            return {
                month,
                year,
                asOf: monthEnd,
                residence: residenceId,
                assets: {
                    current: {
                        cashAndBank: {
                        bank: { amount: bankBalance, accountCode: '1001', accountName: 'Bank Account' },
                            ecocash: { amount: ecocashBalance, accountCode: '1002', accountName: 'Ecocash' },
                            innbucks: { amount: innbucksBalance, accountCode: '1003', accountName: 'Innbucks' },
                            pettyCash: { amount: pettyCashBalance, accountCode: '1004', accountName: 'Petty Cash' },
                            cash: { amount: cashBalance, accountCode: '1005', accountName: 'Cash on Hand' },
                            total: totalCashAndBank
                        },
                        accountsReceivable: { amount: accountsReceivable, accountCode: '1100', accountName: 'Accounts Receivable - Tenants' }
                    },
                    total: totalAssets
                },
                liabilities: {
                    current: {
                        accountsPayable: { amount: accountsPayable, accountCode: '2000', accountName: 'Accounts Payable' },
                        tenantDeposits: { amount: tenantDeposits, accountCode: '2020', accountName: 'Tenant Deposits Held' }
                    },
                    total: totalLiabilities
                },
                equity: {
                    retainedEarnings: { amount: retainedEarnings, accountCode: '3000', accountName: 'Retained Earnings' },
                    total: totalEquity
                },
                balanceCheck: balanceCheck < 0.01 ? 'Balanced' : `Off by $${balanceCheck.toFixed(2)}`,
                basis: 'accrual'
            };
            
        } catch (error) {
            console.error('❌ Error generating balance sheet:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Cash Flow Statement (Cash Basis)
     */
    static async generateMonthlyCashFlowStatement(month, year, residenceId = null) {
        try {
            console.log(`💸 Generating Cash Flow Statement for ${month}/${year}${residenceId ? ` - Residence: ${residenceId}` : ''}...`);
            
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            // Operating Activities - Cash collections and payments
            const cashCollections = await this.getCashCollections(monthStart, monthEnd, residenceId);
            const cashPayments = await this.getCashPayments(monthStart, monthEnd, residenceId);
            const netOperatingCash = cashCollections - cashPayments;
            
            // Investing Activities
            const investingCash = await this.getInvestingCashFlow(monthStart, monthEnd, residenceId);
            
            // Financing Activities
            const financingCash = await this.getFinancingCashFlow(monthStart, monthEnd, residenceId);
            
            // Net Change in Cash
            const netChangeInCash = netOperatingCash + investingCash + financingCash;
            
            // Beginning and Ending Cash
            const beginningCash = await this.getTotalCashBalance(monthStart, residenceId);
            const endingCash = beginningCash + netChangeInCash;
            
            return {
                month,
                year,
                period: `${month}/${year}`,
                residence: residenceId,
                operatingActivities: {
                    cashCollections,
                    cashPayments,
                    netOperatingCash
                },
                investingActivities: {
                    netCash: investingCash
                },
                financingActivities: {
                    netCash: financingCash
                },
                netChangeInCash,
                cashPositions: {
                    beginning: beginningCash,
                    ending: endingCash
                },
                basis: 'cash'
            };
            
        } catch (error) {
            console.error('❌ Error generating cash flow statement:', error);
            throw error;
        }
    }
    
    // Helper methods
    static async getAccountBalance(accountCode, asOfDate, residenceId = null) {
        let query = {
            'entries.accountCode': accountCode,
            date: { $lte: asOfDate },
            status: 'posted'
        };
        
        // Add residence filtering if specified
        if (residenceId) {
            query['residence'] = residenceId;
        }
        
        const entries = await TransactionEntry.find(query);
        
        let balance = 0;
        for (const entry of entries) {
            if (entry.entries && Array.isArray(entry.entries)) {
                for (const subEntry of entry.entries) {
                    if (subEntry.accountCode === accountCode) {
                        // Special handling for tenant deposits (liability account)
                        if (accountCode === '2020') {
                            balance += (subEntry.credit || 0) - (subEntry.debit || 0);
                        } else {
                            balance += (subEntry.debit || 0) - (subEntry.credit || 0);
                        }
                    }
                }
            }
        }
        
        return balance;
    }

    /**
     * Get Accounts Receivable balance (Accruals - Payments)
     */
    static async getAccountsReceivableBalance(asOfDate, residenceId = null) {
        try {
            // Get total rent accruals up to the date
            let accrualQuery = {
                'metadata.type': 'rent_accrual',
                date: { $lte: asOfDate },
                status: 'posted'
            };
            
            if (residenceId) {
                accrualQuery['residence'] = residenceId;
            }
            
            const accrualEntries = await TransactionEntry.find(accrualQuery);
            let totalAccruals = 0;
            
            for (const entry of accrualEntries) {
                if (entry.entries && Array.isArray(entry.entries)) {
                    for (const subEntry of entry.entries) {
                        if (subEntry.accountCode === '4000' && subEntry.credit > 0) {
                            totalAccruals += subEntry.credit;
                        }
                    }
                }
            }
            
            // Get total payments received up to the date
            let paymentQuery = {
                'metadata.type': 'rent_payment',
                date: { $lte: asOfDate },
                status: 'posted'
            };
            
            if (residenceId) {
                paymentQuery['residence'] = residenceId;
            }
            
            const paymentEntries = await TransactionEntry.find(paymentQuery);
            let totalPayments = 0;
            
            for (const entry of paymentEntries) {
                if (entry.entries && Array.isArray(entry.entries)) {
                    for (const subEntry of entry.entries) {
                        if (subEntry.accountCode === '1100' && subEntry.credit > 0) {
                            totalPayments += subEntry.credit;
                        }
                    }
                }
            }
            
            // Accounts Receivable = Accruals - Payments
            const accountsReceivable = totalAccruals - totalPayments;
            
            console.log(`📊 Accounts Receivable calculation: Accruals $${totalAccruals} - Payments $${totalPayments} = $${accountsReceivable}`);
            
            return Math.max(0, accountsReceivable); // Can't be negative
            
        } catch (error) {
            console.error('❌ Error calculating Accounts Receivable:', error);
            return 0;
        }
    }

    /**
     * Get total cash balance across all cash accounts
     */
    static async getTotalCashBalance(asOfDate, residenceId = null) {
        const cashAccounts = ['1001', '1002', '1003', '1004', '1005'];
        let totalCash = 0;
        
        for (const accountCode of cashAccounts) {
            totalCash += await this.getAccountBalance(accountCode, asOfDate, residenceId);
        }
        
        return totalCash;
    }
    
    static async getRetainedEarnings(asOfDate, residenceId = null) {
        let revenueQuery = {
            'entries.accountCode': { $in: ['4000', '4001', '4020', '4100'] },
            date: { $lte: asOfDate },
            status: 'posted'
        };
        
        let expenseQuery = {
            'entries.accountCode': { $regex: /^5/ },
            date: { $lte: asOfDate },
            status: 'posted'
        };
        
        // Add residence filtering if specified
        if (residenceId) {
            revenueQuery['residence'] = residenceId;
            expenseQuery['residence'] = residenceId;
        }
        
        const revenueEntries = await TransactionEntry.find(revenueQuery);
        const expenseEntries = await TransactionEntry.find(expenseQuery);
        
        let totalRevenue = 0;
        let totalExpenses = 0;
        
        // Calculate revenue from nested entries
        for (const entry of revenueEntries) {
            if (entry.entries && Array.isArray(entry.entries)) {
                for (const subEntry of entry.entries) {
                    if (['4000', '4001', '4020', '4100'].includes(subEntry.accountCode)) {
                        totalRevenue += subEntry.credit || 0;
                    }
                }
            }
        }
        
        // Calculate expenses from nested entries
        for (const entry of expenseEntries) {
            if (entry.entries && Array.isArray(entry.entries)) {
                for (const subEntry of entry.entries) {
                    if (subEntry.accountCode && subEntry.accountCode.startsWith('5')) {
                        totalExpenses += subEntry.debit || 0;
                    }
                }
            }
        }
        
        return totalRevenue - totalExpenses;
    }
    
    static async getCashCollections(startDate, endDate, residenceId = null) {
        let query = {
            'entries.accountCode': { $in: ['1001', '1002', '1003', '1004', '1005'] },
            date: { $gte: startDate, $lte: endDate },
            status: 'posted'
        };
        
        if (residenceId) {
            query['residence'] = residenceId;
        }
        
        const entries = await TransactionEntry.find(query);
        
        let totalCollections = 0;
        for (const entry of entries) {
            if (entry.entries && Array.isArray(entry.entries)) {
                for (const subEntry of entry.entries) {
                    if (['1001', '1002', '1003', '1004', '1005'].includes(subEntry.accountCode) && subEntry.debit > 0) {
                        totalCollections += subEntry.debit;
                    }
                }
            }
        }
        
        return totalCollections;
    }
    
    static async getCashPayments(startDate, endDate, residenceId = null) {
        let query = {
            'entries.accountCode': { $in: ['1001', '1002', '1003', '1004', '1005'] },
            date: { $gte: startDate, $lte: endDate },
            status: 'posted'
        };
        
        if (residenceId) {
            query['residence'] = residenceId;
        }
        
        const entries = await TransactionEntry.find(query);
        
        let totalPayments = 0;
        for (const entry of entries) {
            if (entry.entries && Array.isArray(entry.entries)) {
                for (const subEntry of entry.entries) {
                    if (['1001', '1002', '1003', '1004', '1005'].includes(subEntry.accountCode) && subEntry.credit > 0) {
                        totalPayments += subEntry.credit;
                    }
                }
            }
        }
        
        return totalPayments;
    }
    
    static async getInvestingCashFlow(startDate, endDate, residenceId = null) {
        return 0;
    }
    
    static async getFinancingCashFlow(startDate, endDate, residenceId = null) {
        return 0;
    }
}

module.exports = AccountingService;
