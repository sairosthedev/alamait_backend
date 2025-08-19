const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function displayCashFlowTable() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas');

    console.log('\n📊 GENERATING CASH FLOW TABLE (Cash Basis)...');
    console.log('='.repeat(120));
    
    // Get the cash flow data
    const cashFlowData = await FinancialReportingService.generateMonthlyCashFlow('2025', 'cash');
    
    if (!cashFlowData) {
      console.log('❌ No cash flow data returned');
      return;
    }
    
    console.log(`📅 Period: ${cashFlowData.period}`);
    console.log(`📊 Basis: ${cashFlowData.basis.toUpperCase()}`);
    console.log('='.repeat(120));
    
    // Create table header
    console.log('\n📋 MONTHLY CASH FLOW STATEMENT 2025 (Cash Basis)');
    console.log('='.repeat(120));
    console.log('Month        | Operating Activities | Investing Activities | Financing Activities | Net Cash | Opening | Closing');
    console.log('             | Inflows | Outflows | Net | Inflows | Outflows | Net | Inflows | Outflows | Net | Flow   | Balance| Balance');
    console.log('-------------|---------|----------|-----|---------|----------|-----|---------|----------|-----|--------|--------|--------');
    
    // Display monthly data
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    monthNames.forEach((monthName, index) => {
      const monthKey = monthName.toLowerCase();
      const monthData = cashFlowData.monthly_breakdown[monthKey];
      
      if (monthData) {
        const operating = monthData.operating_activities;
        const investing = monthData.investing_activities;
        const financing = monthData.financing_activities;
        
        console.log(
          `${monthName.padEnd(12)} | ` +
          `$${operating.inflows.toString().padStart(7)} | ` +
          `$${operating.outflows.toString().padStart(8)} | ` +
          `$${operating.net.toString().padStart(3)} | ` +
          `$${investing.inflows.toString().padStart(7)} | ` +
          `$${investing.outflows.toString().padStart(8)} | ` +
          `$${investing.net.toString().padStart(3)} | ` +
          `$${financing.inflows.toString().padStart(7)} | ` +
          `$${financing.outflows.toString().padStart(8)} | ` +
          `$${financing.net.toString().padStart(3)} | ` +
          `$${monthData.net_cash_flow.toString().padStart(6)} | ` +
          `$${monthData.opening_balance.toString().padStart(6)} | ` +
          `$${monthData.closing_balance.toString().padStart(6)}`
        );
      }
    });
    
    // Display yearly totals
    console.log('-------------|---------|----------|-----|---------|----------|-----|---------|----------|-----|--------|--------|--------');
    const yearly = cashFlowData.yearly_totals;
    console.log(
      'YEARLY TOTALS | ' +
      `$${yearly.operating_activities.inflows.toString().padStart(7)} | ` +
      `$${yearly.operating_activities.outflows.toString().padStart(8)} | ` +
      `$${yearly.operating_activities.net.toString().padStart(3)} | ` +
      `$${yearly.investing_activities.inflows.toString().padStart(7)} | ` +
      `$${yearly.investing_activities.outflows.toString().padStart(8)} | ` +
      `$${yearly.investing_activities.net.toString().padStart(3)} | ` +
      `$${yearly.financing_activities.inflows.toString().padStart(7)} | ` +
      `$${yearly.financing_activities.outflows.toString().padStart(8)} | ` +
      `$${yearly.financing_activities.net.toString().padStart(3)} | ` +
      `$${yearly.net_cash_flow.toString().padStart(6)} | ` +
      `        |        `
    );
    
    // Display summary
    console.log('\n📈 CASH FLOW SUMMARY');
    console.log('='.repeat(120));
    const summary = cashFlowData.summary;
    console.log(`Best Cash Flow Month: ${summary.best_cash_flow_month.toUpperCase()}`);
    console.log(`Worst Cash Flow Month: ${summary.worst_cash_flow_month.toUpperCase()}`);
    console.log(`Average Monthly Cash Flow: $${summary.average_monthly_cash_flow.toLocaleString()}`);
    console.log(`Ending Cash Balance: $${summary.ending_cash_balance.toLocaleString()}`);
    
    // Display key insights
    console.log('\n🔍 KEY INSIGHTS');
    console.log('='.repeat(120));
    
    // Find months with significant cash flows
    const significantMonths = monthNames.filter(monthName => {
      const monthKey = monthName.toLowerCase();
      const monthData = cashFlowData.monthly_breakdown[monthKey];
      if (monthData) {
        return Math.abs(monthData.net_cash_flow) > 100;
      }
      return false;
    });
    
    if (significantMonths.length > 0) {
      console.log('📅 Months with Significant Cash Flows:');
      significantMonths.forEach(monthName => {
        const monthKey = monthName.toLowerCase();
        const monthData = cashFlowData.monthly_breakdown[monthKey];
        const netFlow = monthData.net_cash_flow;
        const type = netFlow > 0 ? '📈 Positive' : '📉 Negative';
        console.log(`  ${monthName}: ${type} $${Math.abs(netFlow).toLocaleString()}`);
      });
    }
    
    // Check for patterns
    console.log('\n📊 CASH FLOW PATTERNS:');
    const monthsWithInflows = monthNames.filter(monthName => {
      const monthKey = monthName.toLowerCase();
      const monthData = cashFlowData.monthly_breakdown[monthKey];
      return monthData && monthData.operating_activities.inflows > 0;
    });
    
    const monthsWithOutflows = monthNames.filter(monthName => {
      const monthKey = monthName.toLowerCase();
      const monthData = cashFlowData.monthly_breakdown[monthKey];
      return monthData && monthData.operating_activities.outflows > 0;
    });
    
    console.log(`💰 Cash Inflows: ${monthsWithInflows.length} months (${monthsWithInflows.join(', ')})`);
    console.log(`💸 Cash Outflows: ${monthsWithOutflows.length} months (${monthsWithOutflows.join(', ')})`);
    
    // Operating vs Investing vs Financing analysis
    console.log('\n📈 ACTIVITY ANALYSIS:');
    const totalOperating = yearly.operating_activities.net;
    const totalInvesting = yearly.investing_activities.net;
    const totalFinancing = yearly.financing_activities.net;
    
    console.log(`Operating Activities: $${totalOperating.toLocaleString()} (${totalOperating > 0 ? '📈 Net Inflow' : '📉 Net Outflow'})`);
    console.log(`Investing Activities: $${totalInvesting.toLocaleString()} (${totalInvesting > 0 ? '📈 Net Inflow' : '📉 Net Outflow'})`);
    console.log(`Financing Activities: $${totalFinancing.toLocaleString()} (${totalFinancing > 0 ? '📈 Net Inflow' : '📉 Net Outflow'})`);

  } catch (error) {
    console.error('❌ Error displaying cash flow table:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

displayCashFlowTable();
