const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function debugExpenseAccruals() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        // Find expense accrual transactions that created the debt
        console.log('🔍 Looking for expense accrual transactions that created the $149 debt...');
        
        const expenseAccruals = await TransactionEntry.find({
            source: 'expense_accrual',
            'entries.accountCode': '2000',
            status: 'posted'
        }).sort({ date: 1 });

        console.log(`Found ${expenseAccruals.length} expense accrual transactions affecting AP account 2000`);

        let totalAccruedDebt = 0;

        expenseAccruals.forEach((transaction, index) => {
            const apEntry = transaction.entries.find(e => e.accountCode === '2000');
            if (apEntry) {
                const debit = apEntry.debit || 0;
                const credit = apEntry.credit || 0;
                const netEffect = credit - debit; // For liability accounts, credits increase, debits decrease
                
                totalAccruedDebt += netEffect;
                
                console.log(`\n${index + 1}. ${transaction.transactionId}`);
                console.log(`   Date: ${transaction.date.toISOString().split('T')[0]}`);
                console.log(`   Source: ${transaction.source}`);
                console.log(`   Description: ${transaction.description}`);
                console.log(`   Reference: ${transaction.reference}`);
                console.log(`   AP Entry: Debit: ${debit}, Credit: ${credit}, Net Effect: ${netEffect}`);
                console.log(`   Running Accrued Debt: ${totalAccruedDebt}`);
            }
        });

        console.log(`\n📊 Total Accrued Debt: $${totalAccruedDebt}`);

        // Now check the payments
        console.log('\n🔍 Checking the expense payments...');
        
        const expensePayments = await TransactionEntry.find({
            source: 'expense_payment',
            'entries.accountCode': '2000',
            status: 'posted'
        }).sort({ date: 1 });

        console.log(`Found ${expensePayments.length} expense payment transactions affecting AP account 2000`);

        let totalPaidAmount = 0;

        expensePayments.forEach((transaction, index) => {
            const apEntry = transaction.entries.find(e => e.accountCode === '2000');
            if (apEntry) {
                const debit = apEntry.debit || 0;
                const credit = apEntry.credit || 0;
                const netEffect = credit - debit; // For liability accounts, credits increase, debits decrease
                
                totalPaidAmount += netEffect;
                
                console.log(`\n${index + 1}. ${transaction.transactionId}`);
                console.log(`   Date: ${transaction.date.toISOString().split('T')[0]}`);
                console.log(`   Source: ${transaction.source}`);
                console.log(`   Description: ${transaction.description}`);
                console.log(`   Reference: ${transaction.reference}`);
                console.log(`   AP Entry: Debit: ${debit}, Credit: ${credit}, Net Effect: ${netEffect}`);
                console.log(`   Running Paid Amount: ${totalPaidAmount}`);
            }
        });

        console.log(`\n📊 Total Paid Amount: $${totalPaidAmount}`);
        console.log(`📊 Net AP Balance: $${totalAccruedDebt + totalPaidAmount}`);

        // Check what the balance sheet should show for July 31, 2025
        console.log('\n🔍 What should the balance sheet show for July 31, 2025?');
        
        const julyEndDate = new Date('2025-07-31T23:59:59.999Z');
        
        // Get all transactions up to July 31
        const allTransactionsJuly = await TransactionEntry.find({
            'entries.accountCode': '2000',
            date: { $lte: julyEndDate },
            status: 'posted'
        }).sort({ date: 1 });

        let julyBalance = 0;
        console.log(`\nAll ${allTransactionsJuly.length} transactions affecting AP up to July 31:`);
        
        allTransactionsJuly.forEach((transaction, index) => {
            const apEntry = transaction.entries.find(e => e.accountCode === '2000');
            if (apEntry) {
                const debit = apEntry.debit || 0;
                const credit = apEntry.credit || 0;
                const netEffect = credit - debit;
                
                julyBalance += netEffect;
                
                console.log(`${index + 1}. ${transaction.date.toISOString().split('T')[0]} - ${transaction.source} - ${transaction.description}`);
                console.log(`   AP Entry: Debit: ${debit}, Credit: ${credit}, Net Effect: ${netEffect}`);
                console.log(`   Running Balance: ${julyBalance}`);
            }
        });

        console.log(`\n📊 Final AP Balance as of July 31, 2025: $${julyBalance}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugExpenseAccruals();





