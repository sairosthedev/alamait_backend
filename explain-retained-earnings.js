const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function explainRetainedEarnings() {
  try {
    console.log('🔍 Explaining How Retained Earnings is Calculated...\n');
    
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Connected to MongoDB Atlas');
    
    // Get all transactions up to August 31, 2025
    const asOfDate = new Date('2025-08-31');
    console.log(`📅 Calculating Retained Earnings as of: ${asOfDate.toDateString()}\n`);
    
    // Find all income and expense transactions
    const incomeExpenseTransactions = await TransactionEntry.find({
      date: { $lte: asOfDate },
      'entries.accountType': { $in: ['Income', 'Expense'] }
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${incomeExpenseTransactions.length} income/expense transactions\n`);
    
    let retainedEarnings = 0;
    let incomeTotal = 0;
    let expenseTotal = 0;
    
    console.log('📋 INCOME & EXPENSE BREAKDOWN:\n');
    
    incomeExpenseTransactions.forEach((tx, index) => {
      console.log(`--- Transaction ${index + 1} ---`);
      console.log(`Date: ${tx.date.toDateString()}`);
      console.log(`Description: ${tx.description}`);
      console.log(`Source: ${tx.source}`);
      
      tx.entries.forEach((entry, entryIndex) => {
        if (entry.accountType === 'Income' || entry.accountType === 'Expense') {
          console.log(`  Entry ${entryIndex + 1}:`);
          console.log(`    Account: ${entry.accountCode} - ${entry.accountName}`);
          console.log(`    Type: ${entry.accountType}`);
          console.log(`    Debit: $${entry.debit || 0}`);
          console.log(`    Credit: $${entry.credit || 0}`);
          
          if (entry.accountType === 'Income') {
            // Income increases retained earnings (credit)
            const incomeAmount = entry.credit || 0;
            incomeTotal += incomeAmount;
            retainedEarnings += incomeAmount;
            console.log(`    → INCOME: +$${incomeAmount.toLocaleString()} → Retained Earnings: $${retainedEarnings.toLocaleString()}`);
          } else if (entry.accountType === 'Expense') {
            // Expense decreases retained earnings (debit)
            const expenseAmount = entry.debit || 0;
            expenseTotal += expenseAmount;
            retainedEarnings -= expenseAmount;
            console.log(`    → EXPENSE: -$${expenseAmount.toLocaleString()} → Retained Earnings: $${retainedEarnings.toLocaleString()}`);
          }
        }
      });
      console.log('');
    });
    
    console.log('📊 RETAINED EARNINGS CALCULATION SUMMARY:');
    console.log('='.repeat(50));
    console.log(`💰 Total Income: $${incomeTotal.toLocaleString()}`);
    console.log(`💸 Total Expenses: $${expenseTotal.toLocaleString()}`);
    console.log(`📈 Net Income: $${(incomeTotal - expenseTotal).toLocaleString()}`);
    console.log(`🏛️ Final Retained Earnings: $${retainedEarnings.toLocaleString()}`);
    
    // Show the formula
    console.log('\n🧮 FORMULA:');
    console.log('Retained Earnings = Total Income - Total Expenses');
    console.log(`$${retainedEarnings.toLocaleString()} = $${incomeTotal.toLocaleString()} - $${expenseTotal.toLocaleString()}`);
    
    // Show what this means for your business
    console.log('\n💡 WHAT THIS MEANS:');
    if (retainedEarnings > 0) {
      console.log(`✅ Your business has accumulated $${retainedEarnings.toLocaleString()} in profits`);
    } else {
      console.log(`⚠️ Your business has accumulated $${Math.abs(retainedEarnings).toLocaleString()} in losses`);
      console.log('This is normal for a new business or during expansion');
    }
    
    console.log('\n✅ Retained Earnings explanation completed!');
    
  } catch (error) {
    console.error('❌ Error explaining retained earnings:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

explainRetainedEarnings();
