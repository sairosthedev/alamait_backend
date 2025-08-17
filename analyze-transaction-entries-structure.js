require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function analyzeTransactionEntries() {
    try {
        console.log('🔍 Analyzing Transaction Entries Structure...\n');
        
        // Get collections
        const db = mongoose.connection.db;
        
        // Check TransactionEntry collection
        const transactionEntries = await db.collection('transactionentries').find({}).toArray();
        console.log(`📊 Total Transaction Entries: ${transactionEntries.length}\n`);
        
        if (transactionEntries.length === 0) {
            console.log('❌ No transaction entries found!');
            return;
        }
        
        // Group by transaction type
        const byType = {};
        const byAccount = {};
        const byResidence = {};
        const byMonth = {};
        
        transactionEntries.forEach(entry => {
            // By type
            const type = entry.metadata?.type || 'unknown';
            byType[type] = (byType[type] || 0) + 1;
            
            // By account
            const account = entry.account || 'no_account';
            byAccount[account] = (byAccount[account] || 0) + 1;
            
            // By residence
            const residence = entry.residence || 'no_residence';
            byResidence[residence] = (byResidence[residence] || 0) + 1;
            
            // By month
            if (entry.metadata?.accrualMonth) {
                const month = entry.metadata.accrualMonth;
                byMonth[month] = (byMonth[month] || 0) + 1;
            }
        });
        
        console.log('📋 Transaction Types Found:');
        Object.entries(byType).forEach(([type, count]) => {
            console.log(`   ${type}: ${count} entries`);
        });
        
        console.log('\n💰 Account Codes Used:');
        Object.entries(byAccount).forEach(([account, count]) => {
            console.log(`   ${account}: ${count} entries`);
        });
        
        console.log('\n🏠 Residence Distribution:');
        Object.entries(byResidence).forEach(([residence, count]) => {
            console.log(`   ${residence}: ${count} entries`);
        });
        
        console.log('\n📅 Monthly Distribution (Accrual):');
        Object.entries(byMonth).forEach(([month, count]) => {
            console.log(`   ${month}: ${count} entries`);
        });
        
        // Check for double-entry compliance
        console.log('\n🔍 Checking Double-Entry Compliance...');
        const transactions = await db.collection('transactions').find({}).toArray();
        console.log(`📊 Total Transactions: ${transactions.length}`);
        
        // Check if each transaction has balanced entries
        let balancedTransactions = 0;
        let unbalancedTransactions = 0;
        
        for (const transaction of transactions) {
            const entries = transactionEntries.filter(e => e.transactionId === transaction.transactionId);
            if (entries.length > 0) {
                const totalDebits = entries.filter(e => e.type === 'debit').reduce((sum, e) => sum + (e.amount || 0), 0);
                const totalCredits = entries.filter(e => e.type === 'credit').reduce((sum, e) => sum + (e.amount || 0), 0);
                
                if (Math.abs(totalDebits - totalCredits) < 0.01) {
                    balancedTransactions++;
                } else {
                    unbalancedTransactions++;
                    console.log(`   ❌ Unbalanced Transaction ${transaction.transactionId}: Debits: $${totalDebits}, Credits: $${totalCredits}`);
                }
            }
        }
        
        console.log(`\n✅ Balanced Transactions: ${balancedTransactions}`);
        console.log(`❌ Unbalanced Transactions: ${unbalancedTransactions}`);
        
        // Check specific scenarios
        console.log('\n🔍 Checking Specific Scenarios...');
        
        // 1. Student payments (admin adding payment)
        const studentPayments = transactionEntries.filter(e => 
            e.metadata?.type === 'rent_payment' || 
            e.metadata?.type === 'admin_fee_payment' ||
            e.metadata?.type === 'deposit_payment'
        );
        console.log(`\n👨‍🎓 Student Payments: ${studentPayments.length} entries`);
        
        if (studentPayments.length > 0) {
            const sample = studentPayments[0];
            console.log(`   Sample Entry:`);
            console.log(`     Account: ${sample.account}`);
            console.log(`     Type: ${sample.type}`);
            console.log(`     Amount: $${sample.amount}`);
            console.log(`     Residence: ${sample.residence}`);
            console.log(`     Metadata:`, JSON.stringify(sample.metadata, null, 2));
        }
        
        // 2. Petty cash allocations
        const pettyCashAllocations = transactionEntries.filter(e => 
            e.metadata?.type === 'petty_cash_allocation'
        );
        console.log(`\n💵 Petty Cash Allocations: ${pettyCashAllocations.length} entries`);
        
        // 3. Expenses
        const expenses = transactionEntries.filter(e => 
            e.metadata?.type === 'expense_creation' || 
            e.metadata?.type === 'petty_cash_expense'
        );
        console.log(`\n💸 Expenses: ${expenses.length} entries`);
        
        // 4. Rent accruals
        const rentAccruals = transactionEntries.filter(e => 
            e.metadata?.type === 'rent_accrual'
        );
        console.log(`\n🏠 Rent Accruals: ${rentAccruals.length} entries`);
        
        // Check for missing residence
        const entriesWithoutResidence = transactionEntries.filter(e => !e.residence);
        console.log(`\n⚠️  Entries without Residence: ${entriesWithoutResidence.length}`);
        
        if (entriesWithoutResidence.length > 0) {
            console.log('   Sample entries without residence:');
            entriesWithoutResidence.slice(0, 3).forEach(entry => {
                console.log(`     ${entry.account} - ${entry.metadata?.type || 'unknown'} - $${entry.amount}`);
            });
        }
        
        // Check for missing metadata.type
        const entriesWithoutType = transactionEntries.filter(e => !e.metadata?.type);
        console.log(`\n⚠️  Entries without Metadata Type: ${entriesWithoutType.length}`);
        
        if (entriesWithoutType.length > 0) {
            console.log('   Sample entries without type:');
            entriesWithoutType.slice(0, 3).forEach(entry => {
                console.log(`     ${entry.account} - ${entry.type} - $${entry.amount}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error analyzing transaction entries:', error);
    } finally {
        mongoose.connection.close();
    }
}

analyzeTransactionEntries(); 