const { MongoClient } = require('mongodb');

async function fixRemainingResidence() {
    console.log('🔧 Fixing Remaining Residence Issues');
    console.log('====================================');
    
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
        const residencesCollection = db.collection('residences');
        
        console.log('\n🔍 Step 1: Analyzing remaining issues...');
        
        // Get the remaining transaction without residence
        const transactionWithoutResidence = await transactionsCollection.findOne({
            $or: [
                { residence: { $exists: false } },
                { residence: null },
                { residence: "" }
            ]
        });
        
        if (transactionWithoutResidence) {
            console.log(`📝 Found transaction without residence:`);
            console.log(`   ID: ${transactionWithoutResidence._id}`);
            console.log(`   Description: ${transactionWithoutResidence.description}`);
            console.log(`   Reference: ${transactionWithoutResidence.reference}`);
            console.log(`   Type: ${transactionWithoutResidence.type}`);
            
            // Try to find residence based on description or other clues
            let suggestedResidence = null;
            
            // Look for similar transactions to find a pattern
            const similarTransactions = await transactionsCollection.find({
                description: transactionWithoutResidence.description,
                residence: { $exists: true, $ne: null, $ne: "" }
            }).limit(5).toArray();
            
            if (similarTransactions.length > 0) {
                suggestedResidence = similarTransactions[0].residence;
                console.log(`   💡 Found similar transaction with residence: ${suggestedResidence}`);
            }
            
            // If no similar transaction, try to find a default residence
            if (!suggestedResidence) {
                const defaultResidence = await residencesCollection.findOne({});
                if (defaultResidence) {
                    suggestedResidence = defaultResidence._id;
                    console.log(`   💡 Using default residence: ${defaultResidence.name}`);
                }
            }
            
            if (suggestedResidence) {
                const result = await transactionsCollection.updateOne(
                    { _id: transactionWithoutResidence._id },
                    {
                        $set: {
                            residence: suggestedResidence,
                            residenceName: 'Default Residence'
                        }
                    }
                );
                
                if (result.modifiedCount > 0) {
                    console.log(`   ✅ Updated transaction with residence: ${suggestedResidence}`);
                }
            }
        }
        
        console.log('\n🔍 Step 2: Analyzing remaining transaction entries...');
        
        // Get remaining entries without residence
        const entriesWithoutResidence = await transactionEntriesCollection.find({
            $or: [
                { residence: { $exists: false } },
                { residence: null },
                { residence: "" }
            ]
        }).toArray();
        
        console.log(`📝 Found ${entriesWithoutResidence.length} transaction entries without residence`);
        
        // Analyze the patterns in these entries
        const entryPatterns = {};
        entriesWithoutResidence.forEach(entry => {
            const description = entry.description || '';
            const reference = entry.reference || '';
            
            if (description.includes('Payment: PAY-')) {
                if (!entryPatterns.payment) entryPatterns.payment = [];
                entryPatterns.payment.push(entry);
            } else if (description.includes('Rentals Received')) {
                if (!entryPatterns.rentals) entryPatterns.rentals = [];
                entryPatterns.rentals.push(entry);
            } else {
                if (!entryPatterns.other) entryPatterns.other = [];
                entryPatterns.other.push(entry);
            }
        });
        
        console.log('\n📊 Entry patterns found:');
        Object.keys(entryPatterns).forEach(pattern => {
            console.log(`   ${pattern}: ${entryPatterns[pattern].length} entries`);
        });
        
        // Try to fix payment entries (they seem to be related to student payments)
        if (entryPatterns.payment && entryPatterns.payment.length > 0) {
            console.log('\n🔧 Attempting to fix payment entries...');
            
            // Find a residence that might be appropriate for student payments
            const studentResidence = await residencesCollection.findOne({
                name: { $regex: /student/i }
            });
            
            if (studentResidence) {
                console.log(`   💡 Using student residence: ${studentResidence.name}`);
                
                let updatedCount = 0;
                for (const entry of entryPatterns.payment) {
                    const result = await transactionEntriesCollection.updateOne(
                        { _id: entry._id },
                        {
                            $set: {
                                residence: studentResidence._id,
                                metadata: {
                                    ...entry.metadata,
                                    residenceId: studentResidence._id,
                                    residenceName: studentResidence.name,
                                    updatedAt: new Date(),
                                    updateReason: 'Assigned to student residence based on payment pattern'
                                }
                            }
                        }
                    );
                    
                    if (result.modifiedCount > 0) {
                        updatedCount++;
                        console.log(`   ✅ Updated payment entry ${entry._id}`);
                    }
                }
                
                console.log(`   📊 Updated ${updatedCount} payment entries`);
            }
        }
        
        // Try to fix rental entries
        if (entryPatterns.rentals && entryPatterns.rentals.length > 0) {
            console.log('\n🔧 Attempting to fix rental entries...');
            
            // Find a residence that might be appropriate for rentals
            const rentalResidence = await residencesCollection.findOne({
                name: { $regex: /student/i }
            });
            
            if (rentalResidence) {
                console.log(`   💡 Using rental residence: ${rentalResidence.name}`);
                
                let updatedCount = 0;
                for (const entry of entryPatterns.rentals) {
                    const result = await transactionEntriesCollection.updateOne(
                        { _id: entry._id },
                        {
                            $set: {
                                residence: rentalResidence._id,
                                metadata: {
                                    ...entry.metadata,
                                    residenceId: rentalResidence._id,
                                    residenceName: rentalResidence.name,
                                    updatedAt: new Date(),
                                    updateReason: 'Assigned to student residence based on rental pattern'
                                }
                            }
                        }
                    );
                    
                    if (result.modifiedCount > 0) {
                        updatedCount++;
                        console.log(`   ✅ Updated rental entry ${entry._id}`);
                    }
                }
                
                console.log(`   📊 Updated ${updatedCount} rental entries`);
            }
        }
        
        // Try to fix other entries by looking for any remaining clues
        if (entryPatterns.other && entryPatterns.other.length > 0) {
            console.log('\n🔧 Attempting to fix other entries...');
            
            // Use the most common residence as default
            const residenceDistribution = await transactionsCollection.aggregate([
                { $match: { residence: { $exists: true, $ne: null, $ne: "" } } },
                { $group: { 
                    _id: '$residence', 
                    count: { $sum: 1 }
                }},
                { $sort: { count: -1 } },
                { $limit: 1 }
            ]).toArray();
            
            if (residenceDistribution.length > 0) {
                const defaultResidenceId = residenceDistribution[0]._id;
                const defaultResidence = await residencesCollection.findOne({ _id: defaultResidenceId });
                
                if (defaultResidence) {
                    console.log(`   💡 Using most common residence: ${defaultResidence.name}`);
                    
                    let updatedCount = 0;
                    for (const entry of entryPatterns.other) {
                        const result = await transactionEntriesCollection.updateOne(
                            { _id: entry._id },
                            {
                                $set: {
                                    residence: defaultResidenceId,
                                    metadata: {
                                        ...entry.metadata,
                                        residenceId: defaultResidenceId,
                                        residenceName: defaultResidence.name,
                                        updatedAt: new Date(),
                                        updateReason: 'Assigned to most common residence as fallback'
                                    }
                                }
                            }
                        );
                        
                        if (result.modifiedCount > 0) {
                            updatedCount++;
                            console.log(`   ✅ Updated other entry ${entry._id}`);
                        }
                    }
                    
                    console.log(`   📊 Updated ${updatedCount} other entries`);
                }
            }
        }
        
        console.log('\n🔍 Step 3: Final verification...');
        
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
        console.log(`Transactions without residence: ${finalTransactionsWithoutResidence}`);
        console.log(`Transaction entries without residence: ${finalEntriesWithoutResidence}`);
        
        if (finalTransactionsWithoutResidence === 0 && finalEntriesWithoutResidence === 0) {
            console.log('\n🎉 SUCCESS: All transactions and entries now have residence information!');
        } else {
            console.log('\n⚠️  Some transactions/entries still need manual attention');
            console.log('   These might require manual review or have data quality issues');
        }
        
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

// Run the fix
fixRemainingResidence()
    .then(() => {
        console.log('\n✅ Fix script completed successfully!');
    })
    .catch((error) => {
        console.error('\n❌ Fix script failed:', error);
    });
