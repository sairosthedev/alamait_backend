const mongoose = require('mongoose');
require('dotenv').config();

async function checkMissingAccruals() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68adf1dc088169424e25c8a9'; // Cindy's ID
    
    // Check what monthly accruals should exist
    console.log('\n🔍 Checking for monthly accruals (June, July, August 2025):');
    
    // Look for monthly rent accruals
    const monthlyAccruals = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId}` },
      source: 'rental_accrual',
      'metadata.type': 'monthly_rent_accrual'
    }).sort({ date: 1 });
    
    console.log(`\n📊 Found ${monthlyAccruals.length} monthly rent accruals:`);
    
    if (monthlyAccruals.length === 0) {
      console.log('❌ No monthly rent accruals found!');
      console.log('   This explains why the system can\'t find June, July, August outstanding balances.');
    } else {
      monthlyAccruals.forEach((acc, index) => {
        console.log(`\n${index + 1}. Monthly Accrual: ${acc._id}`);
        console.log(`   Date: ${acc.date}`);
        console.log(`   Description: ${acc.description}`);
        console.log(`   Metadata:`, JSON.stringify(acc.metadata, null, 2));
        
        const arEntry = acc.entries.find(e => e.accountCode.startsWith('1100-') && e.debit > 0);
        if (arEntry) {
          console.log(`   AR Amount: $${arEntry.debit}`);
        }
      });
    }
    
    // Check what the system thinks should be outstanding
    console.log('\n🔍 What the system should find for outstanding balances:');
    
    // Look for any AR transactions that create debt
    const allARTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId}` }
    }).sort({ date: 1 });
    
    const monthlyDebt = {};
    
    allARTransactions.forEach(tx => {
      if (tx.source === 'rental_accrual' || tx.source === 'lease_start') {
        const txDate = new Date(tx.date);
        const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyDebt[monthKey]) {
          monthlyDebt[monthKey] = {
            month: monthKey,
            accruals: [],
            totalOwed: 0
          };
        }
        
        // Find AR debit entries (money owed)
        tx.entries.forEach(entry => {
          if (entry.accountCode.startsWith('1100-') && entry.debit > 0) {
            monthlyDebt[monthKey].accruals.push({
              id: tx._id,
              amount: entry.debit,
              description: entry.description,
              source: tx.source
            });
            monthlyDebt[monthKey].totalOwed += entry.debit;
          }
        });
      }
    });
    
    console.log('\n📅 Monthly debt structure:');
    Object.keys(monthlyDebt).sort().forEach(month => {
      const data = monthlyDebt[month];
      console.log(`\n  ${month}:`);
      console.log(`    Total Owed: $${data.totalOwed.toFixed(2)}`);
      data.accruals.forEach(acc => {
        console.log(`    - ${acc.description}: $${acc.amount} (${acc.source})`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkMissingAccruals();
