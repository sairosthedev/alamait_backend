const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function createSimpleSampleData() {
  try {
    console.log('🔄 Creating simple sample financial data for 2025...\n');
    
    // Clear existing data
    await TransactionEntry.deleteMany({});
    console.log('🧹 Cleared existing transaction entries\n');
    
    // Create a simple transaction for each month
    const months = [
      { month: 0, name: 'January', day: 15 },
      { month: 1, name: 'February', day: 10 },
      { month: 2, name: 'March', day: 5 },
      { month: 3, name: 'April', day: 10 },
      { month: 4, name: 'May', day: 12 },
      { month: 5, name: 'June', day: 8 },
      { month: 6, name: 'July', day: 15 },
      { month: 7, name: 'August', day: 10 },
      { month: 8, name: 'September', day: 12 },
      { month: 9, name: 'October', day: 5 },
      { month: 10, name: 'November', day: 18 },
      { month: 11, name: 'December', day: 20 }
    ];
    
    const createdEntries = [];
    
    for (let i = 0; i < months.length; i++) {
      const monthData = months[i];
      const date = new Date(2025, monthData.month, monthData.day);
      
      // Create a simple student payment transaction
      const transaction = new TransactionEntry({
        transactionId: `TXN2025${(i + 1).toString().padStart(3, '0')}`,
        date: date,
        description: `Student Payment - Room ${101 + i}`,
        source: 'payment',
        sourceModel: 'Payment',
        createdBy: 'admin@alamait.com',
        entries: [
          {
            accountCode: '1000',
            accountName: 'Cash',
            accountType: 'Asset',
            debit: 0,
            credit: 300,
            description: 'Cash received'
          },
          {
            accountCode: '4001',
            accountName: 'Rental Income - School Accommodation',
            accountType: 'Income',
            debit: 300,
            credit: 0,
            description: 'Rental income earned'
          }
        ],
        totalDebit: 300,
        totalCredit: 300
      });
      
      await transaction.save();
      createdEntries.push(transaction);
      console.log(`✅ Created: ${transaction.description} (${date.toDateString()})`);
    }
    
    // Add some expense transactions
    const expenseTransactions = [
      { month: 0, description: 'Maintenance Expense', accountCode: '5000', amount: 150 },
      { month: 1, description: 'Cleaning Expense', accountCode: '5200', amount: 80 },
      { month: 2, description: 'Electricity Bill', accountCode: '5002', amount: 120 },
      { month: 4, description: 'Equipment Purchase', accountCode: '1600', amount: 500 }
    ];
    
    for (const expense of expenseTransactions) {
      const date = new Date(2025, expense.month, 25);
      
      const transaction = new TransactionEntry({
        transactionId: `TXN2025EXP${(expense.month + 1).toString().padStart(2, '0')}`,
        date: date,
        description: expense.description,
        source: 'expense_payment',
        sourceModel: 'Expense',
        createdBy: 'admin@alamait.com',
        entries: [
          {
            accountCode: '1000',
            accountName: 'Cash',
            accountType: 'Asset',
            debit: 0,
            credit: expense.amount,
            description: 'Cash paid'
          },
          {
            accountCode: expense.accountCode,
            accountName: expense.description,
            accountType: expense.accountCode === '1600' ? 'Asset' : 'Expense',
            debit: expense.amount,
            credit: 0,
            description: expense.description
          }
        ],
        totalDebit: expense.amount,
        totalCredit: expense.amount
      });
      
      await transaction.save();
      createdEntries.push(transaction);
      console.log(`✅ Created: ${transaction.description} (${date.toDateString()})`);
    }
    
    console.log(`\n🎉 Successfully created ${createdEntries.length} sample transaction entries!`);
    console.log('📊 Now you can test the monthly financial reports with real data.\n');
    
    // Show summary
    const monthlySummary = {};
    createdEntries.forEach(entry => {
      const month = entry.date.toLocaleString('default', { month: 'long' });
      if (!monthlySummary[month]) {
        monthlySummary[month] = { count: 0, revenue: 0, expenses: 0 };
      }
      monthlySummary[month].count++;
      
      // Calculate revenue and expenses
      entry.entries.forEach(line => {
        if (line.accountType === 'Income') {
          monthlySummary[month].revenue += line.credit || 0;
        } else if (line.accountType === 'Expense') {
          monthlySummary[month].expenses += line.debit || 0;
        }
      });
    });
    
    console.log('📅 MONTHLY SUMMARY:');
    console.log('==================');
    Object.keys(monthlySummary).forEach(month => {
      const data = monthlySummary[month];
      console.log(`${month}: ${data.count} transactions, Revenue: $${data.revenue}, Expenses: $${data.expenses}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  } finally {
    mongoose.connection.close();
  }
}

createSimpleSampleData(); 