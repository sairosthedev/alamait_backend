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
                            monthlyRent = monthlyRent * 2; // Double rent for last month (includes deposit)
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
                            monthlyRent = monthlyRent * 2; // Double rent for last month (includes deposit)
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
                            accountCode: '1200',
                            accountName: 'Accounts Receivable',
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
                            accountCode: '4020',
                            accountName: 'Admin Fee Income',
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
                        if (subEntry.accountCode === '4000') { // Rental Income
                            totalRentalIncome += subEntry.credit || 0;
                        } else if (subEntry.accountCode === '4020') { // Admin Fee Income
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
    static async generateMonthlyBalanceSheet(month, year) {
        try {
            console.log(`📋 Generating Balance Sheet for ${month}/${year}...`);
            
            const monthEnd = new Date(year, month, 0);
            
            // Assets
            const bankBalance = await this.getAccountBalance('1001', monthEnd); // Bank
            const accountsReceivable = await this.getAccountBalance('1200', monthEnd); // A/R
            const totalAssets = bankBalance + accountsReceivable;
            
            // Liabilities
            const accountsPayable = await this.getAccountBalance('2000', monthEnd); // A/P
            const tenantDeposits = await this.getAccountBalance('2020', monthEnd); // Tenant Deposits
            const totalLiabilities = accountsPayable + tenantDeposits;
            
            // Equity
            const retainedEarnings = await this.getRetainedEarnings(monthEnd);
            const totalEquity = retainedEarnings;
            
            // Verify: Assets = Liabilities + Equity
            const balanceCheck = Math.abs(totalAssets - (totalLiabilities + totalEquity));
            
            return {
                month,
                year,
                asOf: monthEnd,
                assets: {
                    current: {
                        bank: bankBalance,
                        accountsReceivable: accountsReceivable
                    },
                    total: totalAssets
                },
                liabilities: {
                    current: {
                        accountsPayable: accountsPayable,
                        tenantDeposits: tenantDeposits
                    },
                    total: totalLiabilities
                },
                equity: {
                    retainedEarnings: retainedEarnings,
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
    static async getAccountBalance(accountCode, asOfDate) {
        const entries = await TransactionEntry.find({
            accountCode,
            date: { $lte: asOfDate },
            status: 'posted'
        });
        
        return entries.reduce((balance, entry) => {
            return balance + entry.debit - entry.credit;
        }, 0);
    }
    
    static async getRetainedEarnings(asOfDate) {
        // Simplified: Net income from start of business to date
        const revenueEntries = await TransactionEntry.find({
            accountCode: { $in: ['4000', '4020'] },
            date: { $lte: asOfDate },
            status: 'posted'
        });
        
        const expenseEntries = await TransactionEntry.find({
            accountCode: { $regex: /^5/ },
            date: { $lte: asOfDate },
            status: 'posted'
        });
        
        const totalRevenue = revenueEntries.reduce((sum, entry) => sum + entry.credit, 0);
        const totalExpenses = expenseEntries.reduce((sum, entry) => sum + entry.debit, 0);
        
        return totalRevenue - totalExpenses;
    }
    
    static async getCashCollections(startDate, endDate) {
        const entries = await TransactionEntry.find({
            accountCode: '1001', // Bank
            date: { $gte: startDate, $lte: endDate },
            status: 'posted',
            debit: { $gt: 0 } // Cash coming in
        });
        
        return entries.reduce((sum, entry) => sum + entry.debit, 0);
    }
    
    static async getCashPayments(startDate, endDate) {
        const entries = await TransactionEntry.find({
            accountCode: '1001', // Bank
            date: { $gte: startDate, $lte: endDate },
            status: 'posted',
            credit: { $gt: 0 } // Cash going out
        });
        
        return entries.reduce((sum, entry) => sum + entry.credit, 0);
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
}

module.exports = AccountingService;
