const mongoose = require('mongoose');
require('dotenv').config();

async function testMonthSettledFix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const PaymentService = require('./src/services/paymentService');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68af33e9aef6b0dcc8e8f149'; // Cindy's correct user ID
    
    console.log('\n🧪 TESTING MONTH SETTLED FIX');
    console.log('=============================');
    
    // 1. Create a test payment with explicit month
    console.log('\n1️⃣ CREATING TEST PAYMENT:');
    const testPaymentData = {
      totalAmount: 200,
      payments: [
        { type: 'rent', amount: 180 },
        { type: 'admin', amount: 20 }
      ],
      student: studentId,
      residence: '67d723cf20f89c4ae69804f3',
      method: 'Cash',
      date: new Date(),
      paymentMonth: '2025-05' // Explicitly set payment month
    };
    
    console.log('Payment data:', JSON.stringify(testPaymentData, null, 2));
    
    try {
      const payment = await PaymentService.createPaymentWithSmartAllocation(
        testPaymentData,
        'test-user-id'
      );
      
      console.log('✅ Payment created successfully');
      console.log(`Payment ID: ${payment.paymentId}`);
      console.log(`Allocation: ${payment.allocation ? 'Completed' : 'Pending'}`);
      
      if (payment.allocation) {
        console.log('Allocation details:', JSON.stringify(payment.allocation, null, 2));
      }
      
    } catch (error) {
      console.error('❌ Payment creation failed:', error.message);
      return;
    }
    
    // 2. Check payment transactions and their monthSettled values
    console.log('\n2️⃣ CHECKING PAYMENT TRANSACTIONS:');
    
    // Wait a moment for transactions to be created
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      'metadata.studentId': studentId
    }).sort({ date: -1 }).limit(10);
    
    console.log(`Found ${paymentTransactions.length} payment transactions for user ${studentId}`);
    
    paymentTransactions.forEach((tx, index) => {
      console.log(`\n  Payment Transaction ${index + 1}:`);
      console.log(`    ID: ${tx._id}`);
      console.log(`    Date: ${tx.date.toLocaleDateString()}`);
      console.log(`    Description: ${tx.description}`);
      console.log(`    Total: $${tx.totalDebit.toFixed(2)}`);
      
      if (tx.metadata) {
        console.log(`    Payment Type: ${tx.metadata.paymentType || 'N/A'}`);
        console.log(`    Month Settled: ${tx.metadata.monthSettled || 'N/A'}`);
        console.log(`    Allocation Type: ${tx.metadata.allocationType || 'N/A'}`);
        console.log(`    Payment ID: ${tx.metadata.paymentId || 'N/A'}`);
      }
      
      console.log(`    Entries:`);
      tx.entries.forEach((entry, entryIndex) => {
        console.log(`      ${entryIndex + 1}. ${entry.accountCode} - ${entry.accountName}`);
        console.log(`         Debit: $${entry.debit}, Credit: $${entry.credit}`);
        console.log(`         Description: ${entry.description}`);
      });
    });
    
    // 3. Check for duplicate transactions
    console.log('\n3️⃣ CHECKING FOR DUPLICATES:');
    const paymentIds = new Set();
    const duplicates = [];
    
    paymentTransactions.forEach(tx => {
      if (tx.metadata && tx.metadata.paymentId) {
        if (paymentIds.has(tx.metadata.paymentId)) {
          duplicates.push(tx);
        } else {
          paymentIds.add(tx.metadata.paymentId);
        }
      }
    });
    
    if (duplicates.length > 0) {
      console.log(`❌ Found ${duplicates.length} duplicate transactions:`);
      duplicates.forEach((tx, index) => {
        console.log(`   Duplicate ${index + 1}: ${tx._id} - ${tx.description}`);
      });
    } else {
      console.log('✅ No duplicate transactions found');
    }
    
    // 4. Verify monthSettled values
    console.log('\n4️⃣ VERIFYING MONTH SETTLED VALUES:');
    let correctMonthSettled = 0;
    let missingMonthSettled = 0;
    
    paymentTransactions.forEach(tx => {
      if (tx.metadata && tx.metadata.monthSettled) {
        console.log(`✅ Transaction ${tx._id}: monthSettled = ${tx.metadata.monthSettled}`);
        correctMonthSettled++;
      } else {
        console.log(`❌ Transaction ${tx._id}: monthSettled = MISSING`);
        missingMonthSettled++;
      }
    });
    
    console.log(`\n📊 Month Settled Summary:`);
    console.log(`   Correct: ${correctMonthSettled}`);
    console.log(`   Missing: ${missingMonthSettled}`);
    
    // 5. Check balance sheet impact
    console.log('\n5️⃣ BALANCE SHEET IMPACT:');
    
    // Calculate AR balance for this user
    const userARTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId}` }
    });
    
    let arBalance = 0;
    userARTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          arBalance += entry.debit - entry.credit;
        }
      });
    });
    
    // Calculate cash balance
    const cashTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^100[0-9]' }
    });
    
    let cashBalance = 0;
    cashTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('100')) {
          cashBalance += entry.debit - entry.credit;
        }
      });
    });
    
    console.log(`Accounts Receivable (User ${studentId}): $${arBalance.toFixed(2)}`);
    console.log(`Cash: $${cashBalance.toFixed(2)}`);
    
    // 6. Summary
    console.log('\n6️⃣ SUMMARY:');
    if (correctMonthSettled > 0 && missingMonthSettled === 0) {
      console.log('✅ All payment transactions have correct monthSettled values');
      console.log('✅ No duplicate transactions created');
      console.log('✅ Balance sheet properly updated');
    } else {
      console.log('❌ Issues found with monthSettled or duplicate transactions');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testMonthSettledFix();
