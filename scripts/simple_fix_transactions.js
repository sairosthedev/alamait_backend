const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Debtor = require('../src/models/Debtor');
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');
const User = require('../src/models/User');

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

async function simpleFixTransactions() {
    try {
        console.log('🔧 SIMPLE FIX: ALL TRANSACTION ENTRIES FOR DEBTORS');
        console.log('==================================================');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Get all debtors with their user data
        const debtors = await Debtor.find({})
            .populate('user', 'firstName lastName email');
        
        console.log(`📊 Found ${debtors.length} debtors to process`);
        
        let processedCount = 0;
        let errorCount = 0;
        let transactionsDeleted = 0;
        let leaseStartTransactionsCreated = 0;
        let monthlyTransactionsCreated = 0;
        
        for (const debtor of debtors) {
            try {
                console.log(`\n🔍 Processing debtor: ${debtor.debtorCode} (${debtor.user?.firstName} ${debtor.user?.lastName})`);
                
                // Get debtor's AR account
                const debtorAccount = await Account.findOne({ code: debtor.accountCode });
                if (!debtorAccount) {
                    console.log(`   ⚠️ Debtor account not found: ${debtor.accountCode} - skipping`);
                    continue;
                }
                
                // Get financial data from debtor
                const monthlyRent = debtor.roomPrice || debtor.financialBreakdown?.monthlyRent || 500;
                const startDate = debtor.startDate || debtor.billingPeriod?.startDate || new Date();
                const endDate = debtor.endDate || debtor.billingPeriod?.endDate || new Date(new Date().setMonth(new Date().getMonth() + 6));
                const applicationCode = debtor.applicationCode || 'MANUAL';
                
                // Get admin fee
                const adminFee = 20; // Default admin fee
                
                console.log(`   💰 Monthly Rent: $${monthlyRent}`);
                console.log(`   💰 Admin Fee: $${adminFee}`);
                console.log(`   📅 Start Date: ${startDate.toISOString().split('T')[0]}`);
                console.log(`   📅 End Date: ${endDate.toISOString().split('T')[0]}`);
                
                // DELETE ALL EXISTING TRANSACTIONS FOR THIS DEBTOR
                console.log(`   🗑️ Deleting all existing transactions for ${debtor.debtorCode}`);
                const deleteResult = await TransactionEntry.deleteMany({
                    'entries.accountCode': debtor.accountCode
                });
                console.log(`   ✅ Deleted ${deleteResult.deletedCount} existing transactions`);
                transactionsDeleted += deleteResult.deletedCount;
                
                // CREATE COMPREHENSIVE LEASE START TRANSACTION
                console.log(`   🆕 Creating comprehensive lease start transaction`);
                
                // Calculate amounts
                const proratedRent = calculateProratedRent(startDate, monthlyRent);
                const depositAmount = monthlyRent; // 1 month rent as deposit
                const totalLeaseStartAmount = proratedRent + adminFee + depositAmount;
                
                console.log(`   📊 Prorated Rent: $${proratedRent}`);
                console.log(`   💰 Admin Fee: $${adminFee}`);
                console.log(`   💎 Deposit: $${depositAmount}`);
                console.log(`   💵 Total Lease Start: $${totalLeaseStartAmount}`);
                
                // Get or create admin fee income account
                let adminFeeAccount = await Account.findOne({ code: '4002' });
                if (!adminFeeAccount) {
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
                
                // Create comprehensive lease start transaction
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
                        },
                        // Credit: Administrative Fees
                        {
                            accountCode: '4002',
                            accountName: 'Administrative Fees',
                            accountType: 'Income',
                            debit: 0,
                            credit: adminFee,
                            description: `Admin fee for ${debtor.user?.firstName || 'Student'} ${debtor.user?.lastName || 'Unknown'}`
                        },
                        // Credit: Security Deposits Held
                        {
                            accountCode: '2020',
                            accountName: 'Security Deposits Held',
                            accountType: 'Liability',
                            debit: 0,
                            credit: depositAmount,
                            description: `Security deposit liability for ${debtor.user?.firstName || 'Student'} ${debtor.user?.lastName || 'Unknown'}`
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
                
                await leaseStartTransaction.save();
                console.log(`   ✅ Created comprehensive lease start transaction: $${totalLeaseStartAmount}`);
                leaseStartTransactionsCreated++;
                
                // CREATE MONTHLY ACCRUAL TRANSACTIONS (up to current month only, excluding September)
                console.log(`   🆕 Creating monthly accrual transactions (up to current month, excluding September)`);
                
                // Create monthly accrual transactions for the remaining months (up to current month only)
                const currentDate = new Date(startDate);
                currentDate.setMonth(currentDate.getMonth() + 1); // Start from second month
                
                // Get current month for comparison
                const now = new Date();
                const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
                
                let monthlyTransactionCount = 0;
                while (currentDate < endDate && currentDate <= currentMonth) {
                    const monthKey = currentDate.toISOString().split('T')[0].substring(0, 7); // YYYY-MM
                    
                    // Skip September (as requested)
                    if (currentDate.getMonth() === 8) { // September is month 8 (0-indexed)
                        console.log(`   ⏭️ Skipping September ${monthKey}`);
                        currentDate.setMonth(currentDate.getMonth() + 1);
                        continue;
                    }
                    
                    const monthlyAccrualTransaction = new TransactionEntry({
                        transactionId: `MONTHLY_ACCRUAL_${monthKey}_${applicationCode}_${Date.now()}`,
                        date: currentDate,
                        description: `Monthly rent accrual for ${debtor.user?.firstName || 'Student'} ${debtor.user?.lastName || 'Unknown'} - ${monthKey}`,
                        reference: `MONTHLY_ACCRUAL_${monthKey}_${applicationCode}`,
                        entries: [
                            {
                                accountCode: debtor.accountCode,
                                accountName: debtorAccount.name,
                                accountType: debtorAccount.type,
                                debit: monthlyRent,
                                credit: 0,
                                description: `Monthly rent for ${monthKey}`
                            },
                            {
                                accountCode: '4001',
                                accountName: 'Rental Income',
                                accountType: 'Income',
                                debit: 0,
                                credit: monthlyRent,
                                description: `Rental income for ${monthKey}`
                            }
                        ],
                        totalDebit: monthlyRent,
                        totalCredit: monthlyRent,
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
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }
                
                console.log(`   ✅ Created ${monthlyTransactionCount} monthly accrual transactions (excluding September)`);
                monthlyTransactionsCreated += monthlyTransactionCount;
                
                // Manually recalculate debtor totals
                const allTransactions = await TransactionEntry.find({
                    'entries.accountCode': debtor.accountCode
                });
                
                let totalOwed = 0;
                allTransactions.forEach(tx => {
                    const debitEntry = tx.entries.find(e => e.accountCode === debtor.accountCode);
                    if (debitEntry) {
                        totalOwed += debitEntry.debit;
                    }
                });
                
                debtor.totalOwed = totalOwed;
                debtor.totalPaid = 0; // Assuming no payments yet
                debtor.currentBalance = totalOwed;
                debtor.status = totalOwed > 0 ? 'overdue' : 'current';
                
                await debtor.save();
                
                console.log(`   ✅ Updated debtor totals manually`);
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
        console.log(`🗑️ Transactions deleted: ${transactionsDeleted}`);
        console.log(`🏠 Lease start transactions created: ${leaseStartTransactionsCreated}`);
        console.log(`📅 Monthly transactions created: ${monthlyTransactionsCreated}`);
        console.log(`❌ Errors: ${errorCount} debtors`);
        console.log(`📈 Total debtors: ${debtors.length}`);
        
    } catch (error) {
        console.error('❌ Error in transaction fixing:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the script
simpleFixTransactions().then(() => {
    console.log('\n🎉 Transaction fixing completed!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Transaction fixing failed:', error);
    process.exit(1);
});
