const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Expense = require('../src/models/finance/Expense');
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');
const Transaction = require('../src/models/Transaction');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await fixExpenseAccounting();
});

async function fixExpenseAccounting() {
    console.log('\n🔧 FIXING EXPENSE ACCOUNTING');
    console.log('==============================\n');

    try {
        // 1. Get all expenses
        const allExpenses = await Expense.find({}).sort({ expenseDate: -1 });
        console.log(`📊 Total Expenses Found: ${allExpenses.length}`);

        // 2. Delete all existing expense transaction entries (we'll recreate them properly)
        console.log('\n🗑️  CLEANING UP EXISTING TRANSACTIONS');
        console.log('=====================================');
        
        const existingExpenseTransactions = await TransactionEntry.find({ sourceModel: 'Expense' });
        console.log(`Found ${existingExpenseTransactions.length} existing expense transaction entries`);
        
        if (existingExpenseTransactions.length > 0) {
            await TransactionEntry.deleteMany({ sourceModel: 'Expense' });
            console.log(`✅ Deleted ${existingExpenseTransactions.length} existing expense transaction entries`);
        }

        // 3. Get required accounts
        const accountsPayable = await Account.findOne({ code: '2000' });
        const maintenanceExpense = await Account.findOne({ code: '5000' });
        const bankAccount = await Account.findOne({ code: '1000' });
        const cashAccount = await Account.findOne({ code: '1015' });

        if (!accountsPayable || !maintenanceExpense || !bankAccount || !cashAccount) {
            console.error('❌ Missing required accounts');
            return;
        }

        console.log('✅ Required accounts found');

        // 4. Process each expense
        console.log('\n📝 PROCESSING EXPENSES');
        console.log('======================');

        for (const expense of allExpenses) {
            console.log(`\n📋 Processing: ${expense.expenseId} - ${expense.description}`);
            console.log(`   Amount: $${expense.amount}, Status: ${expense.paymentStatus}`);

            // Step 1: Create approval transaction (creates liability)
            await createExpenseApprovalTransaction(expense, maintenanceExpense, accountsPayable);
            console.log(`   ✅ Created approval transaction`);

            // Step 2: If expense is paid, create payment transaction (settles liability)
            if (expense.paymentStatus === 'Paid') {
                await createExpensePaymentTransaction(expense, accountsPayable, bankAccount, cashAccount);
                console.log(`   ✅ Created payment transaction`);
            }
        }

        // 5. Verify the fix
        console.log('\n🔍 VERIFYING THE FIX');
        console.log('====================');

        await verifyExpenseAccounting();

    } catch (error) {
        console.error('❌ Error during fix:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Expense accounting fix completed');
    }
}

async function createExpenseApprovalTransaction(expense, expenseAccount, payableAccount) {
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    const transactionEntry = new TransactionEntry({
        transactionId: transactionId,
        date: expense.expenseDate,
        description: `Expense Approval: ${expense.expenseId} - ${expense.description}`,
        reference: expense.expenseId,
        entries: [
            {
                accountCode: expenseAccount.code,
                accountName: expenseAccount.name,
                accountType: expenseAccount.type,
                debit: expense.amount,
                credit: 0,
                description: `Expense: ${expense.description}`
            },
            {
                accountCode: payableAccount.code,
                accountName: payableAccount.name,
                accountType: payableAccount.type,
                debit: 0,
                credit: expense.amount,
                description: `Liability created for expense: ${expense.description}`
            }
        ],
        totalDebit: expense.amount,
        totalCredit: expense.amount,
        source: 'manual', // Using 'manual' for approval transactions
        sourceId: expense._id,
        sourceModel: 'Expense',
        createdBy: 'system@fix.com',
        status: 'posted'
    });

    await transactionEntry.save();
    return transactionEntry;
}

async function createExpensePaymentTransaction(expense, payableAccount, bankAccount, cashAccount) {
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    // Determine payment account based on payment method
    let paymentAccount = bankAccount; // Default to bank
    if (expense.paymentMethod && expense.paymentMethod.toLowerCase().includes('cash')) {
        paymentAccount = cashAccount;
    }
    
    const transactionEntry = new TransactionEntry({
        transactionId: transactionId,
        date: expense.paidDate || new Date(),
        description: `Expense Payment: ${expense.expenseId} - ${expense.description}`,
        reference: expense.expenseId,
        entries: [
            {
                accountCode: payableAccount.code,
                accountName: payableAccount.name,
                accountType: payableAccount.type,
                debit: expense.amount,
                credit: 0,
                description: `Settlement of liability for: ${expense.description}`
            },
            {
                accountCode: paymentAccount.code,
                accountName: paymentAccount.name,
                accountType: paymentAccount.type,
                debit: 0,
                credit: expense.amount,
                description: `Payment via ${expense.paymentMethod || 'Bank Transfer'}`
            }
        ],
        totalDebit: expense.amount,
        totalCredit: expense.amount,
        source: 'expense_payment', // Using 'expense_payment' for payment transactions
        sourceId: expense._id,
        sourceModel: 'Expense',
        createdBy: 'system@fix.com',
        status: 'posted'
    });

    await transactionEntry.save();
    return transactionEntry;
}

async function verifyExpenseAccounting() {
    // Get all expenses
    const allExpenses = await Expense.find({});
    const paidExpenses = allExpenses.filter(e => e.paymentStatus === 'Paid');
    const unpaidExpenses = allExpenses.filter(e => e.paymentStatus === 'Pending');

    console.log(`\n📊 EXPENSE SUMMARY:`);
    console.log(`   Total Expenses: ${allExpenses.length}`);
    console.log(`   Paid Expenses: ${paidExpenses.length}`);
    console.log(`   Unpaid Expenses: ${unpaidExpenses.length}`);

    // Check transaction entries
    const approvalTransactions = await TransactionEntry.find({ source: 'manual', sourceModel: 'Expense' });
    const paymentTransactions = await TransactionEntry.find({ source: 'expense_payment' });

    console.log(`\n📝 TRANSACTION SUMMARY:`);
    console.log(`   Approval Transactions: ${approvalTransactions.length}`);
    console.log(`   Payment Transactions: ${paymentTransactions.length}`);

    // Calculate expected Accounts Payable balance
    const totalUnpaidAmount = unpaidExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    console.log(`\n💰 EXPECTED ACCOUNTS PAYABLE: $${totalUnpaidAmount.toFixed(2)}`);

    // Calculate actual Accounts Payable balance
    const allTransactionEntries = await TransactionEntry.find({});
    let actualPayableBalance = 0;

    allTransactionEntries.forEach(entry => {
        entry.entries.forEach(accEntry => {
            if (accEntry.accountCode === '2000') {
                actualPayableBalance += (accEntry.credit || 0) - (accEntry.debit || 0);
            }
        });
    });

    console.log(`📊 ACTUAL ACCOUNTS PAYABLE: $${actualPayableBalance.toFixed(2)}`);

    if (Math.abs(actualPayableBalance - totalUnpaidAmount) < 0.01) {
        console.log('✅ Accounts Payable balance is correct!');
    } else {
        console.log(`❌ Accounts Payable balance mismatch: $${Math.abs(actualPayableBalance - totalUnpaidAmount).toFixed(2)}`);
    }

    // Check individual expense transactions
    console.log(`\n🔍 INDIVIDUAL EXPENSE VERIFICATION:`);
    
    for (const expense of allExpenses) {
        const approvalTxn = await TransactionEntry.findOne({ 
            source: 'manual', 
            sourceModel: 'Expense',
            reference: expense.expenseId 
        });
        
        const paymentTxn = await TransactionEntry.findOne({ 
            source: 'expense_payment', 
            reference: expense.expenseId 
        });

        console.log(`   ${expense.expenseId}:`);
        console.log(`     Approval Transaction: ${approvalTxn ? '✅' : '❌'}`);
        console.log(`     Payment Transaction: ${paymentTxn ? '✅' : '❌'} (${expense.paymentStatus === 'Paid' ? 'Expected' : 'Not Expected'})`);
    }

    console.log('\n🎯 ACCOUNTING FLOW VERIFICATION:');
    console.log('================================');
    
    // Show the proper accounting flow
    console.log('\n📋 PROPER EXPENSE ACCOUNTING FLOW:');
    console.log('====================================');
    
    console.log('\n1. EXPENSE APPROVAL (Creates Liability):');
    console.log('   Dr. Maintenance Expense: $XXX');
    console.log('   Cr. Accounts Payable: $XXX');
    
    console.log('\n2. EXPENSE PAYMENT (Settles Liability):');
    console.log('   Dr. Accounts Payable: $XXX');
    console.log('   Cr. Bank/Cash: $XXX');
    
    console.log('\n3. RESULT:');
    console.log('   - Unpaid expenses remain as Accounts Payable liability');
    console.log('   - Paid expenses have settled liability (zero balance)');
    console.log('   - Balance sheet shows correct Accounts Payable amount');
}

// Run the fix
console.log('🚀 Starting Expense Accounting Fix...'); 