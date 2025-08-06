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
    await fixAccountingIssues();
});

async function fixAccountingIssues() {
    console.log('\n🔧 FIXING ACCOUNTING ISSUES');
    console.log('=============================\n');

    try {
        // 1. Fix orphaned transaction entries
        await fixOrphanedTransactionEntries();
        
        // 2. Fix missing account references
        await fixMissingAccountReferences();
        
        // 3. Fix duplicate transaction references
        await fixDuplicateTransactionReferences();
        
        // 4. Fix payment-transaction mismatches
        await fixPaymentTransactionMismatches();
        
        // 5. Fix missing expense transactions
        await fixMissingExpenseTransactions();
        
        // 6. Verify fixes
        await verifyFixes();

    } catch (error) {
        console.error('❌ Error during fixes:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Fixes completed');
    }
}

async function fixOrphanedTransactionEntries() {
    console.log('🔧 1. FIXING ORPHANED TRANSACTION ENTRIES');
    console.log('------------------------------------------');
    
    // Find orphaned entries (entries without valid transaction references)
    const orphanedEntries = await TransactionEntry.find({
        $or: [
            { transaction: { $exists: false } },
            { transaction: null },
            { transaction: { $nin: await Transaction.distinct('_id') } }
        ]
    });
    
    console.log(`Found ${orphanedEntries.length} orphaned transaction entries`);
    
    if (orphanedEntries.length > 0) {
        // Delete orphaned entries
        await TransactionEntry.deleteMany({
            _id: { $in: orphanedEntries.map(e => e._id) }
        });
        console.log(`✅ Deleted ${orphanedEntries.length} orphaned transaction entries`);
    }
    
    console.log('');
}

async function fixMissingAccountReferences() {
    console.log('🔧 2. FIXING MISSING ACCOUNT REFERENCES');
    console.log('----------------------------------------');
    
    // Find entries with missing account references
    const missingAccountEntries = await TransactionEntry.find({
        $or: [
            { account: { $exists: false } },
            { account: null },
            { account: { $nin: await Account.distinct('_id') } }
        ]
    });
    
    console.log(`Found ${missingAccountEntries.length} entries with missing account references`);
    
    if (missingAccountEntries.length > 0) {
        // Delete entries with missing account references
        await TransactionEntry.deleteMany({
            _id: { $in: missingAccountEntries.map(e => e._id) }
        });
        console.log(`✅ Deleted ${missingAccountEntries.length} entries with missing account references`);
    }
    
    console.log('');
}

async function fixDuplicateTransactionReferences() {
    console.log('🔧 3. FIXING DUPLICATE TRANSACTION REFERENCES');
    console.log('------------------------------------------------');
    
    // Find duplicate references
    const duplicateRefs = await Transaction.aggregate([
        { $group: { _id: '$reference', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } }
    ]);
    
    console.log(`Found ${duplicateRefs.length} duplicate transaction references`);
    
    for (const duplicate of duplicateRefs) {
        console.log(`  ${duplicate._id}: ${duplicate.count} duplicates`);
        
        // Keep the first transaction, delete the rest
        const [keepId, ...deleteIds] = duplicate.ids;
        
        // Delete duplicate transactions
        await Transaction.deleteMany({ _id: { $in: deleteIds } });
        
        // Delete associated entries
        await TransactionEntry.deleteMany({ transaction: { $in: deleteIds } });
        
        console.log(`    ✅ Kept ${keepId}, deleted ${deleteIds.length} duplicates`);
    }
    
    console.log('');
}

async function fixPaymentTransactionMismatches() {
    console.log('🔧 4. FIXING PAYMENT-TRANSACTION MISMATCHES');
    console.log('--------------------------------------------');
    
    const payments = await Payment.find({}).sort({ date: -1 });
    console.log(`Checking ${payments.length} payments`);
    
    for (const payment of payments) {
        // Find or create transaction for this payment
        let transaction = await Transaction.findOne({ reference: payment.paymentId });
        
        if (!transaction) {
            console.log(`  Creating missing transaction for payment: ${payment.paymentId}`);
            
            // Create transaction entry
            const transactionEntryData = await createPaymentTransactionEntries(transaction, payment);
            if (transactionEntryData) {
                const transactionEntry = new TransactionEntry(transactionEntryData);
                await transactionEntry.save();
                console.log(`    ✅ Created transaction entry with ${transactionEntryData.entries.length} account entries`);
            }
        } else {
            // Check if transaction has entries
            const entries = await TransactionEntry.find({ reference: payment.paymentId });
            
            if (entries.length === 0) {
                console.log(`  Creating missing entries for transaction: ${transaction._id}`);
                
                const transactionEntryData = await createPaymentTransactionEntries(transaction, payment);
                if (transactionEntryData) {
                    const transactionEntry = new TransactionEntry(transactionEntryData);
                    await transactionEntry.save();
                    console.log(`    ✅ Created transaction entry with ${transactionEntryData.entries.length} account entries`);
                }
            }
        }
    }
    
    console.log('');
}

async function createPaymentTransactionEntries(transaction, payment) {
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
        return null;
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
                accountCode: studentAccount.code,
                accountName: studentAccount.name,
                accountType: studentAccount.type,
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
                accountCode: rentAccount.code,
                accountName: rentAccount.name,
                accountType: rentAccount.type,
                debit: 0,
                credit: payment.totalAmount,
                description: `Rental income from student`
            }
        );
    }
    
    return {
        transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        date: payment.date,
        description: `Payment: ${payment.paymentId} - ${payment.paymentMonth || ''}`,
        reference: payment.paymentId,
        entries: entries,
        totalDebit: payment.totalAmount,
        totalCredit: payment.totalAmount,
        source: 'payment',
        sourceId: payment._id,
        sourceModel: 'Payment',
        createdBy: 'system@fix.com',
        status: 'posted'
    };
}

async function fixMissingExpenseTransactions() {
    console.log('🔧 5. FIXING MISSING EXPENSE TRANSACTIONS');
    console.log('------------------------------------------');
    
    const expenses = await Expense.find({}).sort({ expenseDate: -1 });
    console.log(`Checking ${expenses.length} expenses`);
    
    for (const expense of expenses) {
        // Find or create transaction for this expense
        let transaction = await Transaction.findOne({ 
            description: { $regex: expense.expenseId, $options: 'i' } 
        });
        
        if (!transaction) {
            console.log(`  Creating missing transaction for expense: ${expense.expenseId}`);
            
            // Create transaction entry
            const transactionEntryData = await createExpenseTransactionEntries(transaction, expense);
            if (transactionEntryData) {
                const transactionEntry = new TransactionEntry(transactionEntryData);
                await transactionEntry.save();
                console.log(`    ✅ Created transaction entry with ${transactionEntryData.entries.length} account entries`);
            }
        }
    }
    
    console.log('');
}

async function createExpenseTransactionEntries(transaction, expense) {
    // Get accounts
    const expenseAccount = await Account.findOne({ code: '5000' }); // Maintenance Expense
    const payableAccount = await Account.findOne({ code: '2000' }); // Accounts Payable
    
    if (!expenseAccount || !payableAccount) {
        console.log(`    ⚠️  Missing required accounts for expense ${expense.expenseId}`);
        return null;
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
    
    return {
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
        createdBy: 'system@fix.com',
        status: 'posted'
    };
}

async function verifyFixes() {
    console.log('🔍 6. VERIFYING FIXES');
    console.log('----------------------');
    
    // Check orphaned entries
    const orphanedEntries = await TransactionEntry.find({
        $or: [
            { transaction: { $exists: false } },
            { transaction: null },
            { transaction: { $nin: await Transaction.distinct('_id') } }
        ]
    });
    
    if (orphanedEntries.length === 0) {
        console.log('✅ No orphaned transaction entries');
    } else {
        console.log(`❌ Still have ${orphanedEntries.length} orphaned entries`);
    }
    
    // Check missing account references
    const missingAccountEntries = await TransactionEntry.find({
        $or: [
            { account: { $exists: false } },
            { account: null },
            { account: { $nin: await Account.distinct('_id') } }
        ]
    });
    
    if (missingAccountEntries.length === 0) {
        console.log('✅ No missing account references');
    } else {
        console.log(`❌ Still have ${missingAccountEntries.length} missing account references`);
    }
    
    // Check duplicate references
    const duplicateRefs = await Transaction.aggregate([
        { $group: { _id: '$reference', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
    ]);
    
    if (duplicateRefs.length === 0) {
        console.log('✅ No duplicate transaction references');
    } else {
        console.log(`❌ Still have ${duplicateRefs.length} duplicate references`);
    }
    
    // Check payment transactions
    const payments = await Payment.find({});
    let paymentTransactionsFixed = 0;
    
    for (const payment of payments) {
        const transaction = await Transaction.findOne({ reference: payment.paymentId });
        if (transaction) {
            const entries = await TransactionEntry.find({ transaction: transaction._id });
            if (entries.length > 0) {
                paymentTransactionsFixed++;
            }
        }
    }
    
    console.log(`✅ ${paymentTransactionsFixed}/${payments.length} payments have proper transactions`);
    
    // Check expense transactions
    const expenses = await Expense.find({});
    let expenseTransactionsFixed = 0;
    
    for (const expense of expenses) {
        const transaction = await Transaction.findOne({ 
            description: { $regex: expense.expenseId, $options: 'i' } 
        });
        if (transaction) {
            expenseTransactionsFixed++;
        }
    }
    
    console.log(`✅ ${expenseTransactionsFixed}/${expenses.length} expenses have proper transactions`);
    
    console.log('');
}

// Run the fixes
console.log('🚀 Starting Accounting Fixes...'); 