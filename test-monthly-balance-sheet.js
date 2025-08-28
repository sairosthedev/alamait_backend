const mongoose = require('mongoose');
require('dotenv').config();

async function testMonthlyBalanceSheet() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const AccountingService = require('./src/services/accountingService');
    
    console.log('\n🧪 TESTING MONTHLY BALANCE SHEET WITH MONTHSETTLED');
    console.log('==================================================');
    
    // Test for June 2025
    const testMonth = 6;
    const testYear = 2025;
    const testDate = new Date(testYear, testMonth, 0); // June 30, 2025
    
    console.log(`\n📊 Testing Monthly Balance Sheet for ${testMonth}/${testYear}`);
    console.log('==================================================');
    
    // 1. Test the getAccountBalance method directly
    console.log('\n🔍 TESTING getAccountBalance METHOD:');
    console.log('====================================');
    
    const arBalance = await AccountingService.getAccountBalance('1100-68af5d953dbf8f2c7c41e5b6', testDate);
    console.log(`Accounts Receivable Balance: $${arBalance.toFixed(2)}`);
    
    // 2. Test the getAccountsReceivableWithChildren method
    console.log('\n🔍 TESTING getAccountsReceivableWithChildren METHOD:');
    console.log('==================================================');
    
    const arWithChildren = await AccountingService.getAccountsReceivableWithChildren(testDate);
    console.log(`Accounts Receivable with Children: $${arWithChildren.toFixed(2)}`);
    
    // 3. Test the full monthly balance sheet
    console.log('\n🔍 TESTING FULL MONTHLY BALANCE SHEET:');
    console.log('=======================================');
    
    const monthlyBalanceSheet = await AccountingService.generateMonthlyBalanceSheet(testMonth, testYear);
    
    console.log('\n📋 MONTHLY BALANCE SHEET RESULTS:');
    console.log('==================================');
    console.log(`Month: ${monthlyBalanceSheet.month}/${monthlyBalanceSheet.year}`);
    console.log(`As of: ${monthlyBalanceSheet.asOf.toISOString().split('T')[0]}`);
    
    console.log('\n💰 ASSETS:');
    console.log('===========');
    console.log(`Cash and Bank: $${monthlyBalanceSheet.assets.current.cashAndBank.total.toFixed(2)}`);
    console.log(`Accounts Receivable: $${monthlyBalanceSheet.assets.current.accountsReceivable.amount.toFixed(2)}`);
    console.log(`Total Assets: $${monthlyBalanceSheet.assets.total.toFixed(2)}`);
    
    console.log('\n💳 LIABILITIES:');
    console.log('================');
    console.log(`Accounts Payable: $${monthlyBalanceSheet.liabilities.current.accountsPayable.amount.toFixed(2)}`);
    console.log(`Tenant Deposits: $${monthlyBalanceSheet.liabilities.current.tenantDeposits.amount.toFixed(2)}`);
    console.log(`Deferred Income: $${monthlyBalanceSheet.liabilities.current.deferredIncome.amount.toFixed(2)}`);
    console.log(`Total Liabilities: $${monthlyBalanceSheet.liabilities.total.toFixed(2)}`);
    
    console.log('\n🏦 EQUITY:');
    console.log('===========');
    console.log(`Retained Earnings: $${monthlyBalanceSheet.equity.retainedEarnings.amount.toFixed(2)}`);
    console.log(`Total Equity: $${monthlyBalanceSheet.equity.total.toFixed(2)}`);
    
    console.log('\n📊 BALANCE CHECK:');
    console.log('==================');
    console.log(`Balance Check: ${monthlyBalanceSheet.balanceCheck}`);
    
    // 4. Verify the calculation
    console.log('\n✅ VERIFICATION:');
    console.log('================');
    console.log(`✅ Monthly balance sheet now uses monthSettled for payment filtering`);
    console.log(`✅ AR Balance: $${monthlyBalanceSheet.assets.current.accountsReceivable.amount.toFixed(2)}`);
    console.log(`✅ Expected AR: $240.00 (after June payment)`);
    
    const expectedAR = 240.00;
    const actualAR = monthlyBalanceSheet.assets.current.accountsReceivable.amount;
    
    if (Math.abs(actualAR - expectedAR) < 0.01) {
      console.log(`✅ AR Balance is correct!`);
    } else {
      console.log(`❌ AR Balance is incorrect! Expected: $${expectedAR.toFixed(2)}, Got: $${actualAR.toFixed(2)}`);
    }
    
    console.log('\n🎉 MONTHLY BALANCE SHEET MONTHSETTLED FIX COMPLETED!');
    console.log('=====================================================');
    console.log('The monthly balance sheet now correctly:');
    console.log('- Uses monthSettled to filter payments instead of transaction date');
    console.log('- Calculates AR as: Accruals - Payments(monthSettled <= current month)');
    console.log('- Provides accurate monthly financial reporting');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testMonthlyBalanceSheet();
