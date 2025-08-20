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

async function testSystemEnum() {
    try {
        console.log('\n🧪 TESTING "SYSTEM" AS VALID ENUM VALUE');
        console.log('=' .repeat(60));

        // Import models
        const Transaction = require('../src/models/Transaction');
        const TransactionEntry = require('../src/models/TransactionEntry');
        const Account = require('../src/models/Account');

        // Get a test residence ID (any residence will do)
        const testResidenceId = '67d723cf20f89c4ae69804f3'; // Using the existing one

        console.log('\n1️⃣ TESTING TRANSACTION MODEL WITH "SYSTEM"');
        console.log('-'.repeat(50));

        // Test Transaction model with "system"
        const testTransaction = new Transaction({
            transactionId: `TEST${Date.now()}`,
            date: new Date(),
            description: 'Test transaction with system user',
            type: 'other',
            residence: testResidenceId,
            createdBy: 'system' // This should now be valid
        });

        try {
            await testTransaction.validate();
            console.log('✅ Transaction validation passed with createdBy: "system"');
        } catch (validationError) {
            console.log('❌ Transaction validation failed:', validationError.message);
        }

        console.log('\n2️⃣ TESTING TRANSACTIONENTRY MODEL WITH "SYSTEM"');
        console.log('-'.repeat(50));

        // Test TransactionEntry model with "system"
        const testTransactionEntry = new TransactionEntry({
            transactionId: `TESTENTRY${Date.now()}`,
            date: new Date(),
            description: 'Test transaction entry with system user',
            entries: [{
                accountCode: '1001',
                accountName: 'Test Account',
                accountType: 'Asset',
                debit: 100,
                credit: 0,
                description: 'Test entry'
            }],
            totalDebit: 100,
            totalCredit: 100,
            source: 'manual',
            sourceId: new mongoose.Types.ObjectId(),
            sourceModel: 'Lease',
            residence: testResidenceId,
            createdBy: 'system' // This should now be valid
        });

        try {
            await testTransactionEntry.validate();
            console.log('✅ TransactionEntry validation passed with createdBy: "system"');
        } catch (validationError) {
            console.log('❌ TransactionEntry validation failed:', validationError.message);
        }

        console.log('\n3️⃣ TESTING TRANSACTION MODEL WITH USER OBJECTID');
        console.log('-'.repeat(50));

        // Test Transaction model with ObjectId
        const testTransactionWithUser = new Transaction({
            transactionId: `TESTUSER${Date.now()}`,
            date: new Date(),
            description: 'Test transaction with user ObjectId',
            type: 'other',
            residence: testResidenceId,
            createdBy: new mongoose.Types.ObjectId() // This should also be valid
        });

        try {
            await testTransactionWithUser.validate();
            console.log('✅ Transaction validation passed with createdBy: ObjectId');
        } catch (validationError) {
            console.log('❌ Transaction validation failed:', validationError.message);
        }

        console.log('\n4️⃣ TESTING INVALID VALUES');
        console.log('-'.repeat(50));

        // Test with invalid value
        const testTransactionInvalid = new Transaction({
            transactionId: `TESTINVALID${Date.now()}`,
            date: new Date(),
            description: 'Test transaction with invalid createdBy',
            type: 'other',
            residence: testResidenceId,
            createdBy: 'invalid_user' // This should fail validation
        });

        try {
            await testTransactionInvalid.validate();
            console.log('❌ Transaction validation should have failed with invalid createdBy');
        } catch (validationError) {
            console.log('✅ Transaction validation correctly failed with invalid createdBy:', validationError.message);
        }

        console.log('\n🎉 SYSTEM ENUM TESTS COMPLETED');

    } catch (error) {
        console.error('❌ Error testing system enum:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await testSystemEnum();
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

module.exports = { testSystemEnum };
