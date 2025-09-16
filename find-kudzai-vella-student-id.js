/**
 * Script to find Kudzai Vella's correct Student User ID
 * 
 * This script will search for Kudzai Vella in both User and Application collections
 * and find the correct student ID that's linked to the transactions.
 */

const mongoose = require('mongoose');

// Connect to database
const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/alamait', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

async function findKudzaiVellaStudentId() {
    try {
        await connectDB();
        
        const User = require('./src/models/User');
        const Application = require('./src/models/Application');
        const TransactionEntry = require('./src/models/TransactionEntry');
        
        console.log('🔍 Searching for Kudzai Vella...\n');
        
        // Search in User collection
        console.log('1. Searching in User collection:');
        const users = await User.find({
            $or: [
                { firstName: { $regex: 'Kudzai', $options: 'i' } },
                { lastName: { $regex: 'Vella', $options: 'i' } },
                { email: { $regex: 'vela@gmail.com', $options: 'i' } }
            ]
        });
        
        if (users.length > 0) {
            users.forEach((user, index) => {
                console.log(`   ${index + 1}. User ID: ${user._id}`);
                console.log(`      Name: ${user.firstName} ${user.lastName}`);
                console.log(`      Email: ${user.email}`);
                console.log(`      Status: ${user.status}`);
                console.log(`      Current Room: ${user.currentRoom}`);
                console.log(`      Residence: ${user.residence}`);
                console.log('');
            });
        } else {
            console.log('   No users found');
        }
        
        // Search in Application collection
        console.log('2. Searching in Application collection:');
        const applications = await Application.find({
            $or: [
                { firstName: { $regex: 'Kudzai', $options: 'i' } },
                { lastName: { $regex: 'Vella', $options: 'i' } },
                { email: { $regex: 'vela@gmail.com', $options: 'i' } }
            ]
        });
        
        if (applications.length > 0) {
            applications.forEach((app, index) => {
                console.log(`   ${index + 1}. Application ID: ${app._id}`);
                console.log(`      Name: ${app.firstName} ${app.lastName}`);
                console.log(`      Email: ${app.email}`);
                console.log(`      Status: ${app.status}`);
                console.log(`      Application Code: ${app.applicationCode}`);
                console.log(`      Student ID: ${app.studentId}`);
                console.log(`      Room: ${app.room}`);
                console.log(`      Residence: ${app.residence}`);
                console.log('');
            });
        } else {
            console.log('   No applications found');
        }
        
        // Search for transactions with Kudzai Vella's name
        console.log('3. Searching for transactions with Kudzai Vella:');
        const transactions = await TransactionEntry.find({
            $or: [
                { 'metadata.studentName': { $regex: 'Kudzai Vella', $options: 'i' } },
                { 'description': { $regex: 'Kudzai Vella', $options: 'i' } }
            ]
        });
        
        if (transactions.length > 0) {
            transactions.forEach((transaction, index) => {
                console.log(`   ${index + 1}. Transaction ID: ${transaction.transactionId}`);
                console.log(`      Description: ${transaction.description}`);
                console.log(`      Student ID in metadata: ${transaction.metadata?.studentId}`);
                console.log(`      Student Name in metadata: ${transaction.metadata?.studentName}`);
                console.log(`      Source ID: ${transaction.sourceId}`);
                console.log(`      Source Model: ${transaction.sourceModel}`);
                console.log(`      Total Debit: $${transaction.totalDebit}`);
                console.log(`      Total Credit: $${transaction.totalCredit}`);
                console.log('');
            });
        } else {
            console.log('   No transactions found');
        }
        
        // Search for specific transaction IDs we know exist
        console.log('4. Searching for specific known transactions:');
        const knownTransactionIds = [
            'LEASE_START_APP1757943001482W209T_1757943002968',
            'TXN1757943070089TK5B7',
            'TXN175794307147756CM2'
        ];
        
        for (const transactionId of knownTransactionIds) {
            const transaction = await TransactionEntry.findOne({ transactionId });
            if (transaction) {
                console.log(`   Found: ${transactionId}`);
                console.log(`      Student ID in metadata: ${transaction.metadata?.studentId}`);
                console.log(`      Student Name in metadata: ${transaction.metadata?.studentName}`);
                console.log(`      Source ID: ${transaction.sourceId}`);
                console.log(`      Source Model: ${transaction.sourceModel}`);
                console.log('');
            } else {
                console.log(`   Not found: ${transactionId}`);
            }
        }
        
        console.log('✅ Search completed!');
        console.log('\n📋 Summary:');
        console.log('Use the correct Student User ID (not Application ID) for the forfeiture API call.');
        console.log('The Student User ID should match the metadata.studentId in the transactions.');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the search
findKudzaiVellaStudentId();

