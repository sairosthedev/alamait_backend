const mongoose = require('mongoose');
require('dotenv').config();

async function checkStudentExistence() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const User = require('./src/models/User');
    const Application = require('./src/models/Application');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68af33e9aef6b0dcc8e8f14b'; // The student from the user's query
    
    console.log('\n🔍 CHECKING STUDENT EXISTENCE');
    console.log('=============================');
    
    // 1. Check if student exists in User collection
    console.log('\n1️⃣ CHECKING USER COLLECTION:');
    const user = await User.findById(studentId);
    if (user) {
      console.log(`✅ User found:`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Residence: ${user.residence}`);
    } else {
      console.log('❌ User not found in User collection');
    }
    
    // 2. Check if student exists in Application collection
    console.log('\n2️⃣ CHECKING APPLICATION COLLECTION:');
    const application = await Application.findOne({ student: studentId });
    if (application) {
      console.log(`✅ Application found:`);
      console.log(`   Name: ${application.firstName} ${application.lastName}`);
      console.log(`   Email: ${application.email}`);
      console.log(`   Status: ${application.status}`);
      console.log(`   Start Date: ${application.startDate}`);
      console.log(`   End Date: ${application.endDate}`);
    } else {
      console.log('❌ Application not found in Application collection');
    }
    
    // 3. Check if there are any transactions for this student
    console.log('\n3️⃣ CHECKING TRANSACTION ENTRIES:');
    const transactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId}` }
    });
    
    console.log(`Found ${transactions.length} transactions for student ${studentId}`);
    
    if (transactions.length > 0) {
      console.log('\nTransaction details:');
      transactions.forEach((tx, index) => {
        console.log(`\n  Transaction ${index + 1}:`);
        console.log(`    ID: ${tx._id}`);
        console.log(`    Date: ${tx.date}`);
        console.log(`    Source: ${tx.source}`);
        console.log(`    Description: ${tx.description}`);
        
        const txDate = new Date(tx.date);
        const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
        console.log(`    Month Key: ${monthKey}`);
      });
    }
    
    // 4. Search for similar student IDs
    console.log('\n4️⃣ SEARCHING FOR SIMILAR STUDENT IDS:');
    
    // Search in User collection for similar IDs
    const similarUsers = await User.find({
      _id: { $regex: studentId.substring(0, 8) }
    }).limit(5);
    
    if (similarUsers.length > 0) {
      console.log('Similar user IDs found:');
      similarUsers.forEach(user => {
        console.log(`   ${user._id}: ${user.firstName} ${user.lastName} (${user.email})`);
      });
    } else {
      console.log('No similar user IDs found');
    }
    
    // Search in Application collection for similar IDs
    const similarApplications = await Application.find({
      student: { $regex: studentId.substring(0, 8) }
    }).limit(5);
    
    if (similarApplications.length > 0) {
      console.log('Similar application student IDs found:');
      similarApplications.forEach(app => {
        console.log(`   ${app.student}: ${app.firstName} ${app.lastName} (${app.email})`);
      });
    } else {
      console.log('No similar application student IDs found');
    }
    
    // 5. Check if there are any transactions with similar account codes
    console.log('\n5️⃣ SEARCHING FOR SIMILAR ACCOUNT CODES:');
    const similarTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId.substring(0, 8)}` }
    }).limit(5);
    
    if (similarTransactions.length > 0) {
      console.log('Similar account codes found:');
      similarTransactions.forEach(tx => {
        tx.entries.forEach(entry => {
          if (entry.accountCode.startsWith('1100-')) {
            console.log(`   ${entry.accountCode}: ${tx.description} (${tx.date})`);
          }
        });
      });
    } else {
      console.log('No similar account codes found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkStudentExistence();
