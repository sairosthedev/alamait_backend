const mongoose = require('mongoose');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function connectToDatabase() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

async function disconnectFromDatabase() {
    try {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Failed to disconnect from MongoDB:', error);
    }
}

async function checkAccountsCollection() {
    try {
        console.log('\n🔍 CHECKING ACCOUNTS COLLECTION');
        console.log('=' .repeat(60));

        // Get the Account model
        const Account = require('../src/models/Account');

        // Check total count
        const totalAccounts = await Account.countDocuments();
        console.log(`📊 Total accounts in database: ${totalAccounts}`);

        if (totalAccounts === 0) {
            console.log('❌ No accounts found in database');
            return;
        }

        // Check for specific accounts needed by rental accrual service
        console.log('\n🎯 CHECKING FOR REQUIRED ACCOUNTS');
        console.log('=' .repeat(40));

        const requiredAccounts = [
            { code: '1100', name: 'Accounts Receivable - Tenants', type: 'Asset' },
            { code: '4000', name: 'Rental Income - Residential', type: 'Income' },
            { code: '4100', name: 'Administrative Income', type: 'Income' },
            { code: '2020', name: 'Tenant Deposits Held', type: 'Liability' }
        ];

        for (const required of requiredAccounts) {
            const account = await Account.findOne({ code: required.code });
            if (account) {
                console.log(`✅ ${required.code} - ${required.name} (${required.type})`);
                console.log(`   ID: ${account._id}`);
                console.log(`   Active: ${account.isActive}`);
            } else {
                console.log(`❌ ${required.code} - ${required.name} (${required.type}) - MISSING`);
            }
        }

        // Show all available accounts
        console.log('\n📋 ALL AVAILABLE ACCOUNTS');
        console.log('=' .repeat(40));

        const allAccounts = await Account.find({}).sort({ code: 1 });
        
        for (const account of allAccounts) {
            console.log(`${account.code} - ${account.name} (${account.type})`);
            console.log(`   ID: ${account._id}`);
            console.log(`   Category: ${account.category || 'N/A'}`);
            console.log(`   Active: ${account.isActive}`);
            console.log('');
        }

        // Check if we have any accounts that could be used as alternatives
        console.log('\n🔍 CHECKING FOR ALTERNATIVE ACCOUNTS');
        console.log('=' .repeat(40));

        const assetAccounts = await Account.find({ type: 'Asset' }).sort({ code: 1 });
        const incomeAccounts = await Account.find({ type: 'Income' }).sort({ code: 1 });
        const liabilityAccounts = await Account.find({ type: 'Liability' }).sort({ code: 1 });

        console.log(`Asset accounts (${assetAccounts.length}):`);
        assetAccounts.forEach(acc => console.log(`   ${acc.code} - ${acc.name}`));

        console.log(`\nIncome accounts (${incomeAccounts.length}):`);
        incomeAccounts.forEach(acc => console.log(`   ${acc.code} - ${acc.name}`));

        console.log(`\nLiability accounts (${liabilityAccounts.length}):`);
        liabilityAccounts.forEach(acc => console.log(`   ${acc.code} - ${acc.name}`));

    } catch (error) {
        console.error('❌ Error checking accounts collection:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await checkAccountsCollection();
    } catch (error) {
        console.error('❌ Main error:', error);
    } finally {
        await disconnectFromDatabase();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { checkAccountsCollection };
