const mongoose = require('mongoose');
require('dotenv').config();

async function testCorrectUserIdPayment() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const User = require('./src/models/User');
    const Application = require('./src/models/Application');
    const Debtor = require('./src/models/Debtor');
    const PaymentService = require('./src/services/paymentService');
    
    console.log('\n🧪 TESTING CORRECT USER ID PAYMENT');
    console.log('===================================');
    
    // 1. Find the correct user ID for Cindy
    console.log('\n1️⃣ FINDING CORRECT USER ID:');
    const cindyTransactions = await TransactionEntry.find({
      'entries.description': { $regex: /cindy/i }
    }).sort({ date: 1 });
    
    // Extract user IDs from AR account codes
    const userIds = new Set();
    cindyTransactions.forEach(tx => {
      const arEntries = tx.entries.filter(entry => entry.accountCode.startsWith('1100-'));
      arEntries.forEach(entry => {
        const userId = entry.accountCode.replace('1100-', '');
        userIds.add(userId);
      });
    });
    
    console.log('User IDs found in transactions:', Array.from(userIds));
    
    // Find which user ID actually exists as a user
    let correctUserId = null;
    for (const userId of userIds) {
      const user = await User.findById(userId);
      if (user) {
        correctUserId = userId;
        console.log(`✅ Found correct user ID: ${userId} (${user.firstName} ${user.lastName})`);
        break;
      }
    }
    
    if (!correctUserId) {
      console.log('❌ No valid user ID found');
      return;
    }
    
    // 2. Check if debtor exists for this user
    console.log('\n2️⃣ CHECKING DEBTOR:');
    const debtor = await Debtor.findOne({ user: correctUserId });
    
    if (debtor) {
      console.log(`✅ Debtor found: ${debtor.debtorCode}`);
    } else {
      console.log(`❌ No debtor found for user ${correctUserId}`);
      console.log('Creating debtor...');
      
      // Find application for this user
      const application = await Application.findOne({ student: correctUserId });
      if (application) {
        console.log(`✅ Found application for user ${correctUserId}`);
        
        // Create debtor
        const { createDebtorForStudent } = require('./src/services/debtorService');
        const user = await User.findById(correctUserId);
        
        const debtorOptions = {
          residenceId: application.residence,
          roomNumber: application.allocatedRoom,
          createdBy: 'system',
          startDate: application.startDate,
          endDate: application.endDate,
          application: application._id,
          applicationCode: application.applicationCode
        };
        
        const newDebtor = await createDebtorForStudent(user, debtorOptions);
        if (newDebtor) {
          console.log(`✅ Debtor created: ${newDebtor.debtorCode}`);
        } else {
          console.log(`❌ Failed to create debtor`);
          return;
        }
      } else {
        console.log(`❌ No application found for user ${correctUserId}`);
        return;
      }
    }
    
    // 3. Create a test payment with the correct user ID
    console.log('\n3️⃣ CREATING TEST PAYMENT:');
    const testPaymentData = {
      totalAmount: 380,
      payments: [
        { type: 'rent', amount: 180 },
        { type: 'admin', amount: 20 },
        { type: 'deposit', amount: 180 }
      ],
      student: correctUserId, // Use the correct user ID
      residence: '67d723cf20f89c4ae69804f3',
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
    
    // 4. Check if double-entry transactions were created
    console.log('\n4️⃣ CHECKING DOUBLE-ENTRY TRANSACTIONS:');
    
    // Wait a moment for transactions to be created
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newTransactions = await TransactionEntry.find({
      source: 'payment',
      'metadata.studentId': correctUserId
    }).sort({ date: -1 }).limit(5);
    
    console.log(`Found ${newTransactions.length} payment transactions for user ${correctUserId}`);
    
    newTransactions.forEach((tx, index) => {
      console.log(`\n  Payment Transaction ${index + 1}:`);
      console.log(`    Date: ${tx.date.toLocaleDateString()}`);
      console.log(`    Description: ${tx.description}`);
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
    
    // Calculate AR balance for this user
    const userARTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${correctUserId}` }
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
    
    console.log(`Accounts Receivable (User ${correctUserId}): $${arBalance.toFixed(2)}`);
    console.log(`Cash: $${cashBalance.toFixed(2)}`);
    
    // 6. Summary
    console.log('\n6️⃣ SUMMARY:');
    if (newTransactions.length > 0) {
      console.log('✅ Double-entry transactions were created successfully');
      console.log(`   Created ${newTransactions.length} payment transaction(s)`);
      console.log('✅ Payment allocation worked with correct user ID');
    } else {
      console.log('❌ No double-entry transactions were created');
      console.log('   Payment was recorded but no accounting entries were made');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testCorrectUserIdPayment();
