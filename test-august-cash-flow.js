const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testAugustCashFlow() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas');

    console.log('\n🧪 TESTING AUGUST CASH FLOW (Should show expense payments)...');
    console.log('='.repeat(80));
    
    // Get the cash flow data
    const cashFlowData = await FinancialReportingService.generateMonthlyCashFlow('2025', 'cash');
    
    if (!cashFlowData) {
      console.log('❌ No cash flow data returned');
      return;
    }
    
    // Check August specifically
    const august = cashFlowData.monthly_breakdown?.august;
    if (august) {
      console.log('\n📅 AUGUST 2025 CASH FLOW BREAKDOWN:');
      console.log('='.repeat(80));
      console.log('Operating Activities:');
      console.log(`  Inflows: $${august.operating_activities.inflows.toLocaleString()}`);
      console.log(`  Outflows: $${august.operating_activities.outflows.toLocaleString()}`);
      console.log(`  Net: $${august.operating_activities.net.toLocaleString()}`);
      
      console.log('\nInvesting Activities:');
      console.log(`  Inflows: $${august.investing_activities.inflows.toLocaleString()}`);
      console.log(`  Outflows: $${august.investing_activities.outflows.toLocaleString()}`);
      console.log(`  Net: $${august.investing_activities.net.toLocaleString()}`);
      
      console.log('\nFinancing Activities:');
      console.log(`  Inflows: $${august.financing_activities.inflows.toLocaleString()}`);
      console.log(`  Outflows: $${august.financing_activities.outflows.toLocaleString()}`);
      console.log(`  Net: $${august.financing_activities.net.toLocaleString()}`);
      
      console.log('\nSummary:');
      console.log(`  Net Cash Flow: $${august.net_cash_flow.toLocaleString()}`);
      console.log(`  Opening Balance: $${august.opening_balance.toLocaleString()}`);
      console.log(`  Closing Balance: $${august.closing_balance.toLocaleString()}`);
      
      // Check if this matches expected expense payments
      console.log('\n🔍 EXPECTED VS ACTUAL:');
      console.log('='.repeat(80));
      console.log('Expected August Expense Payments: $2,457.25');
      console.log('Actual August Operating Outflows: $' + august.operating_activities.outflows.toLocaleString());
      
      if (Math.abs(august.operating_activities.outflows - 2457.25) < 1) {
        console.log('✅ August expense payments match expected amount!');
      } else {
        console.log('❌ August expense payments do not match expected amount');
        console.log('Difference: $' + (august.operating_activities.outflows - 2457.25).toLocaleString());
      }
    }
    
    // Also check June and July for cash inflows
    console.log('\n📊 CHECKING OTHER MONTHS FOR CASH INFLOWS:');
    console.log('='.repeat(80));
    
    const months = ['june', 'july', 'august'];
    months.forEach(month => {
      const monthData = cashFlowData.monthly_breakdown?.[month];
      if (monthData) {
        console.log(`\n${month.toUpperCase()}:`);
        console.log(`  Operating Inflows: $${monthData.operating_activities.inflows.toLocaleString()}`);
        console.log(`  Operating Outflows: $${monthData.operating_activities.outflows.toLocaleString()}`);
        console.log(`  Net Cash Flow: $${monthData.net_cash_flow.toLocaleString()}`);
      }
    });

  } catch (error) {
    console.error('❌ Error testing August cash flow:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testAugustCashFlow();
