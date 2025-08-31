const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Debtor = require('../src/models/Debtor');
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');
const User = require('../src/models/User');
const Application = require('../src/models/Application');

// Import services
const DebtorTransactionSyncService = require('../src/services/debtorTransactionSyncService');
const DebtorDataSyncService = require('../src/services/debtorDataSyncService');

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

async function createMissingTransactions() {
    try {
        console.log('🔧 CREATING MISSING TRANSACTION ENTRIES FOR DEBTORS');
        console.log('==================================================');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Get all debtors with their user and application data
        const debtors = await Debtor.find({})
            .populate('user', 'firstName lastName email')
            .populate('application', 'applicationCode startDate endDate');
        
        console.log(`📊 Found ${debtors.length} debtors to process`);
        
        let processedCount = 0;
        let errorCount = 0;
        let leaseStartTransactionsCreated = 0;
        let monthlyTransactionsCreated = 0;
        
        for (const debtor of debtors) {
            try {
                console.log(`\n🔍 Processing debtor: ${debtor.debtorCode} (${debtor.user?.firstName} ${debtor.user?.lastName})`);
                
                // Get debtor's AR account
                console.log(`   🔍 Looking for debtor account: ${debtor.accountCode}`);
                const debtorAccount = await Account.findOne({ code: debtor.accountCode });
                if (!debtorAccount) {
                    console.log(`   ⚠️ Debtor account not found: ${debtor.accountCode} - skipping`);
                    continue;
                }
                console.log(`   ✅ Found debtor account: ${debtorAccount.name}`);
                
                // Get financial data from debtor
                const monthlyRent = debtor.roomPrice || debtor.financialBreakdown?.monthlyRent || 500;
                const startDate = debtor.startDate || debtor.billingPeriod?.startDate || new Date();
                const endDate = debtor.endDate || debtor.billingPeriod?.endDate || new Date(new Date().setMonth(new Date().getMonth() + 6));
                const applicationCode = debtor.applicationCode || 'MANUAL';
                
                // Get admin fee (check if it's St Kilda or use default)
                const adminFee = debtor.financialBreakdown?.adminFee || 
                               (debtor.residence?.name?.toLowerCase().includes('st kilda') ? 20 : 0);
                
                console.log(`   💰 Monthly Rent: $${monthlyRent}`);
                console.log(`   💰 Admin Fee: $${adminFee}`);
                console.log(`   📅 Start Date: ${startDate.toISOString().split('T')[0]}`);
                console.log(`   📅 End Date: ${endDate.toISOString().split('T')[0]}`);
                
                // Check if lease start transaction already exists (more robust query)
                const existingLeaseStartTransaction = await TransactionEntry.findOne({
                    $or: [
                        { 'entries.accountCode': debtor.accountCode },
                        { sourceId: debtor._id },
                        { 'metadata.studentId': debtor.user?._id.toString() }
                    ],
                    source: 'rental_accrual',
                    'metadata.type': 'lease_start'
                });
                
                console.log(`   🔍 Lease start detection: ${existingLeaseStartTransaction ? 'FOUND' : 'NOT FOUND'}`);
                if (existingLeaseStartTransaction) {
                    console.log(`      Transaction ID: ${existingLeaseStartTransaction.transactionId}`);
                    console.log(`      Amount: $${existingLeaseStartTransaction.totalDebit}`);
                }
                
                if (!existingLeaseStartTransaction) {
                    console.log(`   🆕 Creating lease start transaction with prorated rent, admin fee, and deposit`);
                    
                    // Calculate amounts
                    const proratedRent = calculateProratedRent(startDate, monthlyRent);
                    const depositAmount = calculateDepositAmount(monthlyRent);
                    const totalLeaseStartAmount = proratedRent + adminFee + depositAmount;
                    
                    console.log(`   📊 Prorated Rent: $${proratedRent}`);
                    console.log(`   💰 Admin Fee: $${adminFee}`);
                    console.log(`   💎 Deposit: $${depositAmount}`);
                    console.log(`   💵 Total Lease Start: $${totalLeaseStartAmount}`);
                    
                    // Get or create admin fee income account
                    let adminFeeAccount = await Account.findOne({ code: '4002' });
                    if (!adminFeeAccount && adminFee > 0) {
                        console.log(`   🔧 Creating admin fee income account`);
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
                        console.log(`   🔧 Creating security deposit liability account`);
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
                    
                    // Create lease start transaction with all components
                    const leaseStartTransaction = new TransactionEntry({
                        transactionId: `LEASE_START_${applicationCode}_${Date.now()}`,
                        date: startDate,
                        description: `Lease start for ${debtor.user?.firstName || 'Student'} ${debtor.user?.lastName || 'Unknown'}`,
                        reference: `LEASE_START_${applicationCode}`,
                        entries: [
                            // Debit: Student AR account (total amount owed)
                            {
                                accountCode: debtor.accountCode,
                                accountName: debtorAccount.name,
                                accountType: debtorAccount.type,
                                debit: totalLeaseStartAmount,
                                credit: 0,
                                description: `Lease start charges for ${startDate.toISOString().split('T')[0]}`
                            },
                            // Credit: Rental Income (prorated rent)
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
                            month: startDate.toISOString().split('T')[0].substring(0, 7), // YYYY-MM
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
                    console.log(`   ✅ Created lease start transaction: $${totalLeaseStartAmount}`);
                    leaseStartTransactionsCreated++;
                } else {
                    console.log(`   ✅ Lease start transaction already exists: $${existingLeaseStartTransaction.totalDebit}`);
                }
                
                // Clean up any duplicate monthly accruals before creating new ones
                console.log(`   🧹 Cleaning up any duplicate monthly accruals`);
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
                        console.log(`   🗑️ Found ${transactions.length} transactions for ${month}, keeping the first one`);
                        // Keep the first transaction, delete the rest
                        for (let i = 1; i < transactions.length; i++) {
                            await TransactionEntry.findByIdAndDelete(transactions[i]._id);
                            duplicatesRemoved++;
                        }
                    }
                }
                
                if (duplicatesRemoved > 0) {
                    console.log(`   ✅ Removed ${duplicatesRemoved} duplicate monthly accruals`);
                }
                
                // Create monthly accrual transactions for the remaining months (up to current month, but only if past 2nd of month)
                console.log(`   🆕 Creating monthly accrual transactions (checking for existing ones first)`);
                
                // Get current month for comparison - FIXED LOGIC
                const now = new Date();
                const currentDay = now.getDate();
                const shouldIncludeCurrentMonth = currentDay >= 2; // Only include current month if past 2nd
                
                console.log(`   📅 Current date: ${now.toISOString().split('T')[0]}, Day: ${currentDay}`);
                
                let monthlyTransactionCount = 0;
                
                // Iterate through months from second month to end date (including current month if past 2nd)
                let currentMonthIter = new Date(startDate);
                currentMonthIter.setMonth(currentMonthIter.getMonth() + 1); // Start from second month
                currentMonthIter.setDate(1); // Set to first day of month
                
                while (currentMonthIter < endDate) {
                    const monthKey = currentMonthIter.toISOString().split('T')[0].substring(0, 7); // YYYY-MM
                    const currentMonthKey = now.toISOString().split('T')[0].substring(0, 7);
                    
                    // Skip current month if we haven't passed the 2nd
                    if (monthKey === currentMonthKey && !shouldIncludeCurrentMonth) {
                        console.log(`   ⏭️ Skipping current month (${monthKey}) - only ${currentDay} days into month`);
                        currentMonthIter.setMonth(currentMonthIter.getMonth() + 1);
                        continue;
                    }
                    
                    console.log(`   🔍 Processing month: ${monthKey}`);
                    
                    // Check if monthly accrual already exists for this month (more robust check)
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
                        console.log(`   ⏭️ Monthly accrual already exists for ${monthKey} - skipping`);
                        currentMonthIter.setMonth(currentMonthIter.getMonth() + 1);
                        continue;
                    }
                    
                    // Check if this is the last month of the lease
                    const nextMonth = new Date(currentMonthIter);
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    const isLastMonth = nextMonth > endDate;
                    
                    // For last month, use full monthly rent (not prorated)
                    const monthlyAmount = monthlyRent;
                    
                    console.log(`   📅 Creating monthly accrual for ${monthKey}${isLastMonth ? ' (last month)' : ''}`);
                    
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
                    monthlyTransactionCount++;
                    
                    // Move to next month
                    currentMonthIter.setMonth(currentMonthIter.getMonth() + 1);
                }
                
                console.log(`   ✅ Created ${monthlyTransactionCount} new monthly accrual transactions (up to current month)`);
                monthlyTransactionsCreated += monthlyTransactionCount;
                
                // Note: Deposit is now included in the lease start transaction, no separate deposit transaction needed
                console.log(`   ℹ️ Deposit is included in lease start transaction - no separate deposit transaction needed`);
                
                // Recalculate debtor totals from transactions
                await DebtorTransactionSyncService.recalculateDebtorTotalsFromTransactionEntries(debtor, debtor.user?._id);
                
                // Sync debtor data arrays with transaction data
                await DebtorDataSyncService.syncDebtorDataArrays(debtor._id);
                
                console.log(`   ✅ Updated debtor totals and data arrays from transactions`);
                console.log(`      Total Owed: $${debtor.totalOwed}`);
                console.log(`      Total Paid: $${debtor.totalPaid}`);
                console.log(`      Current Balance: $${debtor.currentBalance}`);
                
                processedCount++;
                
            } catch (error) {
                console.error(`   ❌ Error processing debtor ${debtor.debtorCode}:`, error.message);
                errorCount++;
            }
        }
        
        console.log('\n📊 PROCESSING SUMMARY');
        console.log('=====================');
        console.log(`✅ Successfully processed: ${processedCount} debtors`);
        console.log(`🏠 Lease start transactions created: ${leaseStartTransactionsCreated}`);
        console.log(`📅 Monthly transactions created: ${monthlyTransactionsCreated}`);
        console.log(`💰 Deposits included in lease start transactions`);
        console.log(`❌ Errors: ${errorCount} debtors`);
        console.log(`📈 Total debtors: ${debtors.length}`);
        
        // Run final verification
        console.log('\n🔍 Running final verification...');
        const finalVerification = await DebtorTransactionSyncService.recalculateAllDebtorTotals();
        console.log(`✅ Final verification completed: ${finalVerification.processedCount} processed, ${finalVerification.errorCount} errors`);
        
        // Sync all debtor data arrays
        console.log('\n🔄 Syncing all debtor data arrays...');
        const dataSyncResult = await DebtorDataSyncService.syncAllDebtorsDataArrays();
        console.log(`✅ Data arrays sync completed: ${dataSyncResult.successCount} successful, ${dataSyncResult.errorCount} errors`);
        
    } catch (error) {
        console.error('❌ Error in transaction creation:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the script
createMissingTransactions().then(() => {
    console.log('\n🎉 Transaction creation completed!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Transaction creation failed:', error);
    process.exit(1);
});
