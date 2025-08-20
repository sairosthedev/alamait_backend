const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Debtor = require('../src/models/Debtor');
const Application = require('../src/models/Application');
const User = require('../src/models/User');
const Residence = require('../src/models/Residence');

async function verifyDebtorApplicationLinks() {
  try {
    console.log('🔍 Verifying debtor-application links...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // 1. Show all debtors with their application details
    console.log('📋 1. All Debtors with Application Details:');
    const debtorsWithApps = await Debtor.find({})
      .populate('application', 'applicationCode firstName lastName startDate endDate')
      .populate('user', 'firstName lastName email')
      .populate('residence', 'name');
    
    debtorsWithApps.forEach(debtor => {
      const appInfo = debtor.application ? 
        `${debtor.application.applicationCode} - ${debtor.application.firstName} ${debtor.application.lastName}` : 
        'No application linked';
      
      const userInfo = debtor.user ? 
        `${debtor.user.firstName} ${debtor.user.lastName} (${debtor.user.email})` : 
        'No user linked';
      
      const residenceInfo = debtor.residence ? 
        debtor.residence.name : 'No residence linked';
      
      console.log(`   ${debtor.debtorCode}:`);
      console.log(`     User: ${userInfo}`);
      console.log(`     Application: ${appInfo}`);
      console.log(`     Residence: ${residenceInfo}`);
      console.log(`     Application Code: ${debtor.applicationCode || 'Not set'}`);
      console.log(`     Current Balance: $${debtor.currentBalance}`);
      console.log(`     Total Owed: $${debtor.totalOwed}`);
      console.log('');
    });
    
    // 2. Show all applications with their debtor details
    console.log('📋 2. All Applications with Debtor Details:');
    const applicationsWithDebtors = await Application.find({})
      .populate('debtor', 'debtorCode currentBalance totalOwed')
      .populate('student', 'firstName lastName email')
      .populate('residence', 'name');
    
    applicationsWithDebtors.forEach(app => {
      const debtorInfo = app.debtor ? 
        `${app.debtor.debtorCode} (Balance: $${app.debtor.currentBalance}, Owed: $${app.debtor.totalOwed})` : 
        'No debtor linked';
      
      const studentInfo = app.student ? 
        `${app.student.firstName} ${app.student.lastName} (${app.student.email})` : 
        'No student linked';
      
      const residenceInfo = app.residence ? 
        app.residence.name : 'No residence linked';
      
      console.log(`   ${app.applicationCode || 'No code'}:`);
      console.log(`     Student: ${studentInfo}`);
      console.log(`     Debtor: ${debtorInfo}`);
      console.log(`     Residence: ${residenceInfo}`);
      console.log(`     Status: ${app.status}`);
      console.log(`     Start Date: ${app.startDate ? app.startDate.toDateString() : 'Not set'}`);
      console.log(`     End Date: ${app.endDate ? app.endDate.toDateString() : 'Not set'}`);
      console.log('');
    });
    
    // 3. Demonstrate querying debtors by application code
    console.log('📋 3. Querying Debtors by Application Code:');
    
    // Get all unique application codes
    const appCodes = applicationsWithDebtors
      .map(app => app.applicationCode)
      .filter(code => code);
    
    for (const appCode of appCodes) {
      console.log(`\n🔍 Searching for debtor with application code: ${appCode}`);
      
      const debtorByAppCode = await Debtor.findOne({ applicationCode: appCode })
        .populate('application', 'firstName lastName startDate endDate')
        .populate('user', 'firstName lastName email')
        .populate('residence', 'name');
      
      if (debtorByAppCode) {
        console.log(`   ✅ Found debtor: ${debtorByAppCode.debtorCode}`);
        console.log(`   User: ${debtorByAppCode.user?.firstName} ${debtorByAppCode.user?.lastName}`);
        console.log(`   Application: ${debtorByAppCode.application?.firstName} ${debtorByAppCode.application?.lastName}`);
        console.log(`   Residence: ${debtorByAppCode.residence?.name}`);
        console.log(`   Balance: $${debtorByAppCode.currentBalance}`);
      } else {
        console.log(`   ❌ No debtor found with application code: ${appCode}`);
      }
    }
    
    // 4. Show how to query applications by debtor code
    console.log('\n📋 4. Querying Applications by Debtor Code:');
    
    const debtorCodes = debtorsWithApps.map(d => d.debtorCode);
    
    for (const debtorCode of debtorCodes) {
      console.log(`\n🔍 Searching for application with debtor code: ${debtorCode}`);
      
      const applicationByDebtorCode = await Application.findOne({ debtor: { $exists: true } })
        .populate('debtor')
        .where('debtor.debtorCode', debtorCode);
      
      if (applicationByDebtorCode) {
        console.log(`   ✅ Found application: ${applicationByDebtorCode.applicationCode}`);
        console.log(`   Student: ${applicationByDebtorCode.firstName} ${applicationByDebtorCode.lastName}`);
        console.log(`   Status: ${applicationByDebtorCode.status}`);
      } else {
        // Try alternative approach
        const debtor = await Debtor.findOne({ debtorCode });
        if (debtor && debtor.application) {
          const app = await Application.findById(debtor.application);
          if (app) {
            console.log(`   ✅ Found application via debtor reference: ${app.applicationCode}`);
            console.log(`   Student: ${app.firstName} ${app.lastName}`);
            console.log(`   Status: ${app.status}`);
          } else {
            console.log(`   ❌ No application found for debtor: ${debtorCode}`);
          }
        } else {
          console.log(`   ❌ No application found for debtor: ${debtorCode}`);
        }
      }
    }
    
    console.log('\n✅ Verification completed successfully!');
    
  } catch (error) {
    console.error('❌ Error verifying debtor-application links:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the script
verifyDebtorApplicationLinks();
