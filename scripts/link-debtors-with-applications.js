const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Debtor = require('../src/models/Debtor');
const Application = require('../src/models/Application');
const User = require('../src/models/User');

async function linkDebtorsWithApplications() {
  try {
    console.log('🔗 Linking debtors with applications...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Get all debtors
    const debtors = await Debtor.find({}).populate('user', 'firstName lastName email');
    console.log(`📋 Found ${debtors.length} debtors\n`);
    
    // Get all applications
    const applications = await Application.find({}).populate('student', 'firstName lastName email');
    console.log(`📋 Found ${applications.length} applications\n`);
    
    let linkedCount = 0;
    let updatedCount = 0;
    
    for (const debtor of debtors) {
      console.log(`\n🔍 Processing debtor: ${debtor.debtorCode} - ${debtor.user?.firstName} ${debtor.user?.lastName}`);
      
      // Try to find matching application by user ID
      let matchingApplication = null;
      
      if (debtor.user) {
        // First try to find by student ID
        matchingApplication = await Application.findOne({ 
          student: debtor.user._id 
        });
        
        if (!matchingApplication) {
          // Try to find by email if student ID doesn't match
          const userEmail = debtor.user.email;
          if (userEmail) {
            matchingApplication = await Application.findOne({ 
              email: userEmail 
            });
          }
        }
        
        if (!matchingApplication) {
          // Try to find by name if email doesn't match
          const firstName = debtor.user.firstName;
          const lastName = debtor.user.lastName;
          if (firstName && lastName) {
            matchingApplication = await Application.findOne({
              firstName: { $regex: new RegExp(firstName, 'i') },
              lastName: { $regex: new RegExp(lastName, 'i') }
            });
          }
        }
      }
      
      if (matchingApplication) {
        console.log(`   ✅ Found matching application: ${matchingApplication.applicationCode || 'No code'} - ${matchingApplication.firstName} ${matchingApplication.lastName}`);
        
        // Update debtor with application reference and code
        const updateData = {
          application: matchingApplication._id,
          applicationCode: matchingApplication.applicationCode || null
        };
        
        // Update the debtor
        await Debtor.findByIdAndUpdate(debtor._id, updateData);
        
        console.log(`   ✅ Updated debtor with application link and code: ${matchingApplication.applicationCode || 'No code'}`);
        updatedCount++;
        
        // Also update the application with debtor reference if not already set
        if (!matchingApplication.debtor) {
          await Application.findByIdAndUpdate(matchingApplication._id, {
            debtor: debtor._id
          });
          console.log(`   ✅ Updated application with debtor reference`);
        }
        
      } else {
        console.log(`   ❌ No matching application found for debtor`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total debtors processed: ${debtors.length}`);
    console.log(`   Debtors updated: ${updatedCount}`);
    console.log(`   Applications linked: ${linkedCount}`);
    
    // Show final status
    const finalDebtors = await Debtor.find({}).populate('application', 'applicationCode firstName lastName');
    console.log(`\n📋 Final debtor status:`);
    
    for (const debtor of finalDebtors) {
      const appInfo = debtor.application ? 
        `${debtor.application.applicationCode || 'No code'} - ${debtor.application.firstName} ${debtor.application.lastName}` : 
        'No application linked';
      
      console.log(`   ${debtor.debtorCode}: ${appInfo}`);
    }
    
    console.log('\n✅ Linking completed successfully!');
    
  } catch (error) {
    console.error('❌ Error linking debtors with applications:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the script
linkDebtorsWithApplications();
