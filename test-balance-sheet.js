const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testBalanceSheet() {
  try {
    console.log('🧪 Testing Balance Sheet Service...\n');
    
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Connected to MongoDB Atlas');
    
    // Test 1: Generate Balance Sheet for end of 2025
    console.log('\n🧪 TEST 1: GENERATE BALANCE SHEET AS OF 2025-12-31');
    console.log('='.repeat(60));
    
    const balanceSheet = await BalanceSheetService.generateBalanceSheet('2025-12-31');
    
    console.log('📊 Balance Sheet Generated Successfully:');
    console.log(`  - As of Date: ${balanceSheet.asOfDate}`);
    console.log(`  - Residence: ${balanceSheet.residence}`);
    
    // Assets Section
    console.log('\n💰 ASSETS:');
    console.log('  Current Assets:');
    Object.entries(balanceSheet.assets.current).forEach(([code, asset]) => {
      console.log(`    ${code} - ${asset.name}: $${asset.balance.toLocaleString()}`);
    });
    console.log(`  Total Current Assets: $${balanceSheet.assets.totalCurrent.toLocaleString()}`);
    
    console.log('\n  Fixed Assets:');
    Object.entries(balanceSheet.assets.fixed).forEach(([code, asset]) => {
      console.log(`    ${code} - ${asset.name}: $${asset.balance.toLocaleString()}`);
    });
    console.log(`  Total Fixed Assets: $${balanceSheet.assets.totalFixed.toLocaleString()}`);
    console.log(`  TOTAL ASSETS: $${balanceSheet.assets.totalAssets.toLocaleString()}`);
    
    // Liabilities Section
    console.log('\n💳 LIABILITIES:');
    console.log('  Current Liabilities:');
    Object.entries(balanceSheet.liabilities.current).forEach(([code, liability]) => {
      console.log(`    ${code} - ${liability.name}: $${liability.balance.toLocaleString()}`);
    });
    console.log(`  Total Current Liabilities: $${balanceSheet.liabilities.totalCurrent.toLocaleString()}`);
    
    console.log('\n  Long-term Liabilities:');
    Object.entries(balanceSheet.liabilities.longTerm).forEach(([code, liability]) => {
      console.log(`    ${code} - ${liability.name}: $${liability.balance.toLocaleString()}`);
    });
    console.log(`  Total Long-term Liabilities: $${balanceSheet.liabilities.totalLongTerm.toLocaleString()}`);
    console.log(`  TOTAL LIABILITIES: $${balanceSheet.liabilities.totalLiabilities.toLocaleString()}`);
    
    // Equity Section
    console.log('\n🏛️ EQUITY:');
    console.log(`  Capital: $${balanceSheet.equity.capital.toLocaleString()}`);
    console.log(`  Retained Earnings: $${balanceSheet.equity.retainedEarnings.toLocaleString()}`);
    console.log(`  TOTAL EQUITY: $${balanceSheet.equity.totalEquity.toLocaleString()}`);
    
    // Key Ratios
    console.log('\n📈 KEY RATIOS:');
    console.log(`  Working Capital: $${balanceSheet.workingCapital.toLocaleString()}`);
    console.log(`  Current Ratio: ${balanceSheet.currentRatio.toFixed(2)}`);
    
    // Test 2: Generate Balance Sheet for specific residence
    console.log('\n🧪 TEST 2: BALANCE SHEET FOR SPECIFIC RESIDENCE');
    console.log('='.repeat(60));
    
    const specificResidence = '67d723cf20f89c4ae69804f3'; // St Kilda
    const residenceBalanceSheet = await BalanceSheetService.generateBalanceSheet('2025-12-31', specificResidence);
    
    console.log(`📊 Balance Sheet for Residence ${specificResidence}:`);
    console.log(`  - Total Assets: $${residenceBalanceSheet.assets.totalAssets.toLocaleString()}`);
    console.log(`  - Total Liabilities: $${residenceBalanceSheet.liabilities.totalLiabilities.toLocaleString()}`);
    console.log(`  - Total Equity: $${residenceBalanceSheet.equity.totalEquity.toLocaleString()}`);
    
    // Test 3: Generate Balance Sheet for different dates
    console.log('\n🧪 TEST 3: BALANCE SHEET FOR DIFFERENT DATES');
    console.log('='.repeat(60));
    
    const dates = ['2025-06-30', '2025-09-30', '2025-12-31'];
    
    for (const date of dates) {
      const bs = await BalanceSheetService.generateBalanceSheet(date);
      console.log(`📊 ${date}:`);
      console.log(`  Assets: $${bs.assets.totalAssets.toLocaleString()}`);
      console.log(`  Liabilities: $${bs.liabilities.totalLiabilities.toLocaleString()}`);
      console.log(`  Equity: $${bs.equity.totalEquity.toLocaleString()}`);
    }
    
    console.log('\n✅ All Balance Sheet tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing balance sheet:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testBalanceSheet();
