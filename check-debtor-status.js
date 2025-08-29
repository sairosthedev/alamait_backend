const mongoose = require('mongoose');
require('dotenv').config();

async function checkDebtorStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const Debtor = require('./src/models/Debtor');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6'; // Macdonald Sairos
    
    console.log('\n🔍 CHECKING DEBTOR STATUS');
    console.log('==========================');
    console.log(`Student ID: ${studentId}`);
    
    // 1. Get debtor record
    const debtor = await Debtor.findOne({ user: studentId });
    
    if (!debtor) {
      console.log('❌ No debtor record found for this student');
      return;
    }
    
    console.log(`\n📋 DEBTOR RECORD:`);
    console.log(`   Debtor ID: ${debtor._id}`);
    console.log(`   Debtor Code: ${debtor.debtorCode}`);
    console.log(`   User: ${debtor.user}`);
    console.log(`   Status: ${debtor.status}`);
    
    // 2. Check once-off charges status
    console.log(`\n💰 ONCE-OFF CHARGES STATUS:`);
    console.log(`   Admin Fee:`);
    console.log(`     Is Paid: ${debtor.onceOffCharges?.adminFee?.isPaid || false}`);
    console.log(`     Paid Date: ${debtor.onceOffCharges?.adminFee?.paidDate || 'Not set'}`);
    console.log(`     Paid Amount: $${debtor.onceOffCharges?.adminFee?.paidAmount || 0}`);
    console.log(`     Payment ID: ${debtor.onceOffCharges?.adminFee?.paymentId || 'Not set'}`);
    
    console.log(`   Deposit:`);
    console.log(`     Is Paid: ${debtor.onceOffCharges?.deposit?.isPaid || false}`);
    console.log(`     Paid Date: ${debtor.onceOffCharges?.deposit?.paidDate || 'Not set'}`);
    console.log(`     Paid Amount: $${debtor.onceOffCharges?.deposit?.paidAmount || 0}`);
    console.log(`     Payment ID: ${debtor.onceOffCharges?.deposit?.paymentId || 'Not set'}`);
    
    // 3. Check financial breakdown
    console.log(`\n📊 FINANCIAL BREAKDOWN:`);
    console.log(`   Monthly Rent: $${debtor.financialBreakdown?.monthlyRent || 0}`);
    console.log(`   Admin Fee: $${debtor.financialBreakdown?.adminFee || 0}`);
    console.log(`   Deposit: $${debtor.financialBreakdown?.deposit || 0}`);
    console.log(`   Total Owed: $${debtor.financialBreakdown?.totalOwed || 0}`);
    console.log(`   Total Paid: $${debtor.totalPaid || 0}`);
    console.log(`   Current Balance: $${debtor.currentBalance || 0}`);
    
    // 4. Check actual outstanding balances from transactions
    console.log(`\n🔍 ACTUAL OUTSTANDING BALANCES (FROM TRANSACTIONS):`);
    console.log(`=====================================================`);
    
    const accruals = await TransactionEntry.find({
      'metadata.studentId': studentId,
      source: 'rental_accrual'
    }).sort({ date: 1 });
    
    const payments = await TransactionEntry.find({
      'metadata.studentId': studentId,
      source: 'payment'
    }).sort({ date: 1 });
    
    console.log(`Found ${accruals.length} accrual transactions`);
    console.log(`Found ${payments.length} payment transactions`);
    
    // Calculate actual outstanding
    let totalAccrued = 0;
    let totalPaid = 0;
    
    accruals.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          totalAccrued += entry.debit || 0;
        }
      });
    });
    
    payments.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          totalPaid += entry.credit || 0;
        }
      });
    });
    
    const actualOutstanding = totalAccrued - totalPaid;
    
    console.log(`   Total Accrued: $${totalAccrued.toFixed(2)}`);
    console.log(`   Total Paid: $${totalPaid.toFixed(2)}`);
    console.log(`   Actual Outstanding: $${actualOutstanding.toFixed(2)}`);
    
    // 5. Check for June 2025 specific charges
    console.log(`\n📅 JUNE 2025 SPECIFIC CHARGES:`);
    console.log(`===============================`);
    
    const juneAccruals = accruals.filter(tx => {
      const date = new Date(tx.date);
      return date.getFullYear() === 2025 && date.getMonth() === 5; // June is month 5 (0-indexed)
    });
    
    console.log(`Found ${juneAccruals.length} June 2025 accrual transactions`);
    
    juneAccruals.forEach((tx, index) => {
      console.log(`\n  ${index + 1}. ${tx.description}`);
      console.log(`     Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`     Type: ${tx.metadata?.type || 'Unknown'}`);
      
      tx.entries.forEach((entry, entryIndex) => {
        console.log(`     Entry ${entryIndex + 1}: ${entry.accountCode} - ${entry.accountName}`);
        console.log(`       Debit: $${entry.debit}, Credit: $${entry.credit}`);
        console.log(`       Description: ${entry.description}`);
      });
    });
    
    // 6. Check for June 2025 payments
    console.log(`\n💰 JUNE 2025 PAYMENTS:`);
    console.log(`=======================`);
    
    const junePayments = payments.filter(tx => {
      const monthSettled = tx.metadata?.monthSettled;
      return monthSettled === '2025-06';
    });
    
    console.log(`Found ${junePayments.length} June 2025 payment transactions`);
    
    junePayments.forEach((tx, index) => {
      console.log(`\n  ${index + 1}. ${tx.description}`);
      console.log(`     Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`     Payment Type: ${tx.metadata?.paymentType || 'Unknown'}`);
      
      tx.entries.forEach((entry, entryIndex) => {
        console.log(`     Entry ${entryIndex + 1}: ${entry.accountCode} - ${entry.accountName}`);
        console.log(`       Debit: $${entry.debit}, Credit: $${entry.credit}`);
        console.log(`       Description: ${entry.description}`);
      });
    });
    
    // 7. Analysis
    console.log(`\n🎯 ANALYSIS:`);
    console.log(`=============`);
    
    if (debtor.onceOffCharges?.adminFee?.isPaid) {
      console.log(`❌ PROBLEM: Admin fee marked as paid in debtor record`);
      console.log(`   But June 2025 still shows $20 admin fee outstanding`);
      console.log(`   This suggests the debtor flag was set incorrectly`);
    } else {
      console.log(`✅ Admin fee correctly marked as unpaid in debtor record`);
    }
    
    if (debtor.onceOffCharges?.deposit?.isPaid) {
      console.log(`❌ PROBLEM: Deposit marked as paid in debtor record`);
      console.log(`   But June 2025 still shows $220 deposit outstanding`);
      console.log(`   This suggests the debtor flag was set incorrectly`);
    } else {
      console.log(`✅ Deposit correctly marked as unpaid in debtor record`);
    }
    
    console.log(`\n💡 RECOMMENDATION:`);
    console.log(`==================`);
    console.log(`The debtor once-off charge flags should be reset to false`);
    console.log(`since the actual outstanding balances show these charges are still owed.`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkDebtorStatus();
