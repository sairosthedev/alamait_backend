const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function createProperAllocationTransactions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔧 CREATING PROPER ALLOCATION TRANSACTIONS\n');

    // 1. First, let's create proper accrual transactions for the existing debtor
    console.log('📊 STEP 1: Creating Proper Accrual Transactions\n');
    
    const debtorUserId = '6894770ab6164ec67a9fdeb0';
    
    // Create May 2025 accrual (should be fully paid)
    const mayAccrual = new TransactionEntry({
      transactionId: 'TXN-MAY-ACCRUAL-001',
      date: new Date('2025-05-15'),
      description: 'Monthly rent accrual: Cindy Gwekwerere - 5/2025',
      reference: 'MAY-ACCRUAL-001',
      entries: [
        {
          accountCode: `1100-${debtorUserId}`,
          debit: 180,
          credit: 0,
          description: 'Rent receivable'
        },
        {
          accountCode: '4001',
          debit: 0,
          credit: 180,
          description: 'Rent income'
        }
      ],
      totalDebit: 180,
      totalCredit: 180,
      source: 'rental_accrual',
      sourceId: new mongoose.Types.ObjectId(),
      sourceModel: 'Accrual',
      residence: new mongoose.Types.ObjectId('67d723cf20f89c4ae69804f3'),
      createdBy: 'system',
      status: 'posted',
      metadata: {
        monthKey: '2025-05',
        studentId: debtorUserId,
        studentName: 'Cindy Gwekwerere'
      }
    });

    await mayAccrual.save();
    console.log('✅ Created May 2025 accrual: $180');

    // Create June 2025 accrual (should have $180 outstanding)
    const juneAccrual = new TransactionEntry({
      transactionId: 'TXN-JUNE-ACCRUAL-001',
      date: new Date('2025-06-01'),
      description: 'Monthly rent accrual: Cindy Gwekwerere - 6/2025',
      reference: 'JUNE-ACCRUAL-001',
      entries: [
        {
          accountCode: `1100-${debtorUserId}`,
          debit: 180,
          credit: 0,
          description: 'Rent receivable'
        },
        {
          accountCode: '4001',
          debit: 0,
          credit: 180,
          description: 'Rent income'
        }
      ],
      totalDebit: 180,
      totalCredit: 180,
      source: 'rental_accrual',
      sourceId: new mongoose.Types.ObjectId(),
      sourceModel: 'Accrual',
      residence: new mongoose.Types.ObjectId('67d723cf20f89c4ae69804f3'),
      createdBy: 'system',
      status: 'posted',
      metadata: {
        monthKey: '2025-06',
        studentId: debtorUserId,
        studentName: 'Cindy Gwekwerere'
      }
    });

    await juneAccrual.save();
    console.log('✅ Created June 2025 accrual: $180');

    // Create August 2025 accrual (should have $180 outstanding)
    const augustAccrual = new TransactionEntry({
      transactionId: 'TXN-AUGUST-ACCRUAL-001',
      date: new Date('2025-08-01'),
      description: 'Monthly rent accrual: Cindy Gwekwerere - 8/2025',
      reference: 'AUGUST-ACCRUAL-001',
      entries: [
        {
          accountCode: `1100-${debtorUserId}`,
          debit: 180,
          credit: 0,
          description: 'Rent receivable'
        },
        {
          accountCode: '4001',
          debit: 0,
          credit: 180,
          description: 'Rent income'
        }
      ],
      totalDebit: 180,
      totalCredit: 180,
      source: 'rental_accrual',
      sourceId: new mongoose.Types.ObjectId(),
      sourceModel: 'Accrual',
      residence: new mongoose.Types.ObjectId('67d723cf20f89c4ae69804f3'),
      createdBy: 'system',
      status: 'posted',
      metadata: {
        monthKey: '2025-08',
        studentId: debtorUserId,
        studentName: 'Cindy Gwekwerere'
      }
    });

    await augustAccrual.save();
    console.log('✅ Created August 2025 accrual: $180');

    // 2. Now create payment allocation transactions
    console.log('\n📊 STEP 2: Creating Payment Allocation Transactions\n');

    // Payment allocation for May 2025 (fully paid)
    const mayPaymentAllocation = new TransactionEntry({
      transactionId: 'TXN-MAY-PAYMENT-001',
      date: new Date('2025-08-27'),
      description: 'Payment allocation: $180 rent for 2025-05',
      reference: 'PAYMENT-001',
      entries: [
        {
          accountCode: '1005', // Cash
          debit: 180,
          credit: 0,
          description: 'Cash received'
        },
        {
          accountCode: `1100-${debtorUserId}`,
          debit: 0,
          credit: 180,
          description: 'Rent receivable settled'
        }
      ],
      totalDebit: 180,
      totalCredit: 180,
      source: 'payment',
      sourceId: new mongoose.Types.ObjectId(),
      sourceModel: 'Payment',
      residence: new mongoose.Types.ObjectId('67d723cf20f89c4ae69804f3'),
      createdBy: 'system',
      status: 'posted',
      metadata: {
        monthSettled: '2025-05',
        studentId: debtorUserId,
        studentName: 'Cindy Gwekwerere',
        paymentType: 'rent'
      }
    });

    await mayPaymentAllocation.save();
    console.log('✅ Created May 2025 payment allocation: $180 (monthSettled: 2025-05)');

    // 3. Verify the transactions were created
    console.log('\n📊 STEP 3: Verifying Created Transactions\n');
    
    const accruals = await TransactionEntry.find({
      source: 'rental_accrual',
      'entries.accountCode': { $regex: `^1100-${debtorUserId}` }
    });

    const payments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': { $exists: true },
      'entries.accountCode': { $regex: `^1100-${debtorUserId}` }
    });

    console.log(`Found ${accruals.length} accrual transactions for debtor`);
    console.log(`Found ${payments.length} payment allocation transactions for debtor`);

    // 4. Test balance sheet calculation
    console.log('\n📊 STEP 4: Testing Balance Sheet Calculation\n');
    
    // May 2025
    const mayAccruals = await TransactionEntry.find({
      source: 'rental_accrual',
      date: { $gte: new Date('2025-05-01'), $lte: new Date('2025-05-31') },
      'entries.accountCode': { $regex: `^1100-${debtorUserId}` }
    });

    const mayPayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': '2025-05',
      'entries.accountCode': { $regex: `^1100-${debtorUserId}` }
    });

    let mayAR = 0;
    mayAccruals.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
          mayAR += Number(entry.debit || 0);
        }
      });
    });
    
    mayPayments.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
          mayAR -= Number(entry.credit || 0);
        }
      });
    });

    console.log(`📅 May 2025 AR: $${mayAR} (Expected: $0)`);
    console.log(`   Status: ${mayAR === 0 ? '✅ CORRECT' : '❌ INCORRECT'}`);

    // June 2025
    const juneAccruals = await TransactionEntry.find({
      source: 'rental_accrual',
      date: { $gte: new Date('2025-06-01'), $lte: new Date('2025-06-30') },
      'entries.accountCode': { $regex: `^1100-${debtorUserId}` }
    });

    const junePayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': '2025-06',
      'entries.accountCode': { $regex: `^1100-${debtorUserId}` }
    });

    let juneAR = 0;
    juneAccruals.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
          juneAR += Number(entry.debit || 0);
        }
      });
    });
    
    junePayments.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
          juneAR -= Number(entry.credit || 0);
        }
      });
    });

    console.log(`📅 June 2025 AR: $${juneAR} (Expected: $180)`);
    console.log(`   Status: ${juneAR === 180 ? '✅ CORRECT' : '❌ INCORRECT'}`);

    // August 2025
    const augustAccruals = await TransactionEntry.find({
      source: 'rental_accrual',
      date: { $gte: new Date('2025-08-01'), $lte: new Date('2025-08-31') },
      'entries.accountCode': { $regex: `^1100-${debtorUserId}` }
    });

    const augustPayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': '2025-08',
      'entries.accountCode': { $regex: `^1100-${debtorUserId}` }
    });

    let augustAR = 0;
    augustAccruals.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
          augustAR += Number(entry.debit || 0);
        }
      });
    });
    
    augustPayments.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
          augustAR -= Number(entry.credit || 0);
        }
      });
    });

    console.log(`📅 August 2025 AR: $${augustAR} (Expected: $180)`);
    console.log(`   Status: ${augustAR === 180 ? '✅ CORRECT' : '❌ INCORRECT'}`);

    console.log('\n✅ Proper allocation transactions created!');
    console.log('🎯 Now the balance sheet should show:');
    console.log('   May AR: $0');
    console.log('   June AR: $180');
    console.log('   August AR: $180');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

createProperAllocationTransactions();
