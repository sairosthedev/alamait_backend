require('dotenv').config();
const mongoose = require('mongoose');

async function testPaymentCreation() {
    try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const PaymentService = require('./src/services/paymentService');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68af33e9aef6b0dcc8e8f14b'; // Cindy's ID
    
    console.log('\n🧪 TESTING PAYMENT CREATION');
    console.log('============================');
    
    // 1. Check current transactions before payment
    console.log('\n1️⃣ TRANSACTIONS BEFORE PAYMENT:');
    const beforeTransactions = await TransactionEntry.find({
      $or: [
        { 'entries.accountCode': { $regex: `^1100-${studentId}` } },
        { source: 'payment' }
      ]
    }).sort({ date: 1 });
    
    console.log(`Found ${beforeTransactions.length} transactions before payment`);
    
    // 2. Create a test payment
    console.log('\n2️⃣ CREATING TEST PAYMENT:');
        const testPaymentData = {
      totalAmount: 380,
      payments: [
        { type: 'rent', amount: 180 },
        { type: 'admin', amount: 20 },
        { type: 'deposit', amount: 180 }
      ],
      student: studentId,
      residence: '67d723cf20f89c4ae69804f3', // Cindy's residence
      method: 'Cash',
      date: new Date()
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
    
    // 3. Check transactions after payment
    console.log('\n3️⃣ TRANSACTIONS AFTER PAYMENT:');
    const afterTransactions = await TransactionEntry.find({
      $or: [
        { 'entries.accountCode': { $regex: `^1100-${studentId}` } },
        { source: 'payment' }
      ]
    }).sort({ date: 1 });
    
    console.log(`Found ${afterTransactions.length} transactions after payment`);
    
    // 4. Show new transactions
    const newTransactions = afterTransactions.filter(tx => 
      !beforeTransactions.some(beforeTx => beforeTx._id.toString() === tx._id.toString())
    );
    
    console.log(`\n4️⃣ NEW TRANSACTIONS CREATED: ${newTransactions.length}`);
    
    newTransactions.forEach((tx, index) => {
      console.log(`\n  New Transaction ${index + 1}:`);
      console.log(`    ID: ${tx._id}`);
      console.log(`    Date: ${tx.date.toLocaleDateString()}`);
      console.log(`    Description: ${tx.description}`);
      console.log(`    Source: ${tx.source}`);
      console.log(`    Total: $${tx.totalDebit.toFixed(2)}`);
      
      if (tx.metadata) {
        console.log(`    Payment Type: ${tx.metadata.paymentType || 'N/A'}`);
        console.log(`    Month Settled: ${tx.metadata.monthSettled || 'N/A'}`);
        console.log(`    Allocation Type: ${tx.metadata.allocationType || 'N/A'}`);
      }
      
      console.log(`    Entries:`);
      tx.entries.forEach((entry, entryIndex) => {
        console.log(`      ${entryIndex + 1}. ${entry.accountCode} - ${entry.accountName}`);
        console.log(`         Debit: $${entry.debit}, Credit: $${entry.credit}`);
        console.log(`         Description: ${entry.description}`);
      });
    });
    
    // 5. Check balance sheet impact
    console.log('\n5️⃣ BALANCE SHEET IMPACT:');
    
    // Calculate AR balance
    let arBalance = 0;
    afterTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          arBalance += entry.debit - entry.credit;
        }
      });
    });
    
    // Calculate cash balance
    let cashBalance = 0;
    afterTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('100')) {
          cashBalance += entry.debit - entry.credit;
        }
      });
    });
    
    // Calculate deposit liability
    let depositLiability = 0;
    afterTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode === '2020') {
          depositLiability += entry.credit - entry.debit;
        }
      });
    });
    
    console.log(`Accounts Receivable: $${arBalance.toFixed(2)}`);
    console.log(`Cash: $${cashBalance.toFixed(2)}`);
    console.log(`Security Deposits Liability: $${depositLiability.toFixed(2)}`);
    
    // 6. Summary
    console.log('\n6️⃣ SUMMARY:');
    if (newTransactions.length > 0) {
      console.log('✅ Double-entry transactions were created');
      console.log(`   Created ${newTransactions.length} new transaction(s)`);
    } else {
      console.log('❌ No double-entry transactions were created');
      console.log('   This means the payment was recorded but no accounting entries were made');
    }
    
    } catch (error) {
    console.error('❌ Error:', error.message);
    } finally {
            await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
    }
}

testPaymentCreation();
