const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugAccountingEquation() {
  try {
    console.log('🔍 Debugging Accounting Equation Imbalance...\n');
    
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Connected to MongoDB Atlas');
    
    // Test August 31, 2025 (shows $1,500 imbalance)
    const testDate = '2025-08-31';
    console.log(`\n🔍 Analyzing Balance Sheet as of ${testDate}`);
    console.log('='.repeat(60));
    
    const balanceSheet = await BalanceSheetService.generateBalanceSheet(testDate);
    
    console.log('📊 Balance Sheet Details:');
    console.log(`  - Assets: $${balanceSheet.assets.totalAssets.toLocaleString()}`);
    console.log(`  - Liabilities: $${balanceSheet.liabilities.totalLiabilities.toLocaleString()}`);
    console.log(`  - Equity: $${balanceSheet.equity.totalEquity.toLocaleString()}`);
    
    const calculatedEquity = balanceSheet.assets.totalAssets - balanceSheet.liabilities.totalLiabilities;
    const actualEquity = balanceSheet.equity.totalEquity;
    const difference = calculatedEquity - actualEquity;
    
    console.log('\n🔍 Accounting Equation Analysis:');
    console.log(`  - Assets - Liabilities = ${balanceSheet.assets.totalAssets} - ${balanceSheet.liabilities.totalLiabilities} = $${calculatedEquity.toLocaleString()}`);
    console.log(`  - Actual Equity: $${actualEquity.toLocaleString()}`);
    console.log(`  - Difference: $${difference.toLocaleString()}`);
    
    // Break down assets
    console.log('\n💰 ASSETS BREAKDOWN:');
    console.log('  Current Assets:');
    Object.entries(balanceSheet.assets.current).forEach(([code, asset]) => {
      console.log(`    ${code} - ${asset.name}: $${asset.balance.toLocaleString()}`);
    });
    console.log(`  Total Current Assets: $${balanceSheet.assets.totalCurrent.toLocaleString()}`);
    
    console.log('\n  Non-Current Assets:');
    Object.entries(balanceSheet.assets.nonCurrent).forEach(([code, asset]) => {
      console.log(`    ${code} - ${asset.name}: $${asset.balance.toLocaleString()}`);
    });
    console.log(`  Total Non-Current Assets: $${balanceSheet.assets.totalNonCurrent.toLocaleString()}`);
    
    // Break down liabilities
    console.log('\n💳 LIABILITIES BREAKDOWN:');
    console.log('  Current Liabilities:');
    Object.entries(balanceSheet.liabilities.current).forEach(([code, liability]) => {
      console.log(`    ${code} - ${liability.name}: $${liability.balance.toLocaleString()}`);
    });
    console.log(`  Total Current Liabilities: $${balanceSheet.liabilities.totalCurrent.toLocaleString()}`);
    
    console.log('\n  Non-Current Liabilities:');
    Object.entries(balanceSheet.liabilities.nonCurrent).forEach(([code, liability]) => {
      console.log(`    ${code} - ${liability.name}: $${liability.balance.toLocaleString()}`);
    });
    console.log(`  Total Non-Current Liabilities: $${balanceSheet.liabilities.totalNonCurrent.toLocaleString()}`);
    
    // Break down equity
    console.log('\n🏛️ EQUITY BREAKDOWN:');
    console.log(`  Capital: $${balanceSheet.equity.capital.toLocaleString()}`);
    console.log(`  Retained Earnings: $${balanceSheet.equity.retainedEarnings.toLocaleString()}`);
    console.log(`  Other Equity: $${balanceSheet.equity.otherEquity.toLocaleString()}`);
    console.log(`  Total Equity: $${balanceSheet.equity.totalEquity.toLocaleString()}`);
    
    // Check if the imbalance is in retained earnings calculation
    console.log('\n🔍 RETAINED EARNINGS ANALYSIS:');
    console.log(`  The $${difference.toLocaleString()} imbalance suggests:`);
    
    if (difference > 0) {
      console.log(`  - Retained Earnings should be HIGHER by $${difference.toLocaleString()}`);
      console.log(`  - This could mean missing income entries or incorrect expense recognition`);
    } else {
      console.log(`  - Retained Earnings should be LOWER by $${Math.abs(difference).toLocaleString()}`);
      console.log(`  - This could mean missing expense entries or incorrect income recognition`);
    }
    
    // Suggest fixes
    console.log('\n🛠️ SUGGESTED FIXES:');
    console.log('  1. Check if all income/expense transactions are properly categorized');
    console.log('  2. Verify that retained earnings calculation includes all income/expense accounts');
    console.log('  3. Ensure opening balances are correctly set for the beginning of the year');
    console.log('  4. Check for any missing transaction entries that affect equity');
    
    console.log('\n✅ Accounting equation debugging completed!');
    
  } catch (error) {
    console.error('❌ Error debugging accounting equation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

debugAccountingEquation();
