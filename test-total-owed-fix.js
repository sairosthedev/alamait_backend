const mongoose = require('mongoose');
require('dotenv').config();

async function testTotalOwedFix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const DebtorTransactionSyncService = require('./src/services/debtorTransactionSyncService');
    const TransactionEntry = require('./src/models/TransactionEntry');
    const Debtor = require('./src/models/Debtor');
    
    console.log('🔍 Testing Total Owed Calculation Fix...\n');
    
    // Get the debtor
    const debtor = await Debtor.findOne({});
    if (!debtor) {
      console.log('❌ No debtor found');
      return;
    }
    
    const studentId = debtor.user.toString();
    console.log(`🔍 Analyzing debtor: ${debtor.debtorCode}`);
    
    // Check current totals
    console.log('\n📊 CURRENT TOTALS IN DATABASE:');
    console.log(`   Total Owed: $${debtor.totalOwed}`);
    console.log(`   Total Paid: $${debtor.totalPaid}`);
    console.log(`   Current Balance: $${debtor.currentBalance}`);
    
    // Get all accrual transactions (including lease start)
    const accrualTransactions = await TransactionEntry.find({
      source: 'rental_accrual',
      'metadata.studentId': studentId,
      $or: [
        { 'metadata.type': 'monthly_rent_accrual' },
        { 'metadata.type': 'lease_start' }
      ]
    }).sort({ date: 1 });
    
    console.log('\n📊 ACCRUAL TRANSACTIONS FOUND:');
    accrualTransactions.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.metadata.type}: $${tx.totalDebit} (${tx.transactionId})`);
    });
    
    // Calculate expected total owed
    const expectedTotalOwed = accrualTransactions.reduce((sum, tx) => {
      return sum + (tx.totalDebit || 0);
    }, 0);
    
    console.log(`\n📊 EXPECTED TOTAL OWED: $${expectedTotalOwed}`);
    console.log(`📊 ACTUAL TOTAL OWED: $${debtor.totalOwed}`);
    console.log(`📊 DIFFERENCE: $${expectedTotalOwed - debtor.totalOwed}`);
    
    if (expectedTotalOwed !== debtor.totalOwed) {
      console.log('\n🔧 FIXING TOTAL OWED CALCULATION...');
      
      // Recalculate totals
      await DebtorTransactionSyncService.recalculateDebtorTotalsFromTransactions(debtor, studentId);
      await debtor.save();
      
      console.log('\n✅ TOTALS AFTER FIX:');
      console.log(`   Total Owed: $${debtor.totalOwed}`);
      console.log(`   Total Paid: $${debtor.totalPaid}`);
      console.log(`   Current Balance: $${debtor.currentBalance}`);
      console.log(`   Status: ${debtor.status}`);
      
      // Verify the fix
      if (debtor.totalOwed === expectedTotalOwed) {
        console.log('\n✅ SUCCESS: Total owed now correctly includes lease start transaction!');
      } else {
        console.log('\n❌ ERROR: Total owed still incorrect');
      }
    } else {
      console.log('\n✅ Total owed is already correct!');
    }
    
    // Show breakdown of what should be included
    console.log('\n📋 BREAKDOWN OF WHAT SHOULD BE INCLUDED IN TOTAL OWED:');
    let breakdown = {};
    accrualTransactions.forEach(tx => {
      const type = tx.metadata.type;
      if (!breakdown[type]) breakdown[type] = 0;
      breakdown[type] += tx.totalDebit || 0;
    });
    
    Object.entries(breakdown).forEach(([type, amount]) => {
      console.log(`   ${type}: $${amount}`);
    });
    
    console.log(`   TOTAL: $${expectedTotalOwed}`);
    
  } catch (error) {
    console.error('❌ Error testing total owed fix:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
testTotalOwedFix();
