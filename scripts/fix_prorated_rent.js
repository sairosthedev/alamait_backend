const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Debtor = require('../src/models/Debtor');
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');
const User = require('../src/models/User');

// Import services
const DebtorTransactionSyncService = require('../src/services/debtorTransactionSyncService');

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

async function fixProratedRent() {
    try {
        console.log('🔧 FIXING PRORATED RENT FOR FIRST MONTH');
        console.log('========================================');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Get all debtors with their user data
        const debtors = await Debtor.find({})
            .populate('user', 'firstName lastName')
            .populate('application', 'applicationCode startDate endDate');
        
        console.log(`📊 Found ${debtors.length} debtors to process`);
        
        let processedCount = 0;
        let errorCount = 0;
        
        for (const debtor of debtors) {
            try {
                console.log(`\n🔍 Processing debtor: ${debtor.debtorCode} (${debtor.user?.firstName} ${debtor.user?.lastName})`);
                
                // Get financial data from debtor
                const monthlyRent = debtor.roomPrice || debtor.financialBreakdown?.monthlyRent || 500;
                const startDate = debtor.startDate || debtor.billingPeriod?.startDate || new Date();
                const applicationCode = debtor.applicationCode || 'MANUAL';
                
                console.log(`   💰 Monthly Rent: $${monthlyRent}`);
                console.log(`   📅 Start Date: ${startDate.toISOString().split('T')[0]}`);
                
                // Calculate prorated rent for first month
                const proratedRent = calculateProratedRent(startDate, monthlyRent);
                console.log(`   📊 Prorated Rent: $${proratedRent} (from $${monthlyRent})`);
                
                // Find the lease start transaction for this debtor
                const leaseStartTransaction = await TransactionEntry.findOne({
                    'entries.accountCode': debtor.accountCode,
                    source: 'rental_accrual',
                    'metadata.type': 'lease_start'
                });
                
                if (leaseStartTransaction) {
                    // Check if the amount needs to be updated
                    const currentAmount = leaseStartTransaction.totalDebit;
                    
                    if (Math.abs(currentAmount - proratedRent) > 0.01) {
                        console.log(`   🔧 Updating lease start transaction: $${currentAmount} → $${proratedRent}`);
                        
                        // Update the transaction amounts
                        leaseStartTransaction.totalDebit = proratedRent;
                        leaseStartTransaction.totalCredit = proratedRent;
                        
                        // Update the entries
                        leaseStartTransaction.entries.forEach(entry => {
                            if (entry.accountCode === debtor.accountCode) {
                                entry.debit = proratedRent;
                                entry.description = `Prorated rent for ${startDate.toISOString().split('T')[0]} (${proratedRent.toFixed(2)} days)`;
                            } else if (entry.accountCode === '4001') {
                                entry.credit = proratedRent;
                                entry.description = `Prorated rental income for ${debtor.user?.firstName || 'Student'} ${debtor.user?.lastName || 'Unknown'}`;
                            }
                        });
                        
                        await leaseStartTransaction.save();
                        console.log(`   ✅ Updated lease start transaction`);
                    } else {
                        console.log(`   ✅ Lease start transaction already has correct prorated amount: $${currentAmount}`);
                    }
                } else {
                    console.log(`   ⚠️ No lease start transaction found for ${debtor.debtorCode}`);
                }
                
                // Recalculate debtor totals from transactions
                await DebtorTransactionSyncService.recalculateDebtorTotalsFromTransactionEntries(debtor, debtor.user?._id);
                await debtor.save();
                
                console.log(`   ✅ Updated debtor totals from transactions`);
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
        console.log(`❌ Errors: ${errorCount} debtors`);
        console.log(`📈 Total debtors: ${debtors.length}`);
        
        // Run final verification
        console.log('\n🔍 Running final verification...');
        const finalVerification = await DebtorTransactionSyncService.recalculateAllDebtorTotals();
        console.log(`✅ Final verification completed: ${finalVerification.processedCount} processed, ${finalVerification.errorCount} errors`);
        
    } catch (error) {
        console.error('❌ Error in prorated rent fix:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the script
fixProratedRent().then(() => {
    console.log('\n🎉 Prorated rent fix completed!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Prorated rent fix failed:', error);
    process.exit(1);
});
