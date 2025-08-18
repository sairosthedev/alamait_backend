const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testFixedBalanceSheet() {
  try {
    console.log('🔍 Testing Fixed Balance Sheet Service...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Test the monthly balance sheet generation
    console.log('\n🔍 Testing generateMonthlyBalanceSheet for 2025...');
    
    const monthlyBalanceSheet = await BalanceSheetService.generateMonthlyBalanceSheet(2025);
    
    if (monthlyBalanceSheet.success) {
      console.log('✅ Monthly balance sheet generated successfully');
      
      // Check January data specifically
      const januaryData = monthlyBalanceSheet.data.monthly[1];
      
      if (januaryData) {
        console.log('\n📊 January 2025 Balance Sheet Data:');
        console.log('=====================================');
        
        // Check Assets
        console.log('\n💰 Assets:');
        console.log(`  Total Assets: $${januaryData.assets.total}`);
        console.log(`  Current Assets: $${januaryData.assets.current.total}`);
        
        // Check Liabilities
        console.log('\n💸 Liabilities:');
        console.log(`  Total Liabilities: $${januaryData.liabilities.total}`);
        console.log(`  Current Liabilities: $${januaryData.liabilities.current.total}`);
        
        // Check individual liability accounts
        if (januaryData.liabilities.current.accountsPayable) {
          Object.entries(januaryData.liabilities.current.accountsPayable).forEach(([code, account]) => {
            if (code !== 'total') {
              console.log(`    Accounts Payable (${code}): $${account.amount}`);
            }
          });
        }
        
        if (januaryData.liabilities.current.tenantDeposits) {
          Object.entries(januaryData.liabilities.current.tenantDeposits).forEach(([code, account]) => {
            if (code !== 'total') {
              console.log(`    Tenant Deposits (${code}): $${account.amount}`);
            }
          });
        }
        
        // Check Equity
        console.log('\n🏛️ Equity:');
        console.log(`  Total Equity: $${januaryData.equity.total}`);
        console.log(`  Capital: $${januaryData.equity.capital.amount}`);
        console.log(`  Retained Earnings: $${januaryData.equity.retainedEarnings.amount}`);
        
        // Check Summary
        console.log('\n📋 Summary:');
        console.log(`  Total Assets: $${januaryData.summary.totalAssets}`);
        console.log(`  Total Liabilities: $${januaryData.summary.totalLiabilities}`);
        console.log(`  Total Equity: $${januaryData.summary.totalEquity}`);
        
        // Check if values are positive
        console.log('\n🔍 Checking for Negative Values:');
        console.log('=====================================');
        
        let hasNegativeValues = false;
        
        if (januaryData.liabilities.total < 0) {
          console.log(`❌ Total Liabilities is negative: $${januaryData.liabilities.total}`);
          hasNegativeValues = true;
        } else {
          console.log(`✅ Total Liabilities is positive: $${januaryData.liabilities.total}`);
        }
        
        if (januaryData.equity.total < 0) {
          console.log(`❌ Total Equity is negative: $${januaryData.equity.total}`);
          hasNegativeValues = true;
        } else {
          console.log(`✅ Total Equity is positive: $${januaryData.equity.total}`);
        }
        
        // Check individual accounts
        if (januaryData.liabilities.current.accountsPayable) {
          Object.entries(januaryData.liabilities.current.accountsPayable).forEach(([code, account]) => {
            if (code !== 'total' && account.amount < 0) {
              console.log(`❌ Accounts Payable (${code}) is negative: $${account.amount}`);
              hasNegativeValues = true;
            }
          });
        }
        
        if (januaryData.equity.retainedEarnings.amount < 0) {
          console.log(`❌ Retained Earnings is negative: $${januaryData.equity.retainedEarnings.amount}`);
          hasNegativeValues = true;
        } else {
          console.log(`✅ Retained Earnings is positive: $${januaryData.equity.retainedEarnings.amount}`);
        }
        
        if (!hasNegativeValues) {
          console.log('\n🎉 SUCCESS: All liability and equity values are now positive!');
        } else {
          console.log('\n⚠️  WARNING: Some values are still negative and need fixing.');
        }
        
        // Check balance sheet equation
        console.log('\n🔍 Balance Sheet Equation Check:');
        console.log('=====================================');
        
        const assets = januaryData.summary.totalAssets;
        const liabilities = januaryData.summary.totalLiabilities;
        const equity = januaryData.summary.totalEquity;
        
        console.log(`Assets: $${assets}`);
        console.log(`Liabilities: $${liabilities}`);
        console.log(`Equity: $${equity}`);
        console.log(`Liabilities + Equity: $${liabilities + equity}`);
        
        const difference = Math.abs(assets - (liabilities + equity));
        
        if (difference < 0.01) {
          console.log(`✅ SUCCESS: Assets = Liabilities + Equity (Difference: $${difference.toFixed(2)})`);
        } else {
          console.log(`❌ FAILED: Assets ≠ Liabilities + Equity (Difference: $${difference.toFixed(2)})`);
        }
        
      } else {
        console.log('❌ No January data found');
      }
      
    } else {
      console.log('❌ Failed to generate monthly balance sheet:', monthlyBalanceSheet.message);
    }

  } catch (error) {
    console.error('❌ Error testing fixed balance sheet:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testFixedBalanceSheet();
