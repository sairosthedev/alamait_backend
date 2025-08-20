require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI);

async function analyzeAllTransactions() {
    try {
        await mongoose.connection.asPromise();
        const db = mongoose.connection.db;
        
        console.log('🔍 COMPREHENSIVE TRANSACTION ANALYSIS\n');
        
        // Get all data
        const transactionEntries = await db.collection('transactionentries').find({}).toArray();
        const transactions = await db.collection('transactions').find({}).toArray();
        const payments = await db.collection('payments').find({}).toArray();
        const debtors = await db.collection('debtors').find({}).toArray();
        
        console.log(`📊 DATABASE OVERVIEW:`);
        console.log(`   Transaction Entries: ${transactionEntries.length}`);
        console.log(`   Transactions: ${transactions.length}`);
        console.log(`   Payments: ${payments.length}`);
        console.log(`   Debtors: ${debtors.length}\n`);
        
        // 1. CHECK STUDENT PAYMENTS (Admin adding payment)
        console.log('👨‍🎓 STUDENT PAYMENT SCENARIOS:');
        const studentPayments = transactions.filter(t => 
            t.metadata?.type === 'rent_payment' || 
            t.metadata?.type === 'admin_fee_payment' ||
            t.metadata?.type === 'deposit_payment'
        );
        
        console.log(`   Total Student Payment Transactions: ${studentPayments.length}`);
        
        if (studentPayments.length > 0) {
            console.log('\n   📋 Sample Student Payment Transaction:');
            const sample = studentPayments[0];
            console.log(`     Type: ${sample.metadata?.type}`);
            console.log(`     Amount: $${sample.metadata?.amount}`);
            console.log(`     Residence: ${sample.residence}`);
            console.log(`     Date: ${sample.date}`);
            console.log(`     Status: ${sample.status}`);
            
            // Check if it has balanced entries
            if (sample.entries && sample.entries.length >= 2) {
                console.log(`     ✅ Has balanced entries: ${sample.entries.length}`);
                sample.entries.forEach((entry, index) => {
                    console.log(`       Entry ${index + 1}: ${entry.accountCode} - ${entry.accountName} - Dr: $${entry.debit} Cr: $${entry.credit}`);
                });
            } else {
                console.log(`     ❌ Missing or unbalanced entries`);
            }
        }
        
        // 2. CHECK PETTY CASH ALLOCATIONS
        console.log('\n💵 PETTY CASH ALLOCATIONS:');
        const pettyCashAllocations = transactions.filter(t => 
            t.metadata?.type === 'petty_cash_allocation'
        );
        
        console.log(`   Total Petty Cash Allocations: ${pettyCashAllocations.length}`);
        
        if (pettyCashAllocations.length > 0) {
            console.log('\n   📋 Sample Petty Cash Allocation:');
            const sample = pettyCashAllocations[0];
            console.log(`     Amount: $${sample.metadata?.amount}`);
            console.log(`     Residence: ${sample.residence}`);
            console.log(`     Date: ${sample.date}`);
            
            if (sample.entries && sample.entries.length >= 2) {
                console.log(`     ✅ Has balanced entries: ${sample.entries.length}`);
                sample.entries.forEach((entry, index) => {
                    console.log(`       Entry ${index + 1}: ${entry.accountCode} - ${entry.accountName} - Dr: $${entry.debit} Cr: $${entry.credit}`);
                });
            }
        }
        
        // 3. CHECK EXPENSES
        console.log('\n💸 EXPENSE SCENARIOS:');
        const expenses = transactions.filter(t => 
            t.metadata?.type === 'expense_creation' || 
            t.metadata?.type === 'petty_cash_expense'
        );
        
        console.log(`   Total Expense Transactions: ${expenses.length}`);
        
        if (expenses.length > 0) {
            console.log('\n   📋 Sample Expense Transaction:');
            const sample = expenses[0];
            console.log(`     Type: ${sample.metadata?.type}`);
            console.log(`     Amount: $${sample.metadata?.amount}`);
            console.log(`     Residence: ${sample.residence}`);
            console.log(`     Date: ${sample.date}`);
            
            if (sample.entries && sample.entries.length >= 2) {
                console.log(`     ✅ Has balanced entries: ${sample.entries.length}`);
                sample.entries.forEach((entry, index) => {
                    console.log(`       Entry ${index + 1}: ${entry.accountCode} - ${entry.accountName} - Dr: $${entry.debit} Cr: $${entry.credit}`);
                });
            }
        }
        
        // 4. CHECK RENT ACCRUALS
        console.log('\n🏠 RENT ACCRUAL SCENARIOS:');
        const rentAccruals = transactions.filter(t => 
            t.metadata?.type === 'rent_accrual'
        );
        
        console.log(`   Total Rent Accrual Transactions: ${rentAccruals.length}`);
        
        if (rentAccruals.length > 0) {
            console.log('\n   📋 Sample Rent Accrual:');
            const sample = rentAccruals[0];
            console.log(`     Amount: $${sample.metadata?.amount}`);
            console.log(`     Residence: ${sample.residence}`);
            console.log(`     Accrual Month: ${sample.metadata?.accrualMonth}`);
            console.log(`     Accrual Year: ${sample.metadata?.accrualYear}`);
            
            if (sample.entries && sample.entries.length >= 2) {
                console.log(`     ✅ Has balanced entries: ${sample.entries.length}`);
                sample.entries.forEach((entry, index) => {
                    console.log(`       Entry ${index + 1}: ${entry.accountCode} - ${entry.accountName} - Dr: $${entry.debit} Cr: $${entry.credit}`);
                });
            }
        }
        
        // 5. CHECK RESIDENCE COVERAGE
        console.log('\n🏠 RESIDENCE COVERAGE:');
        const transactionsWithResidence = transactions.filter(t => t.residence);
        const transactionsWithoutResidence = transactions.filter(t => !t.residence);
        
        console.log(`   Transactions WITH Residence: ${transactionsWithResidence.length}`);
        console.log(`   Transactions WITHOUT Residence: ${transactionsWithoutResidence.length}`);
        
        if (transactionsWithoutResidence.length > 0) {
            console.log('\n   ⚠️  Transactions missing residence:');
            transactionsWithoutResidence.slice(0, 3).forEach(t => {
                console.log(`     ${t.metadata?.type || 'unknown'} - $${t.metadata?.amount || 'unknown'} - ${t.date}`);
            });
        }
        
        // 6. CHECK DOUBLE-ENTRY COMPLIANCE
        console.log('\n🔍 DOUBLE-ENTRY COMPLIANCE:');
        let balancedTransactions = 0;
        let unbalancedTransactions = 0;
        let missingEntries = 0;
        
        for (const transaction of transactions) {
            if (transaction.entries && transaction.entries.length >= 2) {
                const totalDebits = transaction.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
                const totalCredits = transaction.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
                
                if (Math.abs(totalDebits - totalCredits) < 0.01) {
                    balancedTransactions++;
                } else {
                    unbalancedTransactions++;
                    console.log(`     ❌ Unbalanced: ${transaction.transactionId} - Dr: $${totalDebits}, Cr: $${totalCredits}`);
                }
            } else {
                missingEntries++;
                console.log(`     ❌ Missing entries: ${transaction.transactionId}`);
            }
        }
        
        console.log(`   ✅ Balanced Transactions: ${balancedTransactions}`);
        console.log(`   ❌ Unbalanced Transactions: ${unbalancedTransactions}`);
        console.log(`   ❌ Missing Entries: ${missingEntries}`);
        
        // 7. CHECK ACCOUNT CODES USED
        console.log('\n💰 ACCOUNT CODES USED:');
        const accountCodes = new Set();
        transactions.forEach(t => {
            if (t.entries) {
                t.entries.forEach(e => {
                    if (e.accountCode) accountCodes.add(e.accountCode);
                });
            }
        });
        
        console.log(`   Total Unique Account Codes: ${accountCodes.size}`);
        console.log(`   Account Codes: ${Array.from(accountCodes).sort().join(', ')}`);
        
        // 8. CHECK METADATA COMPLETENESS
        console.log('\n📋 METADATA COMPLETENESS:');
        const transactionsWithType = transactions.filter(t => t.metadata?.type);
        const transactionsWithoutType = transactions.filter(t => !t.metadata?.type);
        
        console.log(`   Transactions WITH Type: ${transactionsWithType.length}`);
        console.log(`   Transactions WITHOUT Type: ${transactionsWithoutType.length}`);
        
        if (transactionsWithoutType.length > 0) {
            console.log('\n   ⚠️  Transactions missing metadata.type:');
            transactionsWithoutType.slice(0, 3).forEach(t => {
                console.log(`     ${t.transactionId} - ${t.date} - $${t.metadata?.amount || 'unknown'}`);
            });
        }
        
        // 9. SUMMARY
        console.log('\n📊 SUMMARY:');
        console.log(`   Total Transactions: ${transactions.length}`);
        console.log(`   Properly Balanced: ${balancedTransactions}/${transactions.length} (${Math.round(balancedTransactions/transactions.length*100)}%)`);
        console.log(`   With Residence: ${transactionsWithResidence.length}/${transactions.length} (${Math.round(transactionsWithResidence.length/transactions.length*100)}%)`);
        console.log(`   With Metadata Type: ${transactionsWithType.length}/${transactions.length} (${Math.round(transactionsWithType.length/transactions.length*100)}%)`);
        
        if (balancedTransactions === transactions.length && 
            transactionsWithResidence.length === transactions.length && 
            transactionsWithType.length === transactions.length) {
            console.log('\n🎉 EXCELLENT! All transactions are properly configured!');
        } else {
            console.log('\n⚠️  Some issues found that need attention.');
        }
        
    } catch (error) {
        console.error('❌ Error analyzing transactions:', error);
    } finally {
        mongoose.connection.close();
    }
}

analyzeAllTransactions();





