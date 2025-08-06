const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Expense = require('./src/models/finance/Expense');
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await analyzeUnpaidExpenses();
});

async function analyzeUnpaidExpenses() {
    console.log('\n🔍 ANALYZING UNPAID EXPENSES');
    console.log('==============================\n');

    try {
        // 1. Get all expenses
        const allExpenses = await Expense.find({}).sort({ expenseDate: -1 });
        console.log(`📊 Total Expenses Found: ${allExpenses.length}`);

        // 2. Analyze by payment status
        const expensesByStatus = {
            Pending: [],
            Paid: [],
            Overdue: []
        };

        allExpenses.forEach(expense => {
            const status = expense.paymentStatus || 'Pending';
            expensesByStatus[status].push(expense);
        });

        console.log('\n📋 EXPENSE PAYMENT STATUS BREAKDOWN:');
        console.log('=====================================');
        
        Object.entries(expensesByStatus).forEach(([status, expenses]) => {
            const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
            console.log(`${status}: ${expenses.length} expenses - $${totalAmount.toFixed(2)}`);
        });

        // 3. Detailed analysis of unpaid expenses
        const unpaidExpenses = [...expensesByStatus.Pending, ...expensesByStatus.Overdue];
        
        console.log('\n💰 UNPAID EXPENSES DETAILS:');
        console.log('============================');
        console.log(`Total Unpaid: ${unpaidExpenses.length} expenses`);
        
        const totalUnpaidAmount = unpaidExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        console.log(`Total Unpaid Amount: $${totalUnpaidAmount.toFixed(2)}`);

        // 4. Show individual unpaid expenses
        if (unpaidExpenses.length > 0) {
            console.log('\n📝 INDIVIDUAL UNPAID EXPENSES:');
            console.log('===============================');
            
            unpaidExpenses.forEach((expense, index) => {
                console.log(`${index + 1}. ${expense.expenseId} - ${expense.description}`);
                console.log(`   Amount: $${expense.amount.toFixed(2)}`);
                console.log(`   Category: ${expense.category}`);
                console.log(`   Date: ${expense.expenseDate.toDateString()}`);
                console.log(`   Status: ${expense.paymentStatus}`);
                console.log(`   Vendor: ${expense.vendorName || 'N/A'}`);
                console.log('');
            });
        }

        // 5. Check transaction entries for expenses
        console.log('🔍 TRANSACTION ENTRY ANALYSIS:');
        console.log('==============================');
        
        const transactionEntries = await TransactionEntry.find({ sourceModel: 'Expense' });
        console.log(`Total Expense Transaction Entries: ${transactionEntries.length}`);

        // 6. Check for missing transaction entries
        const expensesWithTransactions = [];
        const expensesWithoutTransactions = [];

        for (const expense of allExpenses) {
            const transactionEntry = await TransactionEntry.findOne({ 
                reference: expense.expenseId 
            });
            
            if (transactionEntry) {
                expensesWithTransactions.push(expense);
            } else {
                expensesWithoutTransactions.push(expense);
            }
        }

        console.log(`\nExpenses with Transaction Entries: ${expensesWithTransactions.length}`);
        console.log(`Expenses without Transaction Entries: ${expensesWithoutTransactions.length}`);

        if (expensesWithoutTransactions.length > 0) {
            console.log('\n❌ EXPENSES MISSING TRANSACTION ENTRIES:');
            console.log('=========================================');
            expensesWithoutTransactions.forEach(expense => {
                console.log(`- ${expense.expenseId}: $${expense.amount} (${expense.paymentStatus})`);
            });
        }

        // 7. Check for payment transactions (when expenses are marked as paid)
        console.log('\n💳 PAYMENT TRANSACTION ANALYSIS:');
        console.log('=================================');
        
        const paidExpenses = expensesByStatus.Paid;
        console.log(`Paid Expenses: ${paidExpenses.length}`);
        
        for (const expense of paidExpenses) {
            // Check if there's a payment transaction
            const paymentTransaction = await TransactionEntry.findOne({
                source: 'expense_payment',
                sourceId: expense._id
            });
            
            if (paymentTransaction) {
                console.log(`✅ ${expense.expenseId}: Has payment transaction`);
            } else {
                console.log(`❌ ${expense.expenseId}: Missing payment transaction`);
            }
        }

        // 8. Calculate what should be in Accounts Payable
        console.log('\n📊 ACCOUNTS PAYABLE CALCULATION:');
        console.log('=================================');
        
        const accountsPayable = await Account.findOne({ code: '2000' });
        if (accountsPayable) {
            console.log(`Accounts Payable Account: ${accountsPayable.name} (${accountsPayable.code})`);
            
            // Calculate what should be in Accounts Payable based on unpaid expenses
            console.log(`\nExpected Accounts Payable Balance: $${totalUnpaidAmount.toFixed(2)}`);
            console.log(`(Based on ${unpaidExpenses.length} unpaid expenses)`);
            
            // Check actual balance in transaction entries
            const transactionEntries = await TransactionEntry.find({});
            let actualPayableBalance = 0;
            
            transactionEntries.forEach(transactionEntry => {
                transactionEntry.entries.forEach(entry => {
                    if (entry.accountCode === '2000') {
                        actualPayableBalance += (entry.credit || 0) - (entry.debit || 0);
                    }
                });
            });
            
            console.log(`Actual Accounts Payable Balance: $${actualPayableBalance.toFixed(2)}`);
            
            if (Math.abs(actualPayableBalance - totalUnpaidAmount) < 0.01) {
                console.log('✅ Accounts Payable balance matches unpaid expenses');
            } else {
                console.log(`❌ Accounts Payable balance mismatch: $${Math.abs(actualPayableBalance - totalUnpaidAmount).toFixed(2)}`);
            }
        }

        // 9. Recommendations
        console.log('\n🎯 RECOMMENDATIONS:');
        console.log('===================');
        
        if (expensesWithoutTransactions.length > 0) {
            console.log('1. Create missing transaction entries for expenses without them');
        }
        
        if (totalUnpaidAmount > 0) {
            console.log('2. Ensure Accounts Payable reflects the unpaid expense amount');
        }
        
        const paidWithoutPaymentTransactions = paidExpenses.filter(expense => {
            // This would need to be checked in the actual code
            return true; // Placeholder
        });
        
        if (paidWithoutPaymentTransactions.length > 0) {
            console.log('3. Create payment transactions for expenses marked as paid');
        }

    } catch (error) {
        console.error('❌ Error during analysis:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Analysis completed');
    }
}

// Run the analysis
console.log('🚀 Starting Unpaid Expenses Analysis...'); 