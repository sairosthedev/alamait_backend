const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function investigateJanuaryExpenses() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas');

    console.log('\n🔍 INVESTIGATING JANUARY 2025 EXPENSES...');
    console.log('='.repeat(80));
    
    // Look for all transactions in January 2025
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-01-31');
    
    console.log(`📅 Date Range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
    
    const januaryTransactions = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
    
    console.log(`\n📊 Found ${januaryTransactions.length} transactions in January 2025`);
    
    if (januaryTransactions.length === 0) {
      console.log('❌ No transactions found in January 2025');
      return;
    }
    
    // Analyze each transaction
    let totalExpenses = 0;
    let totalIncome = 0;
    let cashOutflows = 0;
    let cashInflows = 0;
    
    januaryTransactions.forEach((transaction, index) => {
      console.log(`\n${index + 1}. Transaction ID: ${transaction._id}`);
      console.log(`   Date: ${transaction.date.toDateString()}`);
      console.log(`   Source: ${transaction.source || 'N/A'}`);
      console.log(`   Description: ${transaction.description || 'N/A'}`);
      console.log(`   Status: ${transaction.status || 'N/A'}`);
      
      if (transaction.entries && Array.isArray(transaction.entries)) {
        console.log(`   Entries (${transaction.entries.length}):`);
        
        transaction.entries.forEach((entry, entryIndex) => {
          console.log(`     ${entryIndex + 1}. Account: ${entry.accountCode} - ${entry.accountName}`);
          console.log(`        Type: ${entry.accountType}`);
          console.log(`        Debit: $${entry.debit || 0}`);
          console.log(`        Credit: $${entry.credit || 0}`);
          
          // Calculate cash flow impact
          if (entry.accountType === 'Expense') {
            totalExpenses += (entry.debit || 0);
            cashOutflows += (entry.debit || 0);
          } else if (entry.accountType === 'Income') {
            totalIncome += (entry.credit || 0);
            cashInflows += (entry.credit || 0);
          } else if (entry.accountType === 'Asset') {
            if (entry.debit > 0) {
              cashOutflows += entry.debit; // Asset increase = cash outflow
            } else if (entry.credit > 0) {
              cashInflows += entry.credit; // Asset decrease = cash inflow
            }
          } else if (entry.accountType === 'Liability') {
            if (entry.credit > 0) {
              cashInflows += entry.credit; // Liability increase = cash inflow
            } else if (entry.debit > 0) {
              cashOutflows += entry.debit; // Liability decrease = cash outflow
            }
          }
        });
      } else {
        console.log('   ❌ No entries found');
      }
    });
    
    console.log('\n📈 JANUARY 2025 SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total Expenses: $${totalExpenses.toLocaleString()}`);
    console.log(`Total Income: $${totalIncome.toLocaleString()}`);
    console.log(`Net Income: $${(totalIncome - totalExpenses).toLocaleString()}`);
    console.log(`Cash Outflows: $${cashOutflows.toLocaleString()}`);
    console.log(`Cash Inflows: $${cashInflows.toLocaleString()}`);
    console.log(`Net Cash Flow: $${(cashInflows - cashOutflows).toLocaleString()}`);
    
    // Check if this matches your cash flow data
    console.log('\n🔍 CASH FLOW VERIFICATION:');
    console.log('='.repeat(80));
    console.log('Your cash flow shows:');
    console.log('- Operating Activities: +$730 (inflows)');
    console.log('- Financing Activities: -$730 (outflows)');
    console.log('- Net Cash Flow: $0');
    
    if (Math.abs(cashInflows - 730) < 1) {
      console.log('✅ Cash inflows match your cash flow data ($730)');
    } else {
      console.log(`❌ Cash inflows mismatch: Expected $730, Found $${cashInflows}`);
    }
    
    if (Math.abs(cashOutflows - 730) < 1) {
      console.log('✅ Cash outflows match your cash flow data ($730)');
    } else {
      console.log(`❌ Cash outflows mismatch: Expected $730, Found $${cashOutflows}`);
    }
    
    // Look for specific patterns
    console.log('\n🔍 LOOKING FOR PATTERNS:');
    console.log('='.repeat(80));
    
    const sourceBreakdown = {};
    januaryTransactions.forEach(transaction => {
      const source = transaction.source || 'unknown';
      sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
    });
    
    console.log('Transaction Sources:');
    Object.entries(sourceBreakdown).forEach(([source, count]) => {
      console.log(`  ${source}: ${count} transactions`);
    });
    
    // Check for any unusual transactions
    const unusualTransactions = januaryTransactions.filter(t => 
      t.amount > 500 || 
      (t.description && t.description.toLowerCase().includes('unusual')) ||
      (t.source && t.source === 'manual')
    );
    
    if (unusualTransactions.length > 0) {
      console.log('\n⚠️  UNUSUAL TRANSACTIONS (>$500 or manual):');
      unusualTransactions.forEach(t => {
        console.log(`  - $${t.amount || 'N/A'} - ${t.description || 'No description'} (${t.source || 'No source'})`);
      });
    }

  } catch (error) {
    console.error('❌ Error investigating January expenses:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

investigateJanuaryExpenses();
