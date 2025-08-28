const mongoose = require('mongoose');

async function checkAtlasAccountCodes() {
  try {
    // Connect to Atlas database
    await mongoose.connect('mongodb+srv://****:****@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
    console.log('Connected to MongoDB Atlas');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    // Check account codes in transaction entries
    console.log('\n=== Checking account codes in transaction entries ===');
    
    // Get all transaction entries with AR accounts
    const arTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^1100' }
    }).sort({ date: -1 }).limit(10);
    
    console.log(`Found ${arTransactions.length} transactions with AR accounts:`);
    arTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   ID: ${tx._id}`);
      console.log(`   Date: ${tx.date}`);
      console.log(`   Source: ${tx.source}`);
      console.log(`   Account codes:`, tx.entries.map(e => e.accountCode));
      console.log(`   Has metadata: ${!!tx.metadata}`);
      console.log(`   Metadata:`, tx.metadata);
    });
    
    // Check for student-specific AR accounts
    console.log('\n=== Checking for student-specific AR accounts ===');
    const studentARTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^1100-' }
    }).sort({ date: -1 }).limit(5);
    
    console.log(`Found ${studentARTransactions.length} transactions with student-specific AR accounts:`);
    studentARTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   ID: ${tx._id}`);
      console.log(`   Account codes:`, tx.entries.map(e => e.accountCode));
      console.log(`   Has metadata: ${!!tx.metadata}`);
      console.log(`   Metadata:`, tx.metadata);
    });
    
    // Check recent payment transactions
    console.log('\n=== Checking recent payment transactions ===');
    const recentPayments = await TransactionEntry.find({
      source: 'payment'
    }).sort({ date: -1 }).limit(5);
    
    console.log(`Found ${recentPayments.length} recent payment transactions:`);
    recentPayments.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   ID: ${tx._id}`);
      console.log(`   Date: ${tx.date}`);
      console.log(`   Account codes:`, tx.entries.map(e => e.accountCode));
      console.log(`   Has metadata: ${!!tx.metadata}`);
      console.log(`   Metadata:`, tx.metadata);
    });
    
    // Check for rental accruals
    console.log('\n=== Checking rental accruals ===');
    const accruals = await TransactionEntry.find({
      source: 'rental_accrual'
    }).sort({ date: -1 }).limit(5);
    
    console.log(`Found ${accruals.length} rental accruals:`);
    accruals.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   ID: ${tx._id}`);
      console.log(`   Date: ${tx.date}`);
      console.log(`   Account codes:`, tx.entries.map(e => e.accountCode));
      console.log(`   Has metadata: ${!!tx.metadata}`);
      console.log(`   Metadata:`, tx.metadata);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAtlasAccountCodes();
