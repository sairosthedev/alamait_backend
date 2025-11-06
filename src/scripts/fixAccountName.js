const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function fixAccountName() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('../models/TransactionEntry');
    
    console.log('\n🔧 FIXING ACCOUNT NAME IN TRANSACTION');
    console.log('=' .repeat(60));
    
    // Find the problematic transaction
    const transaction = await TransactionEntry.findOne({
      transactionId: 'TXN1760361063463VU90G'
    });
    
    if (transaction) {
      console.log('\n📋 BEFORE FIX:');
      console.log(`   Transaction ID: ${transaction.transactionId}`);
      transaction.entries.forEach((entry, index) => {
        console.log(`   Entry ${index + 1}: ${entry.accountCode} - ${entry.accountName}`);
        console.log(`     Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
      });
      
      // Fix the account name for account code 1000
      const cashEntry = transaction.entries.find(entry => entry.accountCode === '1000');
      if (cashEntry && cashEntry.accountName === 'Bank Account') {
        console.log('\n🔧 FIXING ACCOUNT NAME...');
        cashEntry.accountName = 'Cash';
        
        // Save the transaction
        await transaction.save();
        
        console.log('✅ Account name fixed!');
        
        console.log('\n📋 AFTER FIX:');
        console.log(`   Transaction ID: ${transaction.transactionId}`);
        transaction.entries.forEach((entry, index) => {
          console.log(`   Entry ${index + 1}: ${entry.accountCode} - ${entry.accountName}`);
          console.log(`     Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
        });
        
      } else {
        console.log('❌ Cash entry not found or already has correct name');
      }
      
    } else {
      console.log('❌ Transaction not found');
    }
    
    // Test the balance sheet service again
    console.log('\n🔧 TESTING BALANCE SHEET SERVICE AFTER FIX...');
    
    const FinancialReportingService = require('../services/financialReportingService');
    const balanceSheet = await FinancialReportingService.generateBalanceSheet('2025-10-31', 'cash');
    
    const cashAccount = Object.values(balanceSheet.assets || {}).find(acc => acc.code === '1000');
    if (cashAccount) {
      console.log('\n💰 CASH ACCOUNT AFTER FIX:');
      console.log(`   Code: ${cashAccount.code}`);
      console.log(`   Name: ${cashAccount.name}`);
      console.log(`   Balance: $${cashAccount.balance}`);
      console.log(`   Debit Total: $${cashAccount.debit_total}`);
      console.log(`   Credit Total: $${cashAccount.credit_total}`);
      
      if (cashAccount.balance === 100) {
        console.log('✅ Cash balance is now CORRECT: $100');
      } else {
        console.log(`❌ Cash balance is still INCORRECT: $${cashAccount.balance} (should be $100)`);
      }
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

fixAccountName();




