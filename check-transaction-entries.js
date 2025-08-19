require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI);

async function checkTransactionEntries() {
    try {
        await mongoose.connection.asPromise();
        const db = mongoose.connection.db;
        
        console.log('🔍 CHECKING TRANSACTION ENTRIES COLLECTION\n');
        
        const transactionEntries = await db.collection('transactionentries').find({}).toArray();
        console.log(`📊 Total Transaction Entries: ${transactionEntries.length}\n`);
        
        if (transactionEntries.length === 0) {
            console.log('No transaction entries found');
            return;
        }
        
        // Look at first few entries
        console.log('📋 FIRST 3 TRANSACTION ENTRIES:');
        transactionEntries.slice(0, 3).forEach((entry, index) => {
            console.log(`\nEntry ${index + 1}:`);
            console.log(`  ID: ${entry._id}`);
            console.log(`  Transaction ID: ${entry.transactionId}`);
            console.log(`  Date: ${entry.date}`);
            console.log(`  Description: ${entry.description}`);
            console.log(`  Account: ${entry.account}`);
            console.log(`  Type: ${entry.type}`);
            console.log(`  Amount: $${entry.amount}`);
            console.log(`  Residence: ${entry.residence || 'NO RESIDENCE'}`);
            console.log(`  Reference: ${entry.reference}`);
            
            if (entry.metadata) {
                console.log(`  Metadata:`, JSON.stringify(entry.metadata, null, 2));
            }
        });
        
        // Check what types exist
        console.log('\n🔍 CHECKING ENTRY TYPES:');
        const types = new Set();
        transactionEntries.forEach(entry => {
            if (entry.metadata && entry.metadata.type) {
                types.add(entry.metadata.type);
            }
        });
        
        console.log(`Found types: ${Array.from(types).join(', ')}`);
        
        // Check for entries without metadata.type
        const noType = transactionEntries.filter(entry => !entry.metadata || !entry.metadata.type);
        console.log(`\nEntries without metadata.type: ${noType.length}`);
        
        // Check residence coverage
        const withResidence = transactionEntries.filter(entry => entry.residence);
        const withoutResidence = transactionEntries.filter(entry => !entry.residence);
        
        console.log(`\n🏠 RESIDENCE COVERAGE:`);
        console.log(`  Entries WITH Residence: ${withResidence.length}`);
        console.log(`  Entries WITHOUT Residence: ${withoutResidence.length}`);
        
        if (withoutResidence.length > 0) {
            console.log('\n  ⚠️  Sample entries without residence:');
            withoutResidence.slice(0, 3).forEach(entry => {
                console.log(`    ${entry.account} - ${entry.metadata?.type || 'unknown'} - $${entry.amount}`);
            });
        }
        
        // Check double-entry compliance
        console.log('\n🔍 DOUBLE-ENTRY COMPLIANCE:');
        const byTransaction = {};
        
        transactionEntries.forEach(entry => {
            if (!byTransaction[entry.transactionId]) {
                byTransaction[entry.transactionId] = [];
            }
            byTransaction[entry.transactionId].push(entry);
        });
        
        let balancedTransactions = 0;
        let unbalancedTransactions = 0;
        
        Object.entries(byTransaction).forEach(([txId, entries]) => {
            const totalDebits = entries.filter(e => e.type === 'debit').reduce((sum, e) => sum + (e.amount || 0), 0);
            const totalCredits = entries.filter(e => e.type === 'credit').reduce((sum, e) => sum + (e.amount || 0), 0);
            
            if (Math.abs(totalDebits - totalCredits) < 0.01) {
                balancedTransactions++;
            } else {
                unbalancedTransactions++;
                console.log(`  ❌ Unbalanced Transaction ${txId}: Debits: $${totalDebits}, Credits: $${totalCredits}`);
            }
        });
        
        console.log(`  ✅ Balanced Transactions: ${balancedTransactions}`);
        console.log(`  ❌ Unbalanced Transactions: ${unbalancedTransactions}`);
        
        // Check account codes used
        console.log('\n💰 ACCOUNT CODES USED:');
        const accountCodes = new Set();
        transactionEntries.forEach(entry => {
            if (entry.account) accountCodes.add(entry.account);
        });
        
        console.log(`  Total Unique Account Codes: ${accountCodes.size}`);
        console.log(`  Account Codes: ${Array.from(accountCodes).sort().join(', ')}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

checkTransactionEntries();




