const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function debug450Accrual() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        // Find the $450 expense accrual transaction
        console.log('🔍 Finding the $450 expense accrual transaction...');
        
        const accrual450 = await TransactionEntry.findOne({
            source: 'expense_accrual',
            description: { $regex: 'July 2025', $options: 'i' },
            'entries.credit': 450,
            status: 'posted'
        });

        if (accrual450) {
            console.log('✅ Found $450 accrual transaction:');
            console.log(`   Transaction ID: ${accrual450.transactionId}`);
            console.log(`   Date: ${accrual450.date.toISOString().split('T')[0]}`);
            console.log(`   Description: ${accrual450.description}`);
            console.log(`   Reference: ${accrual450.reference}`);
            console.log(`   Source ID: ${accrual450.sourceId}`);
            
            console.log('\n   Entries:');
            accrual450.entries.forEach((entry, index) => {
                console.log(`     ${index + 1}. Account: ${entry.accountCode} - ${entry.accountName}`);
                console.log(`        Debit: ${entry.debit}, Credit: ${entry.credit}`);
                console.log(`        Description: ${entry.description}`);
            });
        } else {
            console.log('❌ $450 accrual transaction not found');
        }

        // Check if there are any expense payment transactions that might correspond to this accrual
        console.log('\n🔍 Looking for corresponding expense payment transactions...');
        
        const expensePayments = await TransactionEntry.find({
            source: 'expense_payment',
            date: { $gte: new Date('2025-07-01'), $lte: new Date('2025-07-31') },
            status: 'posted'
        });

        console.log(`Found ${expensePayments.length} expense payment transactions in July 2025:`);
        expensePayments.forEach((payment, index) => {
            console.log(`\n${index + 1}. ${payment.transactionId}`);
            console.log(`   Date: ${payment.date.toISOString().split('T')[0]}`);
            console.log(`   Description: ${payment.description}`);
            console.log(`   Reference: ${payment.reference}`);
            console.log(`   Total Amount: $${payment.totalDebit}`);
            
            const apEntry = payment.entries.find(e => e.accountCode === '2000');
            if (apEntry) {
                console.log(`   AP Entry: Debit: ${apEntry.debit}, Credit: ${apEntry.credit}`);
            }
        });

        // Check if there are any other expense accruals that might be missing payments
        console.log('\n🔍 Checking all expense accruals vs payments...');
        
        const allAccruals = await TransactionEntry.find({
            source: 'expense_accrual',
            date: { $gte: new Date('2025-07-01'), $lte: new Date('2025-07-31') },
            status: 'posted'
        });

        const allPayments = await TransactionEntry.find({
            source: 'expense_payment',
            date: { $gte: new Date('2025-07-01'), $lte: new Date('2025-07-31') },
            status: 'posted'
        });

        let totalAccrued = 0;
        let totalPaid = 0;

        console.log(`\nAccruals (${allAccruals.length}):`);
        allAccruals.forEach((accrual, index) => {
            const apEntry = accrual.entries.find(e => e.accountCode === '2000');
            if (apEntry) {
                const amount = apEntry.credit || 0;
                totalAccrued += amount;
                console.log(`   ${index + 1}. ${accrual.transactionId} - $${amount} - ${accrual.description}`);
            }
        });

        console.log(`\nPayments (${allPayments.length}):`);
        allPayments.forEach((payment, index) => {
            const apEntry = payment.entries.find(e => e.accountCode === '2000');
            if (apEntry) {
                const amount = apEntry.debit || 0;
                totalPaid += amount;
                console.log(`   ${index + 1}. ${payment.transactionId} - $${amount} - ${payment.description}`);
            }
        });

        console.log(`\n📊 Summary:`);
        console.log(`   Total Accrued: $${totalAccrued}`);
        console.log(`   Total Paid: $${totalPaid}`);
        console.log(`   Net Balance: $${totalAccrued - totalPaid}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debug450Accrual();





