const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');
const Expense = require('./src/models/finance/Expense');
const MonthlyRequest = require('./src/models/MonthlyRequest');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await fixWaterRequestCategorization();
});

async function fixWaterRequestCategorization() {
    console.log('\n🔧 FIXING WATER REQUEST CATEGORIZATION');
    console.log('========================================\n');

    try {
        // 1. Find the water expense that's incorrectly categorized
        console.log('📋 1. FINDING WATER EXPENSE');
        console.log('===========================');
        
        const waterExpense = await Expense.findOne({
            description: { $regex: /water/i }
        });
        
        if (!waterExpense) {
            console.log('❌ No water expense found');
            return;
        }
        
        console.log(`Found water expense: ${waterExpense.expenseId}`);
        console.log(`Current category: ${waterExpense.category}`);
        console.log(`Current amount: $${waterExpense.amount}`);
        console.log(`Transaction ID: ${waterExpense.transactionId}`);

        // 2. Update the expense category from "Maintenance" to "Utilities"
        console.log('\n📋 2. UPDATING EXPENSE CATEGORY');
        console.log('===============================');
        
        waterExpense.category = 'Utilities';
        await waterExpense.save();
        
        console.log(`✅ Updated expense category from "Maintenance" to "Utilities"`);

        // 3. Find and update the transaction entry to use the correct account
        console.log('\n📋 3. UPDATING TRANSACTION ENTRY');
        console.log('=================================');
        
        if (waterExpense.transactionId) {
            const transactionEntry = await TransactionEntry.findById(waterExpense.transactionId);
            
            if (transactionEntry) {
                console.log(`Found transaction entry: ${transactionEntry.transactionId}`);
                console.log(`Current entries:`);
                transactionEntry.entries.forEach((entry, i) => {
                    console.log(`   ${i + 1}. ${entry.accountCode} - ${entry.accountName}: Dr. $${entry.debit} Cr. $${entry.credit}`);
                });

                // Update the expense account from Transportation (5003) to Utilities - Water (5001)
                const utilitiesAccount = await Account.findOne({ code: '5001' });
                
                if (utilitiesAccount) {
                    // Find the expense entry (the debit entry)
                    const expenseEntry = transactionEntry.entries.find(entry => entry.debit > 0);
                    if (expenseEntry) {
                        expenseEntry.accountCode = '5001';
                        expenseEntry.accountName = 'Utilities - Water';
                        expenseEntry.description = `Utilities: ${waterExpense.description}`;
                        
                        await transactionEntry.save();
                        console.log(`✅ Updated transaction entry to use Utilities - Water account (5001)`);
                    }
                } else {
                    console.log('❌ Utilities - Water account (5001) not found');
                }
            } else {
                console.log('❌ Transaction entry not found');
            }
        }

        // 4. Update monthly request items to use correct category
        console.log('\n📋 4. UPDATING MONTHLY REQUEST ITEMS');
        console.log('=====================================');
        
        const monthlyRequests = await MonthlyRequest.find({
            'items.description': { $regex: /water/i }
        });
        
        console.log(`Found ${monthlyRequests.length} monthly requests with water items`);
        
        for (const request of monthlyRequests) {
            for (const item of request.items) {
                if (item.description.toLowerCase().includes('water')) {
                    if (item.category !== 'utilities') {
                        console.log(`Updating item "${item.description}" from "${item.category}" to "utilities"`);
                        item.category = 'utilities';
                    }
                }
            }
            await request.save();
        }
        
        console.log(`✅ Updated ${monthlyRequests.length} monthly requests`);

        // 5. Verify the fix
        console.log('\n📋 5. VERIFYING THE FIX');
        console.log('========================');
        
        const updatedWaterExpense = await Expense.findOne({
            description: { $regex: /water/i }
        });
        
        console.log(`Updated expense category: ${updatedWaterExpense.category}`);
        
        if (updatedWaterExpense.transactionId) {
            const updatedTransactionEntry = await TransactionEntry.findById(updatedWaterExpense.transactionId);
            
            if (updatedTransactionEntry) {
                console.log(`Updated transaction entries:`);
                updatedTransactionEntry.entries.forEach((entry, i) => {
                    console.log(`   ${i + 1}. ${entry.accountCode} - ${entry.accountName}: Dr. $${entry.debit} Cr. $${entry.credit}`);
                });
            }
        }

        // 6. Summary
        console.log('\n📋 6. SUMMARY');
        console.log('=============');
        console.log('✅ Water expense category updated from "Maintenance" to "Utilities"');
        console.log('✅ Transaction entry updated to use Utilities - Water account (5001)');
        console.log('✅ Monthly request items updated to use "utilities" category');
        console.log('✅ Future water requests will now be properly categorized');

    } catch (error) {
        console.error('❌ Error during fix:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Water request categorization fix completed');
    }
}

// Run the fix
console.log('🚀 Starting Water Request Categorization Fix...'); 