const mongoose = require('mongoose');
require('dotenv').config();

async function fixJuneAccrualId() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('\n🔧 FIXING JUNE ACCRUAL ID');
    console.log('==========================');
    
    // 1. Find the problematic June transaction
    console.log('\n1️⃣ FINDING JUNE TRANSACTION:');
    const juneTransaction = await TransactionEntry.findById('68af33ebaef6b0dcc8e8f1dc');
    
    if (!juneTransaction) {
      console.log('❌ June transaction not found');
      return;
    }
    
    console.log(`✅ Found June transaction:`);
    console.log(`   ID: ${juneTransaction._id}`);
    console.log(`   Description: ${juneTransaction.description}`);
    console.log(`   Source ID: ${juneTransaction.sourceId}`);
    console.log(`   Reference: ${juneTransaction.reference}`);
    
    // Check the AR account codes
    const arEntries = juneTransaction.entries.filter(entry => entry.accountCode.startsWith('1100-'));
    arEntries.forEach(entry => {
      const studentId = entry.accountCode.replace('1100-', '');
      console.log(`   AR Account Code: ${entry.accountCode} (Student ID: ${studentId})`);
    });
    
    // 2. Check what the correct user ID should be
    console.log('\n2️⃣ FINDING CORRECT USER ID:');
    const cindyTransactions = await TransactionEntry.find({
      'entries.description': { $regex: /cindy/i }
    }).sort({ date: 1 });
    
    // Find the correct user ID from lease start transaction
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
    
    // 3. Check if the June transaction uses the wrong ID
    const currentStudentId = arEntries[0]?.accountCode.replace('1100-', '');
    console.log(`\n3️⃣ COMPARING IDs:`);
    console.log(`   Current ID in June transaction: ${currentStudentId}`);
    console.log(`   Correct user ID: ${correctUserId}`);
    
    if (currentStudentId === correctUserId) {
      console.log('✅ June transaction already uses correct user ID');
      return;
    }
    
    console.log('❌ June transaction uses wrong ID - fixing...');
    
    // 4. Update the June transaction to use correct user ID
    console.log('\n4️⃣ UPDATING JUNE TRANSACTION:');
    
    // Update sourceId and reference
    juneTransaction.sourceId = correctUserId;
    juneTransaction.reference = correctUserId;
    
    // Update metadata
    if (juneTransaction.metadata) {
      juneTransaction.metadata.studentId = correctUserId;
    }
    
    // Update AR account codes in entries
    juneTransaction.entries.forEach(entry => {
      if (entry.accountCode.startsWith('1100-')) {
        const oldCode = entry.accountCode;
        entry.accountCode = `1100-${correctUserId}`;
        entry.accountName = `Accounts Receivable - Cindy Gwekwerere`;
        console.log(`   Updated: ${oldCode} → ${entry.accountCode}`);
      }
    });
    
    await juneTransaction.save();
    console.log('✅ June transaction updated successfully');
    
    // 5. Verify the fix
    console.log('\n5️⃣ VERIFYING FIX:');
    const updatedTransaction = await TransactionEntry.findById('68af33ebaef6b0dcc8e8f1dc');
    
    console.log(`   Source ID: ${updatedTransaction.sourceId}`);
    console.log(`   Reference: ${updatedTransaction.reference}`);
    
    const updatedArEntries = updatedTransaction.entries.filter(entry => entry.accountCode.startsWith('1100-'));
    updatedArEntries.forEach(entry => {
      const studentId = entry.accountCode.replace('1100-', '');
      console.log(`   AR Account Code: ${entry.accountCode} (Student ID: ${studentId})`);
    });
    
    if (updatedTransaction.sourceId === correctUserId) {
      console.log('✅ Fix verified successfully!');
    } else {
      console.log('❌ Fix verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

fixJuneAccrualId();
