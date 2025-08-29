const mongoose = require('mongoose');
require('dotenv').config();

async function debugOutstandingBalances() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6';
    
    console.log(`\n🔍 DEBUGGING OUTSTANDING BALANCES FOR STUDENT: ${studentId}`);
    console.log('================================================');
    
    // Test the exact query from getDetailedOutstandingBalances
    const studentIdString = String(studentId);
    console.log(`Student ID String: ${studentIdString}`);
    
    const allStudentTransactions = await TransactionEntry.find({
      $or: [
        { 'entries.accountCode': { $regex: `^1100-${studentIdString}` } },
        { 'entries.accountCode': { $regex: `^1100-${studentIdString.substring(0, 8)}` } }
      ]
    }).sort({ date: 1 });
    
    console.log(`\n📊 Found ${allStudentTransactions.length} transactions with AR account codes:`);
    
    allStudentTransactions.forEach((transaction, index) => {
      console.log(`\n${index + 1}. Transaction ID: ${transaction._id}`);
      console.log(`   Date: ${transaction.date.toISOString().split('T')[0]}`);
      console.log(`   Source: ${transaction.source}`);
      console.log(`   Description: ${transaction.description}`);
      
      // Check entries
      transaction.entries.forEach((entry, entryIndex) => {
        if (entry.accountCode.startsWith('1100-')) {
          console.log(`   Entry ${entryIndex + 1}: ${entry.accountCode}`);
          console.log(`     Debit: $${entry.debit}, Credit: $${entry.credit}`);
          console.log(`     Account Type: ${entry.accountType}`);
          console.log(`     Description: ${entry.description}`);
        }
      });
    });
    
    // Test the accrual filter
    const accruals = allStudentTransactions.filter(tx => 
      tx.source === 'rental_accrual' || 
      (tx.source === 'lease_start' && tx.metadata?.proratedRent > 0) ||
      (tx.metadata?.type === 'lease_start' && tx.metadata?.proratedRent > 0)
    );
    
    console.log(`\n📊 Found ${accruals.length} accrual transactions:`);
    
    accruals.forEach((accrual, index) => {
      console.log(`\n${index + 1}. Accrual Transaction: ${accrual._id}`);
      console.log(`   Date: ${accrual.date.toISOString().split('T')[0]}`);
      console.log(`   Source: ${accrual.source}`);
      console.log(`   Type: ${accrual.metadata?.type || 'N/A'}`);
      console.log(`   Prorated Rent: ${accrual.metadata?.proratedRent || 'N/A'}`);
      
      // Check AR entries
      accrual.entries.forEach((entry, entryIndex) => {
        if (entry.accountCode.startsWith('1100-') && entry.accountType === 'Asset' && entry.debit > 0) {
          console.log(`   AR Entry ${entryIndex + 1}: ${entry.accountCode}`);
          console.log(`     Debit: $${entry.debit}, Credit: $${entry.credit}`);
          console.log(`     Description: ${entry.description}`);
        }
      });
    });
    
    // Test the outstanding balances calculation
    console.log(`\n💰 TESTING OUTSTANDING BALANCES CALCULATION:`);
    console.log('============================================');
    
    const monthlyOutstanding = {};
    
    // Process accruals to build debt structure
    accruals.forEach(accrual => {
      const accrualDate = new Date(accrual.date);
      const monthKey = `${accrualDate.getFullYear()}-${String(accrualDate.getMonth() + 1).padStart(2, '0')}`;
      
      console.log(`\n📅 Processing accrual for month: ${monthKey}`);
      
      if (!monthlyOutstanding[monthKey]) {
        monthlyOutstanding[monthKey] = {
          monthKey,
          year: accrualDate.getFullYear(),
          month: accrualDate.getMonth() + 1,
          monthName: accrualDate.toLocaleString('default', { month: 'long' }),
          date: accrualDate,
          rent: { owed: 0, paid: 0, outstanding: 0 },
          adminFee: { owed: 0, paid: 0, outstanding: 0 },
          deposit: { owed: 0, paid: 0, outstanding: 0 },
          totalOutstanding: 0,
          transactionId: accrual._id,
          source: accrual.source,
          metadata: accrual.metadata
        };
      }
      
      // Categorize the debt by type
      accrual.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-') && entry.accountType === 'Asset' && entry.debit > 0) {
          const description = entry.description.toLowerCase();
          console.log(`   Processing entry: ${entry.description}`);
          console.log(`   Amount: $${entry.debit}`);
          
          if (description.includes('admin fee') || description.includes('administrative')) {
            monthlyOutstanding[monthKey].adminFee.owed += entry.debit;
            console.log(`   → Categorized as Admin Fee`);
          } else if (description.includes('security deposit') || description.includes('deposit')) {
            monthlyOutstanding[monthKey].deposit.owed += entry.debit;
            console.log(`   → Categorized as Deposit`);
          } else {
            monthlyOutstanding[monthKey].rent.owed += entry.debit;
            console.log(`   → Categorized as Rent`);
          }
        }
      });
    });
    
    console.log(`\n📊 Monthly Outstanding Summary:`);
    Object.entries(monthlyOutstanding).forEach(([monthKey, month]) => {
      console.log(`\n${monthKey} (${month.monthName}):`);
      console.log(`  Rent Owed: $${month.rent.owed.toFixed(2)}`);
      console.log(`  Admin Fee Owed: $${month.adminFee.owed.toFixed(2)}`);
      console.log(`  Deposit Owed: $${month.deposit.owed.toFixed(2)}`);
      console.log(`  Total Owed: $${(month.rent.owed + month.adminFee.owed + month.deposit.owed).toFixed(2)}`);
    });
    
    // Test the actual service method
    console.log(`\n🧪 TESTING ACTUAL SERVICE METHOD:`);
    console.log('==================================');
    
    try {
      const outstandingBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);
      console.log(`\n✅ Service method returned ${outstandingBalances.length} outstanding balances:`);
      
      outstandingBalances.forEach((balance, index) => {
        console.log(`\n${index + 1}. ${balance.monthKey} (${balance.monthName}):`);
        console.log(`   Rent Outstanding: $${balance.rent.outstanding.toFixed(2)}`);
        console.log(`   Admin Fee Outstanding: $${balance.adminFee.outstanding.toFixed(2)}`);
        console.log(`   Deposit Outstanding: $${balance.deposit.outstanding.toFixed(2)}`);
        console.log(`   Total Outstanding: $${balance.totalOutstanding.toFixed(2)}`);
      });
    } catch (error) {
      console.error(`❌ Service method error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

debugOutstandingBalances();
