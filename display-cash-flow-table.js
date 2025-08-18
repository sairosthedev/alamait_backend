const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

function createTableRow(month, data) {
  const monthName = month.charAt(0).toUpperCase() + month.slice(1);
  const operatingNet = data.operating_activities.net;
  const investingNet = data.investing_activities.net;
  const financingNet = data.financing_activities.net;
  const netCashFlow = data.net_cash_flow;
  const openingBalance = data.opening_balance;
  const closingBalance = data.closing_balance;
  
  return {
    month: monthName,
    operating: operatingNet,
    investing: investingNet,
    financing: financingNet,
    netCashFlow: netCashFlow,
    openingBalance: openingBalance,
    closingBalance: closingBalance
  };
}

function displayTable(data) {
  console.log('\n📊 CASH FLOW STATEMENT 2025 (CASH BASIS)');
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
              'Activities'.padEnd(15) + 
              'Activities'.padEnd(15) + 
              'Activities'.padEnd(15) + 
              'Flow'.padEnd(15) + 
              'Balance'.padEnd(15) + 
              'Balance'.padEnd(15));
  
  console.log('='.repeat(120));
  
  // Monthly data
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                     'july', 'august', 'september', 'october', 'november', 'december'];
  
  monthNames.forEach(month => {
    const monthData = data.monthly_breakdown[month];
    const row = createTableRow(month, monthData);
    
    console.log(
      row.month.padEnd(12) +
      `$${row.operating.toLocaleString()}`.padEnd(15) +
      `$${row.investing.toLocaleString()}`.padEnd(15) +
      `$${row.financing.toLocaleString()}`.padEnd(15) +
      `$${row.netCashFlow.toLocaleString()}`.padEnd(15) +
      `$${row.openingBalance.toLocaleString()}`.padEnd(15) +
      `$${row.closingBalance.toLocaleString()}`.padEnd(15)
    );
  });
  
  console.log('='.repeat(120));
  
  // Yearly totals
  const yearly = data.yearly_totals;
  console.log('YEARLY TOTALS:'.padEnd(12) + 
              `$${yearly.operating_activities.net.toLocaleString()}`.padEnd(15) +
              `$${yearly.investing_activities.net.toLocaleString()}`.padEnd(15) +
              `$${yearly.financing_activities.net.toLocaleString()}`.padEnd(15) +
              `$${yearly.net_cash_flow.toLocaleString()}`.padEnd(15) +
              'N/A'.padEnd(15) +
              'N/A'.padEnd(15));
  
  console.log('='.repeat(120));
}

function displaySummaryTable(data) {
  console.log('\n📈 CASH FLOW SUMMARY 2025');
  console.log('='.repeat(80));
  
  const summary = data.summary;
  const yearly = data.yearly_totals;
  
  console.log('Operating Activities:'.padEnd(30) + `$${yearly.operating_activities.inflows.toLocaleString()}`.padEnd(25) + 'Inflows');
  console.log(''.padEnd(30) + `$${yearly.operating_activities.outflows.toLocaleString()}`.padEnd(25) + 'Outflows');
  console.log(''.padEnd(30) + `$${yearly.operating_activities.net.toLocaleString()}`.padEnd(25) + 'Net');
  
  console.log('-'.repeat(80));
  
  console.log('Investing Activities:'.padEnd(30) + `$${yearly.investing_activities.inflows.toLocaleString()}`.padEnd(25) + 'Inflows');
  console.log(''.padEnd(30) + `$${yearly.investing_activities.outflows.toLocaleString()}`.padEnd(25) + 'Outflows');
  console.log(''.padEnd(30) + `$${yearly.investing_activities.net.toLocaleString()}`.padEnd(25) + 'Net');
  
  console.log('-'.repeat(80));
  
  console.log('Financing Activities:'.padEnd(30) + `$${yearly.financing_activities.inflows.toLocaleString()}`.padEnd(25) + 'Inflows');
  console.log(''.padEnd(30) + `$${yearly.financing_activities.outflows.toLocaleString()}`.padEnd(25) + 'Outflows');
  console.log(''.padEnd(30) + `$${yearly.financing_activities.net.toLocaleString()}`.padEnd(25) + 'Net');
  
  console.log('='.repeat(80));
  
  console.log('TOTAL NET CASH FLOW:'.padEnd(30) + `$${yearly.net_cash_flow.toLocaleString()}`.padEnd(25) + 'Net');
  console.log('ENDING CASH BALANCE:'.padEnd(30) + `$${summary.ending_cash_balance.toLocaleString()}`.padEnd(25) + 'Balance');
  
  console.log('='.repeat(80));
}

function displayMonthlyDetails(data) {
  console.log('\n📅 MONTHLY DETAILS 2025');
  console.log('='.repeat(100));
  
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                     'july', 'august', 'september', 'october', 'november', 'december'];
  
  monthNames.forEach(month => {
    const monthData = data.monthly_breakdown[month];
    const monthName = month.charAt(0).toUpperCase() + month.slice(1);
    
    console.log(`\n${monthName.toUpperCase()}:`);
    console.log('-'.repeat(100));
    
    console.log('Operating Activities:');
    console.log(`  Inflows: $${monthData.operating_activities.inflows.toLocaleString()}`);
    console.log(`  Outflows: $${monthData.operating_activities.outflows.toLocaleString()}`);
    console.log(`  Net: $${monthData.operating_activities.net.toLocaleString()}`);
    
    console.log('\nInvesting Activities:');
    console.log(`  Inflows: $${monthData.investing_activities.inflows.toLocaleString()}`);
    console.log(`  Outflows: $${monthData.investing_activities.outflows.toLocaleString()}`);
    console.log(`  Net: $${monthData.investing_activities.net.toLocaleString()}`);
    
    console.log('\nFinancing Activities:');
    console.log(`  Inflows: $${monthData.financing_activities.inflows.toLocaleString()}`);
    console.log(`  Outflows: $${monthData.financing_activities.outflows.toLocaleString()}`);
    console.log(`  Net: $${monthData.financing_activities.net.toLocaleString()}`);
    
    console.log('\nCash Flow Summary:');
    console.log(`  Net Cash Flow: $${monthData.net_cash_flow.toLocaleString()}`);
    console.log(`  Opening Balance: $${monthData.opening_balance.toLocaleString()}`);
    console.log(`  Closing Balance: $${monthData.closing_balance.toLocaleString()}`);
  });
}

async function displayCashFlowTables() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas');

    console.log('\n🧪 Generating Cash Flow Data for 2025...');
    const cashFlow2025 = await FinancialReportingService.generateMonthlyCashFlow('2025', 'cash');
    
    // Display main table
    displayTable(cashFlow2025);
    
    // Display summary table
    displaySummaryTable(cashFlow2025);
    
    // Display monthly details
    displayMonthlyDetails(cashFlow2025);
    
    console.log('\n✅ Cash flow tables displayed successfully!');
    
  } catch (error) {
    console.error('❌ Error displaying cash flow tables:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

displayCashFlowTables();
