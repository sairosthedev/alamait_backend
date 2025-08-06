require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');
const Expense = require('./src/models/finance/Expense');
const Account = require('./src/models/Account');

// The three expense objects provided by the user
const expenses = [
    {
        _id: "68931af439a684f33cfca577",
        expenseId: "EXP_MDZQTSCQ_JDX1X_item_0",
        residence: "67d723cf20f89c4ae69804f3",
        category: "Maintenance",
        amount: 200,
        description: "Water requests",
        expenseDate: "2025-08-01T00:00:00.000+00:00",
        paymentStatus: "Pending",
        period: "monthly",
        paymentMethod: "Bank Transfer",
        createdBy: "67f4ef0fcb87ffa3fb7e2d73",
        itemIndex: 0
    },
    {
        _id: "68931af439a684f33cfca579",
        expenseId: "EXP_MDZQTSCQ_JDX1X_item_1",
        residence: "67d723cf20f89c4ae69804f3",
        category: "Maintenance",
        amount: 90,
        description: "Gas requests",
        expenseDate: "2025-08-01T00:00:00.000+00:00",
        paymentStatus: "Pending",
        period: "monthly",
        paymentMethod: "Bank Transfer",
        createdBy: "67f4ef0fcb87ffa3fb7e2d73",
        itemIndex: 1
    },
    {
        _id: "68931af439a684f33cfca57b",
        expenseId: "EXP_MDZQTSCQ_JDX1X_item_2",
        residence: "67d723cf20f89c4ae69804f3",
        category: "Maintenance",
        amount: 450,
        description: "Security requests",
        expenseDate: "2025-08-01T00:00:00.000+00:00",
        paymentStatus: "Pending",
        period: "monthly",
        paymentMethod: "Bank Transfer",
        createdBy: "67f4ef0fcb87ffa3fb7e2d73",
        itemIndex: 2
    }
];

/**
 * Create Double-Entry Transactions for Expenses
 * This script uses the same database connection as the main application
 */
async function createDoubleEntryForExpenses() {
    try {
        console.log('🔗 Connecting to database using environment variables...');
        
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            console.log('💡 Please make sure you have a .env file with MONGODB_URI');
            return;
        }

        console.log('Connection URI:', process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@'));

        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 5,
            retryWrites: true,
            retryReads: true
        });

        console.log('✅ Connected to database');
        console.log('Database name:', mongoose.connection.name);

        // Get account codes for double-entry
        const accounts = await Account.find({});
        const accountMap = {};
        accounts.forEach(account => {
            accountMap[account.accountName] = account;
        });

        console.log('📊 Found accounts:', Object.keys(accountMap));

        // Process each expense
        for (const expenseData of expenses) {
            console.log(`\n🔄 Processing expense: ${expenseData.expenseId}`);
            
            try {
                // Check if expense exists
                const existingExpense = await Expense.findById(expenseData._id);
                if (!existingExpense) {
                    console.log(`❌ Expense ${expenseData.expenseId} not found in database`);
                    console.log(`   Looking for ID: ${expenseData._id}`);
                    
                    // Try to find by expenseId instead
                    const expenseByExpenseId = await Expense.findOne({ expenseId: expenseData.expenseId });
                    if (expenseByExpenseId) {
                        console.log(`✅ Found expense by expenseId: ${expenseByExpenseId._id}`);
                        console.log(`   Will use this expense instead`);
                        // Update the expense data to use the found expense
                        expenseData._id = expenseByExpenseId._id;
                        expenseData.amount = expenseByExpenseId.amount;
                        expenseData.description = expenseByExpenseId.description;
                    } else {
                        console.log(`❌ Expense not found by expenseId either`);
                        continue;
                    }
                } else {
                    console.log(`✅ Found expense in database`);
                }

                // Check if transaction already exists
                if (existingExpense?.transactionId) {
                    console.log(`⚠️  Expense ${expenseData.expenseId} already has transaction: ${existingExpense.transactionId}`);
                    continue;
                }

                // Create transaction ID
                const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

                // Create transaction
                const transaction = new Transaction({
                    transactionId: transactionId,
                    date: new Date(expenseData.expenseDate),
                    description: `Maintenance Expense Approval - ${expenseData.description}`,
                    reference: expenseData.expenseId,
                    totalDebit: expenseData.amount,
                    totalCredit: expenseData.amount,
                    source: 'maintenance_approval',
                    sourceId: expenseData._id,
                    sourceModel: 'Expense',
                    createdBy: expenseData.createdBy,
                    status: 'posted',
                    residence: expenseData.residence, // Add the required residence field
                    metadata: {
                        expenseId: expenseData.expenseId,
                        category: expenseData.category,
                        residence: expenseData.residence,
                        period: expenseData.period,
                        itemIndex: expenseData.itemIndex
                    }
                });

                await transaction.save();
                console.log(`✅ Created transaction: ${transactionId}`);

                // Create transaction entries for double-entry
                const entries = [];

                // Entry 1: Debit Maintenance Expense (increase expense)
                const maintenanceExpenseAccount = accountMap['Maintenance Expense'] || accountMap['Expenses'];
                if (!maintenanceExpenseAccount) {
                    throw new Error('Maintenance Expense account not found');
                }

                entries.push(new TransactionEntry({
                    transactionId: transaction._id,
                    accountCode: maintenanceExpenseAccount.accountCode,
                    accountName: maintenanceExpenseAccount.accountName,
                    accountType: maintenanceExpenseAccount.accountType,
                    debit: expenseData.amount,
                    credit: 0,
                    description: `Maintenance expense: ${expenseData.description}`,
                    reference: expenseData.expenseId
                }));

                // Entry 2: Credit Accounts Payable (increase liability)
                const accountsPayableAccount = accountMap['Accounts Payable'];
                if (!accountsPayableAccount) {
                    throw new Error('Accounts Payable account not found');
                }

                entries.push(new TransactionEntry({
                    transactionId: transaction._id,
                    accountCode: accountsPayableAccount.accountCode,
                    accountName: accountsPayableAccount.accountName,
                    accountType: accountsPayableAccount.accountType,
                    debit: 0,
                    credit: expenseData.amount,
                    description: `Liability created for: ${expenseData.description}`,
                    reference: expenseData.expenseId
                }));

                // Save all entries
                await TransactionEntry.insertMany(entries);
                console.log(`✅ Created ${entries.length} transaction entries`);

                // Link transaction to expense
                const expenseToUpdate = existingExpense || await Expense.findById(expenseData._id);
                if (expenseToUpdate) {
                    expenseToUpdate.transactionId = transaction._id;
                    await expenseToUpdate.save();
                    console.log(`✅ Linked transaction to expense`);
                }

                console.log(`🎯 Successfully processed ${expenseData.expenseId} - Amount: $${expenseData.amount}`);

            } catch (error) {
                console.error(`❌ Error processing expense ${expenseData.expenseId}:`, error.message);
            }
        }

        console.log('\n📋 Summary:');
        console.log('✅ Double-entry transactions created for expenses');
        console.log('✅ Each expense now has proper accounting entries:');
        console.log('   - Debit: Maintenance Expense (increases expense)');
        console.log('   - Credit: Accounts Payable (increases liability)');
        console.log('✅ Expenses are now properly linked to their transactions');

    } catch (error) {
        console.error('❌ Script error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

// Run the script
if (require.main === module) {
    createDoubleEntryForExpenses()
        .then(() => {
            console.log('\n🎉 Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Script failed:', error);
            process.exit(1);
        });
}

module.exports = { createDoubleEntryForExpenses }; 