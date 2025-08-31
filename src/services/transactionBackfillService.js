const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const DebtorTransactionSyncService = require('./debtorTransactionSyncService');
const DebtorDataSyncService = require('./debtorDataSyncService');

/**
 * Calculate prorated rent for the first month
 * @param {Date} startDate - Lease start date
 * @param {number} monthlyRent - Full monthly rent amount
 * @returns {number} Prorated rent amount
 */
function calculateProratedRent(startDate, monthlyRent) {
    const start = new Date(startDate);
    const year = start.getFullYear();
    const month = start.getMonth();
    
    // Get the last day of the month
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    
    // Calculate days from start date to end of month
    const daysFromStart = daysInMonth - start.getDate() + 1;
    
    // Calculate prorated amount
    const proratedAmount = (monthlyRent / daysInMonth) * daysFromStart;
    
    return Math.round(proratedAmount * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate deposit amount based on room price
 * @param {number} roomPrice - Monthly room price
 * @returns {number} Deposit amount (typically 1 month rent)
 */
function calculateDepositAmount(roomPrice) {
    return roomPrice; // Standard practice: 1 month rent as deposit
}

/**
 * Backfill missing transactions for a specific debtor
 * @param {Object} debtor - The debtor object
 * @returns {Object} Result of the backfill operation
 */
async function backfillTransactionsForDebtor(debtor) {
    try {
        console.log(`🔄 Backfilling transactions for debtor: ${debtor.debtorCode}`);
        
        // Get debtor's AR account
        const debtorAccount = await Account.findOne({ code: debtor.accountCode });
        if (!debtorAccount) {
            throw new Error(`Debtor account not found: ${debtor.accountCode}`);
        }
        
        // Get financial data from debtor
        const monthlyRent = debtor.roomPrice || debtor.financialBreakdown?.monthlyRent || 500;
        const startDate = debtor.startDate || debtor.billingPeriod?.startDate || new Date();
        const endDate = debtor.endDate || debtor.billingPeriod?.endDate || new Date(new Date().setMonth(new Date().getMonth() + 6));
        const applicationCode = debtor.applicationCode || 'MANUAL';
        
        // Get admin fee
        const adminFee = debtor.financialBreakdown?.adminFee || 
                       (debtor.residence?.name?.toLowerCase().includes('st kilda') ? 20 : 0);
        
        let leaseStartCreated = false;
        let monthlyTransactionsCreated = 0;
        
        // Check if lease start transaction already exists
        const existingLeaseStartTransaction = await TransactionEntry.findOne({
            $or: [
                { 'entries.accountCode': debtor.accountCode },
                { sourceId: debtor._id },
                { 'metadata.studentId': debtor.user?._id.toString() }
            ],
            source: 'rental_accrual',
            'metadata.type': 'lease_start'
        });
        
        if (!existingLeaseStartTransaction) {
            console.log(`   🆕 Creating lease start transaction`);
            
            // Calculate amounts
            const proratedRent = calculateProratedRent(startDate, monthlyRent);
            const depositAmount = calculateDepositAmount(monthlyRent);
            const totalLeaseStartAmount = proratedRent + adminFee + depositAmount;
            
            // Get or create admin fee income account
            let adminFeeAccount = await Account.findOne({ code: '4002' });
            if (!adminFeeAccount && adminFee > 0) {
                adminFeeAccount = new Account({
                    code: '4002',
                    name: 'Administrative Fees',
                    type: 'Income',
                    description: 'Administrative fees from tenants',
                    category: 'Operating Income',
                    isActive: true,
                    createdBy: 'system'
                });
                await adminFeeAccount.save();
            }
            
            // Get or create security deposit liability account
            let depositLiabilityAccount = await Account.findOne({ code: '2020' });
            if (!depositLiabilityAccount) {
                depositLiabilityAccount = new Account({
                    code: '2020',
                    name: 'Security Deposits Held',
                    type: 'Liability',
                    description: 'Security deposits held from tenants',
                    category: 'Current Liabilities',
                    isActive: true,
                    createdBy: 'system'
                });
                await depositLiabilityAccount.save();
            }
            
            // Create lease start transaction
            const leaseStartTransaction = new TransactionEntry({
                transactionId: `LEASE_START_${applicationCode}_${Date.now()}`,
                date: startDate,
                description: `Lease start for ${debtor.user?.firstName || 'Student'} ${debtor.user?.lastName || 'Unknown'}`,
                reference: `LEASE_START_${applicationCode}`,
                entries: [
                    {
                        accountCode: debtor.accountCode,
                        accountName: debtorAccount.name,
                        accountType: debtorAccount.type,
                        debit: totalLeaseStartAmount,
                        credit: 0,
                        description: `Lease start charges for ${startDate.toISOString().split('T')[0]}`
                    },
                    {
                        accountCode: '4001',
                        accountName: 'Rental Income',
                        accountType: 'Income',
                        debit: 0,
                        credit: proratedRent,
                        description: `Prorated rental income for ${debtor.user?.firstName || 'Student'} ${debtor.user?.lastName || 'Unknown'}`
                    }
                ],
                totalDebit: totalLeaseStartAmount,
                totalCredit: totalLeaseStartAmount,
                source: 'rental_accrual',
                sourceId: debtor._id,
                sourceModel: 'Debtor',
                status: 'posted',
                metadata: {
                    studentId: debtor.user?._id,
                    type: 'lease_start',
                    month: startDate.toISOString().split('T')[0].substring(0, 7),
                    applicationCode: applicationCode,
                    roomNumber: debtor.roomNumber,
                    monthlyRent: monthlyRent,
                    proratedRent: proratedRent,
                    adminFee: adminFee,
                    deposit: depositAmount
                },
                createdBy: debtor.createdBy || debtor.user?._id
            });
            
            // Add admin fee entry if applicable
            if (adminFee > 0 && adminFeeAccount) {
                leaseStartTransaction.entries.push({
                    accountCode: '4002',
                    accountName: 'Administrative Fees',
                    accountType: 'Income',
                    debit: 0,
                    credit: adminFee,
                    description: `Admin fee for ${debtor.user?.firstName || 'Student'} ${debtor.user?.lastName || 'Unknown'}`
                });
            }
            
            // Add deposit liability entry
            if (depositAmount > 0) {
                leaseStartTransaction.entries.push({
                    accountCode: '2020',
                    accountName: 'Security Deposits Held',
                    accountType: 'Liability',
                    debit: 0,
                    credit: depositAmount,
                    description: `Security deposit liability for ${debtor.user?.firstName || 'Student'} ${debtor.user?.lastName || 'Unknown'}`
                });
            }
            
            await leaseStartTransaction.save();
            leaseStartCreated = true;
            console.log(`   ✅ Created lease start transaction: $${totalLeaseStartAmount}`);
        }
        
        // Clean up any duplicate monthly accruals
        const duplicateMonthlyAccruals = await TransactionEntry.find({
            'entries.accountCode': debtor.accountCode,
            source: 'rental_accrual',
            'metadata.type': 'monthly_rent_accrual'
        });
        
        // Group by month and remove duplicates
        const monthlyGroups = {};
        duplicateMonthlyAccruals.forEach(tx => {
            const monthKey = tx.date.toISOString().split('T')[0].substring(0, 7);
            if (!monthlyGroups[monthKey]) {
                monthlyGroups[monthKey] = [];
            }
            monthlyGroups[monthKey].push(tx);
        });
        
        let duplicatesRemoved = 0;
        for (const [month, transactions] of Object.entries(monthlyGroups)) {
            if (transactions.length > 1) {
                // Keep the first transaction, delete the rest
                for (let i = 1; i < transactions.length; i++) {
                    await TransactionEntry.findByIdAndDelete(transactions[i]._id);
                    duplicatesRemoved++;
                }
            }
        }
        
        // Create monthly accrual transactions for missing months
        const now = new Date();
        const currentDay = now.getDate();
        const shouldIncludeCurrentMonth = currentDay >= 2;
        
        // Get current month key for comparison
        const currentMonthKey = now.toISOString().split('T')[0].substring(0, 7);
        
        // Iterate through months from lease start month to current month (not end date)
        let currentMonthIter = new Date(startDate);
        currentMonthIter.setDate(1); // Set to first day of month
        
        while (currentMonthIter < endDate) {
            const monthKey = currentMonthIter.toISOString().split('T')[0].substring(0, 7);
            
            // Stop if we've gone past the current month
            if (monthKey > currentMonthKey) {
                break;
            }
            
            // Skip current month if we haven't passed the 2nd
            if (monthKey === currentMonthKey && !shouldIncludeCurrentMonth) {
                currentMonthIter.setMonth(currentMonthIter.getMonth() + 1);
                continue;
            }
            
            // Check if this is the lease start month
            const leaseStartMonthKey = startDate.toISOString().split('T')[0].substring(0, 7);
            if (monthKey === leaseStartMonthKey) {
                console.log(`   ⏭️ Skipping monthly accrual for lease start month: ${monthKey}`);
                currentMonthIter.setMonth(currentMonthIter.getMonth() + 1);
                continue;
            }
            
            // Check if monthly accrual already exists for this month
            const existingMonthlyForMonth = await TransactionEntry.findOne({
                'entries.accountCode': debtor.accountCode,
                source: 'rental_accrual',
                'metadata.type': 'monthly_rent_accrual',
                $or: [
                    { 'metadata.month': monthKey },
                    { 
                        date: {
                            $gte: new Date(currentMonthIter.getFullYear(), currentMonthIter.getMonth(), 1),
                            $lt: new Date(currentMonthIter.getFullYear(), currentMonthIter.getMonth() + 1, 1)
                        }
                    }
                ]
            });
            
            if (existingMonthlyForMonth) {
                currentMonthIter.setMonth(currentMonthIter.getMonth() + 1);
                continue;
            }
            
            // Check if this is the last month of the lease
            const nextMonth = new Date(currentMonthIter);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            const isLastMonth = nextMonth > endDate;
            
            // For last month, use full monthly rent (not prorated)
            const monthlyAmount = monthlyRent;
            
            const monthlyAccrualTransaction = new TransactionEntry({
                transactionId: `MONTHLY_ACCRUAL_${monthKey}_${applicationCode}_${Date.now()}`,
                date: currentMonthIter,
                description: `Monthly rent accrual for ${debtor.user?.firstName || 'Student'} ${debtor.user?.lastName || 'Unknown'} - ${monthKey}`,
                reference: `MONTHLY_ACCRUAL_${monthKey}_${applicationCode}`,
                entries: [
                    {
                        accountCode: debtor.accountCode,
                        accountName: debtorAccount.name,
                        accountType: debtorAccount.type,
                        debit: monthlyAmount,
                        credit: 0,
                        description: `Monthly rent for ${monthKey}${isLastMonth ? ' (last month)' : ''}`
                    },
                    {
                        accountCode: '4001',
                        accountName: 'Rental Income',
                        accountType: 'Income',
                        debit: 0,
                        credit: monthlyAmount,
                        description: `Rental income for ${monthKey}${isLastMonth ? ' (last month)' : ''}`
                    }
                ],
                totalDebit: monthlyAmount,
                totalCredit: monthlyAmount,
                source: 'rental_accrual',
                sourceId: debtor._id,
                sourceModel: 'Debtor',
                status: 'posted',
                metadata: {
                    studentId: debtor.user?._id,
                    type: 'monthly_rent_accrual',
                    month: monthKey,
                    applicationCode: applicationCode,
                    roomNumber: debtor.roomNumber,
                    monthlyRent: monthlyRent
                },
                createdBy: debtor.createdBy || debtor.user?._id
            });
            
            await monthlyAccrualTransaction.save();
            monthlyTransactionsCreated++;
            
            // Move to next month
            currentMonthIter.setMonth(currentMonthIter.getMonth() + 1);
        }
        
        // Recalculate debtor totals from transactions
        await DebtorTransactionSyncService.recalculateDebtorTotalsFromTransactionEntries(debtor, debtor.user?._id);
        
        // Sync debtor data arrays with transaction data
        await DebtorDataSyncService.syncDebtorDataArrays(debtor._id);
        
        return {
            success: true,
            leaseStartCreated,
            monthlyTransactionsCreated,
            duplicatesRemoved,
            debtor: debtor
        };
        
    } catch (error) {
        console.error(`❌ Error backfilling transactions for debtor ${debtor.debtorCode}:`, error);
        return {
            success: false,
            error: error.message,
            debtor: debtor
        };
    }
}

/**
 * Backfill missing transactions for all debtors
 * @returns {Object} Result of the backfill operation
 */
async function backfillAllTransactions() {
    try {
        const Debtor = require('../models/Debtor');
        
        // Get all debtors with their user and application data
        const debtors = await Debtor.find({})
            .populate('user', 'firstName lastName email')
            .populate('application', 'applicationCode startDate endDate');
        
        console.log(`📊 Found ${debtors.length} debtors to process`);
        
        let processedCount = 0;
        let errorCount = 0;
        let totalLeaseStartCreated = 0;
        let totalMonthlyTransactionsCreated = 0;
        let totalDuplicatesRemoved = 0;
        
        for (const debtor of debtors) {
            const result = await backfillTransactionsForDebtor(debtor);
            
            if (result.success) {
                processedCount++;
                if (result.leaseStartCreated) totalLeaseStartCreated++;
                totalMonthlyTransactionsCreated += result.monthlyTransactionsCreated;
                totalDuplicatesRemoved += result.duplicatesRemoved;
            } else {
                errorCount++;
            }
        }
        
        return {
            success: true,
            summary: {
                totalDebtors: debtors.length,
                processedCount,
                errorCount,
                leaseStartCreated: totalLeaseStartCreated,
                monthlyTransactionsCreated: totalMonthlyTransactionsCreated,
                duplicatesRemoved: totalDuplicatesRemoved
            }
        };
        
    } catch (error) {
        console.error('❌ Error in backfillAllTransactions:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    backfillTransactionsForDebtor,
    backfillAllTransactions,
    calculateProratedRent,
    calculateDepositAmount
};
