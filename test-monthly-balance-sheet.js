const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

// 🔐 User's actual MongoDB Atlas credentials
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testMonthlyBalanceSheet() {
  try {
        console.log('🧪 Testing Monthly Balance Sheet Breakdown...\n');
        
        // Connect to your MongoDB Atlas cluster
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to your MongoDB Atlas cluster');
        
        const year = '2025';
        
        // Test 1: Cash Basis Monthly Balance Sheet
        console.log('\n🧪 TEST 1: CASH BASIS MONTHLY BALANCE SHEET');
        console.log('='.repeat(60));
        const cashMonthlyBalanceSheet = await FinancialReportingService.generateComprehensiveMonthlyBalanceSheet(year, 'cash');
        console.log('Cash Basis Monthly Balance Sheet:');
        console.log(`  - Period: ${cashMonthlyBalanceSheet.period}`);
        console.log(`  - Basis: ${cashMonthlyBalanceSheet.basis}`);
        console.log(`  - Year-end Assets: $${cashMonthlyBalanceSheet.year_end_totals.total_assets.toFixed(2)}`);
        console.log(`  - Year-end Liabilities: $${cashMonthlyBalanceSheet.year_end_totals.total_liabilities.toFixed(2)}`);
        console.log(`  - Year-end Equity: $${cashMonthlyBalanceSheet.year_end_totals.total_equity.toFixed(2)}`);
        console.log(`  - Balanced: ${cashMonthlyBalanceSheet.year_end_totals.accounting_equation_balanced ? '✅' : '❌'}`);
        
        // Show monthly breakdown
        console.log('\n📊 Monthly Balance Sheet Breakdown:');
        Object.entries(cashMonthlyBalanceSheet.monthly_breakdown).forEach(([index, monthData]) => {
            console.log(`  ${monthData.month}:`);
            console.log(`    Assets: $${monthData.total_assets.toFixed(2)}`);
            console.log(`    Liabilities: $${monthData.total_liabilities.toFixed(2)}`);
            console.log(`    Equity: $${monthData.total_equity.toFixed(2)}`);
            console.log(`    Transactions: ${monthData.transaction_count}`);
            console.log(`    Balanced: ${monthData.accounting_equation_balanced ? '✅' : '❌'}`);
        });
        
        // Test 2: Accrual Basis Monthly Balance Sheet
        console.log('\n🧪 TEST 2: ACCRUAL BASIS MONTHLY BALANCE SHEET');
        console.log('='.repeat(60));
        const accrualMonthlyBalanceSheet = await FinancialReportingService.generateComprehensiveMonthlyBalanceSheet(year, 'accrual');
        console.log('Accrual Basis Monthly Balance Sheet:');
        console.log(`  - Period: ${accrualMonthlyBalanceSheet.period}`);
        console.log(`  - Basis: ${accrualMonthlyBalanceSheet.basis}`);
        console.log(`  - Year-end Assets: $${accrualMonthlyBalanceSheet.year_end_totals.total_assets.toFixed(2)}`);
        console.log(`  - Year-end Liabilities: $${accrualMonthlyBalanceSheet.year_end_totals.total_liabilities.toFixed(2)}`);
        console.log(`  - Year-end Equity: $${accrualMonthlyBalanceSheet.year_end_totals.total_equity.toFixed(2)}`);
        console.log(`  - Balanced: ${accrualMonthlyBalanceSheet.year_end_totals.accounting_equation_balanced ? '✅' : '❌'}`);
        
        // Test 3: Compare Monthly vs Regular Balance Sheet
        console.log('\n🧪 TEST 3: MONTHLY VS REGULAR BALANCE SHEET COMPARISON');
        console.log('='.repeat(60));
        
        const regularBalanceSheet = await FinancialReportingService.generateBalanceSheet('2025-12-31', 'cash');
        
        console.log('Comparison:');
        console.log('  Cash Basis:');
        console.log(`    - Regular Balance Sheet Assets: $${regularBalanceSheet.assets.total_assets || 0}`);
        console.log(`    - Monthly Balance Sheet Assets: $${cashMonthlyBalanceSheet.year_end_totals.total_assets.toFixed(2)}`);
        console.log(`    - Regular Balance Sheet Liabilities: $${regularBalanceSheet.liabilities.total_liabilities || 0}`);
        console.log(`    - Monthly Balance Sheet Liabilities: $${cashMonthlyBalanceSheet.year_end_totals.total_liabilities.toFixed(2)}`);
        console.log(`    - Regular Balance Sheet Equity: $${regularBalanceSheet.equity.total_equity || 0}`);
        console.log(`    - Monthly Balance Sheet Equity: $${cashMonthlyBalanceSheet.year_end_totals.total_equity.toFixed(2)}`);
        
        // Test 4: Show detailed account breakdown for December
        console.log('\n🧪 TEST 4: DECEMBER DETAILED ACCOUNT BREAKDOWN');
        console.log('='.repeat(60));
        
        const decemberData = cashMonthlyBalanceSheet.monthly_breakdown[11]; // December (index 11)
        console.log('December Balance Sheet Details:');
        
        console.log('  ASSETS:');
        Object.entries(decemberData.assets).forEach(([key, account]) => {
            console.log(`    ${key}: $${account.balance.toFixed(2)}`);
        });
        
        console.log('  LIABILITIES:');
        Object.entries(decemberData.liabilities).forEach(([key, account]) => {
            console.log(`    ${key}: $${account.balance.toFixed(2)}`);
        });
        
        console.log('  EQUITY:');
        Object.entries(decemberData.equity).forEach(([key, account]) => {
            if (key !== 'retained_earnings') {
                console.log(`    ${key}: $${account.balance.toFixed(2)}`);
            }
        });
        console.log(`    Retained Earnings: $${decemberData.equity.retained_earnings.toFixed(2)}`);
        
        // Test 5: Show progression over months
        console.log('\n🧪 TEST 5: BALANCE SHEET PROGRESSION OVER MONTHS');
        console.log('='.repeat(60));
        
        console.log('Month-by-Month Progression:');
        Object.entries(cashMonthlyBalanceSheet.monthly_breakdown).forEach(([index, monthData]) => {
            const monthNumber = parseInt(index) + 1;
            console.log(`  ${monthNumber.toString().padStart(2, '0')}. ${monthData.month}:`);
            console.log(`    Assets: $${monthData.total_assets.toFixed(2).padStart(10)} | Liabilities: $${monthData.total_liabilities.toFixed(2).padStart(10)} | Equity: $${monthData.total_equity.toFixed(2).padStart(10)}`);
        });
    
  } catch (error) {
        console.error('❌ Error testing monthly balance sheet:', error);
  } finally {
    await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testMonthlyBalanceSheet();
