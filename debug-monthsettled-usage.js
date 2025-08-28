const mongoose = require('mongoose');
require('dotenv').config();

async function debugMonthSettledUsage() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    
    console.log('\n🔍 DEBUGGING MONTHSETTLED USAGE');
    console.log('=================================');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6';
    
    // 1. Check all payment transactions and their monthSettled values
    console.log('\n1️⃣ PAYMENT TRANSACTIONS WITH MONTHSETTLED:');
    console.log('===========================================');
    
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': { $exists: true, $ne: null }
    }).sort({ date: 1 });
    
    console.log(`Found ${paymentTransactions.length} payment transactions with monthSettled:`);
    
    paymentTransactions.forEach((tx, index) => {
      const arEntry = tx.entries.find(e => e.accountCode.startsWith('1100-') && e.credit > 0);
      const cashEntry = tx.entries.find(e => e.accountCode === '1000' && e.debit > 0);
      
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Month Settled: ${tx.metadata?.monthSettled}`);
      console.log(`   Payment Type: ${tx.metadata?.paymentType || 'unknown'}`);
      console.log(`   Amount: $${arEntry?.credit || cashEntry?.debit || 0}`);
      console.log(`   AR Account: ${arEntry?.accountCode || 'N/A'}`);
    });
    
    // 2. Check current outstanding balances calculation
    console.log('\n2️⃣ CURRENT OUTSTANDING BALANCES CALCULATION:');
    console.log('=============================================');
    
    try {
      const outstandingBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);
      console.log(`\nCurrent outstanding balances: ${outstandingBalances.length} months`);
      
      outstandingBalances.forEach((month, index) => {
        console.log(`\n${index + 1}. ${month.monthKey} (${month.monthName}):`);
        console.log(`   Rent Outstanding: $${month.rent.outstanding.toFixed(2)}`);
        console.log(`   Admin Fee Outstanding: $${month.adminFee.outstanding.toFixed(2)}`);
        console.log(`   Deposit Outstanding: $${month.deposit.outstanding.toFixed(2)}`);
        console.log(`   Total Outstanding: $${month.totalOutstanding.toFixed(2)}`);
        console.log(`   Fully Settled: ${month.fullySettled}`);
      });
    } catch (error) {
      console.error(`❌ Error getting outstanding balances: ${error.message}`);
    }
    
    // 3. Check what the balance sheet should look like with proper monthSettled usage
    console.log('\n3️⃣ WHAT BALANCE SHEET SHOULD LOOK LIKE:');
    console.log('=========================================');
    
    // Get all accrual transactions for this student
    const accrualTransactions = await TransactionEntry.find({
      source: 'rental_accrual',
      $or: [
        { 'metadata.studentId': studentId },
        { 'entries.accountCode': { $regex: `^1100-${studentId}` } }
      ]
    }).sort({ date: 1 });
    
    console.log(`\nAccrual transactions: ${accrualTransactions.length}`);
    
    // Build monthly debt structure
    const monthlyDebt = {};
    
    accrualTransactions.forEach(accrual => {
      const accrualDate = new Date(accrual.date);
      const monthKey = `${accrualDate.getFullYear()}-${String(accrualDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyDebt[monthKey]) {
        monthlyDebt[monthKey] = {
          monthKey,
          rent: { owed: 0, paid: 0, outstanding: 0 },
          adminFee: { owed: 0, paid: 0, outstanding: 0 },
          deposit: { owed: 0, paid: 0, outstanding: 0 },
          totalOutstanding: 0
        };
      }
      
      // Categorize the debt
      accrual.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-') && entry.accountType === 'Asset' && entry.debit > 0) {
          const description = entry.description.toLowerCase();
          
          if (description.includes('admin fee') || description.includes('administrative')) {
            monthlyDebt[monthKey].adminFee.owed += entry.debit;
          } else if (description.includes('security deposit') || description.includes('deposit')) {
            monthlyDebt[monthKey].deposit.owed += entry.debit;
          } else {
            monthlyDebt[monthKey].rent.owed += entry.debit;
          }
        }
      });
    });
    
    // Apply payments using monthSettled
    paymentTransactions.forEach(payment => {
      const monthSettled = payment.metadata?.monthSettled;
      const paymentType = payment.metadata?.paymentType;
      const amount = payment.entries.find(e => e.accountCode.startsWith('1100-') && e.credit > 0)?.credit || 0;
      
      if (monthSettled && monthlyDebt[monthSettled]) {
        console.log(`\n💰 Applying payment to ${monthSettled}: $${amount} (${paymentType})`);
        
        if (paymentType === 'rent') {
          monthlyDebt[monthSettled].rent.paid += amount;
        } else if (paymentType === 'admin') {
          monthlyDebt[monthSettled].adminFee.paid += amount;
        } else if (paymentType === 'deposit') {
          monthlyDebt[monthSettled].deposit.paid += amount;
        }
      } else {
        console.log(`\n⚠️ Payment without proper monthSettled: $${amount} (${paymentType})`);
      }
    });
    
    // Calculate outstanding amounts
    Object.values(monthlyDebt).forEach(month => {
      month.rent.outstanding = Math.max(0, month.rent.owed - month.rent.paid);
      month.adminFee.outstanding = Math.max(0, month.adminFee.owed - month.adminFee.paid);
      month.deposit.outstanding = Math.max(0, month.deposit.owed - month.deposit.paid);
      month.totalOutstanding = month.rent.outstanding + month.adminFee.outstanding + month.deposit.outstanding;
    });
    
    // Show the corrected balance sheet
    console.log('\n📊 CORRECTED BALANCE SHEET (using monthSettled):');
    console.log('=================================================');
    
    Object.entries(monthlyDebt)
      .filter(([_, month]) => month.totalOutstanding > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([monthKey, month]) => {
        console.log(`\n${monthKey}:`);
        console.log(`  Rent: $${month.rent.outstanding.toFixed(2)} (owed: $${month.rent.owed.toFixed(2)}, paid: $${month.rent.paid.toFixed(2)})`);
        console.log(`  Admin Fee: $${month.adminFee.outstanding.toFixed(2)} (owed: $${month.adminFee.owed.toFixed(2)}, paid: $${month.adminFee.paid.toFixed(2)})`);
        console.log(`  Deposit: $${month.deposit.outstanding.toFixed(2)} (owed: $${month.deposit.owed.toFixed(2)}, paid: $${month.deposit.paid.toFixed(2)})`);
        console.log(`  Total Outstanding: $${month.totalOutstanding.toFixed(2)}`);
      });
    
    // 4. Summary of the issue
    console.log('\n4️⃣ ISSUE SUMMARY:');
    console.log('==================');
    console.log('❌ PROBLEM: monthSettled is being set but not properly used in balance sheet calculations');
    console.log('✅ SOLUTION: The system should use monthSettled to properly allocate payments to specific months');
    console.log('💰 IMPACT: Without proper monthSettled usage, payments may not be correctly applied to the right months');
    console.log('📊 RESULT: Balance sheet may show incorrect outstanding balances');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

debugMonthSettledUsage();
