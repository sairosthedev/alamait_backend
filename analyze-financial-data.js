// Set environment variable for MongoDB URI
process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');

async function analyzeFinancialData() {
    try {
        console.log('📊 Analyzing Your Financial Data...');
        console.log('=====================================');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000
        });
        
        console.log('✅ Connected to MongoDB');
        
        // Load models
        const Account = require('./src/models/Account');
        const Transaction = require('./src/models/Transaction');
        const TransactionEntry = require('./src/models/TransactionEntry');
        const Payment = require('./src/models/Payment');
        const Expense = require('./src/models/finance/Expense');
        const Vendor = require('./src/models/Vendor');
        const User = require('./src/models/User');
        
        console.log('📊 Models loaded successfully\n');
        
        // 1. EXPENSES ANALYSIS
        console.log('💰 EXPENSES ANALYSIS');
        console.log('===================');
        
        // Get all expenses
        const expenses = await Expense.find({});
        console.log(`Total Expenses Found: ${expenses.length}`);
        
        let totalExpenses = 0;
        let expensesByCategory = {};
        let expensesByVendor = {};
        
        expenses.forEach(expense => {
            const amount = expense.amount || 0;
            totalExpenses += amount;
            
            // Categorize by type
            const category = expense.category || expense.type || 'Uncategorized';
            expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
            
            // Categorize by vendor
            const vendor = expense.vendor || expense.supplier || 'Unknown Vendor';
            expensesByVendor[vendor] = (expensesByVendor[vendor] || 0) + amount;
        });
        
        console.log(`\n📈 Total Expenses Amount: $${totalExpenses.toFixed(2)}`);
        
        console.log('\n📋 Expenses by Category:');
        Object.entries(expensesByCategory)
            .sort(([,a], [,b]) => b - a)
            .forEach(([category, amount]) => {
                console.log(`  - ${category}: $${amount.toFixed(2)}`);
            });
        
        console.log('\n🏢 Top 5 Expenses by Vendor:');
        Object.entries(expensesByVendor)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .forEach(([vendor, amount]) => {
                console.log(`  - ${vendor}: $${amount.toFixed(2)}`);
            });
        
        // 2. INCOME ANALYSIS
        console.log('\n\n💵 INCOME ANALYSIS');
        console.log('==================');
        
        // Get all payments (student rent payments)
        const payments = await Payment.find({});
        console.log(`Total Payments Found: ${payments.length}`);
        
        let totalIncome = 0;
        let incomeByMethod = {};
        let incomeByStudent = {};
        
        payments.forEach(payment => {
            const amount = payment.amount || 0;
            totalIncome += amount;
            
            // Categorize by payment method
            const method = payment.paymentMethod || 'Unknown Method';
            incomeByMethod[method] = (incomeByMethod[method] || 0) + amount;
            
            // Categorize by student
            const student = payment.studentName || payment.studentId || 'Unknown Student';
            incomeByStudent[student] = (incomeByStudent[student] || 0) + amount;
        });
        
        console.log(`\n📈 Total Income Amount: $${totalIncome.toFixed(2)}`);
        
        console.log('\n💳 Income by Payment Method:');
        Object.entries(incomeByMethod)
            .sort(([,a], [,b]) => b - a)
            .forEach(([method, amount]) => {
                console.log(`  - ${method}: $${amount.toFixed(2)}`);
            });
        
        console.log('\n👥 Top 5 Income by Student:');
        Object.entries(incomeByStudent)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .forEach(([student, amount]) => {
                console.log(`  - ${student}: $${amount.toFixed(2)}`);
            });
        
        // 3. ACCOUNT BALANCES
        console.log('\n\n🏦 ACCOUNT BALANCES');
        console.log('===================');
        
        const accounts = await Account.find({});
        console.log(`Total Accounts: ${accounts.length}`);
        
        let accountBalances = {};
        let accountsByType = {};
        
        accounts.forEach(account => {
            const type = account.type || 'Unknown';
            accountsByType[type] = (accountsByType[type] || 0) + 1;
            
            // Get account balance from transactions
            accountBalances[account.name] = {
                code: account.code,
                type: account.type,
                balance: 0
            };
        });
        
        console.log('\n📊 Accounts by Type:');
        Object.entries(accountsByType).forEach(([type, count]) => {
            console.log(`  - ${type}: ${count} accounts`);
        });
        
        // 4. TRANSACTION ANALYSIS
        console.log('\n\n📝 TRANSACTION ANALYSIS');
        console.log('======================');
        
        const transactions = await Transaction.find({});
        console.log(`Total Transactions: ${transactions.length}`);
        
        const transactionEntries = await TransactionEntry.find({});
        console.log(`Total Transaction Entries: ${transactionEntries.length}`);
        
        let totalTransactionAmount = 0;
        let transactionsByType = {};
        
        transactions.forEach(transaction => {
            const amount = transaction.amount || 0;
            totalTransactionAmount += amount;
            
            const type = transaction.type || 'Unknown';
            transactionsByType[type] = (transactionsByType[type] || 0) + 1;
        });
        
        console.log(`\n📈 Total Transaction Amount: $${totalTransactionAmount.toFixed(2)}`);
        
        console.log('\n📋 Transactions by Type:');
        Object.entries(transactionsByType).forEach(([type, count]) => {
            console.log(`  - ${type}: ${count} transactions`);
        });
        
        // 5. VENDOR ANALYSIS
        console.log('\n\n🏢 VENDOR ANALYSIS');
        console.log('==================');
        
        const vendors = await Vendor.find({});
        console.log(`Total Vendors: ${vendors.length}`);
        
        console.log('\n📋 Vendor List:');
        vendors.forEach(vendor => {
            console.log(`  - ${vendor.name || vendor.vendorName}: ${vendor.category || 'No category'}`);
        });
        
        // 6. USER ANALYSIS
        console.log('\n\n👥 USER ANALYSIS');
        console.log('================');
        
        const users = await User.find({});
        console.log(`Total Users: ${users.length}`);
        
        let usersByRole = {};
        users.forEach(user => {
            const role = user.role || 'No role';
            usersByRole[role] = (usersByRole[role] || 0) + 1;
        });
        
        console.log('\n📊 Users by Role:');
        Object.entries(usersByRole).forEach(([role, count]) => {
            console.log(`  - ${role}: ${count} users`);
        });
        
        // 7. FINANCIAL SUMMARY
        console.log('\n\n📊 FINANCIAL SUMMARY');
        console.log('====================');
        
        const netIncome = totalIncome - totalExpenses;
        const profitMargin = totalIncome > 0 ? (netIncome / totalIncome * 100) : 0;
        
        console.log(`💰 Total Income: $${totalIncome.toFixed(2)}`);
        console.log(`💸 Total Expenses: $${totalExpenses.toFixed(2)}`);
        console.log(`📈 Net Income: $${netIncome.toFixed(2)}`);
        console.log(`📊 Profit Margin: ${profitMargin.toFixed(2)}%`);
        
        if (netIncome > 0) {
            console.log('✅ You are profitable!');
        } else {
            console.log('⚠️ You are operating at a loss');
        }
        
        // 8. RECENT ACTIVITY
        console.log('\n\n🕒 RECENT ACTIVITY');
        console.log('==================');
        
        const recentExpenses = await Expense.find({}).sort({ createdAt: -1 }).limit(5);
        console.log('\n📋 Recent Expenses:');
        recentExpenses.forEach(expense => {
            const date = new Date(expense.createdAt).toLocaleDateString();
            console.log(`  - ${date}: ${expense.description} - $${expense.amount}`);
        });
        
        const recentPayments = await Payment.find({}).sort({ createdAt: -1 }).limit(5);
        console.log('\n📋 Recent Payments:');
        recentPayments.forEach(payment => {
            const date = new Date(payment.createdAt).toLocaleDateString();
            console.log(`  - ${date}: ${payment.studentName || 'Student'} - $${payment.amount}`);
        });
        
        console.log('\n🎉 Financial Analysis Complete!');
        console.log('================================');
        
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('❌ Error disconnecting:', disconnectError.message);
        }
        
        process.exit(1);
    }
}

// Run the analysis
analyzeFinancialData(); 