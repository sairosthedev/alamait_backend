const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

function displayCashFlowFormatted(data) {
  console.log('\n📊 CASH FLOW STATEMENT 2025 (CASH BASIS)');
  console.log('='.repeat(120));
  
  // Monthly breakdown table
  console.log('\n📅 MONTHLY BREAKDOWN:');
  console.log('-'.repeat(120));
  
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                     'july', 'august', 'september', 'october', 'november', 'december'];
  
  monthNames.forEach(month => {
    const monthData = data.monthly_breakdown[month];
    const monthName = month.charAt(0).toUpperCase() + month.slice(1);
    
    console.log(`\n${monthName.toUpperCase()}:`);
    console.log(`  Operating Activities:`);
    console.log(`    Inflows: $${monthData.operating_activities.inflows.toLocaleString()}`);
    console.log(`    Outflows: $${monthData.operating_activities.outflows.toLocaleString()}`);
    console.log(`    Net: $${monthData.operating_activities.net.toLocaleString()}`);
    
    console.log(`  Investing Activities:`);
    console.log(`    Inflows: $${monthData.investing_activities.inflows.toLocaleString()}`);
    console.log(`    Outflows: $${monthData.investing_activities.outflows.toLocaleString()}`);
    console.log(`    Net: $${monthData.investing_activities.net.toLocaleString()}`);
    
    console.log(`  Financing Activities:`);
    console.log(`    Inflows: $${monthData.financing_activities.inflows.toLocaleString()}`);
    console.log(`    Outflows: $${monthData.financing_activities.outflows.toLocaleString()}`);
    console.log(`    Net: $${monthData.financing_activities.net.toLocaleString()}`);
    
    console.log(`  Net Cash Flow: $${monthData.net_cash_flow.toLocaleString()}`);
    console.log(`  Opening Balance: $${monthData.opening_balance.toLocaleString()}`);
    console.log(`  Closing Balance: $${monthData.closing_balance.toLocaleString()}`);
  });
  
  // Yearly totals
  console.log('\n📈 YEARLY TOTALS:');
  console.log('='.repeat(120));
  
  const yearly = data.yearly_totals;
  console.log(`Operating Activities:`);
  console.log(`  Inflows: $${yearly.operating_activities.inflows.toLocaleString()}`);
  console.log(`  Outflows: $${yearly.operating_activities.outflows.toLocaleString()}`);
  console.log(`  Net: $${yearly.operating_activities.net.toLocaleString()}`);
  
  console.log(`\nInvesting Activities:`);
  console.log(`  Inflows: $${yearly.investing_activities.inflows.toLocaleString()}`);
  console.log(`  Outflows: $${yearly.investing_activities.outflows.toLocaleString()}`);
  console.log(`  Net: $${yearly.investing_activities.net.toLocaleString()}`);
  
  console.log(`\nFinancing Activities:`);
  console.log(`  Inflows: $${yearly.financing_activities.inflows.toLocaleString()}`);
  console.log(`  Outflows: $${yearly.financing_activities.outflows.toLocaleString()}`);
  console.log(`  Net: $${yearly.financing_activities.net.toLocaleString()}`);
  
  console.log(`\nNet Cash Flow: $${yearly.net_cash_flow.toLocaleString()}`);
  
  // Summary
  console.log('\n📊 SUMMARY:');
  console.log('='.repeat(120));
  
  const summary = data.summary;
  console.log(`Best Cash Flow Month: ${summary.best_cash_flow_month.charAt(0).toUpperCase() + summary.best_cash_flow_month.slice(1)}`);
  console.log(`Worst Cash Flow Month: ${summary.worst_cash_flow_month.charAt(0).toUpperCase() + summary.worst_cash_flow_month.slice(1)}`);
  console.log(`Average Monthly Cash Flow: $${summary.average_monthly_cash_flow.toLocaleString()}`);
  console.log(`Ending Cash Balance: $${summary.ending_cash_balance.toLocaleString()}`);
  
  // Compact table format
  console.log('\n📋 COMPACT TABLE FORMAT:');
  console.log('='.repeat(120));
  
  // Header
  console.log('Month'.padEnd(12) + 
              'Operating'.padEnd(15) + 
              'Investing'.padEnd(15) + 
              'Financing'.padEnd(15) + 
              'Net Cash'.padEnd(15) + 
              'Opening'.padEnd(15) + 
              'Closing'.padEnd(15));
  
  console.log(''.padEnd(12) + 
              'Net'.padEnd(15) + 
              'Net'.padEnd(15) + 
              'Net'.padEnd(15) + 
              'Flow'.padEnd(15) + 
              'Balance'.padEnd(15) + 
              'Balance'.padEnd(15));
  
  console.log('='.repeat(120));
  
  // Monthly data
  monthNames.forEach(month => {
    const monthData = data.monthly_breakdown[month];
    const monthName = month.charAt(0).toUpperCase() + month.slice(1);
    
    console.log(
      monthName.padEnd(12) +
      `$${monthData.operating_activities.net.toLocaleString()}`.padEnd(15) +
      `$${monthData.investing_activities.net.toLocaleString()}`.padEnd(15) +
      `$${monthData.financing_activities.net.toLocaleString()}`.padEnd(15) +
      `$${monthData.net_cash_flow.toLocaleString()}`.padEnd(15) +
      `$${monthData.opening_balance.toLocaleString()}`.padEnd(15) +
      `$${monthData.closing_balance.toLocaleString()}`.padEnd(15)
    );
  });
  
  console.log('='.repeat(120));
  
  // Yearly totals row
  console.log('YEARLY:'.padEnd(12) + 
              `$${yearly.operating_activities.net.toLocaleString()}`.padEnd(15) +
              `$${yearly.investing_activities.net.toLocaleString()}`.padEnd(15) +
              `$${yearly.financing_activities.net.toLocaleString()}`.padEnd(15) +
              `$${yearly.net_cash_flow.toLocaleString()}`.padEnd(15) +
              'N/A'.padEnd(15) +
              `$${summary.ending_cash_balance.toLocaleString()}`.padEnd(15));
  
  console.log('='.repeat(120));
}

async function displayCashFlowFormatted() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas');

    console.log('\n🧪 Generating Cash Flow Data for 2025...');
    const cashFlow2025 = await FinancialReportingService.generateMonthlyCashFlow('2025', 'cash');
    
    console.log('✅ Cash Flow generated successfully!');
    
    // Display in your format
    displayCashFlowFormatted(cashFlow2025);
    
    console.log('\n✅ Cash flow displayed in your format!');
    
  } catch (error) {
    console.error('❌ Error displaying cash flow:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

displayCashFlowFormatted();
