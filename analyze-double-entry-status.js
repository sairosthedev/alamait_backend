require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI);

async function analyzeDoubleEntryStatus() {
    try {
        await mongoose.connection.asPromise();
        const db = mongoose.connection.db;
        
        console.log('🔍 COMPREHENSIVE DOUBLE-ENTRY ANALYSIS\n');
        
        const transactions = await db.collection('transactions').find({}).toArray();
        console.log(`📊 Total Transactions: ${transactions.length}\n`);
        
        if (transactions.length === 0) {
            console.log('No transactions found');
            return;
        }
        
        // 1. CHECK TRANSACTION TYPES
        console.log('📋 TRANSACTION TYPES FOUND:');
        const types = new Set();
        transactions.forEach(tx => {
            if (tx.metadata && tx.metadata.type) {
                types.add(tx.metadata.type);
            }
        });
        
        const typeCounts = {};
        transactions.forEach(tx => {
            const type = tx.metadata?.type || 'unknown';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        
        Object.entries(typeCounts).forEach(([type, count]) => {
            console.log(`   ${type}: ${count} transactions`);
        });
        
        // 2. CHECK DOUBLE-ENTRY COMPLIANCE
        console.log('\n🔍 DOUBLE-ENTRY COMPLIANCE:');
        let balancedTransactions = 0;
        let unbalancedTransactions = 0;
        let missingEntries = 0;
        
        transactions.forEach(tx => {
            if (tx.entries && tx.entries.length >= 2) {
                const totalDebits = tx.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
                const totalCredits = tx.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
                
                if (Math.abs(totalDebits - totalCredits) < 0.01) {
                    balancedTransactions++;
                } else {
                    unbalancedTransactions++;
                    console.log(`   ❌ Unbalanced: ${tx.transactionId} - Dr: $${totalDebits}, Cr: $${totalCredits}`);
                }
            } else {
                missingEntries++;
                console.log(`   ❌ Missing entries: ${tx.transactionId}`);
            }
        });
        
        console.log(`   ✅ Balanced Transactions: ${balancedTransactions}`);
        console.log(`   ❌ Unbalanced Transactions: ${unbalancedTransactions}`);
        console.log(`   ❌ Missing Entries: ${missingEntries}`);
        
        // 3. CHECK RESIDENCE COVERAGE
        console.log('\n🏠 RESIDENCE COVERAGE:');
        const transactionsWithResidence = transactions.filter(tx => tx.residence);
        const transactionsWithoutResidence = transactions.filter(tx => !tx.residence);
        
        console.log(`   Transactions WITH Residence: ${transactionsWithResidence.length}`);
        console.log(`   Transactions WITHOUT Residence: ${transactionsWithoutResidence.length}`);
        
        if (transactionsWithoutResidence.length > 0) {
            console.log('\n   ⚠️  Transactions missing residence:');
            transactionsWithoutResidence.slice(0, 3).forEach(tx => {
                console.log(`     ${tx.metadata?.type || 'unknown'} - $${tx.metadata?.amount || 'unknown'} - ${tx.date}`);
            });
        }
        
        // 4. CHECK ACCOUNT CODES USED
        console.log('\n💰 ACCOUNT CODES USED:');
        const accountCodes = new Set();
        transactions.forEach(tx => {
            if (tx.entries) {
                tx.entries.forEach(entry => {
                    if (entry.accountCode) accountCodes.add(entry.accountCode);
                });
            }
        });
        
        console.log(`   Total Unique Account Codes: ${accountCodes.size}`);
        console.log(`   Account Codes: ${Array.from(accountCodes).sort().join(', ')}`);
        
        // 5. ANALYZE SPECIFIC SCENARIOS
        console.log('\n🔍 SCENARIO ANALYSIS:');
        
        // Student Payments
        const studentPayments = transactions.filter(tx => tx.metadata?.type === 'rent_payment');
        console.log(`\n👨‍🎓 Student Rent Payments: ${studentPayments.length}`);
        if (studentPayments.length > 0) {
            const sample = studentPayments[0];
            console.log(`   Sample Transaction:`);
            console.log(`     Amount: $${sample.metadata?.amount}`);
            console.log(`     Residence: ${sample.residence ? '✅ Has Residence' : '❌ No Residence'}`);
            console.log(`     Entries: ${sample.entries?.length || 0}`);
            if (sample.entries && sample.entries.length >= 2) {
                console.log(`     Double-Entry: ✅ Balanced (Dr: $${sample.entries.reduce((sum, e) => sum + (e.debit || 0), 0)}, Cr: $${sample.entries.reduce((sum, e) => sum + (e.credit || 0), 0)})`);
                sample.entries.forEach((entry, index) => {
                    console.log(`       Entry ${index + 1}: ${entry.accountCode} - ${entry.accountName} - Dr: $${entry.debit} Cr: $${entry.credit}`);
                });
            }
        }
        
        // Check for other payment types
        const adminFeePayments = transactions.filter(tx => tx.metadata?.type === 'admin_fee_payment');
        const depositPayments = transactions.filter(tx => tx.metadata?.type === 'deposit_payment');
        const pettyCashAllocations = transactions.filter(tx => tx.metadata?.type === 'petty_cash_allocation');
        const expenses = transactions.filter(tx => tx.metadata?.type === 'expense_creation');
        const pettyCashExpenses = transactions.filter(tx => tx.metadata?.type === 'petty_cash_expense');
        const rentAccruals = transactions.filter(tx => tx.metadata?.type === 'rent_accrual');
        
        console.log(`\n💰 Other Transaction Types:`);
        console.log(`   Admin Fee Payments: ${adminFeePayments.length}`);
        console.log(`   Deposit Payments: ${depositPayments.length}`);
        console.log(`   Petty Cash Allocations: ${pettyCashAllocations.length}`);
        console.log(`   Expenses: ${expenses.length}`);
        console.log(`   Petty Cash Expenses: ${pettyCashExpenses.length}`);
        console.log(`   Rent Accruals: ${rentAccruals.length}`);
        
        // 6. SUMMARY
        console.log('\n📊 SUMMARY:');
        console.log(`   Total Transactions: ${transactions.length}`);
        console.log(`   Properly Balanced: ${balancedTransactions}/${transactions.length} (${Math.round(balancedTransactions/transactions.length*100)}%)`);
        console.log(`   With Residence: ${transactionsWithResidence.length}/${transactions.length} (${Math.round(transactionsWithResidence.length/transactions.length*100)}%)`);
        
        if (balancedTransactions === transactions.length && transactionsWithResidence.length === transactions.length) {
            console.log('\n🎉 EXCELLENT! All transactions are properly configured with double-entry and residence!');
        } else {
            console.log('\n⚠️  Some issues found that need attention.');
        }
        
    } catch (error) {
        console.error('❌ Error analyzing transactions:', error);
    } finally {
        mongoose.connection.close();
    }
}

analyzeDoubleEntryStatus();





