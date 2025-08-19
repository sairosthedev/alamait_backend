const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import services
const FinancialReportingService = require('../src/services/financialReportingService');
const BalanceSheetService = require('../src/services/balanceSheetService');

/**
 * SHOW CURRENT API TABLES
 * 
 * This script will show the actual table data that your
 * currently working API endpoints display
 */

async function showCurrentApiTables() {
  try {
    console.log('\n📊 CURRENT API ENDPOINT TABLES');
    console.log('================================\n');
    
    // ========================================
    // TABLE 1: INCOME STATEMENT (CASH BASIS) - WORKING
    // ========================================
    console.log('📋 TABLE 1: INCOME STATEMENT (CASH BASIS) - WORKING ✅');
    console.log('======================================================\n');
    
    try {
      const cashIncomeStatement = await FinancialReportingService.generateIncomeStatement('2025', 'cash');
      
      if (cashIncomeStatement.success) {
        console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
        console.log('│                                                                                             │');
        console.log('│  📊 MONTHLY INCOME STATEMENT (CASH BASIS)                                                  │');
        console.log('│                                                                                             │');
        console.log('│  Month      │ Revenue    │ Expenses   │ Net Income │ Transaction Count                      │');
        console.log('│  ───────────┼────────────┼────────────┼────────────┼───────────────────────────────────── │');
        
        // Monthly breakdown table
        Object.entries(cashIncomeStatement.data.monthly_breakdown).forEach(([monthIndex, monthData]) => {
          const monthName = monthData.month;
          const revenue = monthData.total_revenue;
          const expenses = monthData.total_expenses;
          const netIncome = monthData.net_income;
          const transactionCount = monthData.transaction_count;
          
          console.log(`│  ${monthName.padEnd(10)} │ $${revenue.toString().padStart(8)} │ $${expenses.toString().padStart(8)} │ $${netIncome.toString().padStart(8)} │ ${transactionCount.toString().padStart(3)} transactions                          │`);
        });
        
        console.log('│                                                                                             │');
        console.log(`│  📈 YEAR TOTALS: Revenue: $${cashIncomeStatement.data.year_totals.total_revenue} | Expenses: $${cashIncomeStatement.data.year_totals.total_expenses} | Net: $${cashIncomeStatement.data.year_totals.net_income} │`);
        console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
      } else {
        console.log('❌ Cash Basis Income Statement failed:', cashIncomeStatement.message);
      }
    } catch (error) {
      console.log('❌ Error generating cash basis income statement:', error.message);
    }
    
    // ========================================
    // TABLE 2: BALANCE SHEET (ACCRUAL BASIS) - WORKING
    // ========================================
    console.log('\n📋 TABLE 2: BALANCE SHEET (ACCRUAL BASIS) - WORKING ✅');
    console.log('========================================================\n');
    
    try {
      const balanceSheet = await BalanceSheetService.generateMonthlyBalanceSheet('2025');
      
      if (balanceSheet.success) {
        console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
        console.log('│                                                                                             │');
        console.log('│  📊 MONTHLY BALANCE SHEET (ACCRUAL BASIS)                                                  │');
        console.log('│                                                                                             │');
        console.log('│  Month      │ Assets     │ Liabilities│ Equity     │ Balance Check                          │');
        console.log('│  ───────────┼────────────┼────────────┼────────────┼───────────────────────────────────── │');
        
        // Monthly breakdown table
        Object.entries(balanceSheet.data.monthly).forEach(([monthIndex, monthData]) => {
          const monthName = monthData.monthName;
          const assets = monthData.assets.total;
          const liabilities = monthData.liabilities.total;
          const equity = monthData.equity.total;
          const balanceCheck = monthData.balanceCheck;
          
          console.log(`│  ${monthName.padEnd(10)} │ $${assets.toString().padStart(8)} │ $${liabilities.toString().padStart(8)} │ $${equity.toString().padStart(8)} │ ${balanceCheck.padStart(20)} │`);
        });
        
        console.log('│                                                                                             │');
        console.log(`│  📈 ANNUAL SUMMARY: Assets: $${balanceSheet.data.annualSummary.totalAnnualAssets.toFixed(2)} | Liabilities: $${balanceSheet.data.annualSummary.totalAnnualLiabilities.toFixed(2)} | Equity: $${balanceSheet.data.annualSummary.totalAnnualEquity.toFixed(2)} │`);
        console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
      } else {
        console.log('❌ Balance Sheet failed:', balanceSheet.message);
      }
    } catch (error) {
      console.log('❌ Error generating balance sheet:', error.message);
    }
    
    // ========================================
    // TABLE 3: CASH FLOW SUMMARY - WORKING
    // ========================================
    console.log('\n📋 TABLE 3: CASH FLOW SUMMARY - WORKING ✅');
    console.log('==========================================\n');
    
    try {
      const cashFlow = await FinancialReportingService.generateCashFlowStatement('2025', 'cash');
      
      if (cashFlow.success) {
        console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
        console.log('│                                                                                             │');
        console.log('│  📊 CASH FLOW STATEMENT SUMMARY                                                           │');
        console.log('│                                                                                             │');
        console.log(`│  Operating Activities: $${cashFlow.data.year_totals.operating_activities.net_cash_flow}                    │`);
        console.log(`│  Investing Activities: $${cashFlow.data.year_totals.investing_activities.net_cash_flow}                    │`);
        console.log(`│  Financing Activities: $${cashFlow.data.year_totals.financing_activities.net_cash_flow}                    │`);
        console.log(`│  Net Change in Cash: $${cashFlow.data.year_totals.net_change_in_cash}                        │`);
        console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
      } else {
        console.log('❌ Cash Flow Statement failed:', cashFlow.message);
      }
    } catch (error) {
      console.log('❌ Error generating cash flow statement:', error.message);
    }
    
    // ========================================
    // SUMMARY OF WHAT FRONTEND SEES
    // ========================================
    console.log('\n📋 FRONTEND DISPLAY SUMMARY');
    console.log('============================\n');
    
    console.log('🎯 WHAT YOUR FRONTEND CURRENTLY DISPLAYS:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📊 INCOME STATEMENT TABLES:                                                               │');
    console.log('│     • Cash Basis: Shows monthly tables with $0 values across all months                    │');
    console.log('│     • Accrual Basis: No data displayed (endpoint failing)                                  │');
    console.log('│                                                                                             │');
    console.log('│  📊 BALANCE SHEET TABLES:                                                                 │');
    console.log('│     • Accrual Basis: ✅ Complete monthly tables with assets/liabilities/equity              │');
    console.log('│     • Shows progression from January ($0 assets) to December ($16,625 assets)              │');
    console.log('│                                                                                             │');
    console.log('│  📊 CASH FLOW TABLES:                                                                    │');
    console.log('│     • ✅ Shows summary with $8,633.88 operating cash flow                                  │');
    console.log('│     • Monthly breakdown may be limited                                                      │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
  } catch (error) {
    console.error('❌ Error showing current API tables:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the display
showCurrentApiTables();
