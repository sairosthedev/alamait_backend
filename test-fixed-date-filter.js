const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testFixedDateFilter() {
  try {
    console.log('🔍 Testing Fixed Date Filter...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Test the OLD filter (what was causing the issue)
    console.log('\n🔍 OLD FILTER (includes 2024):');
    console.log('date: { $lte: new Date("2025-12-31") }');
    
    const oldFilterResults = await TransactionEntry.find({
      date: { $lte: new Date('2025-12-31') },
      status: 'posted',
      'entries.accountType': 'Liability'
    }).sort({ date: 1 });

    console.log(`Found ${oldFilterResults.length} liability transactions (including 2024)`);
    
    // Check for 2024 transactions
    const transactions2024 = oldFilterResults.filter(tx => tx.date.getFullYear() === 2024);
    console.log(`Transactions from 2024: ${transactions2024.length}`);
    
    if (transactions2024.length > 0) {
      console.log('2024 transactions found:');
      transactions2024.forEach(tx => {
        console.log(`  ${tx.date.toISOString().split('T')[0]} - ${tx.description || 'No description'}`);
      });
    }

    // Test the NEW filter (what should fix the issue)
    console.log('\n🔍 NEW FILTER (2025 only):');
    console.log('date: { $gte: new Date("2025-01-01"), $lte: new Date("2025-12-31") }');
    
    const newFilterResults = await TransactionEntry.find({
      date: { 
        $gte: new Date('2025-01-01'), 
        $lte: new Date('2025-12-31') 
      },
      status: 'posted',
      'entries.accountType': 'Liability'
    }).sort({ date: 1 });

    console.log(`Found ${newFilterResults.length} liability transactions (2025 only)`);
    
    // Check for 2024 transactions
    const transactions2024New = newFilterResults.filter(tx => tx.date.getFullYear() === 2024);
    console.log(`Transactions from 2024: ${transactions2024New.length}`);
    
    if (transactions2024New.length > 0) {
      console.log('❌ 2024 transactions still found with new filter!');
      transactions2024New.forEach(tx => {
        console.log(`  ${tx.date.toISOString().split('T')[0]} - ${tx.description || 'No description'}`);
      });
    } else {
      console.log('✅ No 2024 transactions found with new filter - SUCCESS!');
    }

    // Calculate liability totals with new filter
    console.log('\n🔍 LIABILITY TOTALS WITH NEW FILTER:');
    
    const liabilityAccounts = {};
    
    newFilterResults.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountType === 'Liability') {
          const accountCode = entry.accountCode;
          const accountName = entry.accountName;
          const credit = entry.credit || 0;
          const debit = entry.debit || 0;
          
          if (!liabilityAccounts[accountCode]) {
            liabilityAccounts[accountCode] = {
              code: accountCode,
              name: accountName,
              totalCredit: 0,
              totalDebit: 0,
              balance: 0
            };
          }
          
          liabilityAccounts[accountCode].totalCredit += credit;
          liabilityAccounts[accountCode].totalDebit += debit;
        }
      });
    });

    let totalLiabilities = 0;
    
    Object.values(liabilityAccounts).forEach(account => {
      account.balance = account.totalCredit - account.totalDebit;
      totalLiabilities += account.balance;
      
      console.log(`${account.code} - ${account.name}: $${account.balance.toFixed(2)}`);
    });
    
    console.log(`\nTotal Liabilities (2025 only): $${totalLiabilities.toFixed(2)}`);
    
    // Compare with expected
    const expectedLiabilities = 7397.25;
    const difference = totalLiabilities - expectedLiabilities;
    
    console.log(`Expected Liabilities: $${expectedLiabilities.toFixed(2)}`);
    console.log(`Difference: $${difference.toFixed(2)}`);
    
    if (Math.abs(difference) < 0.01) {
      console.log('✅ SUCCESS: Liabilities now match expected amount!');
    } else {
      console.log(`⚠️  Still have a difference of $${difference.toFixed(2)}`);
    }

  } catch (error) {
    console.error('❌ Error testing fixed date filter:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testFixedDateFilter();
