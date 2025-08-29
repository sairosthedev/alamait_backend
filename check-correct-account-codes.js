const mongoose = require('mongoose');
require('dotenv').config();

async function checkCorrectAccountCodes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68af33e9aef6b0dcc8e8f14b'; // The student from the user's query
    
    console.log('\n🔍 CHECKING ACCOUNT CODE MISMATCH');
    console.log('==================================');
    
    // 1. Check what account codes actually exist for this student
    console.log('\n1️⃣ SEARCHING FOR ALL ACCOUNT CODES:');
    
    // Search for any account codes that might belong to this student
    const allTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-` }
    }).sort({ date: 1 });
    
    console.log(`Found ${allTransactions.length} total transactions with 1100- account codes`);
    
    // Group by account code
    const accountCodes = {};
    allTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          if (!accountCodes[entry.accountCode]) {
            accountCodes[entry.accountCode] = [];
          }
          accountCodes[entry.accountCode].push({
            transactionId: tx._id,
            date: tx.date,
            description: tx.description,
            source: tx.source,
            debit: entry.debit,
            credit: entry.credit,
            entryDescription: entry.description
          });
        }
      });
    });
    
    console.log('\n📊 Account codes found:');
    Object.keys(accountCodes).forEach(accountCode => {
      console.log(`\n  ${accountCode}:`);
      accountCodes[accountCode].forEach(tx => {
        console.log(`    ${tx.date.toLocaleDateString()} - ${tx.description}`);
        console.log(`      ${tx.debit > 0 ? 'Debit' : 'Credit'}: $${tx.debit || tx.credit}`);
        console.log(`      Source: ${tx.source}`);
      });
    });
    
    // 2. Check if there are transactions with the expected account code
    console.log('\n2️⃣ CHECKING EXPECTED ACCOUNT CODE:');
    const expectedAccountCode = `1100-${studentId}`;
    console.log(`Expected account code: ${expectedAccountCode}`);
    
    if (accountCodes[expectedAccountCode]) {
      console.log(`✅ Found transactions with expected account code`);
      accountCodes[expectedAccountCode].forEach(tx => {
        console.log(`  ${tx.date.toLocaleDateString()} - ${tx.description}`);
        console.log(`    ${tx.debit > 0 ? 'Debit' : 'Credit'}: $${tx.debit || tx.credit}`);
      });
    } else {
      console.log(`❌ No transactions found with expected account code`);
    }
    
    // 3. Check if there are transactions with similar account codes
    console.log('\n3️⃣ CHECKING SIMILAR ACCOUNT CODES:');
    const similarAccountCodes = Object.keys(accountCodes).filter(code => 
      code.includes(studentId.substring(0, 8))
    );
    
    if (similarAccountCodes.length > 0) {
      console.log('Similar account codes found:');
      similarAccountCodes.forEach(code => {
        console.log(`  ${code}:`);
        accountCodes[code].forEach(tx => {
          console.log(`    ${tx.date.toLocaleDateString()} - ${tx.description}`);
          console.log(`      ${tx.debit > 0 ? 'Debit' : 'Credit'}: $${tx.debit || tx.credit}`);
        });
      });
    } else {
      console.log('No similar account codes found');
    }
    
    // 4. Calculate what the outstanding balances should be
    console.log('\n4️⃣ CALCULATING CORRECT OUTSTANDING BALANCES:');
    
    // Get all transactions that might belong to this student (including the lease start)
    const studentTransactions = await TransactionEntry.find({
      $or: [
        { 'entries.accountCode': expectedAccountCode },
        { 'entries.accountCode': { $regex: `^1100-${studentId.substring(0, 8)}` } }
      ]
    }).sort({ date: 1 });
    
    console.log(`Found ${studentTransactions.length} potential student transactions`);
    
    // Group by month
    const monthlyBalances = {};
    
    studentTransactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyBalances[monthKey]) {
        monthlyBalances[monthKey] = {
          monthKey,
          year: txDate.getFullYear(),
          month: txDate.getMonth() + 1,
          monthName: txDate.toLocaleString('default', { month: 'long' }),
          date: txDate,
          rent: { owed: 0, paid: 0, outstanding: 0 },
          adminFee: { owed: 0, paid: 0, outstanding: 0 },
          deposit: { owed: 0, paid: 0, outstanding: 0 },
          totalOutstanding: 0,
          transactions: []
        };
      }
      
      monthlyBalances[monthKey].transactions.push({
        id: tx._id,
        date: tx.date,
        description: tx.description,
        source: tx.source
      });
      
      // Process entries
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-') && entry.accountType === 'Asset') {
          const description = entry.description.toLowerCase();
          
          if (description.includes('admin fee') || description.includes('administrative')) {
            if (entry.debit > 0) {
              monthlyBalances[monthKey].adminFee.owed += entry.debit;
            } else if (entry.credit > 0) {
              monthlyBalances[monthKey].adminFee.paid += entry.credit;
            }
          } else if (description.includes('security deposit') || description.includes('deposit')) {
            if (entry.debit > 0) {
              monthlyBalances[monthKey].deposit.owed += entry.debit;
            } else if (entry.credit > 0) {
              monthlyBalances[monthKey].deposit.paid += entry.credit;
            }
          } else {
            // Default to rent
            if (entry.debit > 0) {
              monthlyBalances[monthKey].rent.owed += entry.debit;
            } else if (entry.credit > 0) {
              monthlyBalances[monthKey].rent.paid += entry.credit;
            }
          }
        }
      });
    });
    
    // Calculate outstanding amounts
    Object.values(monthlyBalances).forEach(month => {
      month.rent.outstanding = Math.max(0, month.rent.owed - month.rent.paid);
      month.adminFee.outstanding = Math.max(0, month.adminFee.owed - month.adminFee.paid);
      month.deposit.outstanding = Math.max(0, month.deposit.owed - month.deposit.paid);
      month.totalOutstanding = month.rent.outstanding + month.adminFee.outstanding + month.deposit.outstanding;
    });
    
    // Show results
    console.log('\n📅 CORRECT OUTSTANDING BALANCES:');
    Object.values(monthlyBalances)
      .filter(month => month.totalOutstanding > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(month => {
        console.log(`\n  ${month.monthKey} (${month.monthName}):`);
        console.log(`    Rent: $${month.rent.outstanding.toFixed(2)}`);
        console.log(`    Admin Fee: $${month.adminFee.outstanding.toFixed(2)}`);
        console.log(`    Deposit: $${month.deposit.outstanding.toFixed(2)}`);
        console.log(`    Total Outstanding: $${month.totalOutstanding.toFixed(2)}`);
        console.log(`    Transactions: ${month.transactions.length}`);
      });
    
    const totalOutstanding = Object.values(monthlyBalances)
      .reduce((sum, month) => sum + month.totalOutstanding, 0);
    
    console.log(`\n💰 TOTAL OUTSTANDING: $${totalOutstanding.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkCorrectAccountCodes();
