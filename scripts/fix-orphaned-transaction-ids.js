const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');
const Expense = require('../src/models/finance/Expense');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await fixOrphanedTransactionIds();
});

async function fixOrphanedTransactionIds() {
    console.log('\n🔧 FIXING ORPHANED TRANSACTION IDs');
    console.log('===================================\n');

    try {
        // 1. Find maintenance expenses with orphaned transaction IDs
        console.log('📋 1. FINDING ORPHANED TRANSACTION IDs');
        console.log('=======================================');
        
        const expenses = await Expense.find({
            category: { $in: ['Maintenance', 'maintenance'] }
        });
        
        console.log(`Total maintenance expenses: ${expenses.length}`);
        
        let orphanedExpenses = [];
        
        for (const expense of expenses) {
            if (expense.transactionId) {
                // Check if the transaction actually exists
                const transactionExists = await TransactionEntry.findById(expense.transactionId);
                if (!transactionExists) {
                    orphanedExpenses.push(expense);
                    console.log(`❌ Orphaned transaction ID found: ${expense.expenseId} -> ${expense.transactionId}`);
                }
            }
        }
        
        console.log(`\n📊 ORPHANED TRANSACTION SUMMARY:`);
        console.log(`   Total expenses: ${expenses.length}`);
        console.log(`   Orphaned expenses: ${orphanedExpenses.length}`);
        
        if (orphanedExpenses.length === 0) {
            console.log('✅ No orphaned transaction IDs found!');
            return;
        }

        // 2. Create proper transaction entries for orphaned expenses
        console.log('\n📋 2. CREATING PROPER TRANSACTION ENTRIES');
        console.log('==========================================');
        
        let createdTransactions = 0;
        let errors = [];
        
        for (const expense of orphanedExpenses) {
            try {
                console.log(`\n🔧 Creating transaction for: ${expense.expenseId}`);
                console.log(`   Amount: $${expense.amount}`);
                console.log(`   Description: ${expense.description}`);
                
                // Create transaction entry
                const transactionId = await generateTransactionId();
                
                // Get account codes
                const maintenanceExpenseCode = await getMaintenanceExpenseAccount();
                const cashAccountCode = await getPaymentSourceAccount('Cash');
                
                const entries = [
                    {
                        accountCode: maintenanceExpenseCode,
                        accountName: 'Maintenance Expense',
                        accountType: 'Expense',
                        debit: expense.amount,
                        credit: 0,
                        description: `Maintenance: ${expense.description}`
                    },
                    {
                        accountCode: cashAccountCode,
                        accountName: 'Cash',
                        accountType: 'Asset',
                        debit: 0,
                        credit: expense.amount,
                        description: `Cash payment for ${expense.description}`
                    }
                ];
                
                const transactionEntry = new TransactionEntry({
                    transactionId: transactionId,
                    date: expense.expenseDate || new Date(),
                    description: `Maintenance expense: ${expense.title || expense.description}`,
                    reference: expense._id.toString(),
                    entries: entries,
                    totalDebit: expense.amount,
                    totalCredit: expense.amount,
                    source: 'expense_payment',
                    sourceId: expense._id,
                    sourceModel: 'Expense',
                    residence: expense.residence,
                    createdBy: expense.createdBy ? 'system@alamait.com' : 'finance@alamait.com',
                    status: 'posted',
                    metadata: {
                        requestType: 'maintenance',
                        vendorName: 'Cash Payment',
                        itemCount: 1,
                        isNonVendorItem: true,
                        isOrphanedFix: true
                    }
                });
                
                await transactionEntry.save();
                
                // Update expense with correct transaction ID
                expense.transactionId = transactionEntry._id;
                await expense.save();
                
                createdTransactions++;
                console.log(`   ✅ Transaction created: ${transactionId}`);
                
            } catch (error) {
                console.error(`   ❌ Error creating transaction for ${expense.expenseId}:`, error.message);
                errors.push({
                    expenseId: expense.expenseId,
                    error: error.message
                });
            }
        }
        
        console.log(`\n📊 TRANSACTION CREATION SUMMARY:`);
        console.log(`   Created transactions: ${createdTransactions}`);
        console.log(`   Errors: ${errors.length}`);
        
        if (errors.length > 0) {
            console.log('\n❌ ERRORS:');
            errors.forEach(error => {
                console.log(`   - ${error.expenseId}: ${error.error}`);
            });
        }

        // 3. Verify the fix
        console.log('\n📋 3. VERIFYING THE FIX');
        console.log('=========================');
        
        const updatedExpenses = await Expense.find({
            category: { $in: ['Maintenance', 'maintenance'] }
        });
        
        let validTransactions = 0;
        let stillOrphaned = 0;
        let totalAmount = 0;
        
        for (const expense of updatedExpenses) {
            totalAmount += expense.amount || 0;
            if (expense.transactionId) {
                const transactionExists = await TransactionEntry.findById(expense.transactionId);
                if (transactionExists) {
                    validTransactions++;
                } else {
                    stillOrphaned++;
                }
            } else {
                stillOrphaned++;
            }
        }
        
        console.log(`Total expenses: ${updatedExpenses.length}`);
        console.log(`Valid transactions: ${validTransactions}`);
        console.log(`Still orphaned: ${stillOrphaned}`);
        console.log(`Total amount: $${totalAmount.toFixed(2)}`);
        
        // Check transaction entries
        const transactionEntries = await TransactionEntry.find({
            source: 'expense_payment',
            'metadata.requestType': 'maintenance'
        });
        
        let totalTransactionAmount = 0;
        transactionEntries.forEach(entry => {
            const debitTotal = entry.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
            totalTransactionAmount += debitTotal;
        });
        
        console.log(`Total transaction entries: ${transactionEntries.length}`);
        console.log(`Total transaction amount: $${totalTransactionAmount.toFixed(2)}`);
        
        const difference = totalAmount - totalTransactionAmount;
        console.log(`Difference: $${difference.toFixed(2)}`);
        
        if (Math.abs(difference) < 0.01 && stillOrphaned === 0) {
            console.log('✅ SUCCESS: All orphaned transaction IDs fixed!');
        } else {
            console.log('❌ WARNING: Still have issues');
        }

    } catch (error) {
        console.error('❌ Error during fix:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Orphaned transaction IDs fix completed');
    }
}

// Helper functions
async function generateTransactionId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `TXN-${timestamp}-${random}`;
}

async function getMaintenanceExpenseAccount() {
    let account = await Account.findOne({ 
        accountCode: '5001',
        accountName: { $regex: /maintenance/i }
    });
    
    if (!account) {
        account = await Account.findOne({ 
            accountType: 'Expense',
            accountName: { $regex: /maintenance/i }
        });
    }
    
    return account ? account.accountCode : '5001';
}

async function getPaymentSourceAccount(paymentMethod) {
    let accountCode = '1000'; // Default to bank
    
    if (paymentMethod === 'Cash') {
        accountCode = '1015'; // Cash account
    } else if (paymentMethod === 'Bank Transfer') {
        accountCode = '1000'; // Bank account
    }
    
    return accountCode;
}

// Run the fix
console.log('🚀 Starting Orphaned Transaction IDs Fix...'); 