const mongoose = require('mongoose');
const Debtor = require('./src/models/Debtor');
const User = require('./src/models/User');
const TransactionEntry = require('./src/models/TransactionEntry');

async function checkAndFixDebtors() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔍 CHECKING AND FIXING DEBTOR RECORDS\n');

    // 1. Find all students with AR transactions
    console.log('📊 STEP 1: Finding Students with AR Transactions\n');
    
    const arTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^1100-' }
    });

    const studentIds = new Set();
    arTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
          const studentId = entry.accountCode.replace('1100-', '');
          studentIds.add(studentId);
        }
      });
    });

    console.log(`Found ${studentIds.size} unique student IDs with AR transactions:`);
    Array.from(studentIds).forEach(id => console.log(`   ${id}`));
    console.log('');

    // 2. Check existing debtors
    console.log('📊 STEP 2: Checking Existing Debtors\n');
    
    const existingDebtors = await Debtor.find({});
    console.log(`Found ${existingDebtors.length} existing debtors`);

    existingDebtors.forEach(debtor => {
      console.log(`   Debtor ID: ${debtor._id}`);
      console.log(`   User ID: ${debtor.user}`);
      console.log(`   Debtor Code: ${debtor.debtorCode}`);
      console.log(`   Current Balance: $${debtor.currentBalance}`);
      console.log('');
    });

    // 3. Find missing debtors
    console.log('📊 STEP 3: Finding Missing Debtors\n');
    
    const existingUserIds = existingDebtors.map(d => d.user.toString());
    const missingStudentIds = Array.from(studentIds).filter(id => !existingUserIds.includes(id));

    console.log(`Found ${missingStudentIds.length} students without debtor records:`);
    missingStudentIds.forEach(id => console.log(`   ${id}`));
    console.log('');

    // 4. Create missing debtors
    if (missingStudentIds.length > 0) {
      console.log('📊 STEP 4: Creating Missing Debtors\n');
      
      for (const studentId of missingStudentIds) {
        try {
          // Find the student user
          const student = await User.findById(studentId);
          if (!student) {
            console.log(`❌ Student not found: ${studentId}`);
            continue;
          }

          console.log(`🏗️ Creating debtor for student: ${student.firstName} ${student.lastName} (${studentId})`);

          // Create a basic debtor record
          const debtor = new Debtor({
            user: studentId,
            debtorCode: `DEBTOR-${studentId.slice(-8)}`,
            currentBalance: 0,
            totalOwed: 0,
            totalPaid: 0,
            status: 'active',
            paymentHistory: [],
            monthlyPayments: [],
            onceOffCharges: {
              adminFee: { isPaid: false, amount: 0 },
              deposit: { isPaid: false, amount: 0 }
            },
            deferredIncome: {
              totalAmount: 0,
              monthlyBreakdown: {}
            },
            createdBy: 'system'
          });

          await debtor.save();
          console.log(`✅ Created debtor: ${debtor.debtorCode}`);
          console.log(`   Debtor ID: ${debtor._id}`);
          console.log('');

        } catch (error) {
          console.log(`❌ Error creating debtor for ${studentId}:`, error.message);
        }
      }
    } else {
      console.log('✅ All students have debtor records');
    }

    // 5. Verify all debtors exist
    console.log('📊 STEP 5: Verifying All Debtors Exist\n');
    
    const finalDebtors = await Debtor.find({});
    console.log(`Total debtors after fix: ${finalDebtors.length}`);

    const finalUserIds = finalDebtors.map(d => d.user.toString());
    const stillMissing = Array.from(studentIds).filter(id => !finalUserIds.includes(id));

    if (stillMissing.length === 0) {
      console.log('✅ All students now have debtor records');
    } else {
      console.log(`❌ Still missing debtors for: ${stillMissing.join(', ')}`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkAndFixDebtors();
