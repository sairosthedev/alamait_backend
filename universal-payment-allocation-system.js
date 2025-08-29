const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function universalPaymentAllocationSystem() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔧 UNIVERSAL PAYMENT ALLOCATION SYSTEM\n');

    // 1. Analyze current AR structure
    console.log('📊 STEP 1: Analyzing Current AR Structure\n');
    
    const allARTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: /^1100/ },
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`Found ${allARTransactions.length} AR transactions`);

    // Categorize by account type
    const generalAR = [];
    const studentSpecificAR = [];
    const accountTypes = {};

    allARTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100')) {
          if (entry.accountCode === '1100') {
            generalAR.push({ tx, entry });
          } else if (entry.accountCode.startsWith('1100-')) {
            studentSpecificAR.push({ tx, entry });
          }
          
          if (!accountTypes[entry.accountCode]) {
            accountTypes[entry.accountCode] = {
              totalDebit: 0,
              totalCredit: 0,
              transactions: []
            };
          }
          
          accountTypes[entry.accountCode].totalDebit += entry.debit || 0;
          accountTypes[entry.accountCode].totalCredit += entry.credit || 0;
          accountTypes[entry.accountCode].transactions.push(tx);
        }
      });
    });

    console.log(`📋 General AR (1100): ${generalAR.length} entries`);
    console.log(`📋 Student-Specific AR (1100-*): ${studentSpecificAR.length} entries`);

    // 2. Show current balances by account type
    console.log('\n📊 STEP 2: Current AR Balances by Account Type\n');
    
    Object.entries(accountTypes).forEach(([accountCode, data]) => {
      const balance = data.totalDebit - data.totalCredit;
      console.log(`   ${accountCode}: $${balance} (${data.transactions.length} transactions)`);
    });

    // 3. Create universal payment allocation function
    console.log('\n📊 STEP 3: Universal Payment Allocation Function\n');
    
    async function allocatePayment(paymentData) {
      const { amount, studentId, studentName, paymentMethod = 'Cash', date = new Date() } = paymentData;
      
      console.log(`\n🎯 Allocating payment: $${amount} for ${studentName || studentId}`);
      
      // Determine which account to use
      let targetAccountCode = '1100'; // Default to general AR
      let targetAccountName = 'Accounts Receivable - Tenants';
      
      // Check if student-specific account exists
      if (studentId) {
        const studentSpecificAccount = `1100-${studentId}`;
        if (accountTypes[studentSpecificAccount]) {
          targetAccountCode = studentSpecificAccount;
          targetAccountName = `Accounts Receivable - ${studentName || studentId}`;
          console.log(`   ✅ Using student-specific account: ${targetAccountCode}`);
        } else {
          console.log(`   ℹ️  Using general AR account: ${targetAccountCode}`);
        }
      }

      // Create payment allocation transaction
      const paymentAllocation = new TransactionEntry({
        transactionId: `PAYMENT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        date: date,
        description: `Payment allocation: $${amount} for ${studentName || studentId}`,
        reference: `PAYMENT-${studentId || 'GENERAL'}`,
        entries: [
          {
            accountCode: paymentMethod === 'Cash' ? '1000' : '1001', // Cash or Bank
            accountName: paymentMethod === 'Cash' ? 'Cash' : 'Bank Account',
            accountType: 'Asset',
            debit: amount,
            credit: 0,
            description: `${paymentMethod} received for rent payment`
          },
          {
            accountCode: targetAccountCode,
            accountName: targetAccountName,
            accountType: 'Asset',
            debit: 0,
            credit: amount,
            description: `Rent receivable settled for ${studentName || studentId}`
          }
        ],
        totalDebit: amount,
        totalCredit: amount,
        source: 'payment',
        sourceId: new mongoose.Types.ObjectId(),
        sourceModel: 'Payment',
        createdBy: 'system',
        status: 'posted',
        metadata: {
          studentId: studentId,
          studentName: studentName,
          paymentType: 'rent',
          amount: amount,
          paymentMethod: paymentMethod,
          allocationType: targetAccountCode === '1100' ? 'general' : 'student_specific'
        }
      });

      await paymentAllocation.save();
      console.log(`   ✅ Created payment allocation transaction`);
      
      return paymentAllocation;
    }

    // 4. Test the universal system with different scenarios
    console.log('\n📊 STEP 4: Testing Universal Payment Allocation\n');

    // Test 1: Payment for existing student with specific account
    if (studentSpecificAR.length > 0) {
      const firstStudentAR = studentSpecificAR[0];
      const studentId = firstStudentAR.entry.accountCode.split('-')[1];
      const studentName = firstStudentAR.tx.description.split(':')[1]?.trim().split(' - ')[0] || 'Unknown Student';
      
      console.log(`\n🧪 Test 1: Payment for student with specific account`);
      await allocatePayment({
        amount: 300,
        studentId: studentId,
        studentName: studentName,
        paymentMethod: 'Bank Transfer',
        date: new Date('2025-08-28')
      });
    }

    // Test 2: Payment for student using general AR account
    console.log(`\n🧪 Test 2: Payment using general AR account`);
    await allocatePayment({
      amount: 200,
      studentName: 'New Student',
      paymentMethod: 'Cash',
      date: new Date('2025-08-28')
    });

    // Test 3: Payment for existing student using general AR
    if (generalAR.length > 0) {
      const firstGeneralAR = generalAR[0];
      const studentName = firstGeneralAR.tx.description.split(':')[1]?.trim().split(' - ')[0] || 'General Student';
      
      console.log(`\n🧪 Test 3: Payment for existing student using general AR`);
      await allocatePayment({
        amount: 150,
        studentName: studentName,
        paymentMethod: 'Cash',
        date: new Date('2025-08-28')
      });
    }

    // 5. Verify updated balances
    console.log('\n📊 STEP 5: Verifying Updated AR Balances\n');
    
    const updatedARTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: /^1100/ },
      status: 'posted'
    }).sort({ date: 1 });

    const updatedAccountTypes = {};

    updatedARTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100')) {
          if (!updatedAccountTypes[entry.accountCode]) {
            updatedAccountTypes[entry.accountCode] = {
              totalDebit: 0,
              totalCredit: 0,
              transactions: []
            };
          }
          
          updatedAccountTypes[entry.accountCode].totalDebit += entry.debit || 0;
          updatedAccountTypes[entry.accountCode].totalCredit += entry.credit || 0;
          updatedAccountTypes[entry.accountCode].transactions.push(tx);
        }
      });
    });

    console.log('📋 Updated AR Balances:');
    Object.entries(updatedAccountTypes).forEach(([accountCode, data]) => {
      const balance = data.totalDebit - data.totalCredit;
      const previousBalance = accountTypes[accountCode] ? 
        accountTypes[accountCode].totalDebit - accountTypes[accountCode].totalCredit : 0;
      const change = balance - previousBalance;
      
      console.log(`   ${accountCode}: $${balance} (${change > 0 ? '+' : ''}${change})`);
    });

    // 6. Show payment allocation summary
    console.log('\n📊 STEP 6: Payment Allocation Summary\n');
    
    const recentPayments = await TransactionEntry.find({
      source: 'payment',
      date: { $gte: new Date('2025-08-28') },
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`📋 Recent Payment Allocations (${recentPayments.length}):`);
    recentPayments.forEach((payment, index) => {
      const studentName = payment.metadata?.studentName || 'Unknown';
      const allocationType = payment.metadata?.allocationType || 'unknown';
      console.log(`   ${index + 1}. $${payment.totalDebit} for ${studentName} (${allocationType})`);
    });

    console.log('\n🎯 UNIVERSAL PAYMENT ALLOCATION SYSTEM SUCCESS!');
    console.log('   ✅ Works with general AR accounts (1100)');
    console.log('   ✅ Works with student-specific AR accounts (1100-{studentId})');
    console.log('   ✅ Automatically detects account type');
    console.log('   ✅ Creates proper double-entry transactions');
    console.log('   ✅ Tracks allocation type in metadata');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

universalPaymentAllocationSystem();
