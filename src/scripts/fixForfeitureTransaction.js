const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function fixForfeitureTransaction() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        console.log('🔍 Finding and fixing the unbalanced forfeiture transaction...');
        
        // Find the problematic forfeiture transaction
        const forfeitureTransaction = await TransactionEntry.findOne({
            transactionId: 'FORFEIT-1758015993859'
        });

        if (forfeitureTransaction) {
            console.log('✅ Found the problematic forfeiture transaction:');
            console.log(`Transaction ID: ${forfeitureTransaction.transactionId}`);
            console.log(`Date: ${forfeitureTransaction.date}`);
            console.log(`Description: ${forfeitureTransaction.description}`);
            
            console.log('\nCurrent entries:');
            let totalDebits = 0;
            let totalCredits = 0;
            
            forfeitureTransaction.entries.forEach((entry, index) => {
                console.log(`${index + 1}. ${entry.accountCode} - ${entry.accountName}`);
                console.log(`   Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
                console.log(`   Description: ${entry.description}`);
                
                totalDebits += entry.debit || 0;
                totalCredits += entry.credit || 0;
            });
            
            console.log(`\nTotals: Debits = $${totalDebits}, Credits = $${totalCredits}`);
            console.log(`Difference: $${Math.abs(totalDebits - totalCredits)}`);
            
            if (Math.abs(totalDebits - totalCredits) > 0.01) {
                console.log('\n🔧 This transaction is unbalanced. Let me analyze what should be the correct entries...');
                
                // The transaction is for Tafirei unknown forfeiture
                // Looking at the entries, we need to understand what was intended
                console.log('\n📋 Analyzing the intended forfeiture entries...');
                
                // Show each entry in detail
                forfeitureTransaction.entries.forEach((entry, index) => {
                    console.log(`\nEntry ${index + 1}:`);
                    console.log(`  Account: ${entry.accountCode} - ${entry.accountName}`);
                    console.log(`  Type: ${entry.accountType}`);
                    console.log(`  Debit: $${entry.debit || 0}`);
                    console.log(`  Credit: $${entry.credit || 0}`);
                    console.log(`  Description: ${entry.description}`);
                });
                
                // For a proper forfeiture, we typically expect:
                // 1. Debit: Forfeited Income (increase income)
                // 2. Credit: Accounts Receivable (reduce AR)
                // OR
                // 1. Debit: Cash (if payment was made)
                // 2. Credit: Accounts Receivable (reduce AR)
                
                console.log('\n💡 Expected forfeiture transaction structure:');
                console.log('   - Debit: Forfeited Deposits Income (4003) to recognize forfeited amount');
                console.log('   - Credit: Accounts Receivable (1100-xxx) to clear the student debt');
                console.log('   - Both amounts should be equal to balance the transaction');
                
                // Let's see if we can identify the issue and suggest a fix
                console.log('\n🔍 Checking if this needs manual correction...');
                
                // This transaction needs to be manually reviewed and corrected
                console.log('⚠️  MANUAL CORRECTION NEEDED:');
                console.log('   This forfeiture transaction is unbalanced and needs to be corrected.');
                console.log('   The transaction has $50 in debits but $110 in credits.');
                console.log('   This creates a $60 imbalance that affects the balance sheet.');
                
            } else {
                console.log('✅ Transaction is balanced');
            }
            
        } else {
            console.log('❌ Forfeiture transaction not found');
        }
        
        // Also check for any other unbalanced transactions
        console.log('\n🔍 Checking for other unbalanced transactions...');
        
        const allTransactions = await TransactionEntry.find({
            status: 'posted'
        });
        
        const unbalancedTransactions = [];
        
        allTransactions.forEach(transaction => {
            let totalDebits = 0;
            let totalCredits = 0;
            
            if (transaction.entries && Array.isArray(transaction.entries)) {
                transaction.entries.forEach(entry => {
                    totalDebits += entry.debit || 0;
                    totalCredits += entry.credit || 0;
                });
            }
            
            const difference = Math.abs(totalDebits - totalCredits);
            if (difference > 0.01) {
                unbalancedTransactions.push({
                    id: transaction.transactionId,
                    date: transaction.date,
                    description: transaction.description,
                    totalDebits,
                    totalCredits,
                    difference
                });
            }
        });
        
        console.log(`\nFound ${unbalancedTransactions.length} unbalanced transactions:`);
        let totalImbalance = 0;
        
        unbalancedTransactions.forEach((txn, index) => {
            console.log(`${index + 1}. ${txn.id} - ${txn.date.toISOString().split('T')[0]}`);
            console.log(`   Description: ${txn.description}`);
            console.log(`   Debits: $${txn.totalDebits}, Credits: $${txn.totalCredits}`);
            console.log(`   Difference: $${txn.difference}`);
            
            totalImbalance += (txn.totalCredits - txn.totalDebits); // Net effect
        });
        
        console.log(`\n📊 Total imbalance from all unbalanced transactions: $${totalImbalance}`);
        console.log(`This explains ${Math.abs(totalImbalance) >= 150 ? 'ALL' : 'PART'} of the $150 balance sheet discrepancy.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

fixForfeitureTransaction();










