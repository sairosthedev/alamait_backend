/**
 * Script to revert lease starts created for February and March 2026
 * This removes transactions, transaction entries, and related invoices
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Transaction = require('../src/models/Transaction');
const TransactionEntry = require('../src/models/TransactionEntry');
const Invoice = require('../src/models/Invoice');

async function revertFutureLeaseStarts() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('✅ Connected to database');

        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // 1-12

        // Find lease starts for February and March (assuming 2026)
        const targetMonths = [2, 3]; // February and March
        const targetYear = 2026;

        console.log(`\n🔍 Searching for lease starts in February and March ${targetYear}...`);
        console.log(`   Current date: ${currentMonth}/${currentYear}`);

        // Find all lease start transaction entries for February and March
        const leaseStartEntries = await TransactionEntry.find({
            'metadata.type': 'lease_start',
            $or: [
                {
                    'metadata.accrualMonth': { $in: targetMonths },
                    'metadata.accrualYear': targetYear
                },
                {
                    date: {
                        $gte: new Date(targetYear, 1, 1), // February 1, 2026
                        $lt: new Date(targetYear, 3, 1)    // April 1, 2026 (exclusive)
                    }
                }
            ],
            status: { $ne: 'deleted' }
        });

        console.log(`\n📊 Found ${leaseStartEntries.length} lease start transaction entries`);

        if (leaseStartEntries.length === 0) {
            console.log('✅ No lease starts found for February/March. Nothing to revert.');
            await mongoose.disconnect();
            return;
        }

        // Group by application code for reporting
        const applications = {};
        leaseStartEntries.forEach(entry => {
            const appCode = entry.metadata?.applicationCode || 'Unknown';
            if (!applications[appCode]) {
                applications[appCode] = {
                    entries: [],
                    transactions: [],
                    invoices: []
                };
            }
            applications[appCode].entries.push(entry);
        });

        console.log(`\n📋 Affected applications:`);
        Object.keys(applications).forEach(appCode => {
            console.log(`   - ${appCode}: ${applications[appCode].entries.length} transaction entry(ies)`);
        });

        // Get transaction IDs and entry IDs
        const transactionIds = leaseStartEntries.map(entry => entry.transactionId);
        const uniqueTransactionIds = [...new Set(transactionIds)].filter(id => id);

        // Find related transactions (by transactionId or by entries reference)
        const transactions = await Transaction.find({
            $or: [
                { transactionId: { $in: uniqueTransactionIds } },
                { entries: { $in: leaseStartEntries.map(e => e._id) } }
            ]
        });

        console.log(`\n📊 Found ${transactions.length} related transactions`);

        // Find related invoices
        const applicationCodes = leaseStartEntries
            .map(entry => entry.metadata?.applicationCode)
            .filter(code => code)
            .filter((code, index, self) => self.indexOf(code) === index);

        const invoices = await Invoice.find({
            billingPeriod: { $regex: new RegExp(`LEASE_START_(${applicationCodes.join('|')})`) },
            status: { $ne: 'cancelled' }
        });

        console.log(`📊 Found ${invoices.length} related invoices`);

        // Confirm deletion
        console.log(`\n⚠️  WARNING: This will delete:`);
        console.log(`   - ${leaseStartEntries.length} transaction entries`);
        console.log(`   - ${transactions.length} transactions`);
        console.log(`   - ${invoices.length} invoices`);
        // Perform deletion (auto-confirm for script execution)
        const shouldDelete = process.argv.includes('--confirm') || process.argv.includes('-y');
        
        if (!shouldDelete) {
            console.log(`\n💡 To actually delete, run: node scripts/revertFutureLeaseStarts.js --confirm`);
            await mongoose.disconnect();
            return;
        }

        try {
            // Delete transaction entries
            console.log('\n🗑️  Deleting transaction entries...');
            const deletedEntries = await TransactionEntry.deleteMany({
                _id: { $in: leaseStartEntries.map(e => e._id) }
            });
            console.log(`   ✅ Deleted ${deletedEntries.deletedCount} transaction entries`);

            // Delete transactions
            if (transactions.length > 0) {
                console.log('\n🗑️  Deleting transactions...');
                const deletedTransactions = await Transaction.deleteMany({
                    _id: { $in: transactions.map(t => t._id) }
                });
                console.log(`   ✅ Deleted ${deletedTransactions.deletedCount} transactions`);
            } else {
                console.log('\n⚠️  No transactions found to delete (they may have been deleted already)');
            }

            // Cancel invoices (set status to cancelled instead of deleting)
            if (invoices.length > 0) {
                console.log('\n🗑️  Cancelling invoices...');
                const cancelledInvoices = await Invoice.updateMany(
                    { _id: { $in: invoices.map(i => i._id) } },
                    { 
                        $set: { 
                            status: 'cancelled'
                        } 
                    }
                );
                console.log(`   ✅ Cancelled ${cancelledInvoices.modifiedCount} invoices`);
            } else {
                console.log('\n⚠️  No invoices found to cancel');
            }

            console.log('\n✅ Reversion complete!');
        } catch (error) {
            console.error('❌ Error during deletion:', error);
            throw error;
        }

        await mongoose.disconnect();
        console.log('\n✅ Script completed');

        // Summary
        console.log(`\n📊 Summary:`);
        console.log(`   Transaction Entries: ${leaseStartEntries.length}`);
        console.log(`   Transactions: ${transactions.length}`);
        console.log(`   Invoices: ${invoices.length}`);
        console.log(`   Applications affected: ${Object.keys(applications).length}`);

        // Show details
        console.log(`\n📋 Details:`);
        leaseStartEntries.forEach((entry, index) => {
            const appCode = entry.metadata?.applicationCode || 'Unknown';
            const studentName = entry.metadata?.studentName || 'Unknown';
            const date = entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A';
            console.log(`   ${index + 1}. ${studentName} (${appCode}) - ${date}`);
        });

        await mongoose.disconnect();
        console.log('\n✅ Script completed');

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    revertFutureLeaseStarts();
}

module.exports = { revertFutureLeaseStarts };
