const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testFixedBalanceSheet() {
  try {
    console.log('🧪 Testing FIXED Balance Sheet Service...\n');
    
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Connected to MongoDB Atlas');
    
    // Test the monthly balance sheet generation
    console.log('📊 Generating Monthly Balance Sheet for 2025...');
    const monthlyBalanceSheet = await BalanceSheetService.generateMonthlyBalanceSheet('2025');
    
    console.log('\n🎯 FIXED BALANCE SHEET DATA:');
    console.log('='.repeat(60));
    
    // Show August data (the month we fixed)
    const august = monthlyBalanceSheet.monthly[8];
    if (august) {
      console.log('\n📅 AUGUST 2025 BALANCE SHEET:');
      console.log(`  Assets Total: $${august.assets.total.toLocaleString()}`);
      console.log(`  Liabilities Total: $${august.liabilities.total.toLocaleString()}`);
      console.log(`  Equity Total: $${august.equity.total.toLocaleString()}`);
      
      console.log('\n💰 ASSETS BREAKDOWN:');
      console.log(`  Cash & Bank: $${august.assets.current.cashAndBank.total.toLocaleString()}`);
      console.log(`  Accounts Receivable: $${august.assets.current.accountsReceivable.amount.toLocaleString()}`);
      
      console.log('\n💳 LIABILITIES BREAKDOWN:');
      if (august.liabilities.current.accountsPayable) {
        Object.entries(august.liabilities.current.accountsPayable).forEach(([code, liability]) => {
          console.log(`  ${code} - ${liability.accountName}: $${liability.amount.toLocaleString()}`);
        });
      }
      if (august.liabilities.current.tenantDeposits) {
        Object.entries(august.liabilities.current.tenantDeposits).forEach(([code, liability]) => {
          console.log(`  ${code} - ${liability.accountName}: $${liability.amount.toLocaleString()}`);
        });
      }
      
      console.log('\n🏛️ EQUITY BREAKDOWN:');
      console.log(`  Capital: $${august.equity.capital.amount.toLocaleString()}`);
      console.log(`  Retained Earnings: $${august.equity.retainedEarnings.amount.toLocaleString()}`);
      console.log(`  Other Equity: $${august.equity.otherEquity.amount.toLocaleString()}`);
      
      console.log('\n⚖️ ACCOUNTING EQUATION CHECK:');
      const assets = august.assets.total;
      const liabilities = august.liabilities.total;
      const equity = august.equity.total;
      const equation = assets - liabilities - equity;
      console.log(`  Assets: $${assets.toLocaleString()}`);
      console.log(`  Liabilities: $${liabilities.toLocaleString()}`);
      console.log(`  Equity: $${equity.toLocaleString()}`);
      console.log(`  Assets - Liabilities - Equity = ${equation.toLocaleString()}`);
      console.log(`  ✅ ${equation === 0 ? 'BALANCED!' : 'NOT BALANCED!'}`);
      
      // Check if values are positive
      console.log('\n🔍 POSITIVITY CHECK:');
      console.log(`  Assets: ${assets >= 0 ? '✅ POSITIVE' : '❌ NEGATIVE'}`);
      console.log(`  Liabilities: ${liabilities >= 0 ? '✅ POSITIVE' : '❌ NEGATIVE'}`);
      console.log(`  Equity: ${equity >= 0 ? '✅ POSITIVE' : '❌ NEGATIVE'}`);
      
    } else {
      console.log('❌ August data not found');
    }
    
    // Show annual summary
    console.log('\n📊 ANNUAL SUMMARY:');
    console.log('='.repeat(60));
    console.log(`  Total Annual Assets: $${monthlyBalanceSheet.annualSummary.totalAnnualAssets.toLocaleString()}`);
    console.log(`  Total Annual Liabilities: $${monthlyBalanceSheet.annualSummary.totalAnnualLiabilities.toLocaleString()}`);
    console.log(`  Total Annual Equity: $${monthlyBalanceSheet.annualSummary.totalAnnualEquity.toLocaleString()}`);
    
    console.log('\n✅ Fixed Balance Sheet test completed!');
    
  } catch (error) {
    console.error('❌ Error testing fixed balance sheet:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testFixedBalanceSheet();
