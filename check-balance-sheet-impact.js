const mongoose = require('mongoose');
require('dotenv').config();

async function checkBalanceSheetImpact() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const Payment = require('./src/models/Payment');
    
    const studentId = '68af33e9aef6b0dcc8e8f149'; // Cindy's correct user ID
    
    console.log('\n🔍 CHECKING BALANCE SHEET IMPACT');
    console.log('==================================');
    
    // 1. Check all payment transactions and their monthSettled values
    console.log('\n1️⃣ ALL PAYMENT TRANSACTIONS:');
    const allPaymentTransactions = await TransactionEntry.find({
      source: 'payment',
      'metadata.studentId': studentId
    }).sort({ date: -1 });
    
    console.log(`Total payment transactions: ${allPaymentTransactions.length}`);
    
    const monthImpact = {};
    
    allPaymentTransactions.forEach((tx, index) => {
      const monthSettled = tx.metadata?.monthSettled;
      const paymentType = tx.metadata?.paymentType;
      const amount = tx.totalDebit;
      
      console.log(`\n  Transaction ${index + 1}:`);
      console.log(`    ID: ${tx._id}`);
      console.log(`    Description: ${tx.description}`);
      console.log(`    Amount: $${amount.toFixed(2)}`);
      console.log(`    Payment Type: ${paymentType || 'N/A'}`);
      console.log(`    Month Settled: ${monthSettled || 'N/A'}`);
      console.log(`    Payment ID: ${tx.metadata?.paymentId || 'N/A'}`);
      
      if (monthSettled) {
        if (!monthImpact[monthSettled]) {
          monthImpact[monthSettled] = {
            rent: 0,
            admin: 0,
            deposit: 0,
            total: 0,
            transactions: []
          };
        }
        
        monthImpact[monthSettled][paymentType] += amount;
        monthImpact[monthSettled].total += amount;
        monthImpact[monthSettled].transactions.push({
          id: tx._id,
          type: paymentType,
          amount: amount,
          description: tx.description
        });
      }
    });
    
    // 2. Summary by month
    console.log('\n2️⃣ BALANCE SHEET IMPACT BY MONTH:');
    Object.entries(monthImpact).forEach(([month, impact]) => {
      console.log(`\n  ${month}:`);
      console.log(`    Rent: $${impact.rent.toFixed(2)}`);
      console.log(`    Admin: $${impact.admin.toFixed(2)}`);
      console.log(`    Deposit: $${impact.deposit.toFixed(2)}`);
      console.log(`    Total: $${impact.total.toFixed(2)}`);
      console.log(`    Transactions: ${impact.transactions.length}`);
      
      impact.transactions.forEach(tx => {
        console.log(`      - ${tx.type}: $${tx.amount.toFixed(2)} (${tx.description})`);
      });
    });
    
    // 3. Check what payments were supposed to be allocated
    console.log('\n3️⃣ PAYMENTS THAT SHOULD HAVE BEEN ALLOCATED:');
    const allPayments = await Payment.find({
      student: studentId
    }).sort({ createdAt: -1 });
    
    allPayments.forEach((payment, index) => {
      console.log(`\n  Payment ${index + 1}: ${payment.paymentId}`);
      console.log(`    Date: ${payment.date.toLocaleDateString()}`);
      console.log(`    Total: $${payment.totalAmount}`);
      console.log(`    Components:`);
      payment.payments.forEach(comp => {
        console.log(`      - ${comp.type}: $${comp.amount}`);
      });
      
      // Check if this payment has transactions
      const paymentTransactions = allPaymentTransactions.filter(tx => 
        tx.metadata?.paymentId === payment._id.toString()
      );
      
      console.log(`    Transactions created: ${paymentTransactions.length}`);
      paymentTransactions.forEach(tx => {
        console.log(`      - ${tx.metadata?.paymentType}: $${tx.totalDebit.toFixed(2)} for ${tx.metadata?.monthSettled}`);
      });
    });
    
    // 4. Check outstanding balances to see what should be outstanding
    console.log('\n4️⃣ CURRENT OUTSTANDING BALANCES:');
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    
    try {
      const outstandingBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);
      
      if (outstandingBalances.success) {
        console.log(`Total outstanding: $${outstandingBalances.data.totalOutstanding}`);
        console.log(`Months with outstanding: ${outstandingBalances.data.monthsWithOutstanding}`);
        
        outstandingBalances.data.outstandingBalances.forEach(month => {
          console.log(`\n  ${month.monthName} ${month.year}:`);
          console.log(`    Rent: $${month.rent.outstanding.toFixed(2)}`);
          console.log(`    Admin Fee: $${month.adminFee.outstanding.toFixed(2)}`);
          console.log(`    Deposit: $${month.deposit.outstanding.toFixed(2)}`);
          console.log(`    Total: $${month.totalOutstanding.toFixed(2)}`);
        });
      } else {
        console.log('No outstanding balances found');
      }
    } catch (error) {
      console.log('Error getting outstanding balances:', error.message);
    }
    
    // 5. Check if there are missing transactions
    console.log('\n5️⃣ MISSING TRANSACTIONS ANALYSIS:');
    
    // Calculate expected payments by month
    const expectedPayments = {};
    
    allPayments.forEach(payment => {
      payment.payments.forEach(comp => {
        // For now, assume all payments should go to the earliest outstanding month
        // This is a simplification - in reality, it depends on the allocation logic
        if (!expectedPayments[comp.type]) {
          expectedPayments[comp.type] = 0;
        }
        expectedPayments[comp.type] += comp.amount;
      });
    });
    
    console.log('Expected total payments by type:');
    Object.entries(expectedPayments).forEach(([type, amount]) => {
      console.log(`  ${type}: $${amount.toFixed(2)}`);
    });
    
    // Calculate actual payments by type
    const actualPayments = {};
    allPaymentTransactions.forEach(tx => {
      const type = tx.metadata?.paymentType;
      if (type) {
        if (!actualPayments[type]) {
          actualPayments[type] = 0;
        }
        actualPayments[type] += tx.totalDebit;
      }
    });
    
    console.log('Actual total payments by type:');
    Object.entries(actualPayments).forEach(([type, amount]) => {
      console.log(`  ${type}: $${amount.toFixed(2)}`);
    });
    
    // Find missing payments
    console.log('Missing payments:');
    Object.entries(expectedPayments).forEach(([type, expectedAmount]) => {
      const actualAmount = actualPayments[type] || 0;
      const missing = expectedAmount - actualAmount;
      if (missing > 0) {
        console.log(`  ${type}: Missing $${missing.toFixed(2)}`);
      }
    });
    
    // 6. Final analysis
    console.log('\n6️⃣ FINAL ANALYSIS:');
    console.log(`✅ Total payment transactions: ${allPaymentTransactions.length}`);
    console.log(`✅ Months affected: ${Object.keys(monthImpact).length}`);
    console.log(`✅ Months with transactions: ${Object.keys(monthImpact).join(', ')}`);
    
    if (Object.keys(monthImpact).length === 1 && Object.keys(monthImpact)[0] === '2025-08') {
      console.log(`❌ Only August was affected - other months missing transactions`);
    } else {
      console.log(`✅ Multiple months affected correctly`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkBalanceSheetImpact();
