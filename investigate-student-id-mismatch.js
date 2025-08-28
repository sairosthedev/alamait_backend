const mongoose = require('mongoose');
require('dotenv').config();

async function investigateStudentIdMismatch() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const Application = require('./src/models/Application');
    const User = require('./src/models/User');
    
    console.log('\n🔍 INVESTIGATING STUDENT ID MISMATCH');
    console.log('=====================================');
    
    // 1. Check what student IDs are involved
    const studentId1 = '68af33e9aef6b0dcc8e8f149'; // From lease start transaction
    const studentId2 = '68af33e9aef6b0dcc8e8f14b'; // From monthly accruals
    
    console.log('\n1️⃣ CHECKING STUDENT IDS:');
    console.log(`Student ID 1 (lease start): ${studentId1}`);
    console.log(`Student ID 2 (monthly accruals): ${studentId2}`);
    
    // 2. Check if both student IDs exist in User collection
    console.log('\n2️⃣ CHECKING USER COLLECTION:');
    const user1 = await User.findById(studentId1);
    const user2 = await User.findById(studentId2);
    
    if (user1) {
      console.log(`✅ User 1 found: ${user1.firstName} ${user1.lastName} (${user1.email})`);
    } else {
      console.log(`❌ User 1 not found: ${studentId1}`);
    }
    
    if (user2) {
      console.log(`✅ User 2 found: ${user2.firstName} ${user2.lastName} (${user2.email})`);
    } else {
      console.log(`❌ User 2 not found: ${studentId2}`);
    }
    
    // 3. Check applications for both student IDs
    console.log('\n3️⃣ CHECKING APPLICATIONS:');
    const applications1 = await Application.find({ student: studentId1 });
    const applications2 = await Application.find({ student: studentId2 });
    
    console.log(`Applications for Student ID 1: ${applications1.length}`);
    applications1.forEach((app, index) => {
      console.log(`  ${index + 1}. ${app.firstName} ${app.lastName} - Status: ${app.status} - Date: ${app.applicationDate}`);
    });
    
    console.log(`Applications for Student ID 2: ${applications2.length}`);
    applications2.forEach((app, index) => {
      console.log(`  ${index + 1}. ${app.firstName} ${app.lastName} - Status: ${app.status} - Date: ${app.applicationDate}`);
    });
    
    // 4. Check if there are applications with similar names
    console.log('\n4️⃣ SEARCHING FOR SIMILAR NAMES:');
    const allApplications = await Application.find({
      $or: [
        { firstName: { $regex: 'Cindy', $options: 'i' } },
        { lastName: { $regex: 'Gwekwerere', $options: 'i' } }
      ]
    });
    
    console.log(`Found ${allApplications.length} applications with similar names:`);
    allApplications.forEach((app, index) => {
      console.log(`  ${index + 1}. ${app.firstName} ${app.lastName} - Student: ${app.student} - Status: ${app.status}`);
    });
    
    // 5. Check all transactions for both account codes
    console.log('\n5️⃣ CHECKING ALL TRANSACTIONS:');
    const accountCode1 = `1100-${studentId1}`;
    const accountCode2 = `1100-${studentId2}`;
    
    const transactions1 = await TransactionEntry.find({
      'entries.accountCode': accountCode1
    }).sort({ date: 1 });
    
    const transactions2 = await TransactionEntry.find({
      'entries.accountCode': accountCode2
    }).sort({ date: 1 });
    
    console.log(`Transactions for ${accountCode1}: ${transactions1.length}`);
    transactions1.forEach((tx, index) => {
      console.log(`  ${index + 1}. ${tx.date.toLocaleDateString()} - ${tx.description} - Source: ${tx.source}`);
    });
    
    console.log(`Transactions for ${accountCode2}: ${transactions2.length}`);
    transactions2.forEach((tx, index) => {
      console.log(`  ${index + 1}. ${tx.date.toLocaleDateString()} - ${tx.description} - Source: ${tx.source}`);
    });
    
    // 6. Check if there are any references between the two IDs
    console.log('\n6️⃣ CHECKING FOR REFERENCES:');
    
    // Check if any transactions reference both IDs
    const transactionsWithBoth = await TransactionEntry.find({
      $or: [
        { 'metadata.studentId': { $in: [studentId1, studentId2] } },
        { sourceId: { $in: [studentId1, studentId2] } }
      ]
    });
    
    console.log(`Transactions referencing either student ID: ${transactionsWithBoth.length}`);
    transactionsWithBoth.forEach((tx, index) => {
      console.log(`  ${index + 1}. ${tx.date.toLocaleDateString()} - ${tx.description}`);
      console.log(`     Source: ${tx.source} - SourceId: ${tx.sourceId}`);
      if (tx.metadata && tx.metadata.studentId) {
        console.log(`     Metadata StudentId: ${tx.metadata.studentId}`);
      }
    });
    
    // 7. Check if there are any account creation issues
    console.log('\n7️⃣ CHECKING ACCOUNT CREATION:');
    const Account = require('./src/models/Account');
    
    const account1 = await Account.findOne({ code: accountCode1 });
    const account2 = await Account.findOne({ code: accountCode2 });
    
    if (account1) {
      console.log(`✅ Account 1 found: ${account1.code} - ${account1.name}`);
    } else {
      console.log(`❌ Account 1 not found: ${accountCode1}`);
    }
    
    if (account2) {
      console.log(`✅ Account 2 found: ${account2.code} - ${account2.name}`);
    } else {
      console.log(`❌ Account 2 not found: ${accountCode2}`);
    }
    
    // 8. Summary and recommendations
    console.log('\n8️⃣ SUMMARY AND RECOMMENDATIONS:');
    
    if (user1 && user2 && user1.email === user2.email) {
      console.log(`⚠️  DUPLICATE USER DETECTED: Same email (${user1.email}) with different IDs`);
      console.log(`   This suggests the system created duplicate user records`);
    } else if (user1 && user2 && user1.email !== user2.email) {
      console.log(`⚠️  TWO DIFFERENT USERS: Different emails`);
      console.log(`   User 1: ${user1.email}`);
      console.log(`   User 2: ${user2.email}`);
    } else if (user1 && !user2) {
      console.log(`ℹ️  Only User 1 exists, User 2 is invalid`);
    } else if (!user1 && user2) {
      console.log(`ℹ️  Only User 2 exists, User 1 is invalid`);
    } else {
      console.log(`❌ Neither user exists in the database`);
    }
    
    console.log('\n🔧 RECOMMENDED ACTIONS:');
    console.log('1. Identify which student ID is the correct one');
    console.log('2. Consolidate all transactions to use the correct student ID');
    console.log('3. Update the account codes to use the correct student ID');
    console.log('4. Ensure future transactions use the correct student ID');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

investigateStudentIdMismatch();
