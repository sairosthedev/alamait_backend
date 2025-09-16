/**
 * Debug Script: Investigate why applications and payments aren't being processed
 * 
 * This script will help us understand why the forfeiture system isn't finding
 * applications and payment transactions for Kudzai Vella.
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

async function debugForfeitIssues() {
    try {
        await connectDB();
        
        const User = require('./src/models/User');
        const Application = require('./src/models/Application');
        const Payment = require('./src/models/Payment');
        const TransactionEntry = require('./src/models/TransactionEntry');
        
        const applicationId = "68c814d942bf9ffb8792f0e3";
        const studentId = "68c814d942bf9ffb8792f0df";
        const studentName = "Kudzai Vella";
        
        console.log('🔍 Debugging forfeiture issues...\n');
        
        // 1. Check Application
        console.log('1. Checking Application:');
        const application = await Application.findById(applicationId);
        if (application) {
            console.log(`   ✅ Application found: ${application._id}`);
            console.log(`   Name: ${application.firstName} ${application.lastName}`);
            console.log(`   Email: ${application.email}`);
            console.log(`   Status: ${application.status}`);
            console.log(`   Student ID: ${application.student}`);
            console.log(`   Application Code: ${application.applicationCode}`);
        } else {
            console.log('   ❌ Application not found');
        }
        
        // 2. Check User
        console.log('\n2. Checking User:');
        const user = await User.findById(studentId);
        if (user) {
            console.log(`   ✅ User found: ${user._id}`);
            console.log(`   Name: ${user.firstName} ${user.lastName}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Status: ${user.status}`);
        } else {
            console.log('   ❌ User not found');
        }
        
        // 3. Check Applications by Student ID
        console.log('\n3. Checking Applications by Student ID:');
        const applicationsByStudentId = await Application.find({
            $or: [
                { studentId: studentId },
                { student: studentId },
                { email: 'vela@gmail.com' }
            ]
        });
        console.log(`   Found ${applicationsByStudentId.length} applications:`);
        applicationsByStudentId.forEach((app, index) => {
            console.log(`   ${index + 1}. ID: ${app._id}`);
            console.log(`      Status: ${app.status}`);
            console.log(`      Student ID: ${app.student}`);
            console.log(`      Email: ${app.email}`);
        });
        
        // 4. Check Payments
        console.log('\n4. Checking Payments:');
        const payments = await Payment.find({
            $or: [
                { studentId: studentId },
                { email: 'vela@gmail.com' }
            ]
        });
        console.log(`   Found ${payments.length} payments:`);
        payments.forEach((payment, index) => {
            console.log(`   ${index + 1}. ID: ${payment._id}`);
            console.log(`      Amount: $${payment.amount}`);
            console.log(`      Student ID: ${payment.studentId}`);
            console.log(`      Email: ${payment.email}`);
        });
        
        // 5. Check Payment Transactions
        console.log('\n5. Checking Payment Transactions:');
        const paymentTransactions = await TransactionEntry.find({
            $and: [
                {
                    $or: [
                        { 'metadata.studentId': studentId },
                        { 'metadata.studentId': new mongoose.Types.ObjectId(studentId) },
                        { 'metadata.studentName': { $regex: studentName, $options: 'i' } },
                        { 'description': { $regex: studentName, $options: 'i' } },
                        { 'reference': { $regex: studentId, $options: 'i' } }
                    ]
                },
                {
                    $or: [
                        { source: 'payment' },
                        { source: 'advance_payment' },
                        { 'description': { $regex: 'payment', $options: 'i' } },
                        { 'transactionId': { $regex: 'TXN', $options: 'i' } }
                    ]
                },
                { status: 'posted' }
            ]
        });
        console.log(`   Found ${paymentTransactions.length} payment transactions:`);
        paymentTransactions.forEach((transaction, index) => {
            console.log(`   ${index + 1}. ID: ${transaction._id}`);
            console.log(`      Transaction ID: ${transaction.transactionId}`);
            console.log(`      Description: ${transaction.description}`);
            console.log(`      Amount: $${transaction.totalDebit}`);
            console.log(`      Source: ${transaction.source}`);
            console.log(`      Student ID in metadata: ${transaction.metadata?.studentId}`);
            console.log(`      Student Name in metadata: ${transaction.metadata?.studentName}`);
        });
        
        // 6. Check All Transactions for Kudzai Vella
        console.log('\n6. Checking All Transactions for Kudzai Vella:');
        const allTransactions = await TransactionEntry.find({
            $or: [
                { 'metadata.studentName': { $regex: studentName, $options: 'i' } },
                { 'description': { $regex: studentName, $options: 'i' } }
            ]
        });
        console.log(`   Found ${allTransactions.length} total transactions:`);
        allTransactions.forEach((transaction, index) => {
            console.log(`   ${index + 1}. ${transaction.transactionId}`);
            console.log(`      Description: ${transaction.description}`);
            console.log(`      Source: ${transaction.source}`);
            console.log(`      Amount: $${transaction.totalDebit}`);
            console.log(`      Student ID: ${transaction.metadata?.studentId}`);
            console.log(`      Student Name: ${transaction.metadata?.studentName}`);
        });
        
        console.log('\n✅ Debug completed!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the debug
debugForfeitIssues();

