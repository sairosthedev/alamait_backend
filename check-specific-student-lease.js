const mongoose = require('mongoose');
require('dotenv').config();

async function checkSpecificStudentLease() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const Application = require('./src/models/Application');
    
    const studentId = '68af33e9aef6b0dcc8e8f14b'; // The student from the user's query
    
    console.log('\n🔍 CHECKING SPECIFIC STUDENT LEASE INFORMATION');
    console.log('===============================================');
    
    // 1. Check application details
    console.log('\n1️⃣ APPLICATION DETAILS:');
    const application = await Application.findOne({ student: studentId });
    if (application) {
      console.log(`Student Name: ${application.firstName} ${application.lastName}`);
      console.log(`Email: ${application.email}`);
      console.log(`Status: ${application.status}`);
      console.log(`Start Date: ${application.startDate}`);
      console.log(`End Date: ${application.endDate}`);
      console.log(`Residence: ${application.residence}`);
      console.log(`Allocated Room: ${application.allocatedRoom}`);
      
      const startDate = new Date(application.startDate);
      const endDate = new Date(application.endDate);
      
      console.log(`\n📅 LEASE TIMELINE:`);
      console.log(`Lease starts: ${startDate.toLocaleDateString()} (Month ${startDate.getMonth() + 1}, Year ${startDate.getFullYear()})`);
      console.log(`Lease ends: ${endDate.toLocaleDateString()} (Month ${endDate.getMonth() + 1}, Year ${endDate.getFullYear()})`);
      
      // Check lease start month
      const startMonth = startDate.getMonth() + 1; // Convert to 1-indexed
      const startYear = startDate.getFullYear();
      const startMonthKey = `${startYear}-${String(startMonth).padStart(2, '0')}`;
      
      console.log(`\n🏠 LEASE START ANALYSIS:`);
      console.log(`Lease start month key: ${startMonthKey}`);
      
      if (startMonth === 5) { // May
        console.log(`✅ Lease started in MAY 2025`);
        console.log(`❓ This means May 2025 should have prorated rent!`);
      } else if (startMonth === 6) { // June
        console.log(`✅ Lease started in JUNE 2025`);
        console.log(`✅ This means May 2025 has no rent due (correct)`);
      } else {
        console.log(`⚠️ Lease started in month ${startMonth} (unexpected)`);
      }
      
    } else {
      console.log('❌ No application found for this student');
      return;
    }
    
    // 2. Check all accrual transactions for this student
    console.log('\n2️⃣ ACCRUAL TRANSACTIONS:');
    const accrualTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId}` },
      source: { $in: ['rental_accrual', 'lease_start'] }
    }).sort({ date: 1 });
    
    console.log(`Found ${accrualTransactions.length} accrual transactions`);
    
    if (accrualTransactions.length > 0) {
      accrualTransactions.forEach((tx, index) => {
        console.log(`\n  Transaction ${index + 1}:`);
        console.log(`    ID: ${tx._id}`);
        console.log(`    Date: ${tx.date}`);
        console.log(`    Source: ${tx.source}`);
        console.log(`    Description: ${tx.description}`);
        
        const txDate = new Date(tx.date);
        const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
        console.log(`    Month Key: ${monthKey}`);
        
        if (tx.metadata) {
          console.log(`    Metadata: ${JSON.stringify(tx.metadata, null, 4)}`);
        }
        
        // Show AR entries
        tx.entries.forEach((entry, entryIndex) => {
          if (entry.accountCode.startsWith('1100-')) {
            console.log(`      Entry ${entryIndex + 1}: ${entry.accountCode} - ${entry.accountName}`);
            console.log(`        Debit: $${entry.debit}, Credit: $${entry.credit}`);
            console.log(`        Description: ${entry.description}`);
          }
        });
      });
    } else {
      console.log('❌ No accrual transactions found for this student');
    }
    
    // 3. Check payment transactions for this student
    console.log('\n3️⃣ PAYMENT TRANSACTIONS:');
    const paymentTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId}` },
      source: 'payment'
    }).sort({ date: 1 });
    
    console.log(`Found ${paymentTransactions.length} payment transactions`);
    
    if (paymentTransactions.length > 0) {
      paymentTransactions.forEach((tx, index) => {
        console.log(`\n  Payment ${index + 1}:`);
        console.log(`    ID: ${tx._id}`);
        console.log(`    Date: ${tx.date}`);
        console.log(`    Description: ${tx.description}`);
        
        const txDate = new Date(tx.date);
        const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
        console.log(`    Month Key: ${monthKey}`);
        
        if (tx.metadata) {
          console.log(`    Metadata: ${JSON.stringify(tx.metadata, null, 4)}`);
        }
        
        // Show AR entries
        tx.entries.forEach((entry, entryIndex) => {
          if (entry.accountCode.startsWith('1100-')) {
            console.log(`      Entry ${entryIndex + 1}: ${entry.accountCode} - ${entry.accountName}`);
            console.log(`        Debit: $${entry.debit}, Credit: $${entry.credit}`);
            console.log(`        Description: ${entry.description}`);
          }
        });
      });
    } else {
      console.log('❌ No payment transactions found for this student');
    }
    
    // 4. Check what months should have outstanding balances
    console.log('\n4️⃣ EXPECTED OUTSTANDING BALANCES:');
    if (application) {
      const startDate = new Date(application.startDate);
      const now = new Date();
      
      // Calculate months from lease start to now
      const monthsActive = Math.max(0, 
        (now.getFullYear() - startDate.getFullYear()) * 12 + 
        (now.getMonth() - startDate.getMonth())
      );
      
      console.log(`Months active: ${monthsActive}`);
      console.log(`Current date: ${now.toLocaleDateString()}`);
      
      // Show what months should have accruals
      for (let i = 0; i < monthsActive; i++) {
        const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const monthName = monthDate.toLocaleString('default', { month: 'long' });
        
        console.log(`  ${monthKey} (${monthName}): Should have accrual`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkSpecificStudentLease();
