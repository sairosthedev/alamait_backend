const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import the fixed BalanceSheetService
const BalanceSheetService = require('../src/services/balanceSheetService');

/**
 * TEST FIXED BALANCE SHEET SERVICE
 * 
 * This script will test if the fixed BalanceSheetService now properly
 * includes Deferred Income account 2030
 */

async function testFixedBalanceSheet() {
  try {
    console.log('\n🧪 TESTING FIXED BALANCE SHEET SERVICE');
    console.log('========================================\n');
    
    // ========================================
    // STEP 1: TEST MONTHLY BALANCE SHEET
    // ========================================
    console.log('📋 STEP 1: TESTING MONTHLY BALANCE SHEET');
    console.log('=========================================\n');
    
    console.log('🔍 Testing generateMonthlyBalanceSheet(2025)...');
    const monthlyBalanceSheet = await BalanceSheetService.generateMonthlyBalanceSheet(2025);
    
    if (monthlyBalanceSheet && monthlyBalanceSheet.success) {
      console.log('✅ Monthly Balance Sheet generated successfully!');
      
      // Check August specifically (where we have Deferred Income transactions)
      const august = monthlyBalanceSheet.data.monthly[8];
      if (august) {
        console.log('\n📅 AUGUST 2025 BALANCE SHEET:');
        console.log('─'.repeat(50));
        
        console.log('💰 ASSETS:');
        console.log(`   Total Assets: $${august.assets.total.toFixed(2)}`);
        
        if (august.assets.current.cashAndBank) {
          console.log('   Cash & Bank:');
          Object.entries(august.assets.current.cashAndBank).forEach(([code, account]) => {
            if (code !== 'total') {
              console.log(`     ${code}: ${account.accountName} - $${account.amount.toFixed(2)}`);
            }
          });
          console.log(`     Total Cash: $${august.assets.current.cashAndBank.total.toFixed(2)}`);
        }
        
        if (august.assets.current.accountsReceivable) {
          console.log('   Accounts Receivable:');
          Object.entries(august.assets.current.accountsReceivable).forEach(([code, account]) => {
            if (code !== 'total') {
              console.log(`     ${code}: ${account.accountName} - $${account.amount.toFixed(2)}`);
            }
          });
        }
        
        console.log('\n💳 LIABILITIES:');
        console.log(`   Total Liabilities: $${august.liabilities.total.toFixed(2)}`);
        
        if (august.liabilities.current.accountsPayable) {
          console.log('   Accounts Payable:');
          Object.entries(august.liabilities.current.accountsPayable).forEach(([code, account]) => {
            if (code !== 'total') {
              console.log(`     ${code}: ${account.accountName} - $${account.amount.toFixed(2)}`);
            }
          });
        }
        
        if (august.liabilities.current.tenantDeposits) {
          console.log('   Tenant Deposits:');
          Object.entries(august.liabilities.current.tenantDeposits).forEach(([code, account]) => {
            if (code !== 'total') {
              console.log(`     ${code}: ${account.accountName} - $${account.amount.toFixed(2)}`);
            }
          });
        }
        
        // Check for Deferred Income specifically
        if (august.liabilities.current.deferredIncome) {
          console.log('   Deferred Income:');
          Object.entries(august.liabilities.current.deferredIncome).forEach(([code, account]) => {
            if (code !== 'total') {
              console.log(`     ${code}: ${account.accountName} - $${account.amount.toFixed(2)}`);
            }
          });
        } else {
          console.log('   ❌ Deferred Income section missing!');
        }
        
        console.log('\n🏛️  EQUITY:');
        console.log(`   Total Equity: $${august.equity.total.toFixed(2)}`);
        console.log(`   Capital: $${august.equity.capital.amount.toFixed(2)}`);
        console.log(`   Retained Earnings: $${august.equity.retainedEarnings.amount.toFixed(2)}`);
        
        console.log('\n📊 SUMMARY:');
        console.log(`   Assets: $${august.summary.totalAssets.toFixed(2)}`);
        console.log(`   Liabilities: $${august.summary.totalLiabilities.toFixed(2)}`);
        console.log(`   Equity: $${august.summary.totalEquity.toFixed(2)}`);
        
        // Check accounting equation
        const balanceCheck = august.summary.totalAssets - august.summary.totalLiabilities - august.summary.totalEquity;
        console.log(`   Balance Check: $${balanceCheck.toFixed(2)} (should be 0)`);
        
        if (Math.abs(balanceCheck) > 0.01) {
          console.log(`   ⚠️  BALANCE SHEET IS OFF BY $${Math.abs(balanceCheck).toFixed(2)}`);
        } else {
          console.log(`   ✅ BALANCE SHEET IS BALANCED!`);
        }
        
      } else {
        console.log('❌ August data not found in monthly balance sheet');
      }
      
    } else {
      console.log('❌ Monthly Balance Sheet generation failed');
      console.log('Error:', monthlyBalanceSheet?.message || 'Unknown error');
    }
    
    // ========================================
    // STEP 2: VERIFY DEFERRED INCOME ACCOUNT
    // ========================================
    console.log('\n\n📋 STEP 2: VERIFYING DEFERRED INCOME ACCOUNT');
    console.log('==============================================\n');
    
    // Check if account 2030 exists in the balance sheet
    let deferredIncomeFound = false;
    let deferredIncomeAmount = 0;
    
    if (monthlyBalanceSheet && monthlyBalanceSheet.success) {
      // Check all months for Deferred Income
      Object.values(monthlyBalanceSheet.data.monthly).forEach(monthData => {
        if (monthData.liabilities && monthData.liabilities.current && monthData.liabilities.current.deferredIncome) {
          Object.entries(monthData.liabilities.current.deferredIncome).forEach(([code, account]) => {
            if (code === '2030') {
              deferredIncomeFound = true;
              deferredIncomeAmount = account.amount;
              console.log(`✅ Found Deferred Income in ${monthData.monthName}:`);
              console.log(`   Account: ${code} - ${account.accountName}`);
              console.log(`   Amount: $${account.amount.toFixed(2)}`);
            }
          });
        }
      });
      
      if (!deferredIncomeFound) {
        console.log('❌ Deferred Income account 2030 NOT found in any month!');
        console.log('   This means the fix did not work properly.');
      }
    }
    
    // ========================================
    // STEP 3: SUMMARY
    // ========================================
    console.log('\n\n📋 STEP 3: SUMMARY');
    console.log('===================\n');
    
    if (deferredIncomeFound) {
      console.log('🎯 FIX SUCCESSFUL!');
      console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
      console.log('│                                                                                             │');
      console.log('│  ✅ WHAT WAS FIXED:                                                                          │');
      console.log('│     • BalanceSheetService now includes Deferred Income account 2030                        │');
      console.log('│     • Deferred Income is properly categorized as a liability                               │');
      console.log('│     • Monthly balance sheet shows correct Deferred Income amounts                          │');
      console.log('│                                                                                             │');
      console.log('│  💡 RESULT:                                                                                 │');
      console.log('│     • Your frontend should now show Deferred Income: $${deferredIncomeAmount.toFixed(2)}    │');
      console.log('│     • Balance sheet should be properly balanced                                            │');
      console.log('│     • Assets should show correct cash and receivable amounts                               │');
      console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    } else {
      console.log('❌ FIX FAILED!');
      console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
      console.log('│                                                                                             │');
      console.log('│  ❌ WHAT WENT WRONG:                                                                        │');
      console.log('│     • Deferred Income account 2030 still not showing in balance sheet                     │');
      console.log('│     • Balance sheet service needs further investigation                                     │');
      console.log('│     • Frontend will continue to show incorrect data                                        │');
      console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    }
    
  } catch (error) {
    console.error('❌ Error testing fixed balance sheet:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testFixedBalanceSheet();
