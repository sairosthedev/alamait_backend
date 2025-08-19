const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');
const Debtor = require('../src/models/Debtor');

/**
 * JANUARY-DECEMBER COMPREHENSIVE FINANCIAL REPORTS
 * 
 * This will show ALL cash movements and explain why they differ
 * across different reports and time periods
 */

async function generateJanDecComprehensive() {
  try {
    console.log('\n📊 JANUARY-DECEMBER COMPREHENSIVE FINANCIAL REPORTS');
    console.log('=====================================================\n');
    
    // Set reporting periods
    const fullYear = { start: new Date('2025-01-01'), end: new Date('2025-12-31') };
    const q1 = { start: new Date('2025-01-01'), end: new Date('2025-03-31') };
    const q2 = { start: new Date('2025-04-01'), end: new Date('2025-06-30') };
    const q3 = { start: new Date('2025-07-01'), end: new Date('2025-09-30') };
    const q4 = { start: new Date('2025-10-01'), end: new Date('2025-12-31') };
    
    console.log(`📅 Full Year Period: ${fullYear.start.toDateString()} to ${fullYear.end.toDateString()}\n`);
    
    // ========================================
    // REPORT 1: ALL CASH MOVEMENTS (FULL YEAR)
    // ========================================
    console.log('📋 REPORT 1: ALL CASH MOVEMENTS (FULL YEAR)');
    console.log('=============================================\n');
    
    // Get ALL cash movements regardless of source
    const allCashMovements = await TransactionEntry.find({
      date: { $gte: fullYear.start, $lte: fullYear.end },
      'entries.accountCode': { $in: ['1001', '1002', '1011'] }, // Bank, Cash, Petty Cash
      status: 'posted'
    });
    
    let totalCashIn = 0;
    let totalCashOut = 0;
    const cashInBySource = {};
    const cashOutBySource = {};
    const cashInByMonth = {};
    const cashOutByMonth = {};
    
    allCashMovements.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (['1001', '1002', '1011'].includes(lineItem.accountCode)) {
            const month = new Date(entry.date).toLocaleString('default', { month: 'short' });
            const source = entry.source || 'unknown';
            
            if (lineItem.debit > 0) { // Cash IN
              totalCashIn += lineItem.debit;
              cashInBySource[source] = (cashInBySource[source] || 0) + lineItem.debit;
              cashInByMonth[month] = (cashInByMonth[month] || 0) + lineItem.debit;
            } else if (lineItem.credit > 0) { // Cash OUT
              totalCashOut += lineItem.credit;
              cashOutBySource[source] = (cashOutBySource[source] || 0) + lineItem.credit;
              cashOutByMonth[month] = (cashOutByMonth[month] || 0) + lineItem.credit;
            }
          }
        });
      }
    });
    
    console.log('💰 CASH INFLOWS BY SOURCE:');
    console.log('┌─────────────────────────────────────────────────┬─────────────┐');
    console.log('│ Source                                         │ Amount      │');
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    
    Object.entries(cashInBySource).forEach(([source, amount]) => {
      const paddedSource = source.padEnd(45);
      const paddedAmount = `$${amount.toFixed(2)}`.padStart(12);
      console.log(`│ ${paddedSource} │ ${paddedAmount} │`);
    });
    
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    const totalCashInPadded = `$${totalCashIn.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL CASH IN                                  │ ${totalCashInPadded} │`);
    console.log('└─────────────────────────────────────────────────┴─────────────┘\n');
    
    console.log('💸 CASH OUTFLOWS BY SOURCE:');
    console.log('┌─────────────────────────────────────────────────┬─────────────┐');
    console.log('│ Source                                         │ Amount      │');
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    
    Object.entries(cashOutBySource).forEach(([source, amount]) => {
      const paddedSource = source.padEnd(45);
      const paddedAmount = `$${amount.toFixed(2)}`.padStart(12);
      console.log(`│ ${paddedSource} │ ${paddedAmount} │`);
    });
    
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    const totalCashOutPadded = `$${totalCashOut.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL CASH OUT                                 │ ${totalCashOutPadded} │`);
    console.log('└─────────────────────────────────────────────────┴─────────────┘\n');
    
    // ========================================
    // REPORT 2: MONTHLY CASH FLOW BREAKDOWN
    // ========================================
    console.log('📋 REPORT 2: MONTHLY CASH FLOW BREAKDOWN');
    console.log('=========================================\n');
    
    console.log('📅 MONTHLY CASH FLOW:');
    console.log('┌──────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Month    │ Cash In     │ Cash Out    │ Net Flow    │ Running     │');
    console.log('│          │             │             │             │ Balance     │');
    console.log('├──────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let runningBalance = 0;
    
    months.forEach(month => {
      const cashIn = cashInByMonth[month] || 0;
      const cashOut = cashOutByMonth[month] || 0;
      const netFlow = cashIn - cashOut;
      runningBalance += netFlow;
      
      const monthPadded = month.padEnd(9);
      const cashInPadded = `$${cashIn.toFixed(2)}`.padStart(12);
      const cashOutPadded = `$${cashOut.toFixed(2)}`.padStart(12);
      const netFlowPadded = `$${netFlow.toFixed(2)}`.padStart(12);
      const runningPadded = `$${runningBalance.toFixed(2)}`.padStart(12);
      
      console.log(`│ ${monthPadded} │ ${cashInPadded} │ ${cashOutPadded} │ ${netFlowPadded} │ ${runningPadded} │`);
    });
    
    console.log('├──────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    const totalNetFlow = totalCashIn - totalCashOut;
    const totalNetFlowPadded = `$${totalNetFlow.toFixed(2)}`.padStart(12);
    const finalBalancePadded = `$${runningBalance.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL    │ ${totalCashInPadded} │ ${totalCashOutPadded} │ ${totalNetFlowPadded} │ ${finalBalancePadded} │`);
    console.log('└──────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    // ========================================
    // REPORT 3: QUARTERLY COMPARISON
    // ========================================
    console.log('📋 REPORT 3: QUARTERLY COMPARISON');
    console.log('==================================\n');
    
    console.log('📊 QUARTERLY PERFORMANCE:');
    console.log('┌──────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Quarter  │ Cash In     │ Cash Out    │ Net Flow    │ % of Year   │');
    console.log('├──────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    
    const quarters = [
      { name: 'Q1', period: q1 },
      { name: 'Q2', period: q2 },
      { name: 'Q3', period: q3 },
      { name: 'Q4', period: q4 }
    ];
    
    quarters.forEach(quarter => {
      const qCashIn = cashInByMonth[quarter.name] || 0;
      const qCashOut = cashOutByMonth[quarter.name] || 0;
      const qNetFlow = qCashIn - qCashOut;
      const percentOfYear = totalCashIn > 0 ? ((qCashIn / totalCashIn) * 100) : 0;
      
      const qNamePadded = quarter.name.padEnd(9);
      const qCashInPadded = `$${qCashIn.toFixed(2)}`.padStart(12);
      const qCashOutPadded = `$${qCashOut.toFixed(2)}`.padStart(12);
      const qNetFlowPadded = `$${qNetFlow.toFixed(2)}`.padStart(12);
      const percentPadded = `${percentOfYear.toFixed(1)}%`.padStart(12);
      
      console.log(`│ ${qNamePadded} │ ${qCashInPadded} │ ${qCashOutPadded} │ ${qNetFlowPadded} │ ${percentPadded} │`);
    });
    
    console.log('├──────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    const totalPercentPadded = '100.0%'.padStart(12);
    console.log(`│ TOTAL    │ ${totalCashInPadded} │ ${totalCashOutPadded} │ ${totalNetFlowPadded} │ ${totalPercentPadded} │`);
    console.log('└──────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    // ========================================
    // REPORT 4: WHY CASH RECEIVED DIFFERS
    // ========================================
    console.log('📋 REPORT 4: WHY CASH RECEIVED DIFFERS ACROSS REPORTS');
    console.log('=======================================================\n');
    
    console.log('🔍 EXPLANATION OF CASH DIFFERENCES:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  🚨 WHY CASH RECEIVED DIFFERS ACROSS REPORTS:                                               │');
    console.log('│                                                                                             │');
    console.log('│  1️⃣  DIFFERENT TIME PERIODS:                                                                │');
    console.log('│     • August Report: Only August transactions                                               │');
    console.log('│     • September-December Report: Only Sept-Dec transactions                                │');
    console.log('│     • This Report: January-December (FULL YEAR)                                            │');
    console.log('│                                                                                             │');
    console.log('│  2️⃣  DIFFERENT SOURCE FILTERS:                                                             │');
    console.log('│     • Cash Basis Reports: Only payment, expense_payment, vendor_payment                     │');
    console.log('│     • This Report: ALL sources that affect cash accounts                                   │');
    console.log('│     • Includes: rental_accrual, manual, adjustment, etc.                                   │');
    console.log('│                                                                                             │');
    console.log('│  3️⃣  DIFFERENT ACCOUNT FILTERS:                                                            │');
    console.log('│     • Some reports: Only specific cash accounts                                            │');
    console.log('│     • This report: All cash accounts (1001, 1002, 1011)                                   │');
    console.log('│                                                                                             │');
    console.log('│  4️⃣  DIFFERENT TRANSACTION TYPES:                                                          │');
    console.log('│     • Income Statement: Only revenue/expense transactions                                  │');
    console.log('│     • Cash Flow: All cash movements (including transfers)                                  │');
    console.log('│     • Balance Sheet: All account balance changes                                           │');
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // REPORT 5: SOURCE BREAKDOWN ANALYSIS
    // ========================================
    console.log('📋 REPORT 5: SOURCE BREAKDOWN ANALYSIS');
    console.log('========================================\n');
    
    console.log('📊 CASH MOVEMENTS BY SOURCE TYPE:');
    console.log('┌─────────────────────────────────────────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Source Type                                    │ Cash In     │ Cash Out    │ Net         │');
    console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┤');
    
    // Group sources by type
    const sourceTypes = {
      'Revenue': ['payment'],
      'Expenses': ['expense_payment', 'vendor_payment'],
      'Accruals': ['rental_accrual', 'manual'],
      'Transfers': ['adjustment', 'transfer'],
      'Other': ['unknown', 'system']
    };
    
    Object.entries(sourceTypes).forEach(([type, sources]) => {
      let typeCashIn = 0;
      let typeCashOut = 0;
      
      sources.forEach(source => {
        typeCashIn += cashInBySource[source] || 0;
        typeCashOut += cashOutBySource[source] || 0;
      });
      
      const typePadded = type.padEnd(45);
      const typeCashInPadded = `$${typeCashIn.toFixed(2)}`.padStart(12);
      const typeCashOutPadded = `$${typeCashOut.toFixed(2)}`.padStart(12);
      const typeNetPadded = `$${(typeCashIn - typeCashOut).toFixed(2)}`.padStart(12);
      
      console.log(`│ ${typePadded} │ ${typeCashInPadded} │ ${typeCashOutPadded} │ ${typeNetPadded} │`);
    });
    
    console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┤');
    const totalNetPadded = `$${totalNetFlow.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL                                           │ ${totalCashInPadded} │ ${totalCashOutPadded} │ ${totalNetPadded} │`);
    console.log('└─────────────────────────────────────────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    // ========================================
    // REPORT 6: RECONCILIATION GUIDE
    // ========================================
    console.log('📋 REPORT 6: RECONCILIATION GUIDE');
    console.log('==================================\n');
    
    console.log('🔧 HOW TO RECONCILE CASH ACROSS REPORTS:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📋 STEP-BY-STEP RECONCILIATION:                                                            │');
    console.log('│                                                                                             │');
    console.log('│  1️⃣  START WITH THIS REPORT (Full Year):                                                    │');
    console.log('│     • Total Cash In: $' + totalCashIn.toFixed(2) + '                                                      │');
    console.log('│     • Total Cash Out: $' + totalCashOut.toFixed(2) + '                                                     │');
    console.log('│     • Net Cash Flow: $' + totalNetFlow.toFixed(2) + '                                                      │');
    console.log('│                                                                                             │');
    console.log('│  2️⃣  BREAK DOWN BY QUARTER:                                                                 │');
    console.log('│     • Q1: $' + (cashInByMonth['Q1'] || 0).toFixed(2) + ' | Q2: $' + (cashInByMonth['Q2'] || 0).toFixed(2) + ' | Q3: $' + (cashInByMonth['Q3'] || 0).toFixed(2) + ' | Q4: $' + (cashInByMonth['Q4'] || 0).toFixed(2) + ' │');
    console.log('│                                                                                             │');
    console.log('│  3️⃣  BREAK DOWN BY MONTH:                                                                   │');
    console.log('│     • January: $' + (cashInByMonth['Jan'] || 0).toFixed(2) + ' | February: $' + (cashInByMonth['Feb'] || 0).toFixed(2) + ' | March: $' + (cashInByMonth['Mar'] || 0).toFixed(2) + ' │');
    console.log('│                                                                                             │');
    console.log('│  4️⃣  BREAK DOWN BY SOURCE:                                                                  │');
    console.log('│     • Revenue: $' + (cashInBySource['payment'] || 0).toFixed(2) + ' | Expenses: $' + (cashOutBySource['expense_payment'] || 0).toFixed(2) + ' | Accruals: $' + (cashInBySource['rental_accrual'] || 0).toFixed(2) + ' │');
    console.log('│                                                                                             │');
    console.log('│  5️⃣  COMPARE WITH OTHER REPORTS:                                                            │');
    console.log('│     • August Report: Should match August month from this report                            │');
    console.log('│     • Sept-Dec Report: Should match Q3+Q4 from this report                                 │');
    console.log('│     • Any differences = Different filters or time periods                                  │');
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('🎯 FINAL SUMMARY');
    console.log('================\n');
    
    console.log('✅ WHAT THIS COMPREHENSIVE REPORT SHOWS:');
    console.log('   • Total Cash Received (Full Year): $' + totalCashIn.toFixed(2));
    console.log('   • Total Cash Paid Out (Full Year): $' + totalCashOut.toFixed(2));
    console.log('   • Net Cash Flow (Full Year): $' + totalNetFlow.toFixed(2));
    console.log('   • Monthly breakdown for trend analysis');
    console.log('   • Quarterly performance comparison');
    console.log('   • Source-by-source breakdown');
    
    console.log('\n💡 WHY CASH RECEIVED DIFFERS ACROSS REPORTS:');
    console.log('   1. Different time periods (month vs quarter vs year)');
    console.log('   2. Different source filters (revenue only vs all cash movements)');
    console.log('   3. Different account filters (specific accounts vs all cash accounts)');
    console.log('   4. Different transaction types (income vs all cash movements)');
    
    console.log('\n🔧 HOW TO USE THIS FOR RECONCILIATION:');
    console.log('   • This report is your "source of truth" for full year cash');
    console.log('   • Other reports are subsets of this data');
    console.log('   • Always start here and work backwards to reconcile');
    
    console.log('\n🎉 YOUR CASH FLOW ANALYSIS IS NOW COMPLETE!');
    
  } catch (error) {
    console.error('❌ Error generating January-December comprehensive reports:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the report generation
generateJanDecComprehensive();
