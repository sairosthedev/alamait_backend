const mongoose = require('mongoose');

// Try different database URLs
const possibleUrls = [
    'mongodb://localhost:27017/alamait_backend',
    'mongodb://127.0.0.1:27017/alamait_backend',
    'mongodb://localhost:27017/alamait',
    'mongodb://127.0.0.1:27017/alamait'
];

/**
 * Diagnostic script to find expenses and create double-entry
 */
async function findAndFixExpenses() {
    let connected = false;
    
    for (const url of possibleUrls) {
        try {
            console.log(`🔗 Trying to connect to: ${url}`);
            await mongoose.connect(url);
            console.log(`✅ Successfully connected to: ${url}`);
            connected = true;
            break;
        } catch (error) {
            console.log(`❌ Failed to connect to: ${url}`);
        }
    }
    
    if (!connected) {
        console.log('❌ Could not connect to any database. Please check your MongoDB connection.');
        return;
    }

    try {
        // Try to find the Expense model
        let Expense;
        try {
            Expense = require('../src/models/finance/Expense');
        } catch (error) {
            console.log('❌ Could not load Expense model. Trying alternative path...');
            try {
                Expense = require('./src/models/Expense');
            } catch (error2) {
                console.log('❌ Could not load Expense model from any path');
                return;
            }
        }

        // Find all expenses to see what's in the database
        console.log('\n🔍 Searching for expenses in database...');
        const allExpenses = await Expense.find({}).limit(10);
        
        if (allExpenses.length === 0) {
            console.log('❌ No expenses found in database');
            return;
        }

        console.log(`✅ Found ${allExpenses.length} expenses in database:`);
        allExpenses.forEach((expense, index) => {
            console.log(`${index + 1}. ID: ${expense._id}`);
            console.log(`   Expense ID: ${expense.expenseId}`);
            console.log(`   Description: ${expense.description || 'N/A'}`);
            console.log(`   Amount: $${expense.amount}`);
            console.log(`   Category: ${expense.category}`);
            console.log(`   Transaction ID: ${expense.transactionId || 'None'}`);
            console.log('---');
        });

        // Look for expenses with similar IDs to what you provided
        console.log('\n🔍 Searching for expenses with similar IDs...');
        const searchIds = [
            '68931af439a684f33cfca577',
            '68931af439a684f33cfca579', 
            '68931af439a684f33cfca57b'
        ];

        for (const searchId of searchIds) {
            try {
                const expense = await Expense.findById(searchId);
                if (expense) {
                    console.log(`✅ Found expense with ID ${searchId}:`);
                    console.log(`   Expense ID: ${expense.expenseId}`);
                    console.log(`   Description: ${expense.description || 'N/A'}`);
                    console.log(`   Amount: $${expense.amount}`);
                    console.log(`   Transaction ID: ${expense.transactionId || 'None'}`);
                } else {
                    console.log(`❌ No expense found with ID: ${searchId}`);
                }
            } catch (error) {
                console.log(`❌ Error searching for ID ${searchId}: ${error.message}`);
            }
        }

        // Look for expenses with similar expense IDs
        console.log('\n🔍 Searching for expenses with similar expense IDs...');
        const searchExpenseIds = [
            'EXP_MDZQTSCQ_JDX1X_item_0',
            'EXP_MDZQTSCQ_JDX1X_item_1',
            'EXP_MDZQTSCQ_JDX1X_item_2'
        ];

        for (const searchExpenseId of searchExpenseIds) {
            const expenses = await Expense.find({ expenseId: searchExpenseId });
            if (expenses.length > 0) {
                console.log(`✅ Found expense with expense ID ${searchExpenseId}:`);
                expenses.forEach(expense => {
                    console.log(`   Database ID: ${expense._id}`);
                    console.log(`   Description: ${expense.description || 'N/A'}`);
                    console.log(`   Amount: $${expense.amount}`);
                    console.log(`   Transaction ID: ${expense.transactionId || 'None'}`);
                });
            } else {
                console.log(`❌ No expense found with expense ID: ${searchExpenseId}`);
            }
        }

        // Look for expenses without transaction IDs
        console.log('\n🔍 Searching for expenses without transaction IDs...');
        const expensesWithoutTransactions = await Expense.find({ 
            transactionId: { $exists: false } 
        }).limit(10);
        
        if (expensesWithoutTransactions.length > 0) {
            console.log(`✅ Found ${expensesWithoutTransactions.length} expenses without transaction IDs:`);
            expensesWithoutTransactions.forEach((expense, index) => {
                console.log(`${index + 1}. ID: ${expense._id}`);
                console.log(`   Expense ID: ${expense.expenseId}`);
                console.log(`   Description: ${expense.description || 'N/A'}`);
                console.log(`   Amount: $${expense.amount}`);
                console.log(`   Category: ${expense.category}`);
                console.log('---');
            });
        } else {
            console.log('✅ All expenses have transaction IDs');
        }

    } catch (error) {
        console.error('❌ Error during search:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

// Run the script
if (require.main === module) {
    findAndFixExpenses()
        .then(() => {
            console.log('\n🎉 Diagnostic completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Diagnostic failed:', error);
            process.exit(1);
        });
}

module.exports = { findAndFixExpenses }; 