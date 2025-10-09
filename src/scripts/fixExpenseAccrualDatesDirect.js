const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function fixExpenseAccrualDatesDirect() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        // Find all expense accrual transactions that mention "July 2025"
        console.log('🔍 Finding expense accrual transactions for July 2025...');
        
        const julyAccruals = await TransactionEntry.find({
            source: 'expense_accrual',
            description: { $regex: 'July 2025', $options: 'i' },
            status: 'posted'
        });

        console.log(`Found ${julyAccruals.length} July 2025 expense accrual transactions`);

        let fixedCount = 0;
        const correctDate = new Date('2025-07-01T00:00:00.000Z'); // July 1, 2025

        for (const accrual of julyAccruals) {
            console.log(`\n🔍 Processing: ${accrual.transactionId}`);
            console.log(`   Current date: ${accrual.date.toISOString().split('T')[0]}`);
            console.log(`   Description: ${accrual.description}`);
            
            const currentDateStr = accrual.date.toISOString().split('T')[0];
            const correctDateStr = correctDate.toISOString().split('T')[0];
            
            if (currentDateStr !== correctDateStr) {
                console.log(`   🔧 Fixing date: ${currentDateStr} → ${correctDateStr}`);
                
                // Update the accrual transaction date to July 1, 2025
                await TransactionEntry.updateOne(
                    { _id: accrual._id },
                    { 
                        $set: { 
                            date: correctDate,
                            updatedAt: new Date()
                        }
                    }
                );
                
                fixedCount++;
                console.log(`   ✅ Fixed!`);
            } else {
                console.log(`   ✅ Date already correct`);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   Total July 2025 accruals processed: ${julyAccruals.length}`);
        console.log(`   Fixed: ${fixedCount}`);
        console.log(`   Already correct: ${julyAccruals.length - fixedCount}`);

        // Verify the fix by checking the balance sheet
        console.log('\n🔍 Verifying fix by checking July 2025 balance sheet...');
        
        const julyEndDate = new Date('2025-07-31T23:59:59.999Z');
        
        const julyTransactions = await TransactionEntry.find({
            'entries.accountCode': '2000',
            date: { $lte: julyEndDate },
            status: 'posted'
        }).sort({ date: 1 });

        let julyBalance = 0;
        console.log(`\nAll ${julyTransactions.length} transactions affecting AP up to July 31:`);
        
        julyTransactions.forEach((transaction, index) => {
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

        if (julyBalance === 0) {
            console.log('✅ SUCCESS! Accounts Payable balance is now $0 for July 2025');
        } else {
            console.log(`⚠️ WARNING: Accounts Payable balance is still $${julyBalance} for July 2025`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

fixExpenseAccrualDatesDirect();










