/**
 * Find payment transactions for student Bertha Majonis
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const TransactionEntry = require('../models/TransactionEntry');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function findBerthaTransactions() {
  try {
    console.log('🔍 Finding payment transactions for Bertha Majonis...');
    
    // First, find the student by name
    const students = await User.find({
      $or: [
        { firstName: { $regex: /bertha/i } },
        { lastName: { $regex: /majonis/i } },
        { email: { $regex: /bertha/i } },
        { email: { $regex: /majonis/i } }
      ],
      role: 'student'
    });
    
    console.log(`👤 Found ${students.length} students matching "Bertha Majonis":`);
    students.forEach((student, index) => {
      console.log(`   ${index + 1}. ${student.firstName} ${student.lastName} - ${student.email} - ID: ${student._id}`);
    });
    
    if (students.length === 0) {
      console.log('❌ No students found matching "Bertha Majonis"');
      return;
    }
    
    // Search for payments for each student
    for (const student of students) {
      console.log(`\n💰 Searching payments for ${student.firstName} ${student.lastName} (${student._id}):`);
      
      const payments = await Payment.find({
        $or: [
          { student: student._id },
          { user: student._id }
        ]
      }).sort({ date: -1 });
      
      console.log(`   Found ${payments.length} payments:`);
      payments.forEach((payment, index) => {
        console.log(`   ${index + 1}. ${payment.paymentId} - $${payment.totalAmount || payment.amount} - ${payment.date.toISOString().split('T')[0]} - ${payment.status}`);
        console.log(`      Method: ${payment.method}`);
        console.log(`      Admin Fee: $${payment.adminFee || 0}`);
        console.log(`      Rent Amount: $${payment.rentAmount || 0}`);
        console.log(`      Deposit: $${payment.deposit || 0}`);
      });
      
      // Search for transaction entries for each student
      console.log(`\n💳 Searching transaction entries for ${student.firstName} ${student.lastName}:`);
      
      const transactionEntries = await TransactionEntry.find({
        $or: [
          { sourceId: student._id },
          { reference: student._id.toString() },
          { 'metadata.studentId': student._id.toString() },
          { 'entries.accountCode': { $regex: student._id.toString() } }
        ]
      }).sort({ date: -1 });
      
      console.log(`   Found ${transactionEntries.length} transaction entries:`);
      transactionEntries.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.transactionId} - $${entry.totalDebit || 0} - ${entry.date.toISOString().split('T')[0]} - ${entry.source}`);
        console.log(`      Description: ${entry.description}`);
        console.log(`      Reference: ${entry.reference}`);
        console.log(`      Source ID: ${entry.sourceId}`);
        
        if (entry.entries && entry.entries.length > 0) {
          console.log(`      Entries:`);
          entry.entries.forEach((line, lineIndex) => {
            console.log(`         ${lineIndex + 1}. ${line.accountCode} - ${line.accountName} - Debit: $${line.debit || 0}, Credit: $${line.credit || 0}`);
          });
        }
      });
      
      // Also search by student name in transaction descriptions
      console.log(`\n🔍 Searching by name in transaction descriptions:`);
      const nameTransactions = await TransactionEntry.find({
        $or: [
          { description: { $regex: /bertha/i } },
          { description: { $regex: /majonis/i } }
        ]
      }).sort({ date: -1 });
      
      console.log(`   Found ${nameTransactions.length} transactions with name in description:`);
      nameTransactions.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.transactionId} - $${entry.totalDebit || 0} - ${entry.date.toISOString().split('T')[0]} - ${entry.source}`);
        console.log(`      Description: ${entry.description}`);
      });
    }
    
    // Search for any payments with "bertha" or "majonis" in payment ID or other fields
    console.log(`\n🔍 Searching payments by name in payment ID or other fields:`);
    const namePayments = await Payment.find({
      $or: [
        { paymentId: { $regex: /bertha/i } },
        { paymentId: { $regex: /majonis/i } }
      ]
    }).sort({ date: -1 });
    
    console.log(`   Found ${namePayments.length} payments with name in payment ID:`);
    namePayments.forEach((payment, index) => {
      console.log(`   ${index + 1}. ${payment.paymentId} - $${payment.totalAmount || payment.amount} - ${payment.date.toISOString().split('T')[0]} - ${payment.status}`);
      console.log(`      Student: ${payment.student || payment.user}`);
    });
    
  } catch (error) {
    console.error('❌ Error finding Bertha transactions:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
findBerthaTransactions();


