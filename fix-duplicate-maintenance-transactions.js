const mongoose = require('mongoose');
require('dotenv').config();

async function fixDuplicateMaintenanceTransactions() {
    try {
        console.log('🔧 Fixing Duplicate Maintenance Transactions...\n');

        // Connect to MongoDB
        if (!process.env.MONGODB_URI) {
            console.error('❌ MONGODB_URI is not defined in environment variables');
            return;
        }

        console.log('📊 Connecting to MongoDB...');
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database Name: ${conn.connection.name}`);
        console.log('');

        // 1. Find all duplicate transactions for the specific maintenance request
        const maintenanceId = '686ee3e86af01f8b9f54ed14';
        
        const duplicateTransactions = await mongoose.connection.db.collection('transactions').find({
            reference: { $in: [`MR-${maintenanceId}`, `MAINT-${maintenanceId}`] }
        }).sort({ date: 1 }).toArray();

        console.log(`🔍 Found ${duplicateTransactions.length} duplicate transactions for maintenance ${maintenanceId}:\n`);

        for (const txn of duplicateTransactions) {
            console.log(`   - ${txn.transactionId}: ${txn.description} (${txn.date})`);
        }
        console.log('');

        // 2. Keep only the first transaction and delete the rest
        if (duplicateTransactions.length > 1) {
            const firstTransaction = duplicateTransactions[0];
            const transactionsToDelete = duplicateTransactions.slice(1);

            console.log(`🗑️  Keeping first transaction: ${firstTransaction.transactionId}`);
            console.log(`🗑️  Deleting ${transactionsToDelete.length} duplicate transactions:\n`);

            for (const txn of transactionsToDelete) {
                console.log(`   - Deleting: ${txn.transactionId}`);
                
                // Delete the transaction
                await mongoose.connection.db.collection('transactions').deleteOne({
                    _id: txn._id
                });

                // Delete associated transaction entries
                const deletedEntries = await mongoose.connection.db.collection('transactionentries').deleteMany({
                    transactionId: txn.transactionId
                });

                console.log(`     Deleted ${deletedEntries.deletedCount} associated entries`);
            }
            console.log('');
        }

        // 3. Check if the remaining transaction has proper entries
        const remainingTransaction = await mongoose.connection.db.collection('transactions').findOne({
            reference: { $in: [`MR-${maintenanceId}`, `MAINT-${maintenanceId}`] }
        });

        if (remainingTransaction) {
            console.log(`✅ Remaining transaction: ${remainingTransaction.transactionId}`);
            
            const entries = await mongoose.connection.db.collection('transactionentries').find({
                transactionId: remainingTransaction.transactionId
            }).toArray();

            console.log(`📊 Transaction has ${entries.length} entries:\n`);

            if (entries.length === 0) {
                console.log('⚠️  Transaction has no entries - this needs to be fixed!');
                
                // Get the maintenance request
                const maintenance = await mongoose.connection.db.collection('maintenance').findOne({
                    _id: new mongoose.Types.ObjectId(maintenanceId)
                });

                if (maintenance) {
                    console.log(`🔧 Maintenance Request Details:`);
                    console.log(`   Issue: ${maintenance.issue}`);
                    console.log(`   Amount: $${maintenance.amount}`);
                    console.log(`   Payment Method: ${maintenance.paymentMethod}`);
                    console.log(`   Status: ${maintenance.status}`);
                    console.log(`   Finance Status: ${maintenance.financeStatus}`);
                    console.log('');

                    // Check if there's an expense
                    const expense = await mongoose.connection.db.collection('expenses').findOne({
                        maintenanceRequestId: maintenance._id
                    });

                    if (expense) {
                        console.log(`💰 Linked Expense:`);
                        console.log(`   Expense ID: ${expense.expenseId}`);
                        console.log(`   Amount: $${expense.amount}`);
                        console.log(`   Payment Status: ${expense.paymentStatus}`);
                        console.log(`   Payment Method: ${expense.paymentMethod}`);
                        console.log('');

                        // If expense is paid and payment method is Ecocash, we should have Ecocash entries
                        if (expense.paymentStatus === 'Paid' && expense.paymentMethod === 'Ecocash') {
                            console.log('⚠️  Expense is paid via Ecocash but no Ecocash entries found!');
                            console.log('🔧 This indicates a problem in the payment transaction creation logic.');
                        }
                    }
                }
            } else {
                for (const entry of entries) {
                    console.log(`   - ${entry.accountCode} (${entry.accountName}): ${entry.debit > 0 ? 'DEBIT' : 'CREDIT'} $${entry.debit || entry.credit}`);
                    if (entry.accountCode === '1011') {
                        console.log(`     ⚠️  ECOCASH ENTRY FOUND!`);
                    }
                }
            }
        }

        // 4. Check for any Ecocash entries in the database
        const allEcocashEntries = await mongoose.connection.db.collection('transactionentries').find({
            accountCode: '1011'
        }).toArray();

        console.log(`\n🔍 Total Ecocash (1011) entries in database: ${allEcocashEntries.length}`);

        if (allEcocashEntries.length > 0) {
            console.log('📊 Recent Ecocash entries:');
            for (const entry of allEcocashEntries.slice(-5)) {
                const transaction = await mongoose.connection.db.collection('transactions').findOne({
                    transactionId: entry.transactionId
                });

                console.log(`   - ${entry.transactionId}: ${entry.debit > 0 ? 'DEBIT' : 'CREDIT'} $${entry.debit || entry.credit}`);
                if (transaction) {
                    console.log(`     Description: ${transaction.description}`);
                    console.log(`     Reference: ${transaction.reference}`);
                }
            }
        }

        console.log('\n✅ Duplicate transaction cleanup completed!');

    } catch (error) {
        console.error('❌ Error fixing duplicate transactions:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('🔌 Database connection closed');
        }
    }
}

fixDuplicateMaintenanceTransactions(); 