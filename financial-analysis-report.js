const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const Payment = require('./src/models/Payment');
const Expense = require('./src/models/Expense');
const Debtor = require('./src/models/Debtor');
const Transaction = require('./src/models/Transaction');

async function generateFinancialReport() {
  try {
    console.log('\n📊 Generating Comprehensive Financial Report...\n');
    
    // Get current date for calculations
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    console.log(`📅 Report Period: ${currentYear} (Current Month: ${currentMonth})\n`);
    
    // ========================================
    // 1. CASH FLOW ANALYSIS
    // ========================================
    console.log('💰 CASH FLOW STATEMENT');
    console.log('========================');
    
    // Fetch all payments for the year
    const payments = await Payment.find({
      date: {
        $gte: new Date(currentYear, 0, 1),
        $lte: new Date(currentYear, 11, 31, 23, 59, 59)
      },
      status: { $in: ['confirmed', 'completed', 'paid'] }
    }).populate('student residence');
    
    // Fetch all expenses for the year
    const expenses = await Expense.find({
      date: {
        $gte: new Date(currentYear, 0, 1),
        $lte: new Date(currentYear, 11, 59, 59, 59, 59)
      },
      status: { $in: ['approved', 'paid', 'completed'] }
    }).populate('vendor category');
    
    // Calculate cash inflows (payments)
    const totalCashIn = payments.reduce((sum, payment) => sum + (payment.totalAmount || 0), 0);
    const rentIncome = payments.reduce((sum, payment) => sum + (payment.rentAmount || 0), 0);
    const adminIncome = payments.reduce((sum, payment) => sum + (payment.adminFee || 0), 0);
    const depositIncome = payments.reduce((sum, payment) => sum + (payment.deposit || 0), 0);
    const utilitiesIncome = payments.reduce((sum, payment) => sum + (payment.utilities || 0), 0);
    const otherIncome = payments.reduce((sum, payment) => sum + (payment.other || 0), 0);
    
    // Calculate cash outflows (expenses)
    const totalCashOut = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    
    // Net cash flow
    const netCashFlow = totalCashIn - totalCashOut;
    
    console.log(`📥 CASH INFLOWS:`);
    console.log(`   Rent Income:        $${rentIncome.toFixed(2)}`);
    console.log(`   Admin Fees:         $${adminIncome.toFixed(2)}`);
    console.log(`   Deposits:           $${depositIncome.toFixed(2)}`);
    console.log(`   Utilities:          $${utilitiesIncome.toFixed(2)}`);
    console.log(`   Other Income:       $${otherIncome.toFixed(2)}`);
    console.log(`   ──────────────────────────────────`);
    console.log(`   TOTAL CASH IN:      $${totalCashIn.toFixed(2)}`);
    
    console.log(`\n📤 CASH OUTFLOWS:`);
    console.log(`   Total Expenses:     $${totalCashOut.toFixed(2)}`);
    
    console.log(`\n💵 NET CASH FLOW:     $${netCashFlow.toFixed(2)}`);
    
    // ========================================
    // 2. INCOME STATEMENT
    // ========================================
    console.log('\n📈 INCOME STATEMENT');
    console.log('===================');
    
    // Revenue breakdown
    console.log(`📊 REVENUE:`);
    console.log(`   Rent Revenue:       $${rentIncome.toFixed(2)}`);
    console.log(`   Admin Fees:         $${adminIncome.toFixed(2)}`);
    console.log(`   Deposit Revenue:    $${depositIncome.toFixed(2)}`);
    console.log(`   Utilities Revenue:  $${utilitiesIncome.toFixed(2)}`);
    console.log(`   Other Revenue:      $${otherIncome.toFixed(2)}`);
    console.log(`   ──────────────────────────────────`);
    console.log(`   TOTAL REVENUE:      $${totalCashIn.toFixed(2)}`);
    
    // Expense breakdown by category
    const expensesByCategory = {};
    expenses.forEach(expense => {
      const category = expense.category?.name || 'Uncategorized';
      expensesByCategory[category] = (expensesByCategory[category] || 0) + (expense.amount || 0);
    });
    
    console.log(`\n💸 EXPENSES:`);
    Object.entries(expensesByCategory).forEach(([category, amount]) => {
      console.log(`   ${category}: ${' '.repeat(20 - category.length)}$${amount.toFixed(2)}`);
    });
    console.log(`   ──────────────────────────────────`);
    console.log(`   TOTAL EXPENSES:     $${totalCashOut.toFixed(2)}`);
    
    // Net income
    const netIncome = totalCashIn - totalCashOut;
    console.log(`\n💰 NET INCOME:         $${netIncome.toFixed(2)}`);
    
    // ========================================
    // 3. BALANCE SHEET
    // ========================================
    console.log('\n⚖️  BALANCE SHEET');
    console.log('==================');
    
    // Assets
    const totalAssets = totalCashIn; // Simplified - assuming all income is cash/assets
    
    // Liabilities (outstanding debts)
    const debtors = await Debtor.find({ status: 'active' });
    const totalReceivables = debtors.reduce((sum, debtor) => sum + (debtor.currentBalance || 0), 0);
    
    // Equity
    const totalEquity = totalAssets - totalReceivables;
    
    console.log(`💼 ASSETS:`);
    console.log(`   Cash & Receivables: $${totalAssets.toFixed(2)}`);
    console.log(`   ──────────────────────────────────`);
    console.log(`   TOTAL ASSETS:       $${totalAssets.toFixed(2)}`);
    
    console.log(`\n📋 LIABILITIES:`);
    console.log(`   Accounts Receivable: $${totalReceivables.toFixed(2)}`);
    console.log(`   ──────────────────────────────────`);
    console.log(`   TOTAL LIABILITIES:  $${totalReceivables.toFixed(2)}`);
    
    console.log(`\n🏛️  EQUITY:`);
    console.log(`   Retained Earnings:  $${totalEquity.toFixed(2)}`);
    console.log(`   ──────────────────────────────────`);
    console.log(`   TOTAL EQUITY:       $${totalEquity.toFixed(2)}`);
    
    // ========================================
    // 4. MONTHLY BREAKDOWN
    // ========================================
    console.log('\n📅 MONTHLY BREAKDOWN');
    console.log('====================');
    
    const monthlyData = {};
    
    // Initialize monthly data
    for (let month = 1; month <= 12; month++) {
      monthlyData[month] = {
        income: 0,
        expenses: 0,
        netFlow: 0
      };
    }
    
    // Calculate monthly income
    payments.forEach(payment => {
      const month = new Date(payment.date).getMonth() + 1;
      monthlyData[month].income += payment.totalAmount || 0;
    });
    
    // Calculate monthly expenses
    expenses.forEach(expense => {
      const month = new Date(expense.date).getMonth() + 1;
      monthlyData[month].expenses += expense.amount || 0;
    });
    
    // Calculate net flow
    Object.keys(monthlyData).forEach(month => {
      monthlyData[month].netFlow = monthlyData[month].income - monthlyData[month].expenses;
    });
    
    // Display monthly breakdown
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    console.log(`Month    Income     Expenses   Net Flow`);
    console.log(`─────    ──────     ────────   ────────`);
    
    monthNames.forEach((monthName, index) => {
      const monthNum = index + 1;
      const data = monthlyData[monthNum];
      const monthStr = monthName.padEnd(8);
      const incomeStr = `$${data.income.toFixed(0)}`.padEnd(11);
      const expenseStr = `$${data.expenses.toFixed(0)}`.padEnd(11);
      const netStr = `$${data.netFlow.toFixed(0)}`;
      
      console.log(`${monthStr}${incomeStr}${expenseStr}${netStr}`);
    });
    
    // ========================================
    // 5. KEY FINANCIAL METRICS
    // ========================================
    console.log('\n📊 KEY FINANCIAL METRICS');
    console.log('=========================');
    
    const avgMonthlyIncome = totalCashIn / 12;
    const avgMonthlyExpenses = totalCashOut / 12;
    const profitMargin = totalCashIn > 0 ? (netIncome / totalCashIn) * 100 : 0;
    const cashFlowRatio = totalCashOut > 0 ? totalCashIn / totalCashOut : 0;
    
    console.log(`💰 Average Monthly Income:    $${avgMonthlyIncome.toFixed(2)}`);
    console.log(`💸 Average Monthly Expenses:  $${avgMonthlyExpenses.toFixed(2)}`);
    console.log(`📈 Profit Margin:             ${profitMargin.toFixed(1)}%`);
    console.log(`💵 Cash Flow Ratio:           ${cashFlowRatio.toFixed(2)}`);
    console.log(`📊 Total Transactions:        ${payments.length + expenses.length}`);
    
    // ========================================
    // 6. RECENT TRANSACTIONS
    // ========================================
    console.log('\n🔄 RECENT TRANSACTIONS (Last 10)');
    console.log('==================================');
    
    const recentPayments = await Payment.find()
      .sort({ date: -1 })
      .limit(5)
      .populate('student residence');
    
    const recentExpenses = await Expense.find()
      .sort({ date: -1 })
      .limit(5)
      .populate('vendor category');
    
    console.log('\n📥 Recent Income:');
    recentPayments.forEach((payment, index) => {
      const date = new Date(payment.date).toLocaleDateString();
      const student = payment.student?.firstName || 'Unknown';
      const amount = payment.totalAmount || 0;
      console.log(`   ${index + 1}. ${date} - ${student} - $${amount.toFixed(2)}`);
    });
    
    console.log('\n📤 Recent Expenses:');
    recentExpenses.forEach((expense, index) => {
      const date = new Date(expense.date).toLocaleDateString();
      const vendor = expense.vendor?.name || 'Unknown';
      const amount = expense.amount || 0;
      console.log(`   ${index + 1}. ${date} - ${vendor} - $${amount.toFixed(2)}`);
    });
    
    console.log('\n✅ Financial Report Generated Successfully!');
    
  } catch (error) {
    console.error('❌ Error generating financial report:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the financial analysis
generateFinancialReport();
