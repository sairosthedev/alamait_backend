const mongoose = require('mongoose');

// Connect to MongoDB Atlas cluster
mongoose.connect('mongodb+srv://cluster0.ulvve.mongodb.net/test', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function checkTransactionEntriesStructure() {
    try {
        console.log('🔍 Examining TransactionEntries Collection Structure...\n');
        
        const db = mongoose.connection.db;
        
        // Get transactionentries collection
        const transactionEntries = await db.collection('transactionentries').find({}).limit(5).toArray();
        console.log(`📊 Found ${transactionEntries.length} transaction entries`);
        
        if (transactionEntries.length > 0) {
            console.log('\n📋 Sample Transaction Entry Structure:');
            transactionEntries.forEach((entry, i) => {
                console.log(`\n  Entry ${i + 1}:`);
                console.log(`    _id: ${entry._id}`);
                console.log(`    transactionId: ${entry.transactionId}`);
                console.log(`    date: ${entry.date}`);
                console.log(`    description: ${entry.description}`);
                console.log(`    source: ${entry.source}`);
                console.log(`    status: ${entry.status}`);
                console.log(`    totalDebit: ${entry.totalDebit}`);
                console.log(`    totalCredit: ${entry.totalCredit}`);
                
                if (entry.entries && Array.isArray(entry.entries)) {
                    console.log(`    entries array (${entry.entries.length} items):`);
                    entry.entries.forEach((lineItem, j) => {
                        console.log(`      Line ${j + 1}:`);
                        console.log(`        accountCode: ${lineItem.accountCode}`);
                        console.log(`        accountName: ${lineItem.accountName}`);
                        console.log(`        accountType: ${lineItem.accountType}`);
                        console.log(`        debit: ${lineItem.debit}`);
                        console.log(`        credit: ${lineItem.credit}`);
                        console.log(`        description: ${lineItem.description}`);
                    });
                }
                
                console.log('    ---');
            });
            
            // Check unique source values
            const sources = [...new Set(transactionEntries.map(e => e.source))];
            console.log(`\n🎯 Unique source values: ${sources.join(', ')}`);
            
            // Check unique account types
            const accountTypes = new Set();
            transactionEntries.forEach(entry => {
                if (entry.entries && Array.isArray(entry.entries)) {
                    entry.entries.forEach(lineItem => {
                        if (lineItem.accountType) {
                            accountTypes.add(lineItem.accountType);
                        }
                    });
                }
            });
            console.log(`\n💰 Unique account types: ${Array.from(accountTypes).join(', ')}`);
            
            // Check date ranges
            const dates = transactionEntries.map(e => new Date(e.date)).sort();
            if (dates.length > 0) {
                console.log(`\n📅 Date range: ${dates[0].toISOString().split('T')[0]} to ${dates[dates.length - 1].toISOString().split('T')[0]}`);
            }
            
            // Check 2025 entries specifically
            const entries2025 = transactionEntries.filter(e => {
                const entryDate = new Date(e.date);
                return entryDate.getFullYear() === 2025;
            });
            console.log(`\n📅 Entries in 2025: ${entries2025.length}`);
            
        }
        
    } catch (error) {
        console.error('❌ Error examining transaction entries:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Wait for connection then run
mongoose.connection.once('open', () => {
    checkTransactionEntriesStructure();
});
