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
                    'metadata.type': 'monthly_rent_accrual',
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
                    transactionId: `ACC-${year}${month.toString().padStart(2, '0')}-${student.student.toString().slice(-6)}`,
                    date: new Date(year, month - 1, 1),
                    description: `Monthly Rent & Admin Accrual - ${student.firstName} ${student.lastName} - ${month}/${year}`,
                    type: 'accrual',
                    residence: student.residence || new mongoose.Types.ObjectId(),
                    createdBy: new mongoose.Types.ObjectId(),
                    amount: totalAccrued,
                    metadata: {
                        type: 'monthly_rent_accrual',
                        studentId: student.student,
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
                            accountCode: `1100-${student.student}`,
                            accountName: `Accounts Receivable - ${student.firstName} ${student.lastName}`,
                            accountType: 'Asset',
                            debit: totalAccrued,
                            credit: 0,
                            description: `Rent & Admin Accrued - ${student.firstName} ${student.lastName}`
                        },
                        {
                            accountCode: '4001',
                            accountName: 'Student Accommodation Rent',
                            accountType: 'Income',
                            debit: 0,
                            credit: monthlyRent,
                            description: `Monthly Rent Accrued - ${student.firstName} ${student.lastName}`
                        },
                        {
                            accountCode: '4002',
                            accountName: 'Administrative Fees',
                            accountType: 'Income',
                            debit: 0,
                            credit: monthlyAdminFee,
                            description: `Monthly Admin Fee Accrued - ${student.firstName} ${student.lastName}`
                        }
                    ],
                    metadata: {
                        type: 'monthly_rent_accrual',
                        studentId: student.student,
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
                        accountCode: `1100-${studentId}`,
                        accountName: `Accounts Receivable - ${studentName}`,
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
            
            // Build query for accrual entries and manual adjustments
            // Include lease start, rent accruals, and manual adjustments (negotiations, reversals)
            let query = {
                $or: [
                    // Lease start transactions
                    {
                        'metadata.type': 'lease_start',
                        'metadata.accrualMonth': month,
                        'metadata.accrualYear': year
                    },
                    // Rent accrual transactions
                    {
                        'metadata.type': 'rent_accrual',
                        'metadata.accrualMonth': month,
                        'metadata.accrualYear': year
                    },
                    // Manual adjustments (negotiated payments, reversals)
                    {
                        'metadata.accrualMonth': month,
                        'metadata.accrualYear': year,
                        source: 'manual'
                    },
                    // Fallback: transactions with income entries in the date range
                    {
                        'entries.accountType': 'Income',
                        date: { $gte: monthStart, $lte: monthEnd }
                    }
                ]
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
                        if (subEntry.accountCode === '4001') {
                            // For income accounts: credits increase revenue, debits decrease revenue
                            totalRentalIncome += (subEntry.credit || 0) - (subEntry.debit || 0);
                        } else if (subEntry.accountCode === '4002') {
                            // For income accounts: credits increase revenue, debits decrease revenue
                            totalAdminIncome += (subEntry.credit || 0) - (subEntry.debit || 0);
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
            
            // Assets with account codes (include user petty cash accounts 1010-1014)
            const cashBalance = await this.getAccountBalance('1000', monthEnd, residenceId); // Main cash account
            const bankBalance = await this.getAccountBalance('1001', monthEnd, residenceId);
            const ecocashBalance = await this.getAccountBalance('1002', monthEnd, residenceId);
            const innbucksBalance = await this.getAccountBalance('1003', monthEnd, residenceId);
            const pettyCashBalance = await this.getAccountBalance('1004', monthEnd, residenceId);
            const cashOnHandBalance = await this.getAccountBalance('1005', monthEnd, residenceId);
            // User/role petty cash accounts
            const generalPettyCash = await this.getAccountBalance('1010', monthEnd, residenceId);
            const adminPettyCash = await this.getAccountBalance('1011', monthEnd, residenceId);
            const financePettyCash = await this.getAccountBalance('1012', monthEnd, residenceId);
            const propertyMgrPettyCash = await this.getAccountBalance('1013', monthEnd, residenceId);
            const maintenancePettyCash = await this.getAccountBalance('1014', monthEnd, residenceId);
            // Fix: Calculate Accounts Receivable correctly (Accruals - Payments) including child accounts
            const accountsReceivable = await this.getAccountsReceivableWithChildren(monthEnd, residenceId);
            
            const totalCashAndBank = cashBalance + bankBalance + ecocashBalance + innbucksBalance + pettyCashBalance + cashOnHandBalance
                + generalPettyCash + adminPettyCash + financePettyCash + propertyMgrPettyCash + maintenancePettyCash;
            const totalAssets = totalCashAndBank + accountsReceivable;
            
                // Liabilities with account codes
    const accountsPayable = await this.getAccountsPayableWithChildren(monthEnd, residenceId);
    const tenantDeposits = await this.getAccountBalance('2020', monthEnd, residenceId);
    const deferredIncome = await this.getAccountBalance('2200', monthEnd, residenceId);
    const totalLiabilities = Math.abs(accountsPayable) + Math.abs(tenantDeposits) + Math.abs(deferredIncome);
            
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
                            cash: { amount: cashBalance, accountCode: '1000', accountName: 'Cash' },
                            bank: { amount: bankBalance, accountCode: '1001', accountName: 'Bank Account' },
                            ecocash: { amount: ecocashBalance, accountCode: '1002', accountName: 'Ecocash' },
                            innbucks: { amount: innbucksBalance, accountCode: '1003', accountName: 'Innbucks' },
                            pettyCash: { amount: pettyCashBalance, accountCode: '1004', accountName: 'Petty Cash' },
                            cashOnHand: { amount: cashOnHandBalance, accountCode: '1005', accountName: 'Cash on Hand' },
                            // User petty cash accounts breakdown
                            generalPettyCash: { amount: generalPettyCash, accountCode: '1010', accountName: 'General Petty Cash' },
                            adminPettyCash: { amount: adminPettyCash, accountCode: '1011', accountName: 'Admin Petty Cash' },
                            financePettyCash: { amount: financePettyCash, accountCode: '1012', accountName: 'Finance Petty Cash' },
                            propertyManagerPettyCash: { amount: propertyMgrPettyCash, accountCode: '1013', accountName: 'Property Manager Petty Cash' },
                            maintenancePettyCash: { amount: maintenancePettyCash, accountCode: '1014', accountName: 'Maintenance Petty Cash' },
                            total: totalCashAndBank
                        },
                        accountsReceivable: { amount: accountsReceivable, accountCode: '1100', accountName: 'Accounts Receivable - Tenants' }
                    },
                    total: totalAssets
                },
                liabilities: {
                    current: {
                        accountsPayable: { amount: Math.abs(accountsPayable), accountCode: '2000', accountName: 'Accounts Payable' },
                        tenantDeposits: { amount: Math.abs(tenantDeposits), accountCode: '2020', accountName: 'Tenant Deposits Held' },
                        deferredIncome: { amount: Math.abs(deferredIncome), accountCode: '2200', accountName: 'Advance Payment Liability' }
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
        const asOfMonth = asOfDate.getMonth() + 1;
        const asOfYear = asOfDate.getFullYear();
        const monthKey = `${asOfYear}-${String(asOfMonth).padStart(2, '0')}`;
        
        // For balance sheet, we need to include:
        // 1. All accruals up to asOf date (these create the obligations)
        // 2. All payments with monthSettled <= current month (these settle the obligations)
        // 3. All other transactions up to asOf date (non-payment transactions)
        
        const accrualQuery = {
            source: 'rental_accrual',
            'entries.accountCode': accountCode,
            date: { $lte: asOfDate },
            status: 'posted'
        };
        
        const paymentQuery = {
            source: 'payment',
            'entries.accountCode': accountCode,
            'metadata.monthSettled': { $lte: monthKey },
            status: 'posted'
        };
        
        const otherQuery = {
            source: { $nin: ['rental_accrual', 'payment'] },
            'entries.accountCode': accountCode,
            date: { $lte: asOfDate },
            status: 'posted'
        };
        
        // Add residence filtering if specified
        if (residenceId) {
            accrualQuery['residence'] = residenceId;
            paymentQuery['residence'] = residenceId;
            otherQuery['residence'] = residenceId;
        }
        
        // Get all relevant transactions
        const [accrualEntries, paymentEntries, otherEntries] = await Promise.all([
            TransactionEntry.find(accrualQuery),
            TransactionEntry.find(paymentQuery),
            TransactionEntry.find(otherQuery)
        ]);
        
        const entries = [...accrualEntries, ...paymentEntries, ...otherEntries];
        
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
     * Get Accounts Payable balance including all child accounts (2000 + children)
     */
    static async getAccountsPayableWithChildren(asOfDate, residenceId = null) {
        try {
            // Get the main Accounts Payable account (2000)
            const mainAPAccount = await Account.findOne({ code: '2000' });
            if (!mainAPAccount) {
                console.log('⚠️ Main Accounts Payable account (2000) not found');
                return 0;
            }

            // Get all child accounts linked to 2000
            const childAccounts = await Account.find({ 
                parentAccount: mainAPAccount._id,
                isActive: true
            });

            // Calculate main account 2000 balance
            let totalBalance = await this.getAccountBalance('2000', asOfDate, residenceId);
            
            // Add balances from all child accounts (avoid double-counting main 2000)
            for (const childAccount of childAccounts) {
                if (childAccount.code === '2000' || childAccount._id.equals(mainAPAccount._id)) {
                    // Skip if a data issue made 2000 its own child
                    continue;
                }
                const childBalance = await this.getAccountBalance(childAccount.code, asOfDate, residenceId);
                totalBalance += childBalance;
                console.log(`📊 Child account ${childAccount.code} (${childAccount.name}): $${childBalance}`);
            }

            console.log(`📊 Total Accounts Payable (2000 + ${childAccounts.length} children): $${totalBalance}`);
            return totalBalance;

        } catch (error) {
            console.error('❌ Error calculating Accounts Payable with children:', error);
            // Fallback to just main account if there's an error
            return await this.getAccountBalance('2000', asOfDate, residenceId);
        }
    }

    /**
     * Get Accounts Receivable balance (Accruals - Payments)
     */
    static async getAccountsReceivableBalance(asOfDate, residenceId = null) {
        try {
            // Robust: compute AR directly from ledger by netting tenant AR (1100) and generic AR (1101)
            const query = {
                date: { $lte: asOfDate },
                status: 'posted',
                'entries.accountCode': { $in: ['1100', '1101'] }
            };

            if (residenceId) {
                query['residence'] = residenceId;
            }

            const arEntries = await TransactionEntry.find(query);
            let netAR = 0;

            for (const entry of arEntries) {
                if (entry.entries && Array.isArray(entry.entries)) {
                    for (const subEntry of entry.entries) {
                        if (subEntry.accountCode === '1100' || subEntry.accountCode === '1101') {
                            netAR += (subEntry.debit || 0) - (subEntry.credit || 0);
                        }
                    }
                }
            }

            console.log(`📊 Accounts Receivable (1100/1101) net balance as of ${asOfDate.toISOString()}: $${netAR}`);
            return Math.max(0, netAR);
        } catch (error) {
            console.error('❌ Error calculating Accounts Receivable:', error);
            return 0;
        }
    }

    /**
     * Get Accounts Receivable balance including all child accounts (1100 + children)
     */
    static async getAccountsReceivableWithChildren(asOfDate, residenceId = null) {
        try {
            // Get the main Accounts Receivable account (1100)
            const mainARAccount = await Account.findOne({ code: '1100' });
            if (!mainARAccount) {
                console.log('⚠️ Main Accounts Receivable account (1100) not found');
                return 0;
            }

            // Get only 1100-series child accounts linked to 1100
            const childAccounts = await Account.find({ 
                parentAccount: mainARAccount._id,
                isActive: true,
                code: { $regex: '^1100-' }
            });

            // Calculate main account 1100 balance
            let totalBalance = await this.getAccountBalance('1100', asOfDate, residenceId);
            
            // Add balances from all child accounts
            for (const childAccount of childAccounts) {
                const childBalance = await this.getAccountBalance(childAccount.code, asOfDate, residenceId);
                totalBalance += childBalance;
                console.log(`📊 Child account ${childAccount.code} (${childAccount.name}): $${childBalance}`);
            }

            console.log(`📊 Total Accounts Receivable (1100 + ${childAccounts.length} children): $${totalBalance}`);
            return totalBalance;

        } catch (error) {
            console.error('❌ Error calculating Accounts Receivable with children:', error);
            // Fallback to just main account if there's an error
            return await this.getAccountBalance('1100', asOfDate, residenceId);
        }
    }

    /**
     * Get total cash balance across all cash accounts
     */
    static async getTotalCashBalance(asOfDate, residenceId = null) {
        const cashAccounts = ['1001', '1002', '1003', '1004', '1005', '1010', '1011', '1012', '1013', '1014'];
        let totalCash = 0;
        
        for (const accountCode of cashAccounts) {
            totalCash += await this.getAccountBalance(accountCode, asOfDate, residenceId);
        }
        
        return totalCash;
    }
    
    static async getRetainedEarnings(asOfDate, residenceId = null) {
        let revenueQuery = {
            'entries.accountCode': { $in: ['4000', '4001', '4002', '4020', '4100'] },
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
                    if (['4000', '4001', '4002', '4020', '4100'].includes(subEntry.accountCode)) {
                        // Credits increase revenue, debits decrease revenue (like negotiated discounts)
                        totalRevenue += (subEntry.credit || 0) - (subEntry.debit || 0);
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
            'entries.accountCode': { $in: ['1001', '1002', '1003', '1004', '1005', '1010', '1011', '1012', '1013', '1014'] },
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
                    if (['1001', '1002', '1003', '1004', '1005', '1010', '1011', '1012', '1013', '1014'].includes(subEntry.accountCode) && subEntry.debit > 0) {
                        totalCollections += subEntry.debit;
                    }
                }
            }
        }
        
        return totalCollections;
    }
    
    static async getCashPayments(startDate, endDate, residenceId = null) {
        let query = {
            'entries.accountCode': { $in: ['1001', '1002', '1003', '1004', '1005', '1010', '1011', '1012', '1013', '1014'] },
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
                    if (['1001', '1002', '1003', '1004', '1005', '1010', '1011', '1012', '1013', '1014'].includes(subEntry.accountCode) && subEntry.credit > 0) {
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
