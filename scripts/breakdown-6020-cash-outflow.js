const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');

async function breakdown6020CashOutflow() {
  try {
    console.log('\n🔍 BREAKING DOWN THE $6,020 CASH OUTFLOW');
    console.log('==========================================\n');
    
    const now = new Date();
    
    // Get all transaction entries
    const transactionEntries = await TransactionEntry.find({
      date: { $lte: now },
      status: 'posted'
    });
    
    let totalCashOutflows = 0;
    let cashOutflowDetails = [];
    
    console.log('📊 ANALYZING EACH CASH OUTFLOW TRANSACTION:\n');
    
    transactionEntries.forEach((tx, txIdx) => {
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach((entry, entryIdx) => {
          const accountCode = entry.accountCode;
          const accountName = entry.accountName;
          const debit = entry.debit || 0;
          const credit = entry.credit || 0;
          
          // Only look at REAL cash outflows (debits to cash accounts)
          if (debit > 0 && isRealCashOutflow(accountCode, accountName, tx.source)) {
            totalCashOutflows += debit;
            
            cashOutflowDetails.push({
              transactionId: tx.transactionId,
              accountCode,
              accountName,
              amount: debit,
              source: tx.source,
              date: tx.date,
              description: tx.description,
              sourceId: tx.sourceId
            });
            
            console.log(`💰 Transaction ${txIdx + 1}, Entry ${entryIdx + 1}:`);
            console.log(`   Account: ${accountCode} - ${accountName}`);
            console.log(`   Amount: $${debit.toFixed(2)}`);
            console.log(`   Source: ${tx.source}`);
            console.log(`   Date: ${tx.date.toDateString()}`);
            console.log(`   Description: ${tx.description}`);
            console.log(`   Running Total: $${totalCashOutflows.toFixed(2)}`);
            console.log('');
          }
        });
      }
    });
    
    console.log('📋 SUMMARY OF ALL CASH OUTFLOWS:');
    console.log('==================================');
    console.log(`Total Cash Outflows: $${totalCashOutflows.toFixed(2)}`);
    
    // Group by source type
    const bySource = {};
    cashOutflowDetails.forEach(item => {
      if (!bySource[item.source]) {
        bySource[item.source] = { total: 0, count: 0, items: [] };
      }
      bySource[item.source].total += item.amount;
      bySource[item.source].count += 1;
      bySource[item.source].items.push(item);
    });
    
    console.log('\n📊 BREAKDOWN BY SOURCE TYPE:');
    console.log('==============================');
    Object.entries(bySource).forEach(([source, data]) => {
      console.log(`\n${source.toUpperCase()}:`);
      console.log(`   Total: $${data.total.toFixed(2)} (${data.count} transactions)`);
      data.items.forEach(item => {
        console.log(`   - ${item.accountCode} - ${item.accountName}: $${item.amount.toFixed(2)}`);
      });
    });
    
    // Group by account
    const byAccount = {};
    cashOutflowDetails.forEach(item => {
      const key = `${item.accountCode} - ${item.accountName}`;
      if (!byAccount[key]) {
        byAccount[key] = { total: 0, count: 0, items: [] };
      }
      byAccount[key].total += item.amount;
      byAccount[key].count += 1;
      byAccount[key].items.push(item);
    });
    
    console.log('\n💸 BREAKDOWN BY ACCOUNT:');
    console.log('=========================');
    Object.entries(byAccount)
      .sort(([,a], [,b]) => b.total - a.total)
      .forEach(([account, data]) => {
        console.log(`\n${account}:`);
        console.log(`   Total: $${data.total.toFixed(2)} (${data.count} transactions)`);
        data.items.forEach(item => {
          console.log(`   - ${item.source}: $${item.amount.toFixed(2)} (${item.date.toDateString()})`);
        });
      });
    
    console.log('\n✅ Breakdown complete!');
    console.log(`The $6,020 comes from ${cashOutflowDetails.length} individual cash outflow transactions`);
    
  } catch (error) {
    console.error('❌ Error breaking down cash outflow:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Helper function to identify REAL cash outflows
function isRealCashOutflow(accountCode, accountName, source) {
  // Real cash outflows are typically:
  // - Bank withdrawals
  // - Cash payments
  // - Money actually spent
  
  // Exclude accounting entries like:
  // - Accounts payable (money owed but not paid)
  // - Accruals
  // - Reversals
  // - Internal transfers
  
  const realCashAccounts = [
    '1001', // Bank Account
    '1002', // Cash on Hand
    '1011'  // Admin Petty Cash
  ];
  
  const excludeSources = [
    'rental_accrual',
    'rental_accrual_reversal',
    'expense_accrual', 
    'expense_accrual_reversal',
    'adjustment'
  ];
  
  return realCashAccounts.includes(accountCode) && !excludeSources.includes(source);
}

// Run the breakdown
breakdown6020CashOutflow();
