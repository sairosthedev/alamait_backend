const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function investigateLiabilityDifference() {
  try {
    console.log('🔍 Investigating the $500 Liability Difference...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Get all liability-related transactions
    const liabilityTransactions = await TransactionEntry.find({
      date: { $lte: new Date('2025-12-31') },
      status: 'posted',
      'entries.accountType': 'Liability'
    }).sort({ date: 1 });

    console.log(`📊 Found ${liabilityTransactions.length} liability transactions`);

    // Track each liability account separately
    const liabilityAccounts = {};
    
    liabilityTransactions.forEach((tx, index) => {
      console.log(`\n🔍 Transaction ${index + 1} - ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Description: ${tx.description || 'No description'}`);
      console.log(`   Source: ${tx.source || 'No source'}`);
      
      tx.entries.forEach((entry, entryIndex) => {
        if (entry.accountType === 'Liability') {
          const accountCode = entry.accountCode;
          const accountName = entry.accountName;
          const credit = entry.credit || 0;
          const debit = entry.debit || 0;
          
          if (!liabilityAccounts[accountCode]) {
            liabilityAccounts[accountCode] = {
              code: accountCode,
              name: accountName,
              transactions: [],
              totalCredit: 0,
              totalDebit: 0,
              balance: 0
            };
          }
          
          liabilityAccounts[accountCode].transactions.push({
            date: tx.date,
            description: tx.description,
            source: tx.source,
            credit,
            debit,
            transactionId: tx._id
          });
          
          liabilityAccounts[accountCode].totalCredit += credit;
          liabilityAccounts[accountCode].totalDebit += debit;
          
          console.log(`   Entry ${entryIndex + 1}: ${accountCode} - ${accountName}`);
          console.log(`     Credit: $${credit}, Debit: $${debit}`);
        }
      });
    });

    // Calculate balances and show breakdown
    console.log('\n🔍 LIABILITY ACCOUNT BREAKDOWN');
    console.log('=====================================');
    
    let totalLiabilities = 0;
    
    Object.values(liabilityAccounts).forEach(account => {
      account.balance = account.totalCredit - account.totalDebit;
      totalLiabilities += account.balance;
      
      console.log(`\n📊 ${account.code} - ${account.name}`);
      console.log(`   Total Credit: $${account.totalCredit.toFixed(2)}`);
      console.log(`   Total Debit: $${account.totalDebit.toFixed(2)}`);
      console.log(`   Balance: $${account.balance.toFixed(2)}`);
      
      console.log(`   Transactions:`);
      account.transactions.forEach((tx, idx) => {
        console.log(`     ${idx + 1}. ${tx.date.toISOString().split('T')[0]} - ${tx.description || 'No description'} (${tx.source})`);
        console.log(`        Credit: $${tx.credit}, Debit: $${tx.debit}`);
      });
    });

    console.log('\n🔍 SUMMARY');
    console.log('=====================================');
    console.log(`Total Liabilities: $${totalLiabilities.toFixed(2)}`);
    
    // Compare with expected
    const expectedLiabilities = 7397.25;
    const actualLiabilities = totalLiabilities;
    const difference = actualLiabilities - expectedLiabilities;
    
    console.log(`Expected Liabilities: $${expectedLiabilities.toFixed(2)}`);
    console.log(`Actual Liabilities: $${actualLiabilities.toFixed(2)}`);
    console.log(`Difference: $${difference.toFixed(2)}`);
    
    if (Math.abs(difference) > 0.01) {
      console.log(`\n⚠️  FOUND THE DIFFERENCE: $${difference.toFixed(2)}`);
      console.log(`This explains why your balance sheet shows $${difference.toFixed(2)} more in liabilities than expected.`);
      
      // Look for the specific $500 difference
      console.log(`\n🔍 Looking for transactions that might explain the $${difference.toFixed(2)} difference...`);
      
      Object.values(liabilityAccounts).forEach(account => {
        account.transactions.forEach(tx => {
          if (Math.abs(tx.credit - tx.debit) === difference || 
              Math.abs(tx.credit) === difference || 
              Math.abs(tx.debit) === difference) {
            console.log(`\n🎯 POTENTIAL MATCH: Transaction on ${tx.date.toISOString().split('T')[0]}`);
            console.log(`   Description: ${tx.description || 'No description'}`);
            console.log(`   Source: ${tx.source || 'No source'}`);
            console.log(`   Credit: $${tx.credit}, Debit: $${tx.debit}`);
            console.log(`   Account: ${account.code} - ${account.name}`);
          }
        });
      });
    }

  } catch (error) {
    console.error('❌ Error investigating liability difference:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

investigateLiabilityDifference();
