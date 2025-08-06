const mongoose = require('mongoose');
require('dotenv').config();

// Import all models
const User = require('./src/models/User');
const Payment = require('./src/models/Payment');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');
const Debtor = require('./src/models/Debtor');
const Expense = require('./src/models/finance/Expense');
const Request = require('./src/models/Request');
const Invoice = require('./src/models/Invoice');
const AuditLog = require('./src/models/AuditLog');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await finalAccountingFixes();
});

async function finalAccountingFixes() {
    console.log('\n🔧 FINAL ACCOUNTING FIXES');
    console.log('==========================\n');

    try {
        // 1. Fix missing payment transactions
        await fixMissingPaymentTransactions();
        
        // 2. Fix missing expense transactions
        await fixMissingExpenseTransactions();
        
        // 3. Fix negative asset balances
        await fixNegativeAssetBalances();
        
        // 4. Verify final state
        await verifyFinalState();

    } catch (error) {
        console.error('❌ Error during fixes:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Final fixes completed');
    }
}

async function fixMissingPaymentTransactions() {
    console.log('🔧 1. FIXING MISSING PAYMENT TRANSACTIONS');
    console.log('------------------------------------------');
    
    const payments = await Payment.find({});
    console.log(`Found ${payments.length} payments to process`);
    
    for (const payment of payments) {
        // Check if transaction entry already exists
        const existingEntry = await TransactionEntry.findOne({ reference: payment.paymentId });
        
        if (!existingEntry) {
            console.log(`  Creating missing transaction for payment: ${payment.paymentId}`);
            
            // Get student info
            const student = await User.findById(payment.student);
            const studentName = student ? `${student.firstName} ${student.lastName}` : 'Unknown Student';
            
            // Determine receiving account based on payment method
            let receivingAccountCode = '1000'; // Default to Bank
            if (payment.method && payment.method.toLowerCase().includes('cash')) {
                receivingAccountCode = '1015'; // Cash
            }
            
            // Get accounts
            const receivingAccount = await Account.findOne({ code: receivingAccountCode });
            const studentAccount = await Account.findOne({ code: '1100' }); // Accounts Receivable
            const rentAccount = await Account.findOne({ code: '4000' }); // Rental Income
            
            if (!receivingAccount || !studentAccount || !rentAccount) {
                console.log(`    ⚠️  Missing required accounts for payment ${payment.paymentId}`);
                continue;
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
                        description: `Payment received from ${studentName} (${payment.method})`
                    },
                    {
                        accountCode: studentAccount.code,
                        accountName: studentAccount.name,
                        accountType: studentAccount.type,
                        debit: 0,
                        credit: payment.totalAmount,
                        description: `Settlement of outstanding debt for ${studentName}`
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
                        description: `Payment received from ${studentName} (${payment.method})`
                    },
                    {
                        accountCode: rentAccount.code,
                        accountName: rentAccount.name,
                        accountType: rentAccount.type,
                        debit: 0,
                        credit: payment.totalAmount,
                        description: `Rental income from ${studentName}`
                    }
                );
            }
            
            // Create transaction entry
            const transactionEntry = new TransactionEntry({
                transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                date: payment.date,
                description: `Payment: ${payment.paymentId} - ${studentName} - ${payment.paymentMonth || ''}`,
                reference: payment.paymentId,
                entries: entries,
                totalDebit: payment.totalAmount,
                totalCredit: payment.totalAmount,
                source: 'payment',
                sourceId: payment._id,
                sourceModel: 'Payment',
                createdBy: 'system@final-fix.com',
                status: 'posted'
            });
            
            await transactionEntry.save();
            console.log(`    ✅ Created transaction entry with ${entries.length} account entries`);
        }
    }
    
    console.log('');
}

async function fixMissingExpenseTransactions() {
    console.log('🔧 2. FIXING MISSING EXPENSE TRANSACTIONS');
    console.log('------------------------------------------');
    
    const expenses = await Expense.find({});
    console.log(`Found ${expenses.length} expenses to process`);
    
    for (const expense of expenses) {
        // Check if transaction entry already exists
        const existingEntry = await TransactionEntry.findOne({ reference: expense.expenseId });
        
        if (!existingEntry) {
            console.log(`  Creating missing transaction for expense: ${expense.expenseId}`);
            
            // Get accounts
            const expenseAccount = await Account.findOne({ code: '5000' }); // Maintenance Expense
            const payableAccount = await Account.findOne({ code: '2000' }); // Accounts Payable
            
            if (!expenseAccount || !payableAccount) {
                console.log(`    ⚠️  Missing required accounts for expense ${expense.expenseId}`);
                continue;
            }
            
            const entries = [];
            
            // Expense approval transaction (creates liability)
            entries.push(
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
            );
            
            // Create transaction entry
            const transactionEntry = new TransactionEntry({
                transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                date: expense.expenseDate,
                description: `Expense: ${expense.expenseId} - ${expense.description}`,
                reference: expense.expenseId,
                entries: entries,
                totalDebit: expense.amount,
                totalCredit: expense.amount,
                source: 'expense_payment',
                sourceId: expense._id,
                sourceModel: 'Expense',
                createdBy: 'system@final-fix.com',
                status: 'posted'
            });
            
            await transactionEntry.save();
            console.log(`    ✅ Created transaction entry with ${entries.length} account entries`);
        }
    }
    
    console.log('');
}

async function fixNegativeAssetBalances() {
    console.log('🔧 3. FIXING NEGATIVE ASSET BALANCES');
    console.log('-------------------------------------');
    
    // Get all asset accounts
    const assetAccounts = await Account.find({ type: 'asset' });
    
    for (const account of assetAccounts) {
        const transactionEntries = await TransactionEntry.find({});
        let balance = 0;
        
        transactionEntries.forEach(transactionEntry => {
            transactionEntry.entries.forEach(entry => {
                if (entry.accountCode === account.code) {
                    balance += (entry.debit || 0) - (entry.credit || 0);
                }
            });
        });
        
        if (balance < 0) {
            console.log(`  Found negative balance in ${account.name}: $${balance.toFixed(2)}`);
            console.log(`    This indicates incorrect double-entry accounting`);
            console.log(`    Asset accounts should never have negative balances`);
            console.log(`    Need to review transaction entries for this account`);
        }
    }
    
    console.log('');
}

async function verifyFinalState() {
    console.log('🔍 4. VERIFYING FINAL STATE');
    console.log('----------------------------');
    
    // Count transaction entries
    const totalEntries = await TransactionEntry.countDocuments();
    console.log(`Total Transaction Entries: ${totalEntries}`);
    
    // Check payment transactions
    const payments = await Payment.find({});
    let paymentTransactions = 0;
    
    for (const payment of payments) {
        const transactionEntry = await TransactionEntry.findOne({ reference: payment.paymentId });
        if (transactionEntry) {
            paymentTransactions++;
        }
    }
    
    console.log(`Payment Transactions: ${paymentTransactions}/${payments.length}`);
    
    // Check expense transactions
    const expenses = await Expense.find({});
    let expenseTransactions = 0;
    
    for (const expense of expenses) {
        const transactionEntry = await TransactionEntry.findOne({ reference: expense.expenseId });
        if (transactionEntry) {
            expenseTransactions++;
        }
    }
    
    console.log(`Expense Transactions: ${expenseTransactions}/${expenses.length}`);
    
    // Calculate balance sheet
    const accounts = await Account.find({});
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    
    const transactionEntries = await TransactionEntry.find({});
    
    for (const account of accounts) {
        let balance = 0;
        transactionEntries.forEach(transactionEntry => {
            transactionEntry.entries.forEach(entry => {
                if (entry.accountCode === account.code) {
                    if (account.type === 'asset') {
                        balance += (entry.debit || 0) - (entry.credit || 0);
                    } else if (account.type === 'liability' || account.type === 'equity') {
                        balance += (entry.credit || 0) - (entry.debit || 0);
                    }
                }
            });
        });
        
        if (account.type === 'asset') {
            totalAssets += balance;
        } else if (account.type === 'liability') {
            totalLiabilities += balance;
        } else if (account.type === 'equity') {
            totalEquity += balance;
        }
    }
    
    console.log(`\nBalance Sheet Summary:`);
    console.log(`  Total Assets: $${totalAssets.toFixed(2)}`);
    console.log(`  Total Liabilities: $${totalLiabilities.toFixed(2)}`);
    console.log(`  Total Equity: $${totalEquity.toFixed(2)}`);
    
    const difference = totalAssets - (totalLiabilities + totalEquity);
    if (Math.abs(difference) < 0.01) {
        console.log(`  ✅ Balance Sheet is balanced!`);
    } else {
        console.log(`  ❌ Balance Sheet is unbalanced! Difference: $${difference.toFixed(2)}`);
    }
    
    console.log('');
}

// Run the final fixes
console.log('🚀 Starting Final Accounting Fixes...'); 