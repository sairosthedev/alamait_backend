const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');
const Expense = require('../src/models/finance/Expense');
const MonthlyRequest = require('../src/models/MonthlyRequest');
const Request = require('../src/models/Request');
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
    await fixMixedVendorRequests();
});

async function fixMixedVendorRequests() {
    console.log('\n🔧 FIXING MIXED VENDOR REQUESTS');
    console.log('================================\n');

    try {
        // 1. First, let's check what we need to fix
        console.log('📋 1. ANALYZING CURRENT STATE');
        console.log('==============================');
        
        const expenses = await Expense.find({
            category: { $in: ['Maintenance', 'maintenance'] }
        });
        
        console.log(`Total maintenance expenses: ${expenses.length}`);
        
        let expensesWithoutTransactions = 0;
        let totalMissingAmount = 0;
        
        expenses.forEach(expense => {
            if (!expense.transactionId) {
                expensesWithoutTransactions++;
                totalMissingAmount += expense.amount || 0;
            }
        });
        
        console.log(`Expenses without transactions: ${expensesWithoutTransactions}`);
        console.log(`Total missing amount: $${totalMissingAmount.toFixed(2)}`);
        
        if (expensesWithoutTransactions === 0) {
            console.log('✅ All expenses already have transactions!');
            return;
        }

        // 2. Create missing transactions for expenses without transactions
        console.log('\n📋 2. CREATING MISSING TRANSACTIONS');
        console.log('====================================');
        
        let createdTransactions = 0;
        let errors = [];
        
        for (const expense of expenses) {
            if (!expense.transactionId) {
                try {
                    console.log(`\n🔧 Creating transaction for expense: ${expense.expenseId}`);
                    console.log(`   Amount: $${expense.amount}`);
                    console.log(`   Description: ${expense.description}`);
                    
                    // Create a mock request object for the transaction
                    const mockRequest = {
                        _id: expense.requestId || expense._id,
                        title: expense.title,
                        residence: expense.residence,
                        items: [{
                            description: expense.description,
                            estimatedCost: expense.amount,
                            quotations: [] // No quotations = no vendor
                        }],
                        paymentMethod: expense.paymentMethod || 'Cash',
                        totalEstimatedCost: expense.amount
                    };
                    
                    // Create transaction entry manually
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
                        description: `Maintenance expense: ${expense.title}`,
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
                            isNonVendorItem: true
                        }
                    });
                    
                    await transactionEntry.save();
                    
                    // Update expense with transaction ID
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
        
        let expensesWithTransactions = 0;
        let expensesWithoutTransactionsAfter = 0;
        let totalAmount = 0;
        
        updatedExpenses.forEach(expense => {
            totalAmount += expense.amount || 0;
            if (expense.transactionId) {
                expensesWithTransactions++;
            } else {
                expensesWithoutTransactionsAfter++;
            }
        });
        
        console.log(`Total expenses: ${updatedExpenses.length}`);
        console.log(`Expenses with transactions: ${expensesWithTransactions}`);
        console.log(`Expenses without transactions: ${expensesWithoutTransactionsAfter}`);
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
        
        if (Math.abs(difference) < 0.01) {
            console.log('✅ SUCCESS: All expenses now have matching transactions!');
        } else {
            console.log('❌ WARNING: Still have a mismatch');
        }

    } catch (error) {
        console.error('❌ Error during fix:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Mixed vendor requests fix completed');
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
console.log('🚀 Starting Mixed Vendor Requests Fix...'); 