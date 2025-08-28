require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI);

async function debugTransactions() {
    try {
        await mongoose.connection.asPromise();
        const db = mongoose.connection.db;
        
        console.log('🔍 DEBUGGING TRANSACTION STRUCTURE\n');
        
        const transactions = await db.collection('transactions').find({}).toArray();
        console.log(`📊 Total Transactions: ${transactions.length}\n`);
        
        if (transactions.length === 0) {
            console.log('No transactions found');
            return;
        }
        
        // Look at first few transactions
        console.log('📋 FIRST 3 TRANSACTIONS:');
        transactions.slice(0, 3).forEach((tx, index) => {
            console.log(`\nTransaction ${index + 1}:`);
            console.log(`  ID: ${tx.transactionId}`);
            console.log(`  Date: ${tx.date}`);
            console.log(`  Amount: $${tx.metadata?.amount || 'unknown'}`);
            console.log(`  Type: ${tx.metadata?.type || 'NO TYPE'}`);
            console.log(`  Residence: ${tx.residence || 'NO RESIDENCE'}`);
            console.log(`  Entries: ${tx.entries?.length || 0}`);
            
            if (tx.metadata) {
                console.log(`  Full Metadata:`, JSON.stringify(tx.metadata, null, 2));
            }
            
            if (tx.entries && tx.entries.length > 0) {
                console.log(`  Entry Details:`);
                tx.entries.forEach((entry, eIndex) => {
                    console.log(`    Entry ${eIndex + 1}: ${entry.accountCode} - ${entry.accountName} - Dr: $${entry.debit} Cr: $${entry.credit}`);
                });
            }
        });
        
        // Check what types exist
        console.log('\n🔍 CHECKING METADATA TYPES:');
        const types = new Set();
        transactions.forEach(tx => {
            if (tx.metadata && tx.metadata.type) {
                types.add(tx.metadata.type);
            }
        });
        
        console.log(`Found types: ${Array.from(types).join(', ')}`);
        
        // Check for transactions without metadata.type
        const noType = transactions.filter(tx => !tx.metadata || !tx.metadata.type);
        console.log(`\nTransactions without metadata.type: ${noType.length}`);
        
        if (noType.length > 0) {
            console.log('Sample transaction without type:');
            const sample = noType[0];
            console.log(`  ID: ${sample.transactionId}`);
            console.log(`  Date: ${sample.date}`);
            console.log(`  Has metadata: ${!!sample.metadata}`);
            if (sample.metadata) {
                console.log(`  Metadata keys: ${Object.keys(sample.metadata).join(', ')}`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

debugTransactions();











