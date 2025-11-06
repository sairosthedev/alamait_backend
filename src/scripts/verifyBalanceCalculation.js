const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function verifyBalanceCalculation() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('✅ Connected to database');
    
    const FinancialReportingService = require('../services/financialReportingService');
    
    console.log('\n🔍 VERIFYING BALANCE CALCULATION');
    console.log('=' .repeat(60));
    
    // Test the balance sheet service
    const balanceSheet = await FinancialReportingService.generateBalanceSheet('2025-10-31', 'cash');
    
    console.log('\n📊 BALANCE SHEET RESULTS:');
    console.log(`   Total Assets: $${balanceSheet.assets?.total_assets || 0}`);
    console.log(`   Total Liabilities: $${balanceSheet.liabilities?.total_liabilities || 0}`);
    console.log(`   Total Equity: $${balanceSheet.equity?.total_equity || 0}`);
    
    // Check Cash account specifically
    const cashAccount = Object.values(balanceSheet.assets || {}).find(acc => acc.code === '1000');
    if (cashAccount) {
      console.log('\n💰 CASH ACCOUNT DETAILS:');
      console.log(`   Code: ${cashAccount.code}`);
      console.log(`   Name: ${cashAccount.name}`);
      console.log(`   Balance: $${cashAccount.balance}`);
      console.log(`   Debit Total: $${cashAccount.debit_total}`);
      console.log(`   Credit Total: $${cashAccount.credit_total}`);
      console.log(`   Net Calculation: $${cashAccount.debit_total} - $${cashAccount.credit_total} = $${cashAccount.debit_total - cashAccount.credit_total}`);
      
      if (cashAccount.balance === 100) {
        console.log('✅ Cash balance is CORRECT: $100');
      } else {
        console.log(`❌ Cash balance is INCORRECT: $${cashAccount.balance} (should be $100)`);
      }
    } else {
      console.log('❌ Cash account not found');
    }
    
    // Check Bank Account
    const bankAccount = Object.values(balanceSheet.assets || {}).find(acc => acc.code === '1001');
    if (bankAccount) {
      console.log('\n🏦 BANK ACCOUNT DETAILS:');
      console.log(`   Code: ${bankAccount.code}`);
      console.log(`   Name: ${bankAccount.name}`);
      console.log(`   Balance: $${bankAccount.balance}`);
      console.log(`   Debit Total: $${bankAccount.debit_total}`);
      console.log(`   Credit Total: $${bankAccount.credit_total}`);
    }
    
    // Check CBZ Vault
    const cbzVault = Object.values(balanceSheet.assets || {}).find(acc => acc.code === '10003');
    if (cbzVault) {
      console.log('\n🏛️ CBZ VAULT DETAILS:');
      console.log(`   Code: ${cbzVault.code}`);
      console.log(`   Name: ${cbzVault.name}`);
      console.log(`   Balance: $${cbzVault.balance}`);
      console.log(`   Debit Total: $${cbzVault.debit_total}`);
      console.log(`   Credit Total: $${cbzVault.credit_total}`);
    }
    
    // Check Owner Capital
    const ownerCapital = Object.values(balanceSheet.equity || {}).find(acc => acc.code === '3001');
    if (ownerCapital) {
      console.log('\n👤 OWNER CAPITAL DETAILS:');
      console.log(`   Code: ${ownerCapital.code}`);
      console.log(`   Name: ${ownerCapital.name}`);
      console.log(`   Balance: $${ownerCapital.balance}`);
      console.log(`   Debit Total: $${ownerCapital.debit_total}`);
      console.log(`   Credit Total: $${ownerCapital.credit_total}`);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

verifyBalanceCalculation();




