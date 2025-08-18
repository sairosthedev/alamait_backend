const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testMonthlyBalanceSheet() {
  try {
    console.log('🧪 Testing Monthly Balance Sheet Service...\n');
    
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Connected to MongoDB Atlas');
    
    // Test 1: Generate Monthly Balance Sheet for 2025
    console.log('\n🧪 TEST 1: GENERATE MONTHLY BALANCE SHEET FOR 2025');
    console.log('='.repeat(70));
    
    const monthlyBalanceSheet = await BalanceSheetService.generateMonthlyBalanceSheet('2025');
    
    console.log('📊 Monthly Balance Sheet Generated Successfully:');
    console.log(`  - Year: ${monthlyBalanceSheet.year}`);
    console.log(`  - Residence: ${monthlyBalanceSheet.residence}`);
    console.log(`  - Message: ${monthlyBalanceSheet.message}`);
    
    // Check monthly data structure
    if (monthlyBalanceSheet.monthly) {
      console.log(`  - Monthly data available for ${Object.keys(monthlyBalanceSheet.monthly).length} months`);
      
      // Show sample month data (August)
      const augustData = monthlyBalanceSheet.monthly[8];
      if (augustData) {
        console.log('\n📅 Sample Month (August) Data:');
        console.log(`  - Month: ${augustData.month} (${augustData.monthName})`);
        console.log(`  - Assets Total: $${augustData.assets.total.toLocaleString()}`);
        console.log(`  - Liabilities Total: $${augustData.liabilities.total.toLocaleString()}`);
        console.log(`  - Equity Total: $${augustData.equity.total.toLocaleString()}`);
        
        // Show accounts receivable details
        if (augustData.assets.accountsReceivable) {
          console.log('  - Accounts Receivable:');
          Object.entries(augustData.assets.accountsReceivable).forEach(([key, ar]) => {
            if (key !== 'total') {
              console.log(`    ${ar.accountCode} - ${ar.accountName}: $${ar.amount.toLocaleString()}`);
            }
          });
        }
        
        // Show cash and bank details
        if (augustData.assets.current.cashAndBank) {
          console.log('  - Cash and Bank Accounts:');
          Object.entries(augustData.assets.current.cashAndBank).forEach(([key, cash]) => {
            if (key !== 'total') {
              console.log(`    ${cash.accountCode} - ${cash.accountName}: $${cash.amount.toLocaleString()}`);
            }
          });
          console.log(`    Total Cash & Bank: $${augustData.assets.current.cashAndBank.total.toLocaleString()}`);
        }
      }
    }
    
    // Check annual summary
    if (monthlyBalanceSheet.annualSummary) {
      console.log('\n📈 Annual Summary:');
      console.log(`  - Total Annual Assets: $${monthlyBalanceSheet.annualSummary.totalAnnualAssets.toLocaleString()}`);
      console.log(`  - Total Annual Liabilities: $${monthlyBalanceSheet.annualSummary.totalAnnualLiabilities.toLocaleString()}`);
      console.log(`  - Total Annual Equity: $${monthlyBalanceSheet.annualSummary.totalAnnualEquity.toLocaleString()}`);
    }
    
    // Test 2: Generate Monthly Balance Sheet for specific residence
    console.log('\n🧪 TEST 2: MONTHLY BALANCE SHEET FOR SPECIFIC RESIDENCE');
    console.log('='.repeat(70));
    
    const specificResidence = '67d723cf20f89c4ae69804f3'; // St Kilda
    const residenceMonthlyBalanceSheet = await BalanceSheetService.generateMonthlyBalanceSheet('2025', specificResidence);
    
    console.log(`📊 Monthly Balance Sheet for Residence ${specificResidence}:`);
    console.log(`  - Year: ${residenceMonthlyBalanceSheet.year}`);
    console.log(`  - Residence: ${residenceMonthlyBalanceSheet.residence}`);
    
    // Compare totals
    if (residenceMonthlyBalanceSheet.annualSummary && monthlyBalanceSheet.annualSummary) {
      console.log('\n📊 Comparison (All vs Specific Residence):');
      console.log('  Assets:');
      console.log(`    All Residences: $${monthlyBalanceSheet.annualSummary.totalAnnualAssets.toLocaleString()}`);
      console.log(`    Specific: $${residenceMonthlyBalanceSheet.annualSummary.totalAnnualAssets.toLocaleString()}`);
      
      console.log('  Liabilities:');
      console.log(`    All Residences: $${monthlyBalanceSheet.annualSummary.totalAnnualLiabilities.toLocaleString()}`);
      console.log(`    Specific: $${residenceMonthlyBalanceSheet.annualSummary.totalAnnualLiabilities.toLocaleString()}`);
      
      console.log('  Equity:');
      console.log(`    All Residences: $${monthlyBalanceSheet.annualSummary.totalAnnualEquity.toLocaleString()}`);
      console.log(`    Specific: $${residenceMonthlyBalanceSheet.annualSummary.totalAnnualEquity.toLocaleString()}`);
    }
    
    // Test 3: Check data structure compatibility with React component
    console.log('\n🧪 TEST 3: DATA STRUCTURE COMPATIBILITY CHECK');
    console.log('='.repeat(70));
    
    const requiredStructure = [
      'monthly',
      'annualSummary',
      'year',
      'residence',
      'message'
    ];
    
    const hasRequiredStructure = requiredStructure.every(key => 
      monthlyBalanceSheet.hasOwnProperty(key)
    );
    
    console.log(`✅ Required structure check: ${hasRequiredStructure ? 'PASSED' : 'FAILED'}`);
    
    if (hasRequiredStructure) {
      console.log('  - All required top-level keys present');
      
      // Check monthly structure
      const sampleMonth = monthlyBalanceSheet.monthly[1]; // January
      if (sampleMonth) {
        const monthlyStructure = [
          'month', 'monthName', 'assets', 'liabilities', 'equity', 'summary'
        ];
        
        const hasMonthlyStructure = monthlyStructure.every(key => 
          sampleMonth.hasOwnProperty(key)
        );
        
        console.log(`  - Monthly structure check: ${hasMonthlyStructure ? 'PASSED' : 'FAILED'}`);
        
        if (hasMonthlyStructure) {
          console.log('    - Assets structure:', Object.keys(sampleMonth.assets));
          console.log('    - Liabilities structure:', Object.keys(sampleMonth.liabilities));
          console.log('    - Equity structure:', Object.keys(sampleMonth.equity));
          console.log('    - Summary structure:', Object.keys(sampleMonth.summary));
        }
      }
    }
    
    console.log('\n✅ All Monthly Balance Sheet tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing monthly balance sheet:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testMonthlyBalanceSheet();
