const { MongoClient } = require('mongodb');

async function updateTransactionsWithResidence() {
    console.log('🔄 Updating Transactions and Entries with Residence Information');
    console.log('=============================================================');
    
    // Connect to your MongoDB Atlas cluster
    const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';
    const DB_NAME = 'test';
    
    let client;
    
    try {
        console.log('🔌 Connecting to MongoDB Atlas...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        console.log('✅ Connected to MongoDB Atlas successfully!');
        console.log(`📊 Database: ${DB_NAME}`);
        
        const db = client.db(DB_NAME);
        
        // Collections
        const transactionsCollection = db.collection('transactions');
        const transactionEntriesCollection = db.collection('transactionentries');
        const expensesCollection = db.collection('expenses');
        
        console.log('\n🔍 Step 1: Analyzing current state...');
        
        // Count transactions without residence
        const transactionsWithoutResidence = await transactionsCollection.countDocuments({
            $or: [
                { residence: { $exists: false } },
                { residence: null },
                { residence: "" }
            ]
        });
        
        // Count transaction entries without residence
        const entriesWithoutResidence = await transactionEntriesCollection.countDocuments({
            $or: [
                { residence: { $exists: false } },
                { residence: null },
                { residence: "" }
            ]
        });
        
        console.log(`📊 Current Status:`);
        console.log(`   Transactions without residence: ${transactionsWithoutResidence}`);
        console.log(`   Transaction entries without residence: ${entriesWithoutResidence}`);
        
        if (transactionsWithoutResidence === 0 && entriesWithoutResidence === 0) {
            console.log('\n🎉 All transactions and entries already have residence information!');
            return;
        }
        
        console.log('\n🔍 Step 2: Finding expenses to get residence information...');
        
        // Get all expenses with residence information
        const expenses = await expensesCollection.find({
            residence: { $exists: true, $ne: null, $ne: "" }
        }).toArray();
        
        console.log(`✅ Found ${expenses.length} expenses with residence information`);
        
        // Create a map of expense ID to residence info for quick lookup
        const expenseResidenceMap = new Map();
        expenses.forEach(expense => {
            expenseResidenceMap.set(expense._id.toString(), {
                residenceId: expense.residence._id || expense.residence,
                residenceName: expense.residence?.name || 'Unknown'
            });
        });
        
        console.log('\n🔍 Step 3: Updating transactions without residence...');
        
        // Find transactions without residence that have expenseId
        const transactionsToUpdate = await transactionsCollection.find({
            $and: [
                {
                    $or: [
                        { residence: { $exists: false } },
                        { residence: null },
                        { residence: "" }
                    ]
                },
                { expenseId: { $exists: true, $ne: null } }
            ]
        }).toArray();
        
        console.log(`📝 Found ${transactionsToUpdate.length} transactions to update with expenseId`);
        
        let updatedTransactions = 0;
        for (const transaction of transactionsToUpdate) {
            const expenseId = transaction.expenseId?.toString();
            if (expenseId && expenseResidenceMap.has(expenseId)) {
                const residenceInfo = expenseResidenceMap.get(expenseId);
                
                const result = await transactionsCollection.updateOne(
                    { _id: transaction._id },
                    {
                        $set: {
                            residence: residenceInfo.residenceId,
                            residenceName: residenceInfo.residenceName
                        }
                    }
                );
                
                if (result.modifiedCount > 0) {
                    updatedTransactions++;
                    console.log(`   ✅ Updated transaction ${transaction._id}: ${residenceInfo.residenceName}`);
                }
            }
        }
        
        console.log(`\n📊 Transactions updated: ${updatedTransactions}`);
        
        console.log('\n🔍 Step 4: Updating transaction entries without residence...');
        
        // Find transaction entries without residence
        const entriesToUpdate = await transactionEntriesCollection.find({
            $or: [
                { residence: { $exists: false } },
                { residence: null },
                { residence: "" }
            ]
        }).toArray();
        
        console.log(`📝 Found ${entriesToUpdate.length} transaction entries to update`);
        
        let updatedEntries = 0;
        let updatedFromTransaction = 0;
        let updatedFromExpense = 0;
        let updatedFromMetadata = 0;
        
        for (const entry of entriesToUpdate) {
            let residenceInfo = null;
            let updateSource = '';
            
            // Method 1: Try to get residence from the transaction
            if (entry.transaction) {
                const transaction = await transactionsCollection.findOne({ _id: entry.transaction });
                if (transaction && transaction.residence) {
                    residenceInfo = {
                        residenceId: transaction.residence,
                        residenceName: transaction.residenceName || 'Unknown'
                    };
                    updateSource = 'transaction';
                }
            }
            
            // Method 2: Try to get residence from expense (if entry has expense reference)
            if (!residenceInfo && entry.reference) {
                // Check if reference looks like an expense ID
                if (entry.reference.includes('EXP') || entry.reference.length === 24) {
                    const expense = await expensesCollection.findOne({ expenseId: entry.reference });
                    if (expense && expense.residence) {
                        residenceInfo = {
                            residenceId: expense.residence._id || expense.residence,
                            residenceName: expense.residence?.name || 'Unknown'
                        };
                        updateSource = 'expense';
                    }
                }
            }
            
            // Method 3: Try to get residence from metadata
            if (!residenceInfo && entry.metadata && entry.metadata.residenceId) {
                residenceInfo = {
                    residenceId: entry.metadata.residenceId,
                    residenceName: entry.metadata.residenceName || 'Unknown'
                };
                updateSource = 'metadata';
            }
            
            // Method 4: Try to get residence from expense using transaction ID
            if (!residenceInfo && entry.transaction) {
                const transaction = await transactionsCollection.findOne({ _id: entry.transaction });
                if (transaction && transaction.expenseId) {
                    const expense = await expensesCollection.findOne({ _id: transaction.expenseId });
                    if (expense && expense.residence) {
                        residenceInfo = {
                            residenceId: expense.residence._id || expense.residence,
                            residenceName: expense.residence?.name || 'Unknown'
                        };
                        updateSource = 'expense_via_transaction';
                    }
                }
            }
            
            // Update the entry if we found residence information
            if (residenceInfo) {
                const updateData = {
                    residence: residenceInfo.residenceId
                };
                
                // Also update metadata if it doesn't exist or is incomplete
                if (!entry.metadata || !entry.metadata.residenceId) {
                    updateData.metadata = {
                        ...entry.metadata,
                        residenceId: residenceInfo.residenceId,
                        residenceName: residenceInfo.residenceName,
                        updatedAt: new Date()
                    };
                }
                
                const result = await transactionEntriesCollection.updateOne(
                    { _id: entry._id },
                    { $set: updateData }
                );
                
                if (result.modifiedCount > 0) {
                    updatedEntries++;
                    switch (updateSource) {
                        case 'transaction':
                            updatedFromTransaction++;
                            break;
                        case 'expense':
                        case 'expense_via_transaction':
                            updatedFromExpense++;
                            break;
                        case 'metadata':
                            updatedFromMetadata++;
                            break;
                    }
                    console.log(`   ✅ Updated entry ${entry._id}: ${residenceInfo.residenceName} (from ${updateSource})`);
                }
            } else {
                console.log(`   ⚠️  Could not find residence for entry ${entry._id}`);
            }
        }
        
        console.log(`\n📊 Transaction entries updated: ${updatedEntries}`);
        console.log(`   From transaction: ${updatedFromTransaction}`);
        console.log(`   From expense: ${updatedFromExpense}`);
        console.log(`   From metadata: ${updatedFromMetadata}`);
        
        console.log('\n🔍 Step 5: Final verification...');
        
        // Check final counts
        const finalTransactionsWithoutResidence = await transactionsCollection.countDocuments({
            $or: [
                { residence: { $exists: false } },
                { residence: null },
                { residence: "" }
            ]
        });
        
        const finalEntriesWithoutResidence = await transactionEntriesCollection.countDocuments({
            $or: [
                { residence: { $exists: false } },
                { residence: null },
                { residence: "" }
            ]
        });
        
        console.log(`\n📋 FINAL STATUS:`);
        console.log(`===============`);
        console.log(`Transactions without residence: ${finalTransactionsWithoutResidence} (was ${transactionsWithoutResidence})`);
        console.log(`Transaction entries without residence: ${finalEntriesWithoutResidence} (was ${entriesWithoutResidence})`);
        
        if (finalTransactionsWithoutResidence === 0 && finalEntriesWithoutResidence === 0) {
            console.log('\n🎉 SUCCESS: All transactions and entries now have residence information!');
        } else {
            console.log('\n⚠️  Some transactions/entries still need manual attention');
            console.log('   Consider checking the remaining ones manually');
        }
        
        // Show residence distribution
        console.log('\n📊 Updated Residence Distribution:');
        const residenceDistribution = await transactionsCollection.aggregate([
            { $match: { residence: { $exists: true, $ne: null, $ne: "" } } },
            { $group: { 
                _id: '$residence', 
                count: { $sum: 1 },
                residenceName: { $first: '$residenceName' }
            }},
            { $sort: { count: -1 } }
        ]).toArray();
        
        residenceDistribution.forEach((res, index) => {
            console.log(`   ${index + 1}. Residence ID: ${res._id}`);
            console.log(`      Name: ${res.residenceName || 'Unknown'}`);
            console.log(`      Transaction Count: ${res.count}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        if (client) {
            await client.close();
            console.log('\n🔌 MongoDB Atlas connection closed.');
        }
    }
}

// Run the update
updateTransactionsWithResidence()
    .then(() => {
        console.log('\n✅ Update script completed successfully!');
    })
    .catch((error) => {
        console.error('\n❌ Update script failed:', error);
    });
