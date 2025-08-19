const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function displayEnhancedCashFlow() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas');

    console.log('\n📊 GENERATING ENHANCED CASH FLOW WITH ACCOUNT BREAKDOWNS...');
    console.log('='.repeat(120));
    
    // Get the enhanced cash flow data
    const cashFlowData = await FinancialReportingService.generateMonthlyCashFlow('2025', 'cash');
    
    if (!cashFlowData) {
      console.log('❌ No cash flow data returned');
      return;
    }
    
    console.log(`📅 Period: ${cashFlowData.period}`);
    console.log(`📊 Basis: ${cashFlowData.basis.toUpperCase()}`);
    console.log('='.repeat(120));
    
    // Display monthly summary table
    console.log('\n📋 MONTHLY CASH FLOW SUMMARY 2025 (Cash Basis)');
    console.log('='.repeat(120));
    console.log('Month        | Operating Activities | Investing Activities | Financing Activities | Net Cash | Opening | Closing');
    console.log('             | Inflows | Outflows | Net | Inflows | Outflows | Net | Inflows | Outflows | Net | Flow   | Balance| Balance');
    console.log('-------------|---------|----------|-----|---------|----------|-----|---------|----------|-----|--------|--------|--------');
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    monthNames.forEach((monthName) => {
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
    
    // Display detailed account breakdowns
    console.log('\n🔍 DETAILED ACCOUNT BREAKDOWNS');
    console.log('='.repeat(120));
    
    // Operating Activities Breakdown
    console.log('\n💰 OPERATING ACTIVITIES - ACCOUNT BREAKDOWN:');
    console.log('-'.repeat(80));
    if (Object.keys(yearly.operating_activities.breakdown).length > 0) {
      Object.entries(yearly.operating_activities.breakdown).forEach(([account, amounts]) => {
        const netAmount = amounts.inflows - amounts.outflows;
        const type = netAmount > 0 ? '📈 Inflow' : '📉 Outflow';
        const displayName = amounts.accountName ? `${account} - ${amounts.accountName}` : account;
        console.log(`${displayName.padEnd(50)} | Inflows: $${amounts.inflows.toString().padStart(8)} | Outflows: $${amounts.outflows.toString().padStart(8)} | Net: $${netAmount.toString().padStart(8)} | ${type}`);
      });
    } else {
      console.log('No operating activities recorded');
    }
    
    // Investing Activities Breakdown
    console.log('\n🏗️  INVESTING ACTIVITIES - ACCOUNT BREAKDOWN:');
    console.log('-'.repeat(80));
    if (Object.keys(yearly.investing_activities.breakdown).length > 0) {
      Object.entries(yearly.investing_activities.breakdown).forEach(([account, amounts]) => {
        const netAmount = amounts.inflows - amounts.outflows;
        const type = netAmount > 0 ? '📈 Inflow' : '📉 Outflow';
        const displayName = amounts.accountName ? `${account} - ${amounts.accountName}` : account;
        console.log(`${displayName.padEnd(50)} | Inflows: $${amounts.inflows.toString().padStart(8)} | Outflows: $${amounts.outflows.toString().padStart(8)} | Net: $${netAmount.toString().padStart(8)} | ${type}`);
      });
    } else {
      console.log('No investing activities recorded');
    }
    
    // Financing Activities Breakdown
    console.log('\n💳 FINANCING ACTIVITIES - ACCOUNT BREAKDOWN:');
    console.log('-'.repeat(80));
    if (Object.keys(yearly.financing_activities.breakdown).length > 0) {
      Object.entries(yearly.financing_activities.breakdown).forEach(([account, amounts]) => {
        const netAmount = amounts.inflows - amounts.outflows;
        const type = netAmount > 0 ? '📈 Inflow' : '📉 Outflow';
        const displayName = amounts.accountName ? `${account} - ${amounts.accountName}` : account;
        console.log(`${displayName.padEnd(50)} | Inflows: $${amounts.inflows.toString().padStart(8)} | Outflows: $${amounts.outflows.toString().padStart(8)} | Net: $${netAmount.toString().padStart(8)} | ${type}`);
      });
    } else {
      console.log('No financing activities recorded');
    }
    
    // Monthly detailed breakdown for August (most active month)
    console.log('\n📅 AUGUST 2025 - DETAILED MONTHLY BREAKDOWN:');
    console.log('='.repeat(120));
    
    const august = cashFlowData.monthly_breakdown.august;
    if (august) {
      // Operating Activities
      console.log('\n💰 OPERATING ACTIVITIES (August):');
      console.log('-'.repeat(80));
      if (Object.keys(august.operating_activities.breakdown).length > 0) {
        Object.entries(august.operating_activities.breakdown).forEach(([account, amounts]) => {
          const netAmount = amounts.inflows - amounts.outflows;
          const displayName = amounts.accountName ? `${account} - ${amounts.accountName}` : account;
          console.log(`${displayName.padEnd(50)} | Inflows: $${amounts.inflows.toString().padStart(8)} | Outflows: $${amounts.outflows.toString().padStart(8)} | Net: $${netAmount.toString().padStart(8)}`);
        });
      } else {
        console.log('No operating activities recorded');
      }
      
      // Investing Activities
      console.log('\n🏗️  INVESTING ACTIVITIES (August):');
      console.log('-'.repeat(80));
      if (Object.keys(august.investing_activities.breakdown).length > 0) {
        Object.entries(august.investing_activities.breakdown).forEach(([account, amounts]) => {
          const netAmount = amounts.inflows - amounts.outflows;
          const displayName = amounts.accountName ? `${account} - ${amounts.accountName}` : account;
          console.log(`${displayName.padEnd(50)} | Inflows: $${amounts.inflows.toString().padStart(8)} | Outflows: $${amounts.outflows.toString().padStart(8)} | Net: $${netAmount.toString().padStart(8)}`);
        });
      } else {
        console.log('No investing activities recorded');
      }
      
      // Financing Activities
      console.log('\n💳 FINANCING ACTIVITIES (August):');
      console.log('-'.repeat(80));
      if (Object.keys(august.financing_activities.breakdown).length > 0) {
        Object.entries(august.financing_activities.breakdown).forEach(([account, amounts]) => {
          const netAmount = amounts.inflows - amounts.outflows;
          const displayName = amounts.accountName ? `${account} - ${amounts.accountName}` : account;
          console.log(`${displayName.padEnd(50)} | Inflows: $${amounts.inflows.toString().padStart(8)} | Outflows: $${amounts.outflows.toString().padStart(8)} | Net: $${netAmount.toString().padStart(8)}`);
        });
      } else {
        console.log('No financing activities recorded');
      }
    }
    
    // Summary
    console.log('\n📈 CASH FLOW SUMMARY');
    console.log('='.repeat(120));
    const summary = cashFlowData.summary;
    console.log(`Best Cash Flow Month: ${summary.best_cash_flow_month.toUpperCase()}`);
    console.log(`Worst Cash Flow Month: ${summary.worst_cash_flow_month.toUpperCase()}`);
    console.log(`Average Monthly Cash Flow: $${summary.average_monthly_cash_flow.toLocaleString()}`);
    console.log(`Ending Cash Balance: $${summary.ending_cash_balance.toLocaleString()}`);

  } catch (error) {
    console.error('❌ Error displaying enhanced cash flow:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

displayEnhancedCashFlow();
