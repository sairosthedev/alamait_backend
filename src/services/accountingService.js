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
            const activeStudents = await mongoose.connection.db
                .collection('applications')
                .find({
                    status: 'approved',
                    startDate: { $lte: new Date(year, month, 0) },
                    endDate: { $gte: new Date(year, month - 1, 1) },
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
                    
                    // Billing structure based on residence:
                    if (residence.name.includes('St Kilda')) {
                        // St Kilda: Rent + Admin Fee (one-time) + Deposit (last month's rent)
                        const leaseStartMonth = new Date(student.startDate).getMonth() + 1;
                        const leaseStartYear = new Date(student.startDate).getFullYear();
                        
                        if (month === leaseStartMonth && year === leaseStartYear) {
                            monthlyAdminFee = 20; // Admin fee only in first month
                        } else {
                            monthlyAdminFee = 0; // No admin fee in subsequent months
                        }
                        
                        // Check if this is the last month of the lease (deposit = last month's rent)
                        const leaseEndMonth = new Date(student.endDate).getMonth() + 1;
                        const leaseEndYear = new Date(student.endDate).getFullYear();
                        
                        if (month === leaseEndMonth && year === leaseEndYear) {
                            // Last month is called "deposit" but amount is same as regular rent
                            // No change to monthlyRent - it stays the same
                        }
                        
                    } else if (residence.name.includes('Belvedere')) {
                        // Belvedere: Rent only (no admin, no deposit)
                        monthlyAdminFee = 0;
                        
                    } else {
                        // All other properties: Rent + Deposit (no admin fee)
                        monthlyAdminFee = 0;
                        
                        // Check if this is the last month of the lease (deposit = last month's rent)
                        const leaseEndMonth = new Date(student.endDate).getMonth() + 1;
                        const leaseEndYear = new Date(student.endDate).getFullYear();
                        
                        if (month === leaseEndMonth && year === leaseEndYear) {
                            // Last month is called "deposit" but amount is same as regular rent
                            // No change to monthlyRent - it stays the same
                        }
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
                    residence: student.residence || new mongoose.Types.ObjectId(), // Required field
                    createdBy: new mongoose.Types.ObjectId(), // Required field - using dummy ID for now
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
                
                // Create a single balanced accrual entry (Accrual Basis)
                // This creates the double-entry: Dr. A/R, Cr. Rental Income + Admin Income
                const accrualEntry = new TransactionEntry({
                    transactionId: transaction._id.toString(),
                    description: `Monthly Rent & Admin Accrual - ${student.firstName} ${student.lastName} - ${month}/${year}`,
                    date: new Date(year, month - 1, 1),
                    totalDebit: totalAccrued,    // Total debits (A/R)
                    totalCredit: totalAccrued,   // Total credits (Rental + Admin)
                    source: 'rental_accrual',
                    sourceModel: 'TransactionEntry',
                    sourceId: transaction._id,
                    createdBy: 'system@alamait.com',
                    entries: [
                        // 1. Debit Accounts Receivable (Asset increases)
                        {
                            accountCode: '1100',
                            accountName: 'Accounts Receivable - Tenants',
                            accountType: 'Asset',
                            debit: totalAccrued,
                            credit: 0,
                            description: `Rent & Admin Accrued - ${student.firstName} ${student.lastName}`
                        },
                        // 2. Credit Rental Income (Revenue increases)
                        {
                            accountCode: '4000',
                            accountName: 'Rental Income',
                            accountType: 'Income',
                            debit: 0,
                            credit: monthlyRent,
                            description: `Monthly Rent Accrued - ${student.firstName} ${student.lastName}`
                        },
                        // 3. Credit Admin Fee Income (Revenue increases)
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
                        residence: residence?.name || 'Unknown'
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
     * Generate Monthly Income Statement (Accrual Basis)
     */
    static async generateMonthlyIncomeStatement(month, year) {
        try {
            console.log(`📊 Generating Income Statement for ${month}/${year}...`);
            
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            // Get all accrual entries for this month (accrual basis)
            const accrualEntries = await TransactionEntry.find({
                'metadata.type': 'rent_accrual',
                'metadata.accrualMonth': month,
                'metadata.accrualYear': year,
                date: { $gte: monthStart, $lte: monthEnd }
            });
            
            console.log(`📊 Found ${accrualEntries.length} accrual entries for ${month}/${year}`);
            
            // Calculate totals from accrual entries
            let totalRentalIncome = 0;
            let totalAdminIncome = 0;
            
            for (const entry of accrualEntries) {
                if (entry.entries && Array.isArray(entry.entries)) {
                    for (const subEntry of entry.entries) {
                        if (subEntry.accountCode === '4000') { // Rental Income - Residential
                            totalRentalIncome += subEntry.credit || 0;
                        } else if (subEntry.accountCode === '4100') { // Administrative Income
                            totalAdminIncome += subEntry.credit || 0;
                        }
                    }
                }
            }
            
            const totalRevenue = totalRentalIncome + totalAdminIncome;
            
            // For now, no expenses in accrual system
            const totalExpenses = 0;
            const netIncome = totalRevenue - totalExpenses;
            
            console.log(`📊 Calculated: Rental $${totalRentalIncome}, Admin $${totalAdminIncome}, Total $${totalRevenue}`);
            
            return {
                month,
                year,
                period: `${month}/${year}`,
                revenue: {
                    rentalIncome: totalRentalIncome,
                    adminIncome: totalAdminIncome,
                    total: totalRevenue
                },
                expenses: {
                    total: totalExpenses,
                    breakdown: {}
                },
                netIncome,
                basis: 'accrual' // Shows income when earned, not when received
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
            const bankBalance = await this.getAccountBalance('1001', monthEnd); // Bank
            const accountsReceivable = await this.getAccountBalance('1100', monthEnd, residenceId); // A/R (Tenants)
            const totalAssets = bankBalance + accountsReceivable;
            
            // Liabilities with account codes
            const accountsPayable = await this.getAccountBalance('2000', monthEnd); // A/P
            const tenantDeposits = await this.getAccountBalance('2020', monthEnd, residenceId); // Tenant Deposits
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
                        bank: { amount: bankBalance, accountCode: '1001', accountName: 'Bank Account' },
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
     * Generate Monthly Breakdown Balance Sheet (for frontend display)
     */
    static async generateMonthlyBreakdownBalanceSheet(year) {
        try {
            console.log(`📋 Generating Monthly Breakdown Balance Sheet for ${year}...`);
            
            const monthlyData = {};
            
            // Calculate for each month
            for (let month = 1; month <= 12; month++) {
                const monthEnd = new Date(year, month, 0);
                
                // Assets with account codes
                const bankBalance = await this.getAccountBalance('1001', monthEnd);
                const accountsReceivable = await this.getAccountBalance('1100', monthEnd);
                const totalAssets = bankBalance + accountsReceivable;
                
                // Liabilities with account codes
                const accountsPayable = await this.getAccountBalance('2000', monthEnd);
                const tenantDeposits = await this.getAccountBalance('2020', monthEnd);
                const totalLiabilities = accountsPayable + tenantDeposits;
                
                // Equity with account codes
                const retainedEarnings = await this.getRetainedEarnings(monthEnd);
                const totalEquity = retainedEarnings;
                
                monthlyData[month] = {
                    month,
                    year,
                    monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
                    assets: {
                        bank: { amount: bankBalance, accountCode: '1001', accountName: 'Bank Account' },
                        accountsReceivable: { amount: accountsReceivable, accountCode: '1100', accountName: 'Accounts Receivable - Tenants' },
                        total: totalAssets
                    },
                    liabilities: {
                        accountsPayable: { amount: accountsPayable, accountCode: '2000', accountName: 'Accounts Payable' },
                        tenantDeposits: { amount: tenantDeposits, accountCode: '2020', accountName: 'Tenant Deposits Held' },
                        total: totalLiabilities
                    },
                    equity: {
                        retainedEarnings: { amount: retainedEarnings, accountCode: '3000', accountName: 'Retained Earnings' },
                        total: totalEquity
                    },
                    balanceCheck: totalAssets - (totalLiabilities + totalEquity)
                };
            }
            
            return {
                year,
                monthlyData,
                summary: {
                    totalAssets: monthlyData[12]?.assets.total || 0,
                    totalLiabilities: monthlyData[12]?.liabilities.total || 0,
                    totalEquity: monthlyData[12]?.equity.total || 0
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating monthly breakdown balance sheet:', error);
            throw error;
        }
    }
    
    /**
     * Generate Monthly Cash Flow Statement
     */
    static async generateMonthlyCashFlowStatement(month, year) {
        try {
            console.log(`💸 Generating Cash Flow Statement for ${month}/${year}...`);
            
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            // Operating Activities
            const cashCollections = await this.getCashCollections(monthStart, monthEnd);
            const cashPayments = await this.getCashPayments(monthStart, monthEnd);
            const netOperatingCash = cashCollections - cashPayments;
            
            // Investing Activities
            const investingCash = await this.getInvestingCashFlow(monthStart, monthEnd);
            
            // Financing Activities
            const financingCash = await this.getFinancingCashFlow(monthStart, monthEnd);
            
            // Net Change in Cash
            const netChangeInCash = netOperatingCash + investingCash + financingCash;
            
            // Beginning and Ending Cash
            const beginningCash = await this.getAccountBalance('1001', monthStart);
            const endingCash = beginningCash + netChangeInCash;
            
            return {
                month,
                year,
                period: `${month}/${year}`,
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
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating cash flow statement:', error);
            throw error;
        }
    }
    
    // Helper methods
    static async getAccountBalance(accountCode, asOfDate, residenceId = null) {
        let query = {
            'entries.accountCode': accountCode,  // Look inside nested entries array
            date: { $lte: asOfDate },
            status: 'posted'
        };
        
        // Add residence filtering if specified
        if (residenceId) {
            query.residence = residenceId;
        }
        
        const entries = await TransactionEntry.find(query);
        
        let balance = 0;
        for (const entry of entries) {
            if (entry.entries && Array.isArray(entry.entries)) {
                for (const subEntry of entry.entries) {
                    if (subEntry.accountCode === accountCode) {
                        // Special handling for tenant deposits (liability account)
                        if (accountCode === '2020') {
                            // For tenant deposits: credits increase liability, debits decrease liability
                            balance += (subEntry.credit || 0) - (subEntry.debit || 0);
                        } else {
                            // For other accounts: debits increase, credits decrease
                            balance += (subEntry.debit || 0) - (subEntry.credit || 0);
                        }
                    }
                }
            }
        }
        
        return balance;
    }
    
    static async getRetainedEarnings(asOfDate, residenceId = null) {
        // Simplified: Net income from start of business to date
        let revenueQuery = {
            'entries.accountCode': { $in: ['4000', '4100'] },  // Look inside nested entries array
            date: { $lte: asOfDate },
            status: 'posted'
        };
        
        let expenseQuery = {
            'entries.accountCode': { $regex: /^5/ },  // Look inside nested entries array
            date: { $lte: asOfDate },
            status: 'posted'
        };
        
        // Add residence filtering if specified
        if (residenceId) {
            revenueQuery.residence = residenceId;
            expenseQuery.residence = residenceId;
        }
        
        const revenueEntries = await TransactionEntry.find(revenueQuery);
        const expenseEntries = await TransactionEntry.find(expenseQuery);
        
        let totalRevenue = 0;
        let totalExpenses = 0;
        
        // Calculate revenue from nested entries
        for (const entry of revenueEntries) {
            if (entry.entries && Array.isArray(entry.entries)) {
                for (const subEntry of entry.entries) {
                    if (['4000', '4020'].includes(subEntry.accountCode)) {
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
    
    static async getCashCollections(startDate, endDate) {
        const entries = await TransactionEntry.find({
            'entries.accountCode': '1001', // Bank - look inside nested entries array
            date: { $gte: startDate, $lte: endDate },
            status: 'posted'
        });
        
        let totalCollections = 0;
        for (const entry of entries) {
            if (entry.entries && Array.isArray(entry.entries)) {
                for (const subEntry of entry.entries) {
                    if (subEntry.accountCode === '1001' && subEntry.debit > 0) {
                        totalCollections += subEntry.debit;
                    }
                }
            }
        }
        
        return totalCollections;
    }
    
    static async getCashPayments(startDate, endDate) {
        const entries = await TransactionEntry.find({
            'entries.accountCode': '1001', // Bank - look inside nested entries array
            date: { $gte: startDate, $lte: endDate },
            status: 'posted'
        });
        
        let totalPayments = 0;
        for (const entry of entries) {
            if (entry.entries && Array.isArray(entry.entries)) {
                for (const subEntry of entry.entries) {
                    if (subEntry.accountCode === '1001' && subEntry.credit > 0) {
                        totalPayments += subEntry.credit;
                    }
                }
            }
        }
        
        return totalPayments;
    }
    
    static async getInvestingCashFlow(startDate, endDate) {
        // For now, return 0 (no major investments)
        return 0;
    }
    
    static async getFinancingCashFlow(startDate, endDate) {
        // For now, return 0 (no financing activities)
        return 0;
    }
    
    static async getExpenseBreakdown(expenseEntries) {
        const breakdown = {};
        
        for (const entry of expenseEntries) {
            const account = await Account.findOne({ code: entry.accountCode });
            const accountName = account ? account.name : `Account ${entry.accountCode}`;
            
            if (!breakdown[accountName]) {
                breakdown[accountName] = 0;
            }
            breakdown[accountName] += entry.debit;
        }
        
        return breakdown;
    }

    /**
     * Generate Balance Sheet by Residence (Accrual Basis)
     */
    static async generateBalanceSheetByResidence(month, year, residenceId) {
        try {
            console.log(`📋 Generating Balance Sheet for ${month}/${year} - Residence: ${residenceId}...`);
            
            // Get residence details
            const residence = await mongoose.connection.db
                .collection('residences')
                .findOne({ _id: new mongoose.Types.ObjectId(residenceId) });
            
            if (!residence) {
                throw new Error(`Residence not found: ${residenceId}`);
            }
            
            // Generate balance sheet for specific residence
            const balanceSheet = await this.generateMonthlyBalanceSheet(month, year, residenceId);
            
            // Add residence details
            balanceSheet.residenceDetails = {
                id: residenceId,
                name: residence.name,
                address: residence.address || 'N/A',
                type: residence.type || 'N/A'
            };
            
            return balanceSheet;
            
        } catch (error) {
            console.error('❌ Error generating balance sheet by residence:', error);
            throw error;
        }
    }

    /**
     * Generate Balance Sheet for All Residences (Accrual Basis)
     */
    static async generateBalanceSheetAllResidences(month, year) {
        try {
            console.log(`📋 Generating Balance Sheet for ${month}/${year} - All Residences...`);
            
            // Get all residences
            const residences = await mongoose.connection.db
                .collection('residences')
                .find({}).toArray();
            
            const residenceBalanceSheets = {};
            let totalAssets = 0;
            let totalLiabilities = 0;
            let totalEquity = 0;
            
            // Generate balance sheet for each residence
            for (const residence of residences) {
                const residenceId = residence._id.toString();
                const balanceSheet = await this.generateMonthlyBalanceSheet(month, year, residenceId);
                
                residenceBalanceSheets[residenceId] = {
                    ...balanceSheet,
                    residenceDetails: {
                        id: residenceId,
                        name: residence.name,
                        address: residence.address || 'N/A',
                        type: residence.type || 'N/A'
                    }
                };
                
                totalAssets += balanceSheet.assets.total;
                totalLiabilities += balanceSheet.liabilities.total;
                totalEquity += balanceSheet.equity.total;
            }
            
            // Generate overall balance sheet (all residences combined)
            const overallBalanceSheet = await this.generateMonthlyBalanceSheet(month, year);
            
            return {
                month,
                year,
                asOf: new Date(year, month, 0),
                residences: residenceBalanceSheets,
                overall: {
                    ...overallBalanceSheet,
                    residenceDetails: { name: 'All Residences Combined' }
                },
                summary: {
                    totalResidences: residences.length,
                    totalAssets,
                    totalLiabilities,
                    totalEquity,
                    balanceCheck: totalAssets - (totalLiabilities + totalEquity)
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating balance sheet for all residences:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Progression for All Residences (Accrual Basis)
     * Shows every month from January to December for each residence
     */
    static async generateMonthlyProgressionAllResidences(year) {
        try {
            console.log(`📋 Generating Monthly Progression for ${year} - All Residences...`);
            
            // Get all residences
            const residences = await mongoose.connection.db
                .collection('residences')
                .find({}).toArray();
            
            const monthlyProgression = {};
            
            // Generate monthly progression for each month (Jan-Dec)
            for (let month = 1; month <= 12; month++) {
                const monthData = {
                    month,
                    year,
                    monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
                    residences: {},
                    overall: null,
                    summary: {
                        totalResidences: residences.length,
                        totalAssets: 0,
                        totalLiabilities: 0,
                        totalEquity: 0,
                        balanceCheck: 0
                    }
                };
                
                let monthTotalAssets = 0;
                let monthTotalLiabilities = 0;
                let monthTotalEquity = 0;
                
                // Generate balance sheet for each residence for this month
                for (const residence of residences) {
                    const residenceId = residence._id.toString();
                    const balanceSheet = await this.generateMonthlyBalanceSheet(month, year, residenceId);
                    
                    monthData.residences[residenceId] = {
                        ...balanceSheet,
                        residenceDetails: {
                            id: residenceId,
                            name: residence.name,
                            address: residence.address || 'N/A',
                            type: residence.type || 'N/A'
                        }
                    };
                    
                    monthTotalAssets += balanceSheet.assets.total;
                    monthTotalLiabilities += balanceSheet.liabilities.total;
                    monthTotalEquity += balanceSheet.equity.total;
                }
                
                // Generate overall balance sheet for this month
                const overallBalanceSheet = await this.generateMonthlyBalanceSheet(month, year);
                monthData.overall = {
                    ...overallBalanceSheet,
                    residenceDetails: { name: 'All Residences Combined' }
                };
                
                // Update month summary
                monthData.summary.totalAssets = monthTotalAssets;
                monthData.summary.totalLiabilities = monthTotalLiabilities;
                monthData.summary.totalEquity = monthTotalEquity;
                monthData.summary.balanceCheck = monthTotalAssets - (monthTotalLiabilities + monthTotalEquity);
                
                monthlyProgression[month] = monthData;
            }
            
            return {
                year,
                monthlyProgression,
                summary: {
                    totalResidences: residences.length,
                    totalAssets: monthlyProgression[12]?.summary.totalAssets || 0,
                    totalLiabilities: monthlyProgression[12]?.summary.totalLiabilities || 0,
                    totalEquity: monthlyProgression[12]?.summary.totalEquity || 0
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating monthly progression for all residences:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Progression for Income Statement - All Residences
     * Shows every month from January to December for each residence
     */
    static async generateMonthlyProgressionIncomeStatement(year) {
        try {
            console.log(`📊 Generating Monthly Progression Income Statement for ${year} - All Residences...`);
            
            // Get all residences
            const residences = await mongoose.connection.db
                .collection('residences')
                .find({}).toArray();
            
            const monthlyProgression = {};
            
            // Generate monthly progression for each month (Jan-Dec)
            for (let month = 1; month <= 12; month++) {
                const monthData = {
                    month,
                    year,
                    monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
                    residences: {},
                    overall: null,
                    summary: {
                        totalResidences: residences.length,
                        totalRevenue: 0,
                        totalExpenses: 0,
                        totalNetIncome: 0
                    }
                };
                
                let monthTotalRevenue = 0;
                let monthTotalExpenses = 0;
                let monthTotalNetIncome = 0;
                
                // Generate income statement for each residence for this month
                for (const residence of residences) {
                    const residenceId = residence._id.toString();
                    const incomeStatement = await this.generateMonthlyIncomeStatementByResidence(month, year, residenceId);
                    
                    monthData.residences[residenceId] = {
                        ...incomeStatement,
                        residenceDetails: {
                            id: residenceId,
                            name: residence.name,
                            address: residence.address || 'N/A',
                            type: residence.type || 'N/A'
                        }
                    };
                    
                    monthTotalRevenue += incomeStatement.revenue.total;
                    monthTotalExpenses += incomeStatement.expenses.total;
                    monthTotalNetIncome += incomeStatement.netIncome;
                }
                
                // Generate overall income statement for this month
                const overallIncomeStatement = await this.generateMonthlyIncomeStatement(month, year);
                monthData.overall = {
                    ...overallIncomeStatement,
                    residenceDetails: { name: 'All Residences Combined' }
                };
                
                // Update month summary
                monthData.summary.totalRevenue = monthTotalRevenue;
                monthData.summary.totalExpenses = monthTotalExpenses;
                monthData.summary.totalNetIncome = monthTotalNetIncome;
                
                monthlyProgression[month] = monthData;
            }
            
            return {
                year,
                monthlyProgression,
                summary: {
                    totalResidences: residences.length,
                    totalRevenue: monthlyProgression[12]?.summary.totalRevenue || 0,
                    totalExpenses: monthlyProgression[12]?.summary.totalExpenses || 0,
                    totalNetIncome: monthlyProgression[12]?.summary.totalNetIncome || 0
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating monthly progression income statement:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Progression for Cash Flow - All Residences
     * Shows every month from January to December for each residence
     */
    static async generateMonthlyProgressionCashFlow(year) {
        try {
            console.log(`💸 Generating Monthly Progression Cash Flow for ${year} - All Residences...`);
            
            // Get all residences
            const residences = await mongoose.connection.db
                .collection('residences')
                .find({}).toArray();
            
            const monthlyProgression = {};
            
            // Generate monthly progression for each month (Jan-Dec)
            for (let month = 1; month <= 12; month++) {
                const monthData = {
                    month,
                    year,
                    monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
                    residences: {},
                    overall: null,
                    summary: {
                        totalResidences: residences.length,
                        totalNetOperatingCash: 0,
                        totalNetChangeInCash: 0,
                        totalEndingCash: 0
                    }
                };
                
                let monthTotalNetOperatingCash = 0;
                let monthTotalNetChangeInCash = 0;
                let monthTotalEndingCash = 0;
                
                // Generate cash flow for each residence for this month
                for (const residence of residences) {
                    const residenceId = residence._id.toString();
                    const cashFlow = await this.generateMonthlyCashFlowStatementByResidence(month, year, residenceId);
                    
                    monthData.residences[residenceId] = {
                        ...cashFlow,
                        residenceDetails: {
                            id: residenceId,
                            name: residence.name,
                            address: residence.address || 'N/A',
                            type: residence.type || 'N/A'
                        }
                    };
                    
                    monthTotalNetOperatingCash += cashFlow.operatingActivities.netOperatingCash;
                    monthTotalNetChangeInCash += cashFlow.netChangeInCash;
                    monthTotalEndingCash += cashFlow.cashPositions.ending;
                }
                
                // Generate overall cash flow for this month
                const overallCashFlow = await this.generateMonthlyCashFlowStatement(month, year);
                monthData.overall = {
                    ...overallCashFlow,
                    residenceDetails: { name: 'All Residences Combined' }
                };
                
                // Update month summary
                monthData.summary.totalNetOperatingCash = monthTotalNetOperatingCash;
                monthData.summary.totalNetChangeInCash = monthTotalNetChangeInCash;
                monthData.summary.totalEndingCash = monthTotalEndingCash;
                
                monthlyProgression[month] = monthData;
            }
            
            return {
                year,
                monthlyProgression,
                summary: {
                    totalResidences: residences.length,
                    totalNetOperatingCash: monthlyProgression[12]?.summary.totalNetOperatingCash || 0,
                    totalNetChangeInCash: monthlyProgression[12]?.summary.totalNetChangeInCash || 0,
                    totalEndingCash: monthlyProgression[12]?.summary.totalEndingCash || 0
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating monthly progression cash flow:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Income Statement by Residence (Accrual Basis)
     * FIXED: Now correctly filters by residence name from metadata
     */
    static async generateMonthlyIncomeStatementByResidence(month, year, residenceId) {
        try {
            console.log(`📊 Generating Income Statement for ${month}/${year} - Residence: ${residenceId}...`);
            
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            // Get all accrual entries for this month and residence (accrual basis)
            const accrualEntries = await TransactionEntry.find({
                'metadata.type': 'rent_accrual',
                'metadata.accrualMonth': month,
                'metadata.accrualYear': year,
                date: { $gte: monthStart, $lte: monthEnd }
            });
            
            console.log(`📊 Found ${accrualEntries.length} accrual entries for ${month}/${year} - Residence: ${residenceId}`);
            
            // Calculate totals from accrual entries for this specific residence
            let totalRentalIncome = 0;
            let totalAdminIncome = 0;
            
            for (const entry of accrualEntries) {
                // Filter by residence name from metadata
                if (entry.metadata && entry.metadata.residence) {
                    const entryResidenceName = entry.metadata.residence;
                    const targetResidence = await mongoose.connection.db
                        .collection('residences')
                        .findOne({ _id: new mongoose.Types.ObjectId(residenceId) });
                    
                    if (targetResidence && entryResidenceName === targetResidence.name) {
                        if (entry.entries && Array.isArray(entry.entries)) {
                            for (const subEntry of entry.entries) {
                                if (subEntry.accountCode === '4000') { // Rental Income - Residential
                                    totalRentalIncome += subEntry.credit || 0;
                                } else if (subEntry.accountCode === '4100') { // Administrative Income
                                    totalAdminIncome += subEntry.credit || 0;
                                }
                            }
                        }
                    }
                }
            }
            
            const totalRevenue = totalRentalIncome + totalAdminIncome;
            
            // For now, no expenses in accrual system
            const totalExpenses = 0;
            const netIncome = totalRevenue - totalExpenses;
            
            console.log(`📊 Calculated for Residence ${residenceId}: Rental $${totalRentalIncome}, Admin $${totalAdminIncome}, Total $${totalRevenue}`);
            
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
                    breakdown: {}
                },
                netIncome,
                basis: 'accrual' // Shows income when earned, not when received
            };
            
        } catch (error) {
            console.error('❌ Error generating income statement by residence:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Cash Flow Statement by Residence
     */
    static async generateMonthlyCashFlowStatementByResidence(month, year, residenceId) {
        try {
            console.log(`💸 Generating Cash Flow Statement for ${month}/${year} - Residence: ${residenceId}...`);
            
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            // Operating Activities
            const cashCollections = await this.getCashCollectionsByResidence(monthStart, monthEnd, residenceId);
            const cashPayments = await this.getCashPaymentsByResidence(monthStart, monthEnd, residenceId);
            const netOperatingCash = cashCollections - cashPayments;
            
            // Investing Activities
            const investingCash = await this.getInvestingCashFlowByResidence(monthStart, monthEnd, residenceId);
            
            // Financing Activities
            const financingCash = await this.getFinancingCashFlowByResidence(monthStart, monthEnd, residenceId);
            
            // Net Change in Cash
            const netChangeInCash = netOperatingCash + investingCash + financingCash;
            
            // Beginning and Ending Cash
            const beginningCash = await this.getAccountBalance('1001', monthStart, residenceId);
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
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating cash flow statement by residence:', error);
            throw error;
        }
    }

    // Helper methods for residence-specific cash flow
    static async getCashCollectionsByResidence(startDate, endDate, residenceId) {
        const entries = await TransactionEntry.find({
            'entries.accountCode': '1001', // Bank - look inside nested entries array
            date: { $gte: startDate, $lte: endDate },
            status: 'posted',
            residence: residenceId
        });
        
        let totalCollections = 0;
        for (const entry of entries) {
            if (entry.entries && Array.isArray(entry.entries)) {
                for (const subEntry of entry.entries) {
                    if (subEntry.accountCode === '1001' && subEntry.debit > 0) {
                        totalCollections += subEntry.debit;
                    }
                }
            }
        }
        
        return totalCollections;
    }
    
    static async getCashPaymentsByResidence(startDate, endDate, residenceId) {
        const entries = await TransactionEntry.find({
            'entries.accountCode': '1001', // Bank - look inside nested entries array
            date: { $gte: startDate, $lte: endDate },
            status: 'posted',
            residence: residenceId
        });
        
        let totalPayments = 0;
        for (const entry of entries) {
            if (entry.entries && Array.isArray(entry.entries)) {
                for (const subEntry of entry.entries) {
                    if (subEntry.accountCode === '1001' && subEntry.credit > 0) {
                        totalPayments += subEntry.credit;
                    }
                }
            }
        }
        
        return totalPayments;
    }
    
    static async getInvestingCashFlowByResidence(startDate, endDate, residenceId) {
        // For now, return 0 (no major investments)
        return 0;
    }
    
    static async getFinancingCashFlowByResidence(startDate, endDate, residenceId) {
        // For now, return 0 (no financing activities)
        return 0;
    }
}

module.exports = AccountingService;
