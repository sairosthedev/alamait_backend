/**
 * Simple Migration Script with Proper Connection Handling
 * 
 * This script fixes the database connection timeout issues and provides
 * a more robust migration process.
 */

const mongoose = require('mongoose');

// Database connection configuration
const connectToDatabase = async () => {
    try {
        console.log('🔄 Connecting to database...');
        
        const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000
        });
        
        console.log('✅ Database connected successfully');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
};

// Test database connection
const testConnection = async () => {
    try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`✅ Connection test successful. Found ${collections.length} collections.`);
        return true;
    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        return false;
    }
};

// Main migration function
const runSimpleMigration = async () => {
    console.log('🚀 Starting Simple Migration Script...');
    console.log('=====================================');
    
    try {
        // Step 1: Connect to database
        const connected = await connectToDatabase();
        if (!connected) {
            throw new Error('Failed to connect to database');
        }
        
        // Step 2: Test connection
        const connectionTest = await testConnection();
        if (!connectionTest) {
            throw new Error('Database connection test failed');
        }
        
        // Step 3: Load models after connection
        const Account = require('../models/Account');
        const Transaction = require('../models/Transaction');
        const TransactionEntry = require('../models/TransactionEntry');
        const Payment = require('../models/Payment');
        const Expense = require('../models/finance/Expense');
        const Vendor = require('../models/Vendor');
        const Debtor = require('../models/Debtor');
        const User = require('../models/User');
        
        console.log('📊 Models loaded successfully');
        
        // Step 4: Check existing data
        console.log('🔍 Checking existing data...');
        
        const accountCount = await Account.countDocuments().maxTimeMS(10000);
        const transactionCount = await Transaction.countDocuments().maxTimeMS(10000);
        const paymentCount = await Payment.countDocuments().maxTimeMS(10000);
        const vendorCount = await Vendor.countDocuments().maxTimeMS(10000);
        const userCount = await User.countDocuments().maxTimeMS(10000);
        
        console.log(`📈 Found ${accountCount} accounts`);
        console.log(`📈 Found ${transactionCount} transactions`);
        console.log(`📈 Found ${paymentCount} payments`);
        console.log(`📈 Found ${vendorCount} vendors`);
        console.log(`📈 Found ${userCount} users`);
        
        // Step 5: Create basic accounts if they don't exist
        console.log('📊 Creating basic accounts...');
        
        const basicAccounts = [
            { code: '1001', name: 'Bank Account', type: 'Asset', category: 'Current Assets' },
            { code: '1002', name: 'Cash on Hand', type: 'Asset', category: 'Current Assets' },
            { code: '1003', name: 'Ecocash Wallet', type: 'Asset', category: 'Current Assets' },
            { code: '1004', name: 'Innbucks Wallet', type: 'Asset', category: 'Current Assets' },
            { code: '1008', name: 'Petty Cash', type: 'Asset', category: 'Current Assets' },
            { code: '2001', name: 'Accounts Payable', type: 'Liability', category: 'Current Liabilities' },
            { code: '4001', name: 'Rent Income', type: 'Income', category: 'Operating Revenue' },
            { code: '5001', name: 'Maintenance Expense', type: 'Expense', category: 'Operating Expenses' },
            { code: '5002', name: 'Supplies Expense', type: 'Expense', category: 'Operating Expenses' },
            { code: '5003', name: 'Utilities Expense', type: 'Expense', category: 'Operating Expenses' }
        ];
        
        let accountsCreated = 0;
        
        for (const accountData of basicAccounts) {
            try {
                const existingAccount = await Account.findOne({ code: accountData.code }).maxTimeMS(5000);
                
                if (!existingAccount) {
                    const account = new Account({
                        ...accountData,
                        isActive: true,
                        level: 1,
                        sortOrder: 0,
                        metadata: {}
                    });
                    
                    await account.save();
                    accountsCreated++;
                    console.log(`✅ Created account: ${accountData.code} - ${accountData.name}`);
                } else {
                    console.log(`ℹ️ Account ${accountData.code} already exists`);
                }
            } catch (error) {
                console.error(`❌ Error creating account ${accountData.code}:`, error.message);
            }
        }
        
        console.log(`✅ Created ${accountsCreated} new accounts`);
        
        // Step 6: Summary
        console.log('\n📊 MIGRATION SUMMARY');
        console.log('====================');
        console.log(`✅ Database connected successfully`);
        console.log(`✅ Found ${accountCount} existing accounts`);
        console.log(`✅ Found ${transactionCount} existing transactions`);
        console.log(`✅ Found ${paymentCount} existing payments`);
        console.log(`✅ Found ${vendorCount} existing vendors`);
        console.log(`✅ Found ${userCount} existing users`);
        console.log(`✅ Created ${accountsCreated} new accounts`);
        console.log('\n🎉 Migration completed successfully!');
        
        // Step 7: Disconnect
        await mongoose.disconnect();
        console.log('✅ Disconnected from database');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        
        // Try to disconnect
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('❌ Error disconnecting:', disconnectError.message);
        }
        
        process.exit(1);
    }
};

// Run migration if called directly
if (require.main === module) {
    runSimpleMigration();
}

module.exports = { runSimpleMigration }; 