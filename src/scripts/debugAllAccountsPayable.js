const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function debugAllAccountsPayable() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        // Find all transactions that affect accounts payable (2000) up to July 31, 2025
        const julyEndDate = new Date('2025-07-31T23:59:59.999Z');
        
        console.log('🔍 All transactions affecting Accounts Payable (2000) up to July 31, 2025:');
        
        const allAPTransactions = await TransactionEntry.find({
            'entries.accountCode': '2000',
            date: { $lte: julyEndDate },
            status: 'posted'
        }).sort({ date: 1 });

        console.log(`Found ${allAPTransactions.length} transactions affecting AP account 2000`);

        let totalAPBalance = 0;
        let expenseAccruals = 0;
        let expensePayments = 0;

        allAPTransactions.forEach((transaction, index) => {
            const apEntry = transaction.entries.find(e => e.accountCode === '2000');
            if (apEntry) {
                const debit = apEntry.debit || 0;
                const credit = apEntry.credit || 0;
                const netEffect = credit - debit; // For liability accounts, credits increase, debits decrease
                
                totalAPBalance += netEffect;
                
                console.log(`\n${index + 1}. ${transaction.transactionId}`);
                console.log(`   Date: ${transaction.date.toISOString().split('T')[0]}`);
                console.log(`   Source: ${transaction.source}`);
                console.log(`   Description: ${transaction.description}`);
                console.log(`   AP Entry: Debit: ${debit}, Credit: ${credit}, Net Effect: ${netEffect}`);
                console.log(`   Running AP Balance: ${totalAPBalance}`);
                
                if (transaction.source === 'expense_accrual') {
                    expenseAccruals += netEffect;
                } else if (transaction.source === 'expense_payment') {
                    expensePayments += netEffect;
                }
            }
        });

        console.log('\n📊 SUMMARY:');
        console.log(`Total AP Balance as of July 31, 2025: $${totalAPBalance}`);
        console.log(`From Expense Accruals: $${expenseAccruals}`);
        console.log(`From Expense Payments: $${expensePayments}`);

        // Now check what happens in August
        console.log('\n🔍 All transactions affecting Accounts Payable (2000) up to August 31, 2025:');
        
        const augustEndDate = new Date('2025-08-31T23:59:59.999Z');
        
        const allAPTransactionsAugust = await TransactionEntry.find({
            'entries.accountCode': '2000',
            date: { $lte: augustEndDate },
            status: 'posted'
        }).sort({ date: 1 });

        console.log(`Found ${allAPTransactionsAugust.length} transactions affecting AP account 2000`);

        let totalAPBalanceAugust = 0;
        let newTransactionsInAugust = 0;

        allAPTransactionsAugust.forEach((transaction, index) => {
            const apEntry = transaction.entries.find(e => e.accountCode === '2000');
            if (apEntry) {
                const debit = apEntry.debit || 0;
                const credit = apEntry.credit || 0;
                const netEffect = credit - debit;
                
                totalAPBalanceAugust += netEffect;
                
                // Check if this is a new transaction in August
                const isNewInAugust = transaction.date > julyEndDate;
                if (isNewInAugust) {
                    newTransactionsInAugust++;
                    console.log(`\n🆕 NEW IN AUGUST - ${transaction.transactionId}`);
                    console.log(`   Date: ${transaction.date.toISOString().split('T')[0]}`);
                    console.log(`   Source: ${transaction.source}`);
                    console.log(`   Description: ${transaction.description}`);
                    console.log(`   AP Entry: Debit: ${debit}, Credit: ${credit}, Net Effect: ${netEffect}`);
                }
            }
        });

        console.log('\n📊 AUGUST SUMMARY:');
        console.log(`Total AP Balance as of August 31, 2025: $${totalAPBalanceAugust}`);
        console.log(`New transactions in August: ${newTransactionsInAugust}`);
        console.log(`Change from July to August: $${totalAPBalanceAugust - totalAPBalance}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugAllAccountsPayable();










