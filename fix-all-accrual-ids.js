const mongoose = require('mongoose');
require('dotenv').config();

async function fixAllAccrualIds() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('\n🔧 FIXING ALL ACCRUAL IDS');
    console.log('==========================');
    
    // 1. Find all Cindy transactions
    console.log('\n1️⃣ FINDING ALL CINDY TRANSACTIONS:');
    const cindyTransactions = await TransactionEntry.find({
      'entries.description': { $regex: /cindy/i }
    }).sort({ date: 1 });
    
    console.log(`Found ${cindyTransactions.length} Cindy transactions`);
    
    // 2. Find the correct user ID from lease start
    let correctUserId = null;
    for (const tx of cindyTransactions) {
      if (tx.description.includes('Lease start')) {
        const arEntries = tx.entries.filter(entry => entry.accountCode.startsWith('1100-'));
        if (arEntries.length > 0) {
          correctUserId = arEntries[0].accountCode.replace('1100-', '');
          console.log(`✅ Correct user ID from lease start: ${correctUserId}`);
          break;
        }
      }
    }
    
    if (!correctUserId) {
      console.log('❌ Could not find correct user ID');
      return;
    }
    
    // 3. Check each transaction and fix if needed
    console.log('\n2️⃣ CHECKING AND FIXING TRANSACTIONS:');
    let fixedCount = 0;
    
    for (const tx of cindyTransactions) {
      const arEntries = tx.entries.filter(entry => entry.accountCode.startsWith('1100-'));
      if (arEntries.length === 0) continue;
      
      const currentStudentId = arEntries[0].accountCode.replace('1100-', '');
      
      if (currentStudentId !== correctUserId) {
        console.log(`\n🔧 Fixing transaction: ${tx.description}`);
        console.log(`   Current ID: ${currentStudentId} → Correct ID: ${correctUserId}`);
        
        // Update sourceId and reference
        tx.sourceId = correctUserId;
        tx.reference = correctUserId;
        
        // Update metadata
        if (tx.metadata) {
          tx.metadata.studentId = correctUserId;
        }
        
        // Update AR account codes in entries
        tx.entries.forEach(entry => {
          if (entry.accountCode.startsWith('1100-')) {
            const oldCode = entry.accountCode;
            entry.accountCode = `1100-${correctUserId}`;
            entry.accountName = `Accounts Receivable - Cindy Gwekwerere`;
            console.log(`   Updated: ${oldCode} → ${entry.accountCode}`);
          }
        });
        
        await tx.save();
        console.log(`   ✅ Fixed successfully`);
        fixedCount++;
      } else {
        console.log(`✅ ${tx.description} - Already correct`);
      }
    }
    
    console.log(`\n3️⃣ SUMMARY:`);
    console.log(`   Total transactions checked: ${cindyTransactions.length}`);
    console.log(`   Transactions fixed: ${fixedCount}`);
    
    if (fixedCount > 0) {
      console.log(`✅ All transactions now use correct user ID: ${correctUserId}`);
    } else {
      console.log(`✅ All transactions already use correct user ID`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

fixAllAccrualIds();
