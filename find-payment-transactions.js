/**
 * Script to find payment transactions for Kudzai Vella
 * 
 * This script will search for all payment-related transactions
 * using various search criteria to understand why they're not being found.
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

async function findPaymentTransactions() {
    try {
        await connectDB();
        
        const TransactionEntry = require('./src/models/TransactionEntry');
        
        const applicationId = "68c814d942bf9ffb8792f0e3";
        const studentId = "68c814d942bf9ffb8792f0df";
        const studentName = "Kudzai Vella";
        
        console.log('🔍 Searching for payment transactions...\n');
        
        // 1. Search by transaction ID patterns
        console.log('1. Searching by transaction ID patterns:');
        const txnTransactions = await TransactionEntry.find({
            'transactionId': { $regex: 'TXN', $options: 'i' }
        });
        console.log(`   Found ${txnTransactions.length} TXN transactions:`);
        txnTransactions.forEach((transaction, index) => {
            console.log(`   ${index + 1}. ${transaction.transactionId}`);
            console.log(`      Description: ${transaction.description}`);
            console.log(`      Amount: $${transaction.totalDebit}`);
            console.log(`      Student ID: ${transaction.metadata?.studentId}`);
            console.log(`      Student Name: ${transaction.metadata?.studentName}`);
        });
        
        // 2. Search by source
        console.log('\n2. Searching by source:');
        const paymentSourceTransactions = await TransactionEntry.find({
            source: { $in: ['payment', 'advance_payment'] }
        });
        console.log(`   Found ${paymentSourceTransactions.length} payment source transactions:`);
        paymentSourceTransactions.forEach((transaction, index) => {
            console.log(`   ${index + 1}. ${transaction.transactionId}`);
            console.log(`      Source: ${transaction.source}`);
            console.log(`      Description: ${transaction.description}`);
            console.log(`      Amount: $${transaction.totalDebit}`);
            console.log(`      Student ID: ${transaction.metadata?.studentId}`);
        });
        
        // 3. Search by description containing "payment"
        console.log('\n3. Searching by description containing "payment":');
        const paymentDescTransactions = await TransactionEntry.find({
            'description': { $regex: 'payment', $options: 'i' }
        });
        console.log(`   Found ${paymentDescTransactions.length} payment description transactions:`);
        paymentDescTransactions.forEach((transaction, index) => {
            console.log(`   ${index + 1}. ${transaction.transactionId}`);
            console.log(`      Description: ${transaction.description}`);
            console.log(`      Amount: $${transaction.totalDebit}`);
            console.log(`      Student ID: ${transaction.metadata?.studentId}`);
        });
        
        // 4. Search by specific student IDs
        console.log('\n4. Searching by specific student IDs:');
        const studentIdTransactions = await TransactionEntry.find({
            $or: [
                { 'metadata.studentId': applicationId },
                { 'metadata.studentId': new mongoose.Types.ObjectId(applicationId) },
                { 'metadata.studentId': studentId },
                { 'metadata.studentId': new mongoose.Types.ObjectId(studentId) }
            ]
        });
        console.log(`   Found ${studentIdTransactions.length} transactions with student IDs:`);
        studentIdTransactions.forEach((transaction, index) => {
            console.log(`   ${index + 1}. ${transaction.transactionId}`);
            console.log(`      Description: ${transaction.description}`);
            console.log(`      Source: ${transaction.source}`);
            console.log(`      Amount: $${transaction.totalDebit}`);
            console.log(`      Student ID: ${transaction.metadata?.studentId}`);
        });
        
        // 5. Search by student name
        console.log('\n5. Searching by student name:');
        const nameTransactions = await TransactionEntry.find({
            $or: [
                { 'metadata.studentName': { $regex: studentName, $options: 'i' } },
                { 'description': { $regex: studentName, $options: 'i' } }
            ]
        });
        console.log(`   Found ${nameTransactions.length} transactions with student name:`);
        nameTransactions.forEach((transaction, index) => {
            console.log(`   ${index + 1}. ${transaction.transactionId}`);
            console.log(`      Description: ${transaction.description}`);
            console.log(`      Source: ${transaction.source}`);
            console.log(`      Amount: $${transaction.totalDebit}`);
            console.log(`      Student Name: ${transaction.metadata?.studentName}`);
        });
        
        // 6. Search by reference field
        console.log('\n6. Searching by reference field:');
        const referenceTransactions = await TransactionEntry.find({
            $or: [
                { 'reference': { $regex: applicationId, $options: 'i' } },
                { 'reference': { $regex: studentId, $options: 'i' } }
            ]
        });
        console.log(`   Found ${referenceTransactions.length} transactions with reference:`);
        referenceTransactions.forEach((transaction, index) => {
            console.log(`   ${index + 1}. ${transaction.transactionId}`);
            console.log(`      Description: ${transaction.description}`);
            console.log(`      Reference: ${transaction.reference}`);
            console.log(`      Amount: $${transaction.totalDebit}`);
        });
        
        // 7. Search for all transactions in the last 24 hours
        console.log('\n7. Searching for all transactions in the last 24 hours:');
        const recentTransactions = await TransactionEntry.find({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).sort({ createdAt: -1 });
        console.log(`   Found ${recentTransactions.length} recent transactions:`);
        recentTransactions.forEach((transaction, index) => {
            console.log(`   ${index + 1}. ${transaction.transactionId}`);
            console.log(`      Description: ${transaction.description}`);
            console.log(`      Source: ${transaction.source}`);
            console.log(`      Amount: $${transaction.totalDebit}`);
            console.log(`      Created: ${transaction.createdAt}`);
        });
        
        console.log('\n✅ Search completed!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the search
findPaymentTransactions();

