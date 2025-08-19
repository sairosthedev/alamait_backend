const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function checkActualExpensePayments() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas');

    console.log('\n🔍 CHECKING ACTUAL EXPENSE PAYMENTS (Cash Basis)...');
    console.log('='.repeat(80));
    
    // Look for all expense payment transactions in 2025
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');
    
    console.log(`📅 Date Range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
    
    // Check for different types of expense payments
    const expensePaymentSources = [
      'expense_payment',
      'manual',
      'payment_collection',
      'bank_transfer'
    ];
    
    console.log('\n🔍 Looking for expense payments with sources:', expensePaymentSources);
    
    const expensePayments = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: { $in: expensePaymentSources }
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${expensePayments.length} expense payment transactions in 2025`);
    
    if (expensePayments.length === 0) {
      console.log('❌ No expense payments found! This explains why cash flow shows $0');
      console.log('\n🔍 Let me check what sources actually exist in your database...');
      
      const allSources = await TransactionEntry.distinct('source');
      console.log('Available sources in database:', allSources);
      return;
    }
    
    // Analyze each expense payment
    let totalExpensePayments = 0;
    let monthlyBreakdown = {};
    
    expensePayments.forEach((transaction, index) => {
      console.log(`\n${index + 1}. Transaction ID: ${transaction._id}`);
      console.log(`   Date: ${transaction.date.toDateString()}`);
      console.log(`   Source: ${transaction.source || 'N/A'}`);
      console.log(`   Description: ${transaction.description || 'N/A'}`);
      console.log(`   Status: ${transaction.status || 'N/A'}`);
      
      // Get month for breakdown
      const month = transaction.date.getMonth() + 1;
      const monthName = new Date(transaction.date).toLocaleString('default', { month: 'long' });
      
      if (!monthlyBreakdown[month]) {
        monthlyBreakdown[month] = {
          monthName,
          total: 0,
          transactions: []
        };
      }
      
      if (transaction.entries && Array.isArray(transaction.entries)) {
        console.log(`   Entries (${transaction.entries.length}):`);
        
        let transactionTotal = 0;
        transaction.entries.forEach((entry, entryIndex) => {
          console.log(`     ${entryIndex + 1}. Account: ${entry.accountCode} - ${entry.accountName}`);
          console.log(`        Type: ${entry.accountType}`);
          console.log(`        Debit: $${entry.debit || 0}`);
          console.log(`        Credit: $${entry.credit || 0}`);
          
          // For cash basis, we're interested in cash outflows
          if (entry.accountType === 'Expense' && entry.debit > 0) {
            transactionTotal += entry.debit;
          } else if (entry.accountType === 'Asset' && entry.credit > 0) {
            // Asset decrease (like bank account) = cash outflow
            transactionTotal += entry.credit;
          }
        });
        
        console.log(`   💰 Total Cash Outflow: $${transactionTotal.toLocaleString()}`);
        totalExpensePayments += transactionTotal;
        monthlyBreakdown[month].total += transactionTotal;
        monthlyBreakdown[month].transactions.push({
          description: transaction.description,
          amount: transactionTotal,
          source: transaction.source
        });
      } else {
        console.log('   ❌ No entries found');
      }
    });
    
    console.log('\n📈 EXPENSE PAYMENTS SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total Expense Payments: $${totalExpensePayments.toLocaleString()}`);
    
    console.log('\n📅 MONTHLY BREAKDOWN:');
    console.log('-'.repeat(80));
    Object.keys(monthlyBreakdown).sort((a, b) => parseInt(a) - parseInt(b)).forEach(month => {
      const monthData = monthlyBreakdown[month];
      console.log(`\n${monthData.monthName}: $${monthData.total.toLocaleString()}`);
      monthData.transactions.forEach(t => {
        console.log(`  - ${t.description}: $${t.amount.toLocaleString()} (${t.source})`);
      });
    });
    
    // Now check if there are any other transactions that might represent cash outflows
    console.log('\n🔍 CHECKING FOR OTHER CASH OUTFLOWS...');
    console.log('='.repeat(80));
    
    // Look for any transactions with cash accounts (bank, ecocash, etc.)
    const cashAccountCodes = ['1001', '1002', '1003', '1004', '1005']; // Bank, Ecocash, Innbucks, Petty Cash, Cash
    
    const cashTransactions = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      'entries.accountCode': { $in: cashAccountCodes }
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${cashTransactions.length} transactions involving cash accounts`);
    
    if (cashTransactions.length > 0) {
      console.log('\n💰 CASH ACCOUNT TRANSACTIONS:');
      cashTransactions.forEach((t, index) => {
        console.log(`\n${index + 1}. ${t.description || 'No description'}`);
        console.log(`   Date: ${t.date.toDateString()}, Source: ${t.source || 'N/A'}`);
        
        if (t.entries) {
          t.entries.forEach(entry => {
            if (cashAccountCodes.includes(entry.accountCode)) {
              console.log(`   Cash Account: ${entry.accountCode} - ${entry.accountName}`);
              console.log(`   Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
            }
          });
        }
      });
    }

  } catch (error) {
    console.error('❌ Error checking expense payments:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkActualExpensePayments();
