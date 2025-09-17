const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function debugBalanceSheetDates() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        // Check what transactions the balance sheet would find for July 2025
        const julyEndDate = new Date('2025-07-31T23:59:59.999Z');
        console.log('🔍 Balance Sheet Query for July 2025 (up to July 31):');
        
        // This is the query the balance sheet uses
        const accrualQuery = {
            source: { $in: ['rental_accrual', 'expense_accrual'] },
            date: { $lte: julyEndDate },
            status: 'posted',
            voided: { $ne: true }
        };
        
        const paymentQuery = {
            source: { $in: ['payment', 'vendor_payment', 'expense_payment'] },
            date: { $lte: julyEndDate },
            status: 'posted',
            voided: { $ne: true }
        };
        
        const otherQuery = {
            source: { $nin: ['rental_accrual', 'expense_accrual', 'payment', 'vendor_payment', 'expense_payment'] },
            date: { $lte: julyEndDate },
            status: 'posted',
            voided: { $ne: true }
        };

        const [accrualEntries, paymentEntries, otherEntries] = await Promise.all([
            TransactionEntry.find(accrualQuery),
            TransactionEntry.find(paymentQuery),
            TransactionEntry.find(otherQuery)
        ]);

        console.log(`Found ${accrualEntries.length} accrual entries`);
        console.log(`Found ${paymentEntries.length} payment entries`);
        console.log(`Found ${otherEntries.length} other entries`);

        // Check specifically for accounts payable transactions
        let apAccruals = 0;
        let apPayments = 0;

        console.log('\n📊 ACCOUNTS PAYABLE TRANSACTIONS IN JULY:');
        
        // Check accruals (these create the debt)
        accrualEntries.forEach(entry => {
            const apEntry = entry.entries.find(e => e.accountCode === '2000');
            if (apEntry) {
                const credit = apEntry.credit || 0;
                const debit = apEntry.debit || 0;
                const netEffect = credit - debit;
                apAccruals += netEffect;
                
                console.log(`\n📈 ACCRUAL (Creates Debt):`);
                console.log(`   Transaction: ${entry.transactionId}`);
                console.log(`   Date: ${entry.date.toISOString().split('T')[0]}`);
                console.log(`   Source: ${entry.source}`);
                console.log(`   Description: ${entry.description}`);
                console.log(`   AP Entry: Debit: ${debit}, Credit: ${credit}, Net Effect: +${netEffect}`);
            }
        });

        // Check payments (these clear the debt)
        paymentEntries.forEach(entry => {
            const apEntry = entry.entries.find(e => e.accountCode === '2000');
            if (apEntry) {
                const credit = apEntry.credit || 0;
                const debit = apEntry.debit || 0;
                const netEffect = credit - debit;
                apPayments += netEffect;
                
                console.log(`\n📉 PAYMENT (Clears Debt):`);
                console.log(`   Transaction: ${entry.transactionId}`);
                console.log(`   Date: ${entry.date.toISOString().split('T')[0]}`);
                console.log(`   Source: ${entry.source}`);
                console.log(`   Description: ${entry.description}`);
                console.log(`   AP Entry: Debit: ${debit}, Credit: ${credit}, Net Effect: ${netEffect}`);
            }
        });

        const julyAPBalance = apAccruals + apPayments;
        console.log(`\n💰 JULY ACCOUNTS PAYABLE BALANCE: $${julyAPBalance}`);
        console.log(`   From Accruals: +$${apAccruals}`);
        console.log(`   From Payments: $${apPayments}`);

        // Now check August
        console.log('\n🔍 Balance Sheet Query for August 2025 (up to August 31):');
        
        const augustEndDate = new Date('2025-08-31T23:59:59.999Z');
        
        const augustAccrualQuery = {
            source: { $in: ['rental_accrual', 'expense_accrual'] },
            date: { $lte: augustEndDate },
            status: 'posted',
            voided: { $ne: true }
        };
        
        const augustPaymentQuery = {
            source: { $in: ['payment', 'vendor_payment', 'expense_payment'] },
            date: { $lte: augustEndDate },
            status: 'posted',
            voided: { $ne: true }
        };
        
        const augustOtherQuery = {
            source: { $nin: ['rental_accrual', 'expense_accrual', 'payment', 'vendor_payment', 'expense_payment'] },
            date: { $lte: augustEndDate },
            status: 'posted',
            voided: { $ne: true }
        };

        const [augustAccrualEntries, augustPaymentEntries, augustOtherEntries] = await Promise.all([
            TransactionEntry.find(augustAccrualQuery),
            TransactionEntry.find(augustPaymentQuery),
            TransactionEntry.find(augustOtherQuery)
        ]);

        console.log(`Found ${augustAccrualEntries.length} accrual entries`);
        console.log(`Found ${augustPaymentEntries.length} payment entries`);
        console.log(`Found ${augustOtherEntries.length} other entries`);

        let augustAPAccruals = 0;
        let augustAPPayments = 0;

        console.log('\n📊 ACCOUNTS PAYABLE TRANSACTIONS IN AUGUST:');
        
        // Check accruals
        augustAccrualEntries.forEach(entry => {
            const apEntry = entry.entries.find(e => e.accountCode === '2000');
            if (apEntry) {
                const credit = apEntry.credit || 0;
                const debit = apEntry.debit || 0;
                const netEffect = credit - debit;
                augustAPAccruals += netEffect;
                
                console.log(`\n📈 ACCRUAL (Creates Debt):`);
                console.log(`   Transaction: ${entry.transactionId}`);
                console.log(`   Date: ${entry.date.toISOString().split('T')[0]}`);
                console.log(`   Source: ${entry.source}`);
                console.log(`   Description: ${entry.description}`);
                console.log(`   AP Entry: Debit: ${debit}, Credit: ${credit}, Net Effect: +${netEffect}`);
            }
        });

        // Check payments
        augustPaymentEntries.forEach(entry => {
            const apEntry = entry.entries.find(e => e.accountCode === '2000');
            if (apEntry) {
                const credit = apEntry.credit || 0;
                const debit = apEntry.debit || 0;
                const netEffect = credit - debit;
                augustAPPayments += netEffect;
                
                console.log(`\n📉 PAYMENT (Clears Debt):`);
                console.log(`   Transaction: ${entry.transactionId}`);
                console.log(`   Date: ${entry.date.toISOString().split('T')[0]}`);
                console.log(`   Source: ${entry.source}`);
                console.log(`   Description: ${entry.description}`);
                console.log(`   AP Entry: Debit: ${debit}, Credit: ${credit}, Net Effect: ${netEffect}`);
            }
        });

        const augustAPBalance = augustAPAccruals + augustAPPayments;
        console.log(`\n💰 AUGUST ACCOUNTS PAYABLE BALANCE: $${augustAPBalance}`);
        console.log(`   From Accruals: +$${augustAPAccruals}`);
        console.log(`   From Payments: $${augustAPPayments}`);

        console.log(`\n📊 SUMMARY:`);
        console.log(`July AP Balance: $${julyAPBalance}`);
        console.log(`August AP Balance: $${augustAPBalance}`);
        console.log(`Change: $${augustAPBalance - julyAPBalance}`);

        // Check if there are any expense accruals that create the $149 debt
        console.log('\n🔍 Looking for expense accruals that create the $149 debt...');
        
        const allExpenseAccruals = await TransactionEntry.find({
            source: 'expense_accrual',
            'entries.accountCode': '2000',
            status: 'posted'
        }).sort({ date: 1 });

        console.log(`Found ${allExpenseAccruals.length} expense accruals affecting AP:`);
        allExpenseAccruals.forEach(entry => {
            const apEntry = entry.entries.find(e => e.accountCode === '2000');
            if (apEntry) {
                const credit = apEntry.credit || 0;
                const debit = apEntry.debit || 0;
                const netEffect = credit - debit;
                
                console.log(`\n📈 EXPENSE ACCRUAL:`);
                console.log(`   Transaction: ${entry.transactionId}`);
                console.log(`   Date: ${entry.date.toISOString().split('T')[0]}`);
                console.log(`   Description: ${entry.description}`);
                console.log(`   AP Entry: Debit: ${debit}, Credit: ${credit}, Net Effect: +${netEffect}`);
            }
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugBalanceSheetDates();


