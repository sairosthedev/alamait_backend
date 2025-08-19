const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

function displayBalanceSheetTable(data) {
  console.log('\n📊 BALANCE SHEET 2025 (ACCRUAL BASIS)');
  console.log('='.repeat(100));
  
  // Assets Section
  console.log('\n💼 ASSETS:');
  console.log('-'.repeat(100));
  
  // Current Assets
  console.log('Current Assets:');
  Object.entries(data.assets.current).forEach(([code, asset]) => {
    console.log(`  ${asset.name} (${code}): $${asset.balance.toLocaleString()}`);
  });
  console.log(`  Total Current Assets: $${data.assets.totalCurrent.toLocaleString()}`);
  
  // Non-Current Assets
  console.log('\nNon-Current Assets:');
  Object.entries(data.assets.nonCurrent).forEach(([code, asset]) => {
    console.log(`  ${asset.name} (${code}): $${asset.balance.toLocaleString()}`);
  });
  console.log(`  Total Non-Current Assets: $${data.assets.totalNonCurrent.toLocaleString()}`);
  
  console.log(`\n🏦 TOTAL ASSETS: $${data.assets.totalAssets.toLocaleString()}`);
  
  // Liabilities Section
  console.log('\n💳 LIABILITIES:');
  console.log('-'.repeat(100));
  
  // Current Liabilities
  console.log('Current Liabilities:');
  Object.entries(data.liabilities.current).forEach(([code, liability]) => {
    console.log(`  ${liability.name} (${code}): $${liability.balance.toLocaleString()}`);
  });
  console.log(`  Total Current Liabilities: $${data.liabilities.totalCurrent.toLocaleString()}`);
  
  // Non-Current Liabilities
  console.log('\nNon-Current Liabilities:');
  Object.entries(data.liabilities.nonCurrent).forEach(([code, liability]) => {
    console.log(`  ${liability.name} (${code}): $${liability.balance.toLocaleString()}`);
  });
  console.log(`  Total Non-Current Liabilities: $${data.liabilities.totalNonCurrent.toLocaleString()}`);
  
  console.log(`\n📋 TOTAL LIABILITIES: $${data.liabilities.totalLiabilities.toLocaleString()}`);
  
  // Equity Section
  console.log('\n👑 EQUITY:');
  console.log('-'.repeat(100));
  console.log(`  Owner's Capital: $${data.equity.capital.toLocaleString()}`);
  console.log(`  Retained Earnings: $${data.equity.retainedEarnings.toLocaleString()}`);
  console.log(`  Other Equity: $${data.equity.otherEquity.toLocaleString()}`);
  console.log(`\n💰 TOTAL EQUITY: $${data.equity.totalEquity.toLocaleString()}`);
  
  // Summary
  console.log('\n📈 SUMMARY:');
  console.log('='.repeat(100));
  console.log(`Total Assets: $${data.assets.totalAssets.toLocaleString()}`);
  console.log(`Total Liabilities: $${data.liabilities.totalLiabilities.toLocaleString()}`);
  console.log(`Total Equity: $${data.equity.totalEquity.toLocaleString()}`);
  
  // Check if balanced
  const total = data.liabilities.totalLiabilities + data.equity.totalEquity;
  const difference = Math.abs(data.assets.totalAssets - total);
  
  if (difference < 0.01) {
    console.log(`\n✅ BALANCED: Assets = Liabilities + Equity ✓`);
  } else {
    console.log(`\n⚠️  UNBALANCED: Assets ≠ Liabilities + Equity`);
    console.log(`  Difference: $${difference.toLocaleString()}`);
  }
  
  // Key Ratios
  console.log('\n📊 KEY RATIOS:');
  console.log('-'.repeat(100));
  console.log(`Working Capital: $${data.workingCapital.toLocaleString()}`);
  console.log(`Current Ratio: ${data.currentRatio.toFixed(2)}`);
  console.log(`Debt-to-Equity Ratio: ${data.debtToEquity.toFixed(2)}`);
}

function displayMonthlyBalanceSheetTable(data) {
  console.log('\n📅 MONTHLY BALANCE SHEET BREAKDOWN 2025');
  console.log('='.repeat(120));
  
  // Header
  console.log('Month'.padEnd(12) + 
              'Assets'.padEnd(15) + 
              'Liabilities'.padEnd(15) + 
              'Equity'.padEnd(15) + 
              'Net Worth'.padEnd(15) + 
              'Working'.padEnd(15) + 
              'Current'.padEnd(15) + 
              'Status'.padEnd(15));
  
  console.log(''.padEnd(12) + 
              'Total'.padEnd(15) + 
              'Total'.padEnd(15) + 
              'Total'.padEnd(15) + 
              'Total'.padEnd(15) + 
              'Capital'.padEnd(15) + 
              'Ratio'.padEnd(15) + 
              ''.padEnd(15));
  
  console.log('='.repeat(120));
  
  // Monthly data
  for (let month = 1; month <= 12; month++) {
    const monthData = data.monthly[month];
    if (monthData) {
      const monthName = monthData.monthName;
      const assets = monthData.summary.totalAssets;
      const liabilities = monthData.summary.totalLiabilities;
      const equity = monthData.summary.totalEquity;
      const netWorth = assets - liabilities;
      const workingCapital = monthData.summary.workingCapital;
      const currentRatio = monthData.summary.currentRatio;
      
      // Status indicator
      let status = '✅';
      if (netWorth < 0) status = '⚠️';
      if (currentRatio < 1) status = '🔴';
      
      console.log(
        monthName.padEnd(12) +
        `$${assets.toLocaleString()}`.padEnd(15) +
        `$${liabilities.toLocaleString()}`.padEnd(15) +
        `$${equity.toLocaleString()}`.padEnd(15) +
        `$${netWorth.toLocaleString()}`.padEnd(15) +
        `$${workingCapital.toLocaleString()}`.padEnd(15) +
        `${currentRatio.toFixed(2)}`.padEnd(15) +
        status.padEnd(15)
      );
    }
  }
  
  console.log('='.repeat(120));
  
  // Annual Summary
  const annual = data.annualSummary;
  console.log('ANNUAL AVG:'.padEnd(12) + 
              `$${annual.totalAnnualAssets.toLocaleString()}`.padEnd(15) +
              `$${annual.totalAnnualLiabilities.toLocaleString()}`.padEnd(15) +
              `$${annual.totalAnnualEquity.toLocaleString()}`.padEnd(15) +
              'N/A'.padEnd(15) +
              'N/A'.padEnd(15) +
              'N/A'.padEnd(15) +
              '📊'.padEnd(15));
  
  console.log('='.repeat(120));
}

function displayDetailedMonthlyData(data) {
  console.log('\n🔍 DETAILED MONTHLY ANALYSIS:');
  console.log('='.repeat(100));
  
  for (let month = 1; month <= 12; month++) {
    const monthData = data.monthly[month];
    if (monthData) {
      console.log(`\n📅 ${monthData.monthName.toUpperCase()} 2025:`);
      console.log('-'.repeat(100));
      
      // Assets breakdown
      console.log('Assets:');
      const cashTotal = monthData.assets.current.cashAndBank?.total || 0;
      const arTotal = monthData.assets.current.accountsReceivable?.total || 0;
      const currentTotal = monthData.assets.current.total || 0;
      const totalAssets = monthData.assets.total || 0;
      
      console.log(`  Cash & Bank: $${cashTotal.toLocaleString()}`);
      console.log(`  Accounts Receivable: $${arTotal.toLocaleString()}`);
      console.log(`  Total Current Assets: $${currentTotal.toLocaleString()}`);
      console.log(`  Total Assets: $${totalAssets.toLocaleString()}`);
      
      // Liabilities breakdown
      console.log('\nLiabilities:');
      const apTotal = monthData.liabilities.current.accountsPayable?.total || 0;
      const depositsTotal = monthData.liabilities.current.tenantDeposits?.total || 0;
      const currentLiabTotal = monthData.liabilities.current.total || 0;
      const totalLiab = monthData.liabilities.total || 0;
      
      console.log(`  Accounts Payable: $${apTotal.toLocaleString()}`);
      console.log(`  Tenant Deposits: $${depositsTotal.toLocaleString()}`);
      console.log(`  Total Current Liabilities: $${currentLiabTotal.toLocaleString()}`);
      console.log(`  Total Liabilities: $${totalLiab.toLocaleString()}`);
      
      // Equity breakdown
      console.log('\nEquity:');
      const capital = monthData.equity.capital?.amount || 0;
      const retainedEarnings = monthData.equity.retainedEarnings?.amount || 0;
      const totalEquity = monthData.equity.total || 0;
      
      console.log(`  Capital: $${capital.toLocaleString()}`);
      console.log(`  Retained Earnings: $${retainedEarnings.toLocaleString()}`);
      console.log(`  Total Equity: $${totalEquity.toLocaleString()}`);
      
      // Summary
      console.log('\nSummary:');
      const netWorth = totalAssets - totalLiab - totalEquity;
      const workingCapital = monthData.summary.workingCapital || 0;
      const currentRatio = monthData.summary.currentRatio || 0;
      
      console.log(`  Net Worth: $${netWorth.toLocaleString()}`);
      console.log(`  Working Capital: $${workingCapital.toLocaleString()}`);
      console.log(`  Current Ratio: ${currentRatio.toFixed(2)}`);
    }
  }
}

async function displayBalanceSheetTables() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas');

    console.log('\n🧪 Generating Balance Sheet Data for 2025...');
    
    // Generate monthly balance sheet
    const monthlyBalanceSheet = await BalanceSheetService.generateMonthlyBalanceSheet(2025);
    
    if (monthlyBalanceSheet.success) {
      console.log('✅ Balance Sheet generated successfully!');
      
      // Display monthly table
      displayMonthlyBalanceSheetTable(monthlyBalanceSheet.data);
      
      // Display detailed monthly analysis
      displayDetailedMonthlyData(monthlyBalanceSheet.data);
      
      // Generate single balance sheet for current date
      console.log('\n🧪 Generating Current Balance Sheet...');
      const currentBalanceSheet = await BalanceSheetService.generateBalanceSheet(new Date('2025-12-31'));
      
      // Display current balance sheet
      displayBalanceSheetTable(currentBalanceSheet);
      
    } else {
      console.log('❌ Failed to generate balance sheet');
    }
    
    console.log('\n✅ Balance sheet tables displayed successfully!');
    
  } catch (error) {
    console.error('❌ Error displaying balance sheet tables:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

displayBalanceSheetTables();
