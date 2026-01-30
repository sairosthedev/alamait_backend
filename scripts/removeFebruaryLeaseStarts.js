/**
 * Script to remove all lease starts created for February 2026
 * This removes transactions, transaction entries, and cancels related invoices
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Transaction = require('../src/models/Transaction');
const TransactionEntry = require('../src/models/TransactionEntry');
const Invoice = require('../src/models/Invoice');

async function removeFebruaryLeaseStarts() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('✅ Connected to database');

        const targetMonth = 2; // February
        const targetYear = 2026;

        console.log(`\n🔍 Searching for lease starts in February ${targetYear}...`);

        // Find all lease start transaction entries for February 2026
        // Check multiple ways to identify February lease starts:
        // 1. By metadata.accrualMonth
        // 2. By date field (February 2026)
        // 3. By description/reference containing lease start info
        const leaseStartEntries = await TransactionEntry.find({
            $or: [
                // Check metadata for lease_start type with February month
                {
                    'metadata.type': 'lease_start',
                    $or: [
                        {
                            'metadata.accrualMonth': targetMonth,
                            'metadata.accrualYear': targetYear
                        },
                        {
                            date: {
                                $gte: new Date(targetYear, targetMonth - 1, 1), // February 1, 2026
                                $lt: new Date(targetYear, targetMonth, 1)         // March 1, 2026 (exclusive)
                            }
                        }
                    ]
                },
                // Check by date field for February
                {
                    date: {
                        $gte: new Date(targetYear, targetMonth - 1, 1), // February 1, 2026
                        $lt: new Date(targetYear, targetMonth, 1)         // March 1, 2026 (exclusive)
                    },
                    $or: [
                        { description: { $regex: /lease start/i } },
                        { reference: { $regex: /LEASE_START/i } },
                        { 'metadata.type': 'lease_start' }
                    ]
                }
            ],
            status: { $ne: 'deleted' }
        });

        console.log(`\n📊 Found ${leaseStartEntries.length} lease start transaction entries for February ${targetYear}`);

        if (leaseStartEntries.length === 0) {
            console.log('✅ No lease starts found for February. Nothing to remove.');
            await mongoose.disconnect();
            return;
        }

        // Display details of what will be deleted
        console.log(`\n📋 Lease starts to be removed:`);
        const applications = {};
        leaseStartEntries.forEach((entry, index) => {
            const appCode = entry.metadata?.applicationCode || entry.reference?.replace('LEASE_START_', '') || 'Unknown';
            const studentName = entry.metadata?.studentName || entry.description?.replace('Lease start for ', '').split(' - ')[0] || 'Unknown';
            const date = entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A';
            const amount = entry.totalDebit || entry.totalCredit || 0;
            
            console.log(`   ${index + 1}. ${studentName} (${appCode}) - ${date} - $${amount.toFixed(2)}`);
            
            if (!applications[appCode]) {
                applications[appCode] = {
                    entries: [],
                    studentName: studentName
                };
            }
            applications[appCode].entries.push(entry);
        });

        console.log(`\n📊 Summary:`);
        console.log(`   Total transaction entries: ${leaseStartEntries.length}`);
        console.log(`   Applications affected: ${Object.keys(applications).length}`);

        // Get unique transaction IDs
        const transactionIds = leaseStartEntries.map(entry => entry.transactionId);
        const uniqueTransactionIds = [...new Set(transactionIds)].filter(id => id);

        // Find related Transaction documents
        const transactions = await Transaction.find({
            transactionId: { $in: uniqueTransactionIds }
        });

        console.log(`   Related transactions: ${transactions.length}`);

        // Find related invoices
        const applicationCodes = Object.keys(applications);
        const invoices = await Invoice.find({
            $or: [
                {
                    billingPeriod: { $regex: new RegExp(`LEASE_START_(${applicationCodes.join('|')})`) }
                },
                {
                    student: { $in: leaseStartEntries.map(e => e.metadata?.studentId || e.sourceId).filter(id => id) }
                }
            ],
            status: { $ne: 'cancelled' }
        });

        console.log(`   Related invoices: ${invoices.length}`);

        // Confirm deletion
        const shouldDelete = process.argv.includes('--confirm') || process.argv.includes('-y');
        
        if (!shouldDelete) {
            console.log(`\n⚠️  DRY RUN MODE - No deletions performed`);
            console.log(`\n💡 To actually delete, run: node scripts/removeFebruaryLeaseStarts.js --confirm`);
            await mongoose.disconnect();
            return;
        }

        console.log(`\n🗑️  Starting deletion process...`);

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
                console.log('\n⚠️  No transactions found to delete');
            }

            // Cancel invoices (set status to cancelled instead of deleting)
            if (invoices.length > 0) {
                console.log('\n🗑️  Cancelling invoices...');
                const cancelledInvoices = await Invoice.updateMany(
                    { _id: { $in: invoices.map(i => i._id) } },
                    { 
                        $set: { 
                            status: 'cancelled',
                            cancellationDate: new Date(),
                            cancellationReason: 'Premature lease start for February - removed'
                        } 
                    }
                );
                console.log(`   ✅ Cancelled ${cancelledInvoices.modifiedCount} invoices`);
            } else {
                console.log('\n⚠️  No invoices found to cancel');
            }

            console.log('\n✅ Deletion complete!');
            
            // Final summary
            console.log(`\n📊 Final Summary:`);
            console.log(`   ✅ Transaction Entries deleted: ${deletedEntries.deletedCount}`);
            console.log(`   ✅ Transactions deleted: ${transactions.length > 0 ? transactions.length : 0}`);
            console.log(`   ✅ Invoices cancelled: ${invoices.length > 0 ? invoices.length : 0}`);
            console.log(`   ✅ Applications affected: ${Object.keys(applications).length}`);

        } catch (error) {
            console.error('❌ Error during deletion:', error);
            throw error;
        }

        await mongoose.disconnect();
        console.log('\n✅ Script completed successfully');

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    removeFebruaryLeaseStarts();
}

module.exports = { removeFebruaryLeaseStarts };
