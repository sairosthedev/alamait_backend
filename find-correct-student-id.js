const mongoose = require('mongoose');
require('dotenv').config();

async function findCorrectStudentId() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const User = require('./src/models/User');
    const Application = require('./src/models/Application');
    const Debtor = require('./src/models/Debtor');
    
    console.log('\n🔍 FINDING CORRECT STUDENT ID');
    console.log('=============================');
    
    // 1. Search for transactions with "Cindy" in the description
    console.log('\n1️⃣ SEARCHING FOR CINDY TRANSACTIONS:');
    const cindyTransactions = await TransactionEntry.find({
      'entries.description': { $regex: /cindy/i }
    }).sort({ date: 1 });
    
    console.log(`Found ${cindyTransactions.length} transactions for Cindy`);
    
    cindyTransactions.forEach((tx, index) => {
      console.log(`\n  Transaction ${index + 1}:`);
      console.log(`    Date: ${tx.date.toLocaleDateString()}`);
      console.log(`    Description: ${tx.description}`);
      console.log(`    Source: ${tx.source}`);
      console.log(`    Source ID: ${tx.sourceId}`);
      console.log(`    Reference: ${tx.reference}`);
      
      // Find student ID from AR account codes
      const arEntries = tx.entries.filter(entry => entry.accountCode.startsWith('1100-'));
      arEntries.forEach(entry => {
        const studentId = entry.accountCode.replace('1100-', '');
        console.log(`    Student ID from AR: ${studentId}`);
      });
    });
    
    // 2. Search for users with "Cindy" in the name
    console.log('\n2️⃣ SEARCHING FOR CINDY USER:');
    const cindyUsers = await User.find({
      $or: [
        { firstName: { $regex: /cindy/i } },
        { lastName: { $regex: /cindy/i } }
      ]
    });
    
    console.log(`Found ${cindyUsers.length} users with Cindy in name`);
    cindyUsers.forEach((user, index) => {
      console.log(`\n  User ${index + 1}:`);
      console.log(`    ID: ${user._id}`);
      console.log(`    Name: ${user.firstName} ${user.lastName}`);
      console.log(`    Email: ${user.email}`);
      console.log(`    Status: ${user.status}`);
    });
    
    // 3. Search for applications with "Cindy" in the name
    console.log('\n3️⃣ SEARCHING FOR CINDY APPLICATION:');
    const cindyApplications = await Application.find({
      $or: [
        { firstName: { $regex: /cindy/i } },
        { lastName: { $regex: /cindy/i } }
      ]
    });
    
    console.log(`Found ${cindyApplications.length} applications with Cindy in name`);
    cindyApplications.forEach((app, index) => {
      console.log(`\n  Application ${index + 1}:`);
      console.log(`    ID: ${app._id}`);
      console.log(`    Name: ${app.firstName} ${app.lastName}`);
      console.log(`    Student ID: ${app.student}`);
      console.log(`    Status: ${app.status}`);
      console.log(`    Start Date: ${app.startDate}`);
    });
    
    // 4. Search for debtors with "Cindy" in the name
    console.log('\n4️⃣ SEARCHING FOR CINDY DEBTOR:');
    const cindyDebtors = await Debtor.find({
      $or: [
        { firstName: { $regex: /cindy/i } },
        { lastName: { $regex: /cindy/i } }
      ]
    });
    
    console.log(`Found ${cindyDebtors.length} debtors with Cindy in name`);
    cindyDebtors.forEach((debtor, index) => {
      console.log(`\n  Debtor ${index + 1}:`);
      console.log(`    ID: ${debtor._id}`);
      console.log(`    Name: ${debtor.firstName} ${debtor.lastName}`);
      console.log(`    User ID: ${debtor.user}`);
      console.log(`    Debtor Code: ${debtor.debtorCode}`);
      console.log(`    Status: ${debtor.status}`);
    });
    
    // 5. Check if the ID from transactions exists as a user
    console.log('\n5️⃣ CHECKING TRANSACTION ID AS USER:');
    const transactionIds = new Set();
    cindyTransactions.forEach(tx => {
      const arEntries = tx.entries.filter(entry => entry.accountCode.startsWith('1100-'));
      arEntries.forEach(entry => {
        const studentId = entry.accountCode.replace('1100-', '');
        transactionIds.add(studentId);
      });
    });
    
    for (const studentId of transactionIds) {
      console.log(`\n  Checking ID: ${studentId}`);
      const user = await User.findById(studentId);
      if (user) {
        console.log(`    ✅ Found as User: ${user.firstName} ${user.lastName}`);
      } else {
        console.log(`    ❌ Not found as User`);
      }
      
      const application = await Application.findById(studentId);
      if (application) {
        console.log(`    ✅ Found as Application: ${application.firstName} ${application.lastName}`);
      } else {
        console.log(`    ❌ Not found as Application`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

findCorrectStudentId();
