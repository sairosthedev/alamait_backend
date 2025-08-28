const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const TransactionEntry = require('./src/models/TransactionEntry');

async function testMonthSettledLogic() {
  try {
    console.log('🔍 Testing monthSettled logic...\n');

    // Test for May 2025
    const mayKey = '2025-05';
    console.log(`📊 Testing May 2025 (${mayKey}):`);

    // 1. Get accruals for May
    const mayStart = new Date(2025, 4, 1); // May 1, 2025
    const mayEnd = new Date(2025, 4, 31, 23, 59, 59, 999); // May 31, 2025
    
    const mayAccruals = await TransactionEntry.find({
      source: 'rental_accrual',
      date: { $gte: mayStart, $lte: mayEnd },
      $or: [
        { 'entries.accountCode': { $regex: '^1100-' } },
        { 'entries.accountCode': '1100' }
      ]
    }).lean();

    console.log(`   May accruals found: ${mayAccruals.length}`);
    let mayARDebits = 0;
    mayAccruals.forEach(tx => {
      tx.entries.forEach(line => {
        if (line.accountCode && (line.accountCode.startsWith('1100-') || line.accountCode === '1100')) {
          mayARDebits += Number(line.debit || 0);
        }
      });
    });
    console.log(`   May AR debits (accruals): $${mayARDebits}`);

    // 2. Get payments allocated to May
    const mayPayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': mayKey,
      $or: [
        { 'entries.accountCode': { $regex: '^1100-' } },
        { 'entries.accountCode': '1100' }
      ]
    }).lean();

    console.log(`   May payments found: ${mayPayments.length}`);
    let mayARCredits = 0;
    mayPayments.forEach(tx => {
      console.log(`     Payment: ${tx.description} - monthSettled: ${tx.metadata?.monthSettled}`);
      tx.entries.forEach(line => {
        if (line.accountCode && (line.accountCode.startsWith('1100-') || line.accountCode === '1100')) {
          mayARCredits += Number(line.credit || 0);
        }
      });
    });
    console.log(`   May AR credits (payments): $${mayARCredits}`);

    const mayOutstanding = mayARDebits - mayARCredits;
    console.log(`   May AR outstanding: $${mayOutstanding}\n`);

    // Test for June 2025
    const juneKey = '2025-06';
    console.log(`📊 Testing June 2025 (${juneKey}):`);

    // 1. Get accruals for June
    const juneStart = new Date(2025, 5, 1); // June 1, 2025
    const juneEnd = new Date(2025, 5, 30, 23, 59, 59, 999); // June 30, 2025
    
    const juneAccruals = await TransactionEntry.find({
      source: 'rental_accrual',
      date: { $gte: juneStart, $lte: juneEnd },
      $or: [
        { 'entries.accountCode': { $regex: '^1100-' } },
        { 'entries.accountCode': '1100' }
      ]
    }).lean();

    console.log(`   June accruals found: ${juneAccruals.length}`);
    let juneARDebits = 0;
    juneAccruals.forEach(tx => {
      tx.entries.forEach(line => {
        if (line.accountCode && (line.accountCode.startsWith('1100-') || line.accountCode === '1100')) {
          juneARDebits += Number(line.debit || 0);
        }
      });
    });
    console.log(`   June AR debits (accruals): $${juneARDebits}`);

    // 2. Get payments allocated to June
    const junePayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': juneKey,
      $or: [
        { 'entries.accountCode': { $regex: '^1100-' } },
        { 'entries.accountCode': '1100' }
      ]
    }).lean();

    console.log(`   June payments found: ${junePayments.length}`);
    let juneARCredits = 0;
    junePayments.forEach(tx => {
      console.log(`     Payment: ${tx.description} - monthSettled: ${tx.metadata?.monthSettled}`);
      tx.entries.forEach(line => {
        if (line.accountCode && (line.accountCode.startsWith('1100-') || line.accountCode === '1100')) {
          juneARCredits += Number(line.credit || 0);
        }
      });
    });
    console.log(`   June AR credits (payments): $${juneARCredits}`);

    const juneOutstanding = juneARDebits - juneARCredits;
    console.log(`   June AR outstanding: $${juneOutstanding}\n`);

    // Test for August 2025
    const augustKey = '2025-08';
    console.log(`📊 Testing August 2025 (${augustKey}):`);

    // 1. Get accruals for August
    const augustStart = new Date(2025, 7, 1); // August 1, 2025
    const augustEnd = new Date(2025, 7, 31, 23, 59, 59, 999); // August 31, 2025
    
    const augustAccruals = await TransactionEntry.find({
      source: 'rental_accrual',
      date: { $gte: augustStart, $lte: augustEnd },
      $or: [
        { 'entries.accountCode': { $regex: '^1100-' } },
        { 'entries.accountCode': '1100' }
      ]
    }).lean();

    console.log(`   August accruals found: ${augustAccruals.length}`);
    let augustARDebits = 0;
    augustAccruals.forEach(tx => {
      tx.entries.forEach(line => {
        if (line.accountCode && (line.accountCode.startsWith('1100-') || line.accountCode === '1100')) {
          augustARDebits += Number(line.debit || 0);
        }
      });
    });
    console.log(`   August AR debits (accruals): $${augustARDebits}`);

    // 2. Get payments allocated to August
    const augustPayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': augustKey,
      $or: [
        { 'entries.accountCode': { $regex: '^1100-' } },
        { 'entries.accountCode': '1100' }
      ]
    }).lean();

    console.log(`   August payments found: ${augustPayments.length}`);
    let augustARCredits = 0;
    augustPayments.forEach(tx => {
      console.log(`     Payment: ${tx.description} - monthSettled: ${tx.metadata?.monthSettled}`);
      tx.entries.forEach(line => {
        if (line.accountCode && (line.accountCode.startsWith('1100-') || line.accountCode === '1100')) {
          augustARCredits += Number(line.credit || 0);
        }
      });
    });
    console.log(`   August AR credits (payments): $${augustARCredits}`);

    const augustOutstanding = augustARDebits - augustARCredits;
    console.log(`   August AR outstanding: $${augustOutstanding}\n`);

    console.log('📋 SUMMARY:');
    console.log(`   May AR: $${mayOutstanding} (should be $0 - cleared by payment)`);
    console.log(`   June AR: $${juneOutstanding} (should be $180 - remaining after payment)`);
    console.log(`   August AR: $${augustOutstanding} (should be $180 - no payments allocated)`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

testMonthSettledLogic();
