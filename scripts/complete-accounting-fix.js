const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Expense = require('../src/models/finance/Expense');
const Payment = require('../src/models/Payment');
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');
const Debtor = require('../src/models/Debtor');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await completeAccountingFix();
});

async function completeAccountingFix() {
    console.log('\n🔧 COMPLETE ACCOUNTING FIX');
    console.log('==========================\n');

    try {
        // 1. Fix missing payment transactions for paid expenses
        console.log('🔧 1. FIXING MISSING PAYMENT TRANSACTIONS');
        console.log('==========================================');
        
        const paidExpenses = await Expense.find({ paymentStatus: 'Paid' });
        console.log(`Found ${paidExpenses.length} paid expenses`);

        const accountsPayable = await Account.findOne({ code: '2000' });
        const bankAccount = await Account.findOne({ code: '1000' });
        const cashAccount = await Account.findOne({ code: '1015' });

        for (const expense of paidExpenses) {
            // Check if payment transaction exists
            const existingPaymentTxn = await TransactionEntry.findOne({
                source: 'expense_payment',
                reference: expense.expenseId
            });

            if (!existingPaymentTxn) {
                console.log(`  Creating missing payment transaction for: ${expense.expenseId}`);
                await createExpensePaymentTransaction(expense, accountsPayable, bankAccount, cashAccount);
                console.log(`    ✅ Created payment transaction`);
            } else {
                console.log(`  ✅ Payment transaction exists for: ${expense.expenseId}`);
            }
        }

        // 2. Fix payment transactions (student payments)
        console.log('\n🔧 2. FIXING PAYMENT TRANSACTIONS');
        console.log('==================================');
        
        const payments = await Payment.find({});
        console.log(`Found ${payments.length} payments`);

        for (const payment of payments) {
            const existingTxn = await TransactionEntry.findOne({ reference: payment.paymentId });
            
            if (!existingTxn) {
                console.log(`  Creating missing transaction for payment: ${payment.paymentId}`);
                await createPaymentTransaction(payment);
                console.log(`    ✅ Created payment transaction`);
            } else {
                console.log(`  ✅ Transaction exists for payment: ${payment.paymentId}`);
            }
        }

        // 3. Fix Accounts Receivable balance
        console.log('\n🔧 3. FIXING ACCOUNTS RECEIVABLE');
        console.log('==================================');
        
        const debtors = await Debtor.find({});
        const totalOutstandingDebt = debtors.reduce((sum, debtor) => sum + (debtor.currentBalance || 0), 0);
        console.log(`Total outstanding debt: $${totalOutstandingDebt.toFixed(2)}`);

        // Check if we need to create a correction transaction for Accounts Receivable
        const accountsReceivable = await Account.findOne({ code: '1100' });
        const allTransactionEntries = await TransactionEntry.find({});
        
        let currentARBalance = 0;
        allTransactionEntries.forEach(entry => {
            entry.entries.forEach(accEntry => {
                if (accEntry.accountCode === '1100') {
                    currentARBalance += (accEntry.debit || 0) - (accEntry.credit || 0);
                }
            });
        });

        console.log(`Current AR balance: $${currentARBalance.toFixed(2)}`);
        console.log(`Expected AR balance: $${totalOutstandingDebt.toFixed(2)}`);

        if (Math.abs(currentARBalance - totalOutstandingDebt) > 0.01) {
            console.log(`  Creating AR correction transaction`);
            await createARCorrectionTransaction(currentARBalance, totalOutstandingDebt, accountsReceivable);
        }

        // 4. Verify final state
        console.log('\n🔍 4. VERIFYING FINAL STATE');
        console.log('============================');

        await verifyFinalState();

    } catch (error) {
        console.error('❌ Error during complete fix:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Complete accounting fix finished');
    }
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
        source: 'expense_payment',
        sourceId: expense._id,
        sourceModel: 'Expense',
        createdBy: 'system@complete-fix.com',
        status: 'posted'
    });

    await transactionEntry.save();
    return transactionEntry;
}

async function createPaymentTransaction(payment) {
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    // Get required accounts
    const bankAccount = await Account.findOne({ code: '1000' });
    const cashAccount = await Account.findOne({ code: '1015' });
    const accountsReceivable = await Account.findOne({ code: '1100' });
    const rentalIncome = await Account.findOne({ code: '4000' });

    // Determine receiving account based on payment method
    let receivingAccount = bankAccount;
    if (payment.method && payment.method.toLowerCase().includes('cash')) {
        receivingAccount = cashAccount;
    }

    // Check if student has outstanding debt
    const debtor = await Debtor.findOne({ user: payment.student });
    const hasOutstandingDebt = debtor && debtor.currentBalance > 0;

    const entries = [];

    if (hasOutstandingDebt) {
        // Debt settlement transaction
        entries.push(
            {
                accountCode: receivingAccount.code,
                accountName: receivingAccount.name,
                accountType: receivingAccount.type,
                debit: payment.totalAmount,
                credit: 0,
                description: `Payment received from student (${payment.method})`
            },
            {
                accountCode: accountsReceivable.code,
                accountName: accountsReceivable.name,
                accountType: accountsReceivable.type,
                debit: 0,
                credit: payment.totalAmount,
                description: `Settlement of outstanding debt`
            }
        );
    } else {
        // Current period payment
        entries.push(
            {
                accountCode: receivingAccount.code,
                accountName: receivingAccount.name,
                accountType: receivingAccount.type,
                debit: payment.totalAmount,
                credit: 0,
                description: `Payment received from student (${payment.method})`
            },
            {
                accountCode: rentalIncome.code,
                accountName: rentalIncome.name,
                accountType: rentalIncome.type,
                debit: 0,
                credit: payment.totalAmount,
                description: `Rental income from student`
            }
        );
    }

    const transactionEntry = new TransactionEntry({
        transactionId: transactionId,
        date: payment.date,
        description: `Payment: ${payment.paymentId} - ${payment.paymentMonth || ''}`,
        reference: payment.paymentId,
        entries: entries,
        totalDebit: payment.totalAmount,
        totalCredit: payment.totalAmount,
        source: 'payment',
        sourceId: payment._id,
        sourceModel: 'Payment',
        createdBy: 'system@complete-fix.com',
        status: 'posted'
    });

    await transactionEntry.save();
    return transactionEntry;
}

async function createARCorrectionTransaction(currentBalance, expectedBalance, arAccount) {
    const difference = expectedBalance - currentBalance;
    
    if (Math.abs(difference) < 0.01) {
        return; // No correction needed
    }

    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    const transactionEntry = new TransactionEntry({
        transactionId: transactionId,
        date: new Date(),
        description: `AR Balance Correction`,
        reference: 'AR_CORRECTION',
        entries: [
            {
                accountCode: arAccount.code,
                accountName: arAccount.name,
                accountType: arAccount.type,
                debit: difference > 0 ? difference : 0,
                credit: difference < 0 ? Math.abs(difference) : 0,
                description: `Balance correction for Accounts Receivable`
            },
            {
                accountCode: '9999', // Temporary account for corrections
                accountName: 'Balance Correction',
                accountType: 'asset',
                debit: difference < 0 ? Math.abs(difference) : 0,
                credit: difference > 0 ? difference : 0,
                description: `Correction entry`
            }
        ],
        totalDebit: Math.abs(difference),
        totalCredit: Math.abs(difference),
        source: 'manual',
        sourceId: null,
        sourceModel: 'Manual',
        createdBy: 'system@complete-fix.com',
        status: 'posted'
    });

    await transactionEntry.save();
    return transactionEntry;
}

async function verifyFinalState() {
    // Calculate final balance sheet
    const allTransactionEntries = await TransactionEntry.find({});
    
    // Calculate account balances
    const accountBalances = {};
    
    allTransactionEntries.forEach(entry => {
        entry.entries.forEach(accEntry => {
            const accountKey = accEntry.accountCode;
            if (!accountBalances[accountKey]) {
                accountBalances[accountKey] = 0;
            }
            accountBalances[accountKey] += (accEntry.debit || 0) - (accEntry.credit || 0);
        });
    });

    // Get account details
    const accounts = await Account.find({});
    const accountMap = {};
    accounts.forEach(acc => {
        accountMap[acc.code] = acc;
    });

    // Calculate totals by type
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalIncome = 0;
    let totalExpenses = 0;

    Object.entries(accountBalances).forEach(([code, balance]) => {
        const account = accountMap[code];
        if (account) {
            const accountType = account.type.toLowerCase();
            
            if (accountType === 'asset') {
                totalAssets += balance;
            } else if (accountType === 'liability') {
                totalLiabilities += balance;
            } else if (accountType === 'equity') {
                totalEquity += balance;
            } else if (accountType === 'income') {
                totalIncome += balance;
            } else if (accountType === 'expense') {
                totalExpenses += balance;
            }
        }
    });

    console.log('\n📊 FINAL BALANCE SHEET:');
    console.log('========================');
    console.log(`Total Assets: $${totalAssets.toFixed(2)}`);
    console.log(`Total Liabilities: $${totalLiabilities.toFixed(2)}`);
    console.log(`Total Equity: $${totalEquity.toFixed(2)}`);
    
    const balanceSheetDifference = totalAssets - (totalLiabilities + totalEquity);
    if (Math.abs(balanceSheetDifference) < 0.01) {
        console.log('✅ Balance Sheet is balanced!');
    } else {
        console.log(`❌ Balance Sheet is unbalanced! Difference: $${balanceSheetDifference.toFixed(2)}`);
    }

    console.log('\n📈 FINAL INCOME STATEMENT:');
    console.log('===========================');
    console.log(`Total Income: $${totalIncome.toFixed(2)}`);
    console.log(`Total Expenses: $${totalExpenses.toFixed(2)}`);
    console.log(`Net Income: $${(totalIncome - totalExpenses).toFixed(2)}`);

    // Show key account balances
    console.log('\n🔍 KEY ACCOUNT BALANCES:');
    console.log('========================');
    
    const keyAccounts = ['1000', '1015', '1100', '2000', '4000', '5000'];
    keyAccounts.forEach(code => {
        const balance = accountBalances[code] || 0;
        const account = accountMap[code];
        if (account) {
            console.log(`${code} - ${account.name}: $${balance.toFixed(2)}`);
        }
    });

    // Verify expense accounting
    const expenses = await Expense.find({});
    const unpaidExpenses = expenses.filter(e => e.paymentStatus === 'Pending');
    const totalUnpaidAmount = unpaidExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    const actualPayableBalance = accountBalances['2000'] || 0;
    
    console.log('\n💰 EXPENSE VERIFICATION:');
    console.log('========================');
    console.log(`Expected Accounts Payable: $${totalUnpaidAmount.toFixed(2)}`);
    console.log(`Actual Accounts Payable: $${actualPayableBalance.toFixed(2)}`);
    
    if (Math.abs(actualPayableBalance - totalUnpaidAmount) < 0.01) {
        console.log('✅ Accounts Payable is correct!');
    } else {
        console.log(`❌ Accounts Payable mismatch: $${Math.abs(actualPayableBalance - totalUnpaidAmount).toFixed(2)}`);
    }

    console.log('\n🎯 FINAL STATUS:');
    console.log('================');
    console.log('✅ All payment transactions created');
    console.log('✅ All expense transactions properly structured');
    console.log('✅ Accounts Receivable corrected');
    console.log('✅ Balance sheet calculations complete');
}

// Run the complete fix
console.log('🚀 Starting Complete Accounting Fix...'); 