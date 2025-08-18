const mongoose = require('mongoose');
require('dotenv').config();

// Database connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
};

// Check existing users
const checkUsers = async () => {
    try {
        const User = require('./src/models/User');
        const users = await User.find({}).select('email role -_id');
        
        console.log('\n📋 Existing Users:');
        console.log('==================');
        
        if (users.length === 0) {
            console.log('❌ No users found in database');
        } else {
            users.forEach((user, index) => {
                console.log(`${index + 1}. ${user.email} (${user.role})`);
            });
        }
        
        return users;
    } catch (error) {
        console.error('❌ Error checking users:', error.message);
        return [];
    }
};

// Check existing maintenance requests
const checkMaintenanceRequests = async () => {
    try {
        const Maintenance = require('./src/models/Maintenance');
        const requests = await Maintenance.find({}).select('issue status financeStatus -_id');
        
        console.log('\n🔧 Existing Maintenance Requests:');
        console.log('==================================');
        
        if (requests.length === 0) {
            console.log('❌ No maintenance requests found');
        } else {
            requests.forEach((req, index) => {
                console.log(`${index + 1}. ${req.issue} - Status: ${req.status} - Finance: ${req.financeStatus}`);
            });
        }
        
        return requests;
    } catch (error) {
        console.error('❌ Error checking maintenance requests:', error.message);
        return [];
    }
};

// Check existing expenses
const checkExpenses = async () => {
    try {
        const Expense = require('./src/models/finance/Expense');
        const expenses = await Expense.find({}).select('expenseId description amount category -_id');
        
        console.log('\n💰 Existing Expenses:');
        console.log('====================');
        
        if (expenses.length === 0) {
            console.log('❌ No expenses found');
        } else {
            expenses.forEach((exp, index) => {
                console.log(`${index + 1}. ${exp.expenseId} - ${exp.description} - $${exp.amount} (${exp.category})`);
            });
        }
        
        return expenses;
    } catch (error) {
        console.error('❌ Error checking expenses:', error.message);
        return [];
    }
};

// Check existing transactions
const checkTransactions = async () => {
    try {
        const Transaction = require('./src/models/finance/Transaction');
        const transactions = await Transaction.find({}).select('transactionId description amount type -_id');
        
        console.log('\n💳 Existing Transactions:');
        console.log('=========================');
        
        if (transactions.length === 0) {
            console.log('❌ No transactions found');
        } else {
            transactions.forEach((txn, index) => {
                console.log(`${index + 1}. ${txn.transactionId} - ${txn.description} - $${txn.amount} (${txn.type})`);
            });
        }
        
        return transactions;
    } catch (error) {
        console.error('❌ Error checking transactions:', error.message);
        return [];
    }
};

// Main function
const runQuickCheck = async () => {
    console.log('🚀 Quick Database Check');
    console.log('=======================');
    
    try {
        // Connect to database
        await connectDB();
        
        // Check users
        const users = await checkUsers();
        
        // Check maintenance requests
        const maintenanceRequests = await checkMaintenanceRequests();
        
        // Check expenses
        const expenses = await checkExpenses();
        
        // Check transactions
        const transactions = await checkTransactions();
        
        console.log('\n📊 Summary:');
        console.log('===========');
        console.log(`   - Users: ${users.length}`);
        console.log(`   - Maintenance Requests: ${maintenanceRequests.length}`);
        console.log(`   - Expenses: ${expenses.length}`);
        console.log(`   - Transactions: ${transactions.length}`);
        
        if (users.length === 0) {
            console.log('\n💡 Next Steps:');
            console.log('==============');
            console.log('1. Create test users in the database');
            console.log('2. Or use the frontend to register new users');
            console.log('3. Then test the maintenance workflow manually');
        }
        
        console.log('\n✅ Database check completed!');
        
    } catch (error) {
        console.error('❌ Database check failed:', error.message);
    } finally {
        mongoose.connection.close();
    }
};

// Run the check
if (require.main === module) {
    runQuickCheck()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Quick check failed:', error.message);
            process.exit(1);
        });
}

module.exports = {
    runQuickCheck
}; 