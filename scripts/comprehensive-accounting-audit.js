const mongoose = require('mongoose');
require('dotenv').config();

// Import all models
const User = require('../src/models/User');
const Payment = require('../src/models/Payment');
const Transaction = require('../src/models/Transaction');
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');
const Debtor = require('../src/models/Debtor');
const Expense = require('../src/models/finance/Expense');
const Request = require('../src/models/Request');
const Invoice = require('../src/models/Invoice');
const AuditLog = require('../src/models/AuditLog');
const Residence = require('../src/models/Residence');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await runComprehensiveAudit();
});

async function runComprehensiveAudit() {
    console.log('\n🔍 COMPREHENSIVE ACCOUNTING AUDIT');
    console.log('=====================================\n');

    try {
        // 1. Check Chart of Accounts
        await auditChartOfAccounts();
        
        // 2. Check Transactions and Entries
        await auditTransactions();
        
        // 3. Check Payments and Double-Entry
        await auditPayments();
        
        // 4. Check Expenses and Double-Entry
        await auditExpenses();
        
        // 5. Check Debtors and Creditors
        await auditDebtorsAndCreditors();
        
        // 6. Check Invoices
        await auditInvoices();
        
        // 7. Check Audit Logs
        await auditAuditLogs();
        
        // 8. Check Balance Sheet Integrity
        await auditBalanceSheetIntegrity();
        
        // 9. Check Income Statement Integrity
        await auditIncomeStatementIntegrity();
        
        // 10. Check for Common Accounting Errors
        await checkCommonAccountingErrors();

    } catch (error) {
        console.error('❌ Error during audit:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Audit completed');
    }
}

async function auditChartOfAccounts() {
    console.log('📊 1. CHART OF ACCOUNTS AUDIT');
    console.log('-------------------------------');
    
    const accounts = await Account.find({}).sort({ code: 1 });
    console.log(`Found ${accounts.length} accounts in Chart of Accounts`);
    
    // Check for required accounts
    const requiredAccounts = [
        { code: '1000', name: 'Bank - Main Account', type: 'asset' },
        { code: '1015', name: 'Cash', type: 'asset' },
        { code: '1100', name: 'Accounts Receivable - Tenants', type: 'asset' },
        { code: '2000', name: 'Accounts Payable', type: 'liability' },
        { code: '4000', name: 'Rental Income - Residential', type: 'income' },
        { code: '4001', name: 'Rental Income - School', type: 'income' },
        { code: '5000', name: 'Maintenance Expense', type: 'expense' }
    ];
    
    for (const required of requiredAccounts) {
        const account = accounts.find(a => a.code === required.code);
        if (account) {
            console.log(`✅ ${required.code} - ${account.name} (${account.type})`);
        } else {
            console.log(`❌ MISSING: ${required.code} - ${required.name} (${required.type})`);
        }
    }
    
    // Check account types
    const accountTypes = {};
    accounts.forEach(account => {
        accountTypes[account.type] = (accountTypes[account.type] || 0) + 1;
    });
    
    console.log('\nAccount Types Summary:');
    Object.entries(accountTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count} accounts`);
    });
    
    console.log('');
}

async function auditTransactions() {
    console.log('💰 2. TRANSACTIONS AND ENTRIES AUDIT');
    console.log('-------------------------------------');
    
    const transactionEntries = await TransactionEntry.find({}).sort({ date: -1 }).limit(50);
    console.log(`Found ${transactionEntries.length} recent transaction entries`);
    
    // Check transaction entries balance
    let balancedTransactions = 0;
    let unbalancedTransactions = 0;
    
    for (const transactionEntry of transactionEntries) {
        const totalDebits = transactionEntry.entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
        const totalCredits = transactionEntry.entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
        
        if (Math.abs(totalDebits - totalCredits) < 0.01) {
            balancedTransactions++;
        } else {
            unbalancedTransactions++;
            console.log(`❌ Unbalanced Transaction: ${transactionEntry._id}`);
            console.log(`   Description: ${transactionEntry.description}`);
            console.log(`   Debits: $${totalDebits}, Credits: $${totalCredits}`);
            console.log(`   Difference: $${Math.abs(totalDebits - totalCredits)}`);
        }
    }
    
    console.log(`\nTransaction Balance Summary:`);
    console.log(`  Balanced: ${balancedTransactions}`);
    console.log(`  Unbalanced: ${unbalancedTransactions}`);
    
    // Check for orphaned entries (entries without valid sourceId)
    const orphanedEntries = await TransactionEntry.find({
        $or: [
            { sourceId: { $exists: false } },
            { sourceId: null }
        ]
    });
    if (orphanedEntries.length > 0) {
        console.log(`❌ Found ${orphanedEntries.length} orphaned transaction entries`);
    } else {
        console.log(`✅ No orphaned transaction entries found`);
    }
    
    console.log('');
}

async function auditPayments() {
    console.log('💳 3. PAYMENTS AND DOUBLE-ENTRY AUDIT');
    console.log('--------------------------------------');
    
    const payments = await Payment.find({}).sort({ date: -1 }).limit(50);
    console.log(`Found ${payments.length} recent payments`);
    
    // Check payment amounts vs transaction entries
    for (const payment of payments) {
        const transactionEntry = await TransactionEntry.findOne({ reference: payment.paymentId });
        
        if (transactionEntry) {
            const totalAmount = transactionEntry.totalDebit || transactionEntry.totalCredit || 0;
            
            if (Math.abs(totalAmount - payment.totalAmount) > 0.01) {
                console.log(`❌ Payment amount mismatch: ${payment.paymentId}`);
                console.log(`   Payment amount: $${payment.totalAmount}`);
                console.log(`   Transaction total: $${totalAmount}`);
            }
        } else {
            console.log(`❌ No transaction found for payment: ${payment.paymentId}`);
        }
    }
    
    // Check payment methods and corresponding accounts
    const paymentMethods = await Payment.aggregate([
        { $group: { _id: '$method', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' } } }
    ]);
    
    console.log('\nPayment Methods Summary:');
    paymentMethods.forEach(method => {
        console.log(`  ${method._id}: ${method.count} payments, $${method.totalAmount.toFixed(2)} total`);
    });
    
    console.log('');
}

async function auditExpenses() {
    console.log('📋 4. EXPENSES AND DOUBLE-ENTRY AUDIT');
    console.log('--------------------------------------');
    
    const expenses = await Expense.find({}).sort({ expenseDate: -1 }).limit(50);
    console.log(`Found ${expenses.length} recent expenses`);
    
    // Check expense approval transactions
    for (const expense of expenses) {
        const transactionEntry = await TransactionEntry.findOne({ 
            description: { $regex: expense.expenseId, $options: 'i' } 
        });
        
        if (!transactionEntry) {
            console.log(`❌ No transaction found for expense: ${expense.expenseId}`);
        }
    }
    
    // Check expense categories
    const expenseCategories = await Expense.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);
    
    console.log('\nExpense Categories Summary:');
    expenseCategories.forEach(category => {
        console.log(`  ${category._id}: ${category.count} expenses, $${category.totalAmount.toFixed(2)} total`);
    });
    
    console.log('');
}

async function auditDebtorsAndCreditors() {
    console.log('👥 5. DEBTORS AUDIT');
    console.log('--------------------');
    
    const debtors = await Debtor.find({});
    
    console.log(`Found ${debtors.length} debtors`);
    
    // Check debtor balances
    let totalDebtorBalance = 0;
    for (const debtor of debtors) {
        totalDebtorBalance += debtor.currentBalance || 0;
        
        if (debtor.currentBalance > 0) {
            console.log(`💰 Outstanding Debt: ${debtor.contactInfo?.name || 'Unknown'} - $${debtor.currentBalance}`);
        }
    }
    
    console.log(`\nTotal Outstanding Debt: $${totalDebtorBalance.toFixed(2)}`);
    
    console.log('');
}

async function auditInvoices() {
    console.log('🧾 6. INVOICES AUDIT');
    console.log('---------------------');
    
    const invoices = await Invoice.find({}).sort({ createdAt: -1 }).limit(50);
    console.log(`Found ${invoices.length} recent invoices`);
    
    // Check invoice statuses
    const invoiceStatuses = await Invoice.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' } } }
    ]);
    
    console.log('\nInvoice Status Summary:');
    invoiceStatuses.forEach(status => {
        console.log(`  ${status._id}: ${status.count} invoices, $${status.totalAmount.toFixed(2)} total`);
    });
    
    // Check for unpaid invoices
    const unpaidInvoices = await Invoice.find({ status: { $ne: 'paid' } });
    console.log(`\nUnpaid Invoices: ${unpaidInvoices.length}`);
    
    console.log('');
}

async function auditAuditLogs() {
    console.log('📝 7. AUDIT LOGS AUDIT');
    console.log('-----------------------');
    
    const auditLogs = await AuditLog.find({}).sort({ timestamp: -1 }).limit(50);
    console.log(`Found ${auditLogs.length} recent audit logs`);
    
    // Check audit log actions
    const auditActions = await AuditLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);
    
    console.log('\nMost Common Audit Actions:');
    auditActions.slice(0, 10).forEach(action => {
        console.log(`  ${action._id}: ${action.count} times`);
    });
    
    console.log('');
}

async function auditBalanceSheetIntegrity() {
    console.log('⚖️ 8. BALANCE SHEET INTEGRITY AUDIT');
    console.log('-----------------------------------');
    
    // Get all accounts
    const accounts = await Account.find({});
    
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    
    for (const account of accounts) {
        const transactionEntries = await TransactionEntry.find({});
        
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
    
    console.log(`Total Assets: $${totalAssets.toFixed(2)}`);
    console.log(`Total Liabilities: $${totalLiabilities.toFixed(2)}`);
    console.log(`Total Equity: $${totalEquity.toFixed(2)}`);
    
    const difference = totalAssets - (totalLiabilities + totalEquity);
    if (Math.abs(difference) < 0.01) {
        console.log('✅ Balance Sheet is balanced!');
    } else {
        console.log(`❌ Balance Sheet is unbalanced! Difference: $${difference.toFixed(2)}`);
    }
    
    console.log('');
}

async function auditIncomeStatementIntegrity() {
    console.log('📈 9. INCOME STATEMENT INTEGRITY AUDIT');
    console.log('--------------------------------------');
    
    // Get income and expense accounts
    const incomeAccounts = await Account.find({ type: 'income' });
    const expenseAccounts = await Account.find({ type: 'expense' });
    
    let totalIncome = 0;
    let totalExpenses = 0;
    
    // Calculate total income
    for (const account of incomeAccounts) {
        const transactionEntries = await TransactionEntry.find({});
        let income = 0;
        transactionEntries.forEach(transactionEntry => {
            transactionEntry.entries.forEach(entry => {
                if (entry.accountCode === account.code) {
                    income += (entry.credit || 0);
                }
            });
        });
        totalIncome += income;
    }
    
    // Calculate total expenses
    for (const account of expenseAccounts) {
        const transactionEntries = await TransactionEntry.find({});
        let expenses = 0;
        transactionEntries.forEach(transactionEntry => {
            transactionEntry.entries.forEach(entry => {
                if (entry.accountCode === account.code) {
                    expenses += (entry.debit || 0);
                }
            });
        });
        totalExpenses += expenses;
    }
    
    const netIncome = totalIncome - totalExpenses;
    
    console.log(`Total Income: $${totalIncome.toFixed(2)}`);
    console.log(`Total Expenses: $${totalExpenses.toFixed(2)}`);
    console.log(`Net Income: $${netIncome.toFixed(2)}`);
    
    console.log('');
}

async function checkCommonAccountingErrors() {
    console.log('🔍 10. COMMON ACCOUNTING ERRORS CHECK');
    console.log('-------------------------------------');
    
    // Check for negative balances in asset accounts
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
            console.log(`❌ Negative balance in asset account: ${account.name} - $${balance.toFixed(2)}`);
        }
    }
    
    // Check for duplicate transaction references
    const duplicateRefs = await TransactionEntry.aggregate([
        { $group: { _id: '$reference', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
    ]);
    
    if (duplicateRefs.length > 0) {
        console.log(`❌ Found ${duplicateRefs.length} duplicate transaction references`);
        duplicateRefs.forEach(ref => {
            console.log(`   ${ref._id}: ${ref.count} times`);
        });
    } else {
        console.log('✅ No duplicate transaction references found');
    }
    
    // Check for orphaned transaction entries
    const orphanedEntries = await TransactionEntry.find({
        $or: [
            { sourceId: { $exists: false } },
            { sourceId: null }
        ]
    });
    
    if (orphanedEntries.length > 0) {
        console.log(`❌ Found ${orphanedEntries.length} orphaned transaction entries`);
    } else {
        console.log('✅ No orphaned transaction entries found');
    }
    
    // Check for missing account references
    const missingAccountRefs = await TransactionEntry.find({
        'entries.accountCode': { $exists: false }
    });
    
    if (missingAccountRefs.length > 0) {
        console.log(`❌ Found ${missingAccountRefs.length} transaction entries with missing account references`);
    } else {
        console.log('✅ All transaction entries have valid account references');
    }
    
    console.log('');
}

// Run the audit
console.log('🚀 Starting Comprehensive Accounting Audit...'); 