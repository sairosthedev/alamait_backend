const mongoose = require('mongoose');
require('dotenv').config();

async function debugMaintenanceTransactions() {
    try {
        console.log('🔍 Debugging "Toilet is blocked" Maintenance Request...\n');

        // Use the same connection as your app
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

        // 1. Find the specific "Toilet is blocked" maintenance request
        const toiletMaintenance = await mongoose.connection.db.collection('maintenance').find({
            issue: { $regex: /toilet.*blocked/i }
        }).toArray();

        console.log(`🔧 Found ${toiletMaintenance.length} "Toilet is blocked" maintenance requests:\n`);

        for (const maint of toiletMaintenance) {
            console.log(`Maintenance ID: ${maint._id}`);
            console.log(`Issue: ${maint.issue}`);
            console.log(`Description: ${maint.description}`);
            console.log(`Amount: $${maint.amount}`);
            console.log(`Status: ${maint.status}`);
            console.log(`Finance Status: ${maint.financeStatus}`);
            console.log(`Payment Method: ${maint.paymentMethod || 'Not specified'}`);
            console.log(`Created: ${maint.createdAt}`);
            console.log(`Completed: ${maint.completedDate || 'Not completed'}`);
            console.log('');

            // 2. Check if there's an expense created for this maintenance
            const expense = await mongoose.connection.db.collection('expenses').findOne({
                maintenanceRequestId: maint._id
            });

            if (expense) {
                console.log(`💰 Linked Expense Found:`);
                console.log(`   Expense ID: ${expense.expenseId}`);
                console.log(`   Amount: $${expense.amount}`);
                console.log(`   Payment Status: ${expense.paymentStatus}`);
                console.log(`   Payment Method: ${expense.paymentMethod}`);
                console.log(`   Created: ${expense.createdAt}`);
                console.log('');
            }

            // 3. Find all transactions related to this maintenance
            const transactions = await mongoose.connection.db.collection('transactions').find({
                $or: [
                    { reference: `MAINT-${maint._id}` },
                    { reference: `MAINT-COMPLETE-${maint._id}` },
                    { description: { $regex: maint.issue, $options: 'i' } }
                ]
            }).toArray();

            console.log(`💳 Found ${transactions.length} related transactions:\n`);

            for (const transaction of transactions) {
                console.log(`   Transaction ID: ${transaction.transactionId}`);
                console.log(`   Type: ${transaction.type}`);
                console.log(`   Reference: ${transaction.reference}`);
                console.log(`   Description: ${transaction.description}`);
                console.log(`   Date: ${transaction.date}`);

                // 4. Get transaction entries
                const entries = await mongoose.connection.db.collection('transactionentries').find({
                    transactionId: transaction.transactionId
                }).toArray();

                console.log(`   Entries (${entries.length}):`);
                for (const entry of entries) {
                    console.log(`     - ${entry.accountCode} (${entry.accountName}): ${entry.debit > 0 ? 'DEBIT' : 'CREDIT'} $${entry.debit || entry.credit}`);
                    console.log(`       Description: ${entry.description}`);
                    
                    // Check if this is an Ecocash entry
                    if (entry.accountCode === '1011') {
                        console.log(`       ⚠️  ECOCASH ENTRY DETECTED!`);
                    }
                }
                console.log('');
            }

            console.log('─'.repeat(80));
            console.log('');
        }

        // 4. Check for any transactions with "toilet" or "blocked" in description
        console.log('🔍 Checking for toilet/blocked related transactions...\n');
        
        const toiletTransactions = await mongoose.connection.db.collection('transactions').find({
            description: { $regex: /(toilet|blocked)/i }
        }).toArray();

        console.log(`Found ${toiletTransactions.length} toilet/blocked related transactions:\n`);

        for (const transaction of toiletTransactions) {
            console.log(`Transaction ID: ${transaction.transactionId}`);
            console.log(`Type: ${transaction.type}`);
            console.log(`Reference: ${transaction.reference}`);
            console.log(`Description: ${transaction.description}`);
            console.log(`Date: ${transaction.date}`);

            const entries = await mongoose.connection.db.collection('transactionentries').find({
                transactionId: transaction.transactionId
            }).toArray();

            console.log(`Entries (${entries.length}):`);
            for (const entry of entries) {
                console.log(`  - ${entry.accountCode} (${entry.accountName}): ${entry.debit > 0 ? 'DEBIT' : 'CREDIT'} $${entry.debit || entry.credit}`);
                if (entry.accountCode === '1011') {
                    console.log(`    ⚠️  ECOCASH ENTRY!`);
                }
            }
            console.log('');
        }

        // 5. Check for any Ecocash entries in the last 30 days
        console.log('🔍 Checking for recent Ecocash entries...\n');
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentEcocashEntries = await mongoose.connection.db.collection('transactionentries').find({
            accountCode: '1011',
            createdAt: { $gte: thirtyDaysAgo }
        }).toArray();

        console.log(`Found ${recentEcocashEntries.length} Ecocash entries in the last 30 days:\n`);

        for (const entry of recentEcocashEntries) {
            const transaction = await mongoose.connection.db.collection('transactions').findOne({
                transactionId: entry.transactionId
            });

            console.log(`Entry: ${entry._id}`);
            console.log(`Transaction: ${entry.transactionId}`);
            console.log(`Amount: ${entry.debit > 0 ? 'DEBIT' : 'CREDIT'} $${entry.debit || entry.credit}`);
            console.log(`Description: ${entry.description}`);
            console.log(`Created: ${entry.createdAt}`);
            if (transaction) {
                console.log(`Transaction Description: ${transaction.description}`);
                console.log(`Transaction Reference: ${transaction.reference}`);
                console.log(`Transaction Type: ${transaction.type}`);
            }
            console.log('');
        }

    } catch (error) {
        console.error('❌ Error debugging database:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('🔌 Database connection closed');
        }
    }
}

debugMaintenanceTransactions(); 