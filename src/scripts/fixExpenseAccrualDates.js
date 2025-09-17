const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Expense = require('../models/finance/Expense');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function fixExpenseAccrualDates() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        // Find all expense accrual transactions that were created with approval dates instead of expense dates
        console.log('🔍 Finding expense accrual transactions with incorrect dates...');
        
        const expenseAccruals = await TransactionEntry.find({
            source: 'expense_accrual',
            status: 'posted'
        }).sort({ date: 1 });

        console.log(`Found ${expenseAccruals.length} expense accrual transactions`);

        let fixedCount = 0;

        for (const accrual of expenseAccruals) {
            console.log(`\n🔍 Processing: ${accrual.transactionId}`);
            console.log(`   Current date: ${accrual.date.toISOString().split('T')[0]}`);
            console.log(`   Description: ${accrual.description}`);
            console.log(`   Reference: ${accrual.reference}`);

            // Try to find the corresponding expense record
            let expense = null;
            
            // Method 1: Try to find by reference (if it's an expense ID)
            if (accrual.reference) {
                try {
                    expense = await Expense.findOne({ expenseId: accrual.reference });
                } catch (e) {
                    // Reference might not be an expense ID
                }
            }

            // Method 2: Try to find by description matching
            if (!expense && accrual.description) {
                // Look for expenses with similar descriptions
                const expenseQuery = {
                    $or: [
                        { description: { $regex: accrual.description.replace('ACCRUAL: ', ''), $options: 'i' } },
                        { title: { $regex: accrual.description.replace('ACCRUAL: ', ''), $options: 'i' } }
                    ]
                };
                expense = await Expense.findOne(expenseQuery);
            }

            if (expense) {
                console.log(`   ✅ Found expense: ${expense.expenseId}`);
                console.log(`   Expense date: ${expense.expenseDate.toISOString().split('T')[0]}`);
                
                // Check if the accrual date matches the expense date
                const accrualDateStr = accrual.date.toISOString().split('T')[0];
                const expenseDateStr = expense.expenseDate.toISOString().split('T')[0];
                
                if (accrualDateStr !== expenseDateStr) {
                    console.log(`   🔧 Fixing date: ${accrualDateStr} → ${expenseDateStr}`);
                    
                    // Update the accrual transaction date to match the expense date
                    await TransactionEntry.updateOne(
                        { _id: accrual._id },
                        { 
                            $set: { 
                                date: expense.expenseDate,
                                updatedAt: new Date()
                            }
                        }
                    );
                    
                    fixedCount++;
                    console.log(`   ✅ Fixed!`);
                } else {
                    console.log(`   ✅ Date already correct`);
                }
            } else {
                console.log(`   ⚠️ Could not find corresponding expense record`);
                console.log(`   Reference: ${accrual.reference}`);
                console.log(`   Description: ${accrual.description}`);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   Total expense accruals processed: ${expenseAccruals.length}`);
        console.log(`   Fixed: ${fixedCount}`);
        console.log(`   Already correct: ${expenseAccruals.length - fixedCount}`);

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

fixExpenseAccrualDates();
