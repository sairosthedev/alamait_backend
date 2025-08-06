const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function createSampleFinancialData() {
  try {
    console.log('🔄 Creating sample financial data for 2025...\n');
    
    // Clear existing data
    await TransactionEntry.deleteMany({});
    console.log('🧹 Cleared existing transaction entries\n');
    
    // Sample data for 2025 - spread across different months
    const sampleTransactions = [
      // January 2025
      {
        date: new Date('2025-01-15'),
        description: 'Student Payment - Room 101',
        source: 'payment',
        sourceModel: 'Payment',
        createdBy: 'admin@alamait.com',
        totalDebit: 0,
        totalCredit: 300,
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
        ]
      },
      {
        date: new Date('2025-01-20'),
        description: 'Maintenance Expense - Plumbing',
        source: 'expense_payment',
        sourceModel: 'Expense',
        createdBy: 'admin@alamait.com',
        totalDebit: 150,
        totalCredit: 150,
        entries: [
          {
            accountCode: '1000',
            accountName: 'Cash',
            accountType: 'Asset',
            debit: 0,
            credit: 150,
            description: 'Cash paid'
          },
          {
            accountCode: '5000',
            accountName: 'Maintenance Expense',
            accountType: 'Expense',
            debit: 150,
            credit: 0,
            description: 'Plumbing maintenance'
          }
        ]
      },
      
      // February 2025
      {
        date: new Date('2025-02-10'),
        description: 'Student Payment - Room 102',
        source: 'payment',
        sourceModel: 'Payment',
        createdBy: 'admin@alamait.com',
        totalDebit: 0,
        totalCredit: 300,
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
        ]
      },
      {
        date: new Date('2025-02-25'),
        description: 'Cleaning Service Expense',
        source: 'expense_payment',
        sourceModel: 'Expense',
        createdBy: 'admin@alamait.com',
        totalDebit: 80,
        totalCredit: 80,
        entries: [
          {
            accountCode: '1000',
            accountName: 'Cash',
            accountType: 'Asset',
            debit: 0,
            credit: 80,
            description: 'Cash paid'
          },
          {
            accountCode: '5200',
            accountName: 'Cleaning Expense',
            accountType: 'Expense',
            debit: 80,
            credit: 0,
            description: 'Monthly cleaning service'
          }
        ]
      },
      
      // March 2025
      {
        date: new Date('2025-03-05'),
        description: 'Student Payment - Room 103',
        source: 'payment',
        sourceModel: 'Payment',
        createdBy: 'admin@alamait.com',
        totalDebit: 0,
        totalCredit: 300,
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
        ]
      },
      {
        date: new Date('2025-03-15'),
        description: 'Electricity Bill Payment',
        source: 'expense_payment',
        sourceModel: 'Expense',
        createdBy: 'admin@alamait.com',
        totalDebit: 120,
        totalCredit: 120,
        entries: [
          {
            accountCode: '1000',
            accountName: 'Cash',
            accountType: 'Asset',
            debit: 0,
            credit: 120,
            description: 'Cash paid'
          },
          {
            accountCode: '5002',
            accountName: 'Utilities - Electricity',
            accountType: 'Expense',
            debit: 120,
            credit: 0,
            description: 'Electricity bill'
          }
        ]
      },
      
      // April 2025
      {
        date: new Date('2025-04-10'),
        description: 'Student Payment - Room 104',
        source: 'payment',
        sourceModel: 'Payment',
        createdBy: 'admin@alamait.com',
        totalDebit: 0,
        totalCredit: 300,
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
        ]
      },
      
      // May 2025
      {
        date: new Date('2025-05-12'),
        description: 'Student Payment - Room 105',
        source: 'payment',
        sourceModel: 'Payment',
        createdBy: 'admin@alamait.com',
        totalDebit: 0,
        totalCredit: 300,
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
        ]
      },
      {
        date: new Date('2025-05-20'),
        description: 'Equipment Purchase - New Furniture',
        source: 'expense_payment',
        sourceModel: 'Expense',
        createdBy: 'admin@alamait.com',
        totalDebit: 500,
        totalCredit: 500,
        entries: [
          {
            accountCode: '1000',
            accountName: 'Cash',
            accountType: 'Asset',
            debit: 0,
            credit: 500,
            description: 'Cash paid'
          },
          {
            accountCode: '1600',
            accountName: 'Equipment',
            accountType: 'Asset',
            debit: 500,
            credit: 0,
            description: 'New furniture purchase'
          }
        ]
      },
      
      // June 2025
      {
        date: new Date('2025-06-08'),
        description: 'Student Payment - Room 106',
        source: 'payment',
        sourceModel: 'Payment',
        createdBy: 'admin@alamait.com',
        totalDebit: 0,
        totalCredit: 300,
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
        ]
      },
      
      // July 2025
      {
        date: new Date('2025-07-15'),
        description: 'Student Payment - Room 107',
        source: 'payment',
        sourceModel: 'Payment',
        createdBy: 'admin@alamait.com',
        totalDebit: 0,
        totalCredit: 300,
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
        ]
      },
      
      // August 2025
      {
        date: new Date('2025-08-10'),
        description: 'Student Payment - Room 108',
        source: 'payment',
        sourceModel: 'Payment',
        createdBy: 'admin@alamait.com',
        totalDebit: 0,
        totalCredit: 300,
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
        ]
      },
      
      // September 2025
      {
        date: new Date('2025-09-12'),
        description: 'Student Payment - Room 109',
        source: 'payment',
        sourceModel: 'Payment',
        createdBy: 'admin@alamait.com',
        totalDebit: 0,
        totalCredit: 300,
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
        ]
      },
      
      // October 2025
      {
        date: new Date('2025-10-05'),
        description: 'Student Payment - Room 110',
        source: 'payment',
        sourceModel: 'Payment',
        createdBy: 'admin@alamait.com',
        totalDebit: 0,
        totalCredit: 300,
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
        ]
      },
      
      // November 2025
      {
        date: new Date('2025-11-18'),
        description: 'Student Payment - Room 111',
        source: 'payment',
        sourceModel: 'Payment',
        createdBy: 'admin@alamait.com',
        totalDebit: 0,
        totalCredit: 300,
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
        ]
      },
      
      // December 2025
      {
        date: new Date('2025-12-20'),
        description: 'Student Payment - Room 112',
        source: 'payment',
        sourceModel: 'Payment',
        createdBy: 'admin@alamait.com',
        totalDebit: 0,
        totalCredit: 300,
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
        ]
      }
    ];
    
    // Create transaction entries
    const createdEntries = [];
    for (let i = 0; i < sampleTransactions.length; i++) {
      const transaction = sampleTransactions[i];
      
      // Calculate total debit and credit from entries
      let totalDebit = 0;
      let totalCredit = 0;
      transaction.entries.forEach(entry => {
        totalDebit += entry.debit || 0;
        totalCredit += entry.credit || 0;
      });
      
      // Update transaction with calculated totals
      transaction.totalDebit = totalDebit;
      transaction.totalCredit = totalCredit;
      
      const entry = new TransactionEntry(transaction);
      await entry.save();
      createdEntries.push(entry);
      console.log(`✅ Created: ${entry.description} (${entry.date.toDateString()}) - Debit: $${totalDebit}, Credit: $${totalCredit}`);
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

createSampleFinancialData(); 