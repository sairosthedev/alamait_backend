const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugLiabilityBalances() {
  try {
    console.log('🔍 Debugging Liability Balances...');
    
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('✅ Connected to MongoDB Atlas');
    
    // Test with August 31, 2025
    const testDate = new Date('2025-08-31');
    
    console.log(`📊 Generating Balance Sheet for ${testDate.toDateString()}`);
    
    const balanceSheet = await BalanceSheetService.generateBalanceSheet(testDate);
    
    console.log('\n🔍 LIABILITY ACCOUNT DETAILS:');
    console.log('=====================================');
    
    // Check current liabilities
    console.log('\n📋 Current Liabilities:');
    Object.entries(balanceSheet.liabilities.current).forEach(([code, liability]) => {
      console.log(`  ${code}: ${liability.name}`);
      console.log(`    Balance: $${liability.balance}`);
      console.log(`    Category: ${liability.category}`);
      console.log(`    Description: ${liability.description}`);
      console.log('');
    });
    
    // Check non-current liabilities
    console.log('\n📋 Non-Current Liabilities:');
    Object.entries(balanceSheet.liabilities.nonCurrent).forEach(([code, liability]) => {
      console.log(`  ${code}: ${liability.name}`);
      console.log(`    Balance: $${liability.balance}`);
      console.log(`    Category: ${liability.category}`);
      console.log(`    Description: ${liability.description}`);
      console.log('');
    });
    
    console.log('\n💰 LIABILITY TOTALS:');
    console.log(`  Total Current: $${balanceSheet.liabilities.totalCurrent}`);
    console.log(`  Total Non-Current: $${balanceSheet.liabilities.totalNonCurrent}`);
    console.log(`  Total Liabilities: $${balanceSheet.liabilities.totalLiabilities}`);
    
    console.log('\n🔍 ACCOUNT BALANCES FROM TRANSACTIONS:');
    console.log('=====================================');
    
    // Get the raw transaction data for liability accounts
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const liabilityEntries = await TransactionEntry.find({
      'entries.accountType': 'Liability',
      date: { $lte: testDate }
    }).sort({ date: 1 });
    
    console.log(`\n📊 Found ${liabilityEntries.length} liability transactions`);
    
    const accountBalances = {};
    
    liabilityEntries.forEach(entry => {
      entry.entries.forEach(lineItem => {
        if (lineItem.accountType === 'Liability') {
          const code = lineItem.accountCode;
          const name = lineItem.accountName;
          const debit = lineItem.debit || 0;
          const credit = lineItem.credit || 0;
          
          if (!accountBalances[code]) {
            accountBalances[code] = {
              name: name,
              debitTotal: 0,
              creditTotal: 0,
              balance: 0
            };
          }
          
          accountBalances[code].debitTotal += debit;
          accountBalances[code].creditTotal += credit;
        }
      });
    });
    
    // Calculate balances
    Object.entries(accountBalances).forEach(([code, account]) => {
      // Liability balance = Credit - Debit
      account.balance = account.creditTotal - account.debitTotal;
      
      console.log(`\n📋 Account ${code}: ${account.name}`);
      console.log(`  Debit Total: $${account.debitTotal}`);
      console.log(`  Credit Total: $${account.creditTotal}`);
      console.log(`  Balance (Credit - Debit): $${account.balance}`);
      console.log(`  Should be positive: ${account.balance > 0 ? '✅ YES' : '❌ NO'}`);
    });
    
  } catch (error) {
    console.error('❌ Error debugging liability balances:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

debugLiabilityBalances();
