const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');
const Expense = require('./src/models/finance/Expense');
const Request = require('./src/models/Request');
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
    await analyzeWaterRequestAccount();
});

async function analyzeWaterRequestAccount() {
    console.log('\n🔍 ANALYZING WATER REQUEST ACCOUNT MAPPING');
    console.log('===========================================\n');

    try {
        // 1. Check all accounts to understand the structure
        console.log('📋 1. CHART OF ACCOUNTS ANALYSIS');
        console.log('=================================');
        
        const accounts = await Account.find({}).sort({ code: 1 });
        console.log(`Total accounts in system: ${accounts.length}`);
        
        console.log('\n📊 EXPENSE ACCOUNTS:');
        const expenseAccounts = accounts.filter(acc => acc.type === 'Expense');
        expenseAccounts.forEach(account => {
            console.log(`   ${account.code}: ${account.name} (${account.category})`);
        });

        // 2. Check water-related expenses
        console.log('\n📋 2. WATER-RELATED EXPENSES');
        console.log('=============================');
        
        const waterExpenses = await Expense.find({
            $or: [
                { description: { $regex: /water/i } },
                { title: { $regex: /water/i } },
                { category: { $regex: /water/i } }
            ]
        });
        
        console.log(`Total water-related expenses: ${waterExpenses.length}`);
        
        waterExpenses.forEach((expense, index) => {
            console.log(`\n${index + 1}. Water Expense:`);
            console.log(`   ID: ${expense._id}`);
            console.log(`   Expense ID: ${expense.expenseId}`);
            console.log(`   Title: ${expense.title}`);
            console.log(`   Description: ${expense.description}`);
            console.log(`   Category: ${expense.category}`);
            console.log(`   Amount: $${expense.amount}`);
            console.log(`   Transaction ID: ${expense.transactionId}`);
        });

        // 3. Check water-related requests
        console.log('\n📋 3. WATER-RELATED REQUESTS');
        console.log('=============================');
        
        const waterRequests = await Request.find({
            $or: [
                { title: { $regex: /water/i } },
                { 'items.description': { $regex: /water/i } }
            ]
        });
        
        console.log(`Total water-related requests: ${waterRequests.length}`);
        
        waterRequests.forEach((request, index) => {
            console.log(`\n${index + 1}. Water Request:`);
            console.log(`   ID: ${request._id}`);
            console.log(`   Title: ${request.title}`);
            console.log(`   Status: ${request.status}`);
            console.log(`   Finance Status: ${request.financeStatus}`);
            console.log(`   Items:`);
            request.items.forEach((item, i) => {
                console.log(`     ${i + 1}. ${item.description} - Category: ${item.category}`);
            });
        });

        // 4. Check water-related monthly requests
        console.log('\n📋 4. WATER-RELATED MONTHLY REQUESTS');
        console.log('=====================================');
        
        const waterMonthlyRequests = await MonthlyRequest.find({
            $or: [
                { title: { $regex: /water/i } },
                { 'items.description': { $regex: /water/i } }
            ]
        });
        
        console.log(`Total water-related monthly requests: ${waterMonthlyRequests.length}`);
        
        waterMonthlyRequests.forEach((request, index) => {
            console.log(`\n${index + 1}. Water Monthly Request:`);
            console.log(`   ID: ${request._id}`);
            console.log(`   Title: ${request.title}`);
            console.log(`   Status: ${request.status}`);
            console.log(`   Items:`);
            request.items.forEach((item, i) => {
                console.log(`     ${i + 1}. ${item.description} - Provider: ${item.provider || 'No provider'}`);
            });
        });

        // 5. Check transaction entries for water expenses
        console.log('\n📋 5. WATER EXPENSE TRANSACTION ENTRIES');
        console.log('========================================');
        
        const waterTransactionEntries = await TransactionEntry.find({
            $or: [
                { description: { $regex: /water/i } },
                { 'entries.description': { $regex: /water/i } }
            ]
        });
        
        console.log(`Total water-related transaction entries: ${waterTransactionEntries.length}`);
        
        waterTransactionEntries.forEach((entry, index) => {
            console.log(`\n${index + 1}. Water Transaction Entry:`);
            console.log(`   ID: ${entry._id}`);
            console.log(`   Transaction ID: ${entry.transactionId}`);
            console.log(`   Description: ${entry.description}`);
            console.log(`   Source: ${entry.source}`);
            console.log(`   Source Model: ${entry.sourceModel}`);
            console.log(`   Total Debit: $${entry.totalDebit}`);
            console.log(`   Total Credit: $${entry.totalCredit}`);
            console.log(`   Entries:`);
            entry.entries.forEach((e, i) => {
                console.log(`     ${i + 1}. ${e.accountCode} - ${e.accountName}: Dr. $${e.debit} Cr. $${e.credit}`);
            });
        });

        // 6. Analyze the account mapping issue
        console.log('\n📋 6. ACCOUNT MAPPING ANALYSIS');
        console.log('==============================');
        
        console.log('\n🔍 CURRENT ACCOUNT MAPPINGS:');
        console.log('============================');
        
        const currentMappings = {
            'Maintenance': '5003', // Transportation Expense (for maintenance)
            'Utilities': '5099',   // Other Operating Expenses (for utilities)
            'Taxes': '5099',       // Other Operating Expenses (for taxes)
            'Insurance': '5099',   // Other Operating Expenses (for insurance)
            'Salaries': '5099',    // Other Operating Expenses (for salaries)
            'Supplies': '5099',    // Other Operating Expenses (for supplies)
            'Other': '5099'        // Other Operating Expenses (fallback)
        };
        
        Object.entries(currentMappings).forEach(([category, accountCode]) => {
            const account = accounts.find(acc => acc.code === accountCode);
            console.log(`   ${category} → ${accountCode} (${account ? account.name : 'NOT FOUND'})`);
        });

        console.log('\n🔍 PROBLEM IDENTIFIED:');
        console.log('=====================');
        console.log('❌ ISSUE: Water requests are being categorized as "Maintenance" instead of "Utilities"');
        console.log('❌ RESULT: Water expenses get mapped to Transportation Expense (5003) instead of Utilities');
        console.log('❌ EXPECTED: Water should be mapped to Utilities account (5099)');

        console.log('\n💡 SOLUTION:');
        console.log('============');
        console.log('1. Update request categorization logic to properly identify water as "Utilities"');
        console.log('2. Add specific water category mapping');
        console.log('3. Update expense creation logic to use correct category');

        // 7. Check if there are specific water accounts
        console.log('\n📋 7. WATER-SPECIFIC ACCOUNTS');
        console.log('=============================');
        
        const waterAccounts = accounts.filter(acc => 
            acc.name.toLowerCase().includes('water') || 
            acc.code.toLowerCase().includes('water')
        );
        
        if (waterAccounts.length > 0) {
            console.log(`Found ${waterAccounts.length} water-specific accounts:`);
            waterAccounts.forEach(account => {
                console.log(`   ${account.code}: ${account.name} (${account.type})`);
            });
        } else {
            console.log('❌ No water-specific accounts found in chart of accounts');
        }

    } catch (error) {
        console.error('❌ Error during analysis:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Water request account analysis completed');
    }
}

// Run the analysis
console.log('🚀 Starting Water Request Account Analysis...'); 