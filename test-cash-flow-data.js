const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testCashFlowData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas');

    console.log('\n🧪 Testing Cash Flow Generation for 2025...');
    console.log('=====================================');
    
    // Test 1: Generate cash flow for 2025
    const cashFlow2025 = await FinancialReportingService.generateMonthlyCashFlow('2025', 'cash');
    
    console.log('\n📊 CASH FLOW 2025 (CASH BASIS):');
    console.log('=====================================');
    console.log(`Period: ${cashFlow2025.period}`);
    console.log(`Basis: ${cashFlow2025.basis}`);
    console.log(`Total Months: ${Object.keys(cashFlow2025.monthly_breakdown).length}`);
    
    // Display monthly breakdown
    console.log('\n📅 MONTHLY BREAKDOWN:');
    console.log('=====================================');
    
    Object.entries(cashFlow2025.monthly_breakdown).forEach(([month, data]) => {
      console.log(`\n${month.toUpperCase()}:`);
      console.log(`  Operating Activities:`);
      console.log(`    - Inflows: $${data.operating_activities.inflows.toLocaleString()}`);
      console.log(`    - Outflows: $${data.operating_activities.outflows.toLocaleString()}`);
      console.log(`    - Net: $${data.operating_activities.net.toLocaleString()}`);
      
      console.log(`  Investing Activities:`);
      console.log(`    - Inflows: $${data.investing_activities.inflows.toLocaleString()}`);
      console.log(`    - Outflows: $${data.investing_activities.outflows.toLocaleString()}`);
      console.log(`    - Net: $${data.investing_activities.net.toLocaleString()}`);
      
      console.log(`  Financing Activities:`);
      console.log(`    - Inflows: $${data.financing_activities.inflows.toLocaleString()}`);
      console.log(`    - Outflows: $${data.financing_activities.outflows.toLocaleString()}`);
      console.log(`    - Net: $${data.financing_activities.net.toLocaleString()}`);
      
      console.log(`  Cash Flow Summary:`);
      console.log(`    - Net Cash Flow: $${data.net_cash_flow.toLocaleString()}`);
      console.log(`    - Opening Balance: $${data.opening_balance.toLocaleString()}`);
      console.log(`    - Closing Balance: $${data.closing_balance.toLocaleString()}`);
    });
    
    // Display yearly totals
    console.log('\n📈 YEARLY TOTALS:');
    console.log('=====================================');
    console.log(`Operating Activities:`);
    console.log(`  - Total Inflows: $${cashFlow2025.yearly_totals.operating_activities.inflows.toLocaleString()}`);
    console.log(`  - Total Outflows: $${cashFlow2025.yearly_totals.operating_activities.outflows.toLocaleString()}`);
    console.log(`  - Net Operating: $${cashFlow2025.yearly_totals.operating_activities.net.toLocaleString()}`);
    
    console.log(`\nInvesting Activities:`);
    console.log(`  - Total Inflows: $${cashFlow2025.yearly_totals.investing_activities.inflows.toLocaleString()}`);
    console.log(`  - Total Outflows: $${cashFlow2025.yearly_totals.investing_activities.outflows.toLocaleString()}`);
    console.log(`  - Net Investing: $${cashFlow2025.yearly_totals.investing_activities.net.toLocaleString()}`);
    
    console.log(`\nFinancing Activities:`);
    console.log(`  - Total Inflows: $${cashFlow2025.yearly_totals.financing_activities.inflows.toLocaleString()}`);
    console.log(`  - Total Outflows: $${cashFlow2025.yearly_totals.financing_activities.outflows.toLocaleString()}`);
    console.log(`  - Net Financing: $${cashFlow2025.yearly_totals.financing_activities.net.toLocaleString()}`);
    
    console.log(`\n🎯 ANNUAL SUMMARY:`);
    console.log(`  - Total Net Cash Flow: $${cashFlow2025.yearly_totals.net_cash_flow.toLocaleString()}`);
    console.log(`  - Best Month: ${cashFlow2025.summary.best_cash_flow_month}`);
    console.log(`  - Worst Month: ${cashFlow2025.summary.worst_cash_flow_month}`);
    console.log(`  - Average Monthly Cash Flow: $${cashFlow2025.summary.average_monthly_cash_flow.toLocaleString()}`);
    console.log(`  - Ending Cash Balance: $${cashFlow2025.summary.ending_cash_balance.toLocaleString()}`);
    
    // Test 2: Check if there are any cash transactions
    console.log('\n🔍 ANALYZING CASH TRANSACTIONS:');
    console.log('=====================================');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const cashTransactions = await TransactionEntry.find({
      date: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') },
      'entries.accountCode': { $in: ['1001', '1002', '1003', '1004', '1005'] } // Cash accounts
    }).sort({ date: 1 });
    
    console.log(`Found ${cashTransactions.length} cash transactions in 2025`);
    
    if (cashTransactions.length > 0) {
      console.log('\n📋 SAMPLE CASH TRANSACTIONS:');
      cashTransactions.slice(0, 5).forEach((transaction, index) => {
        console.log(`\nTransaction ${index + 1}:`);
        console.log(`  Date: ${transaction.date.toDateString()}`);
        console.log(`  Description: ${transaction.description}`);
        console.log(`  Source: ${transaction.source}`);
        
        transaction.entries.forEach(entry => {
          if (['1001', '1002', '1003', '1004', '1005'].includes(entry.accountCode)) {
            console.log(`  Cash Entry: ${entry.accountName} (${entry.accountCode})`);
            console.log(`    Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
          }
        });
      });
    }
    
    console.log('\n✅ Cash flow analysis completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing cash flow data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testCashFlowData();
