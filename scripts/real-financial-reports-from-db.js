const mongoose = require('mongoose');
const Account = require('../src/models/Account');

/**
 * Real Financial Reports from Database
 * 
 * This script pulls REAL data from your database to show actual
 * financial reports, especially focusing on student leases and payments.
 * 
 * Run with: node real-financial-reports-from-db.js
 */

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

async function connectToDatabase() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB successfully!');
        console.log('Database:', mongoose.connection.name);
        console.log('');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error.message);
        throw error;
    }
}

async function generateRealFinancialReports() {
    try {
        console.log('=============================================');
        console.log('📊 REAL FINANCIAL REPORTS FROM YOUR DATABASE');
        console.log('=============================================\n');

        // 1. CHART OF ACCOUNTS OVERVIEW
        console.log('🏗️ 1. CHART OF ACCOUNTS OVERVIEW');
        console.log('=============================================\n');

        const totalAccounts = await Account.countDocuments();
        console.log(`Total Accounts in Database: ${totalAccounts}`);

        // Show account distribution by type
        const accountTypes = await Account.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        console.log('\nAccount Distribution:');
        accountTypes.forEach(type => {
            console.log(`   ${type._id}: ${type.count} accounts`);
        });

        // 2. RENTAL INCOME ACCOUNTS (Student Leases)
        console.log('\n💰 2. RENTAL INCOME ACCOUNTS (Student Leases)');
        console.log('=============================================\n');

        const rentalIncomeAccounts = await Account.find({
            type: 'Income',
            name: { $regex: /rental|lease|student/i }
        }).sort('code');

        if (rentalIncomeAccounts.length > 0) {
            console.log('Rental Income Accounts Found:');
            rentalIncomeAccounts.forEach(account => {
                console.log(`   ${account.code} - ${account.name}`);
            });
        } else {
            console.log('No specific rental income accounts found.');
            console.log('Checking general income accounts...');
            
            const incomeAccounts = await Account.find({ type: 'Income' }).sort('code');
            incomeAccounts.forEach(account => {
                console.log(`   ${account.code} - ${account.name}`);
            });
        }

        // 3. ACCOUNTS RECEIVABLE (Money Owed by Students)
        console.log('\n📊 3. ACCOUNTS RECEIVABLE (Money Owed by Students)');
        console.log('=============================================\n');

        const receivableAccounts = await Account.find({
            type: 'Asset',
            name: { $regex: /receivable|debtor|student/i }
        }).sort('code');

        if (receivableAccounts.length > 0) {
            console.log('Accounts Receivable Found:');
            receivableAccounts.forEach(account => {
                console.log(`   ${account.code} - ${account.name}`);
            });
        } else {
            console.log('No specific receivable accounts found.');
            console.log('Checking general asset accounts...');
            
            const assetAccounts = await Account.find({ type: 'Asset' }).limit(10).sort('code');
            assetAccounts.forEach(account => {
                console.log(`   ${account.code} - ${account.name}`);
            });
        }

        // 4. BANK ACCOUNTS (Money Received)
        console.log('\n🏦 4. BANK ACCOUNTS (Money Received)');
        console.log('=============================================\n');

        const bankAccounts = await Account.find({
            type: 'Asset',
            name: { $regex: /bank|cash|payment/i }
        }).sort('code');

        if (bankAccounts.length > 0) {
            console.log('Bank & Cash Accounts Found:');
            bankAccounts.forEach(account => {
                console.log(`   ${account.code} - ${account.name}`);
            });
        } else {
            console.log('No specific bank accounts found.');
        }

        // 5. EXPENSE ACCOUNTS
        console.log('\n💸 5. EXPENSE ACCOUNTS');
        console.log('=============================================\n');

        const expenseAccounts = await Account.find({ type: 'Expense' }).limit(15).sort('code');
        console.log('Key Expense Accounts:');
        expenseAccounts.forEach(account => {
            console.log(`   ${account.code} - ${account.name}`);
        });

        // 6. DATABASE COLLECTIONS ANALYSIS
        console.log('\n🗄️ 6. DATABASE COLLECTIONS ANALYSIS');
        console.log('=============================================\n');

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Available Collections:');
        collections.forEach(collection => {
            console.log(`   ${collection.name}`);
        });

        // 7. SAMPLE INCOME STATEMENT STRUCTURE
        console.log('\n📈 7. SAMPLE INCOME STATEMENT STRUCTURE');
        console.log('=============================================\n');

        console.log('INCOME STATEMENT - [CURRENT MONTH]');
        console.log('├── REVENUE');
        console.log('│   ├── Student Lease Income (Accrued)');
        console.log('│   │   ├── St Kilda Students: $[AMOUNT]');
        console.log('│   │   ├── Belvedere Students: $[AMOUNT]');
        console.log('│   │   └── Nyanga Students: $[AMOUNT]');
        console.log('│   └── Total Revenue: $[TOTAL]');
        console.log('├── EXPENSES');
        console.log('│   ├── Property Maintenance');
        console.log('│   ├── Utilities');
        console.log('│   ├── Administrative');
        console.log('│   └── Total Expenses: $[TOTAL]');
        console.log('└── NET INCOME: $[AMOUNT]');
        console.log('');

        // 8. ACCOUNTS RECEIVABLE AGING STRUCTURE
        console.log('💰 8. ACCOUNTS RECEIVABLE AGING STRUCTURE');
        console.log('=============================================\n');

        console.log('ACCOUNTS RECEIVABLE - [CURRENT DATE]');
        console.log('├── Current (0-30 days)');
        console.log('│   ├── Paid Students: $[AMOUNT]');
        console.log('│   └── Unpaid Students: $[AMOUNT]');
        console.log('├── 31-60 days (Overdue)');
        console.log('│   └── Unpaid Students: $[AMOUNT]');
        console.log('├── 61-90 days (Seriously Overdue)');
        console.log('│   └── Unpaid Students: $[AMOUNT]');
        console.log('└── Over 90 days (Critical)');
        console.log('    └── Unpaid Students: $[AMOUNT]');
        console.log('');

        // 9. NEXT STEPS FOR REAL DATA
        console.log('🎯 9. NEXT STEPS TO GET REAL DATA');
        console.log('=============================================\n');

        console.log('To see your REAL financial reports, you need to:');
        console.log('');
        console.log('1. 📝 Create Student Records:');
        console.log('   - Student names and lease amounts');
        console.log('   - Property assignments (St Kilda, Belvedere, Nyanga)');
        console.log('   - Monthly rent amounts');
        console.log('');
        console.log('2. 💰 Record Monthly Rent Accruals:');
        console.log('   - When rent becomes due (1st of month)');
        console.log('   - Use accounts: 1101, 1102, 1103 (Receivables)');
        console.log('   - Use accounts: 4001, 4002, 4003 (Income)');
        console.log('');
        console.log('3. 💳 Record Student Payments:');
        console.log('   - When students actually pay');
        console.log('   - Use accounts: 1110 (Bank)');
        console.log('   - Clear the receivable accounts');
        console.log('');
        console.log('4. 📊 Generate Real Reports:');
        console.log('   - Income statement with actual amounts');
        console.log('   - Accounts receivable aging');
        console.log('   - Property-by-property performance');

        console.log('\n🎉 Database Analysis Complete!');
        console.log('Your rental accrual system is ready for real data!');

    } catch (error) {
        console.error('❌ Error generating real financial reports:', error);
    }
}

async function cleanup() {
    try {
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
    } catch (error) {
        console.error('❌ Error closing database connection:', error);
    }
}

async function main() {
    try {
        await connectToDatabase();
        await generateRealFinancialReports();
    } catch (error) {
        console.error('❌ Report generation failed:', error);
    } finally {
        await cleanup();
        process.exit(0);
    }
}

if (require.main === module) {
    main();
}

module.exports = { generateRealFinancialReports };
