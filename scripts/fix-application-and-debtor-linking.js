const mongoose = require('mongoose');
require('dotenv').config();

async function fixApplicationAndDebtorLinking() {
  try {
    console.log('\n🔧 FIXING APPLICATION AND DEBTOR LINKING');
    console.log('==========================================\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const Debtor = require('../src/models/Debtor');
    const User = require('../src/models/User');
    const Residence = require('../src/models/Residence');
    const Application = require('../src/models/Application');
    
    // Step 1: Fix the application by adding the missing student field
    console.log('🔧 STEP 1: FIXING APPLICATION STUDENT FIELD');
    console.log('─'.repeat(50));
    
    const user = await User.findOne({ email: 'macdonald.sairos@students.uz.ac.zw' }).lean();
    if (!user) {
      console.log('❌ User not found for Macdonald Sairos');
      return;
    }
    
    console.log(`👤 Found user: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`   User ID: ${user._id}`);
    
    // Find the application by email
    const application = await Application.findOne({ 
      email: 'macdonald.sairos@students.uz.ac.zw' 
    }).lean();
    
    if (!application) {
      console.log('❌ Application not found for Macdonald Sairos');
      return;
    }
    
    console.log(`📝 Found application: ${application.applicationCode}`);
    console.log(`   Status: ${application.status}`);
    console.log(`   Room: ${application.allocatedRoom}`);
    console.log(`   Residence: ${application.residence}`);
    console.log(`   Student field: ${application.student || 'MISSING'}`);
    
    // Update the application to include the student field
    if (!application.student) {
      console.log('\n🔧 Adding missing student field to application...');
      
      await Application.findByIdAndUpdate(application._id, {
        student: user._id
      });
      
      console.log('✅ Application updated with student field');
      
      // Refresh the application data
      const updatedApp = await Application.findById(application._id).lean();
      console.log(`   Updated student field: ${updatedApp.student}`);
    } else {
      console.log('✅ Application already has student field');
    }
    
    // Step 2: Fix debtor linking
    console.log('\n🔧 STEP 2: FIXING DEBTOR LINKING');
    console.log('─'.repeat(50));
    
    const debtors = await Debtor.find().lean();
    console.log(`📊 Found ${debtors.length} debtors to fix\n`);
    
    if (debtors.length === 0) {
      console.log('❌ No debtors found to fix');
      return;
    }
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const debtor of debtors) {
      try {
        console.log(`\n🔧 Fixing debtor: ${debtor.debtorCode}`);
        console.log('─'.repeat(40));
        
        // Get the user (student)
        const debtorUser = await User.findById(debtor.user).lean();
        if (!debtorUser) {
          console.log(`   ❌ User not found for debtor ${debtor.debtorCode}`);
          errorCount++;
          continue;
        }
        
        console.log(`   Student: ${debtorUser.firstName} ${debtorUser.lastName} (${debtorUser.email})`);
        
        // Find the approved application for this student (now by both student ID and email)
        const studentApplication = await Application.findOne({
          $or: [
            { student: debtorUser._id, status: 'approved' },
            { email: debtorUser.email, status: 'approved' }
          ]
        }).lean();
        
        if (!studentApplication) {
          console.log(`   ⚠️  No approved application found for ${debtorUser.email}`);
          // Try to get any application
          const anyApp = await Application.findOne({
            $or: [
              { student: debtorUser._id },
              { email: debtorUser.email }
            ]
          }).lean();
          if (anyApp) {
            console.log(`   📝 Found application with status: ${anyApp.status}`);
          }
          continue;
        }
        
        console.log(`   📝 Application found: Room ${studentApplication.allocatedRoom}, Residence: ${studentApplication.residence}`);
        console.log(`   📅 Lease Period: ${studentApplication.startDate} to ${studentApplication.endDate}`);
        
        // Get residence details
        const residence = await Residence.findById(studentApplication.residence).lean();
        if (!residence) {
          console.log(`   ❌ Residence not found: ${studentApplication.residence}`);
          errorCount++;
          continue;
        }
        
        console.log(`   🏠 Residence: ${residence.name}`);
        
        // Find the room and get its price
        const room = residence.rooms.find(r => r.roomNumber === studentApplication.allocatedRoom);
        if (!room) {
          console.log(`   ❌ Room ${studentApplication.allocatedRoom} not found in residence`);
          errorCount++;
          continue;
        }
        
        const roomPrice = room.price;
        console.log(`   💰 Room Price: $${roomPrice}`);
        
        // Calculate lease duration in months
        const startDate = new Date(studentApplication.startDate);
        const endDate = new Date(studentApplication.endDate);
        const monthsDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44));
        console.log(`   📅 Lease Duration: ${monthsDiff} months`);
        
        // Calculate total owed
        let totalOwed = roomPrice * monthsDiff;
        
        // Add admin fee if it's St Kilda (based on your previous requirements)
        if (residence.name.toLowerCase().includes('st kilda')) {
          totalOwed += 20; // Admin fee
          console.log(`   💰 Added admin fee: $20`);
        }
        
        // Add security deposit (typically 1 month rent)
        const securityDeposit = roomPrice;
        totalOwed += securityDeposit;
        console.log(`   💰 Added security deposit: $${securityDeposit}`);
        
        console.log(`   💰 Total Owed: $${totalOwed}`);
        
        // Update the debtor with correct information
        const updateData = {
          residence: studentApplication.residence,
          roomNumber: studentApplication.allocatedRoom,
          totalOwed: totalOwed,
          currentBalance: totalOwed - (debtor.totalPaid || 0),
          billingPeriod: {
            type: 'monthly',
            duration: {
              value: monthsDiff,
              unit: 'months'
            },
            startDate: studentApplication.startDate,
            endDate: studentApplication.endDate,
            roomPrice: roomPrice,
            adminFee: residence.name.toLowerCase().includes('st kilda') ? 20 : 0,
            securityDeposit: securityDeposit
          }
        };
        
        // Update the debtor
        await Debtor.findByIdAndUpdate(debtor._id, updateData);
        
        console.log(`   ✅ Debtor updated successfully`);
        console.log(`      - Residence: ${residence.name}`);
        console.log(`      - Room: ${studentApplication.allocatedRoom}`);
        console.log(`      - Total Owed: $${totalOwed}`);
        console.log(`      - Current Balance: $${totalOwed - (debtor.totalPaid || 0)}`);
        
        fixedCount++;
        
      } catch (error) {
        console.error(`   ❌ Error fixing debtor ${debtor.debtorCode}:`, error.message);
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n📋 FIXING SUMMARY:');
    console.log('─'.repeat(40));
    console.log(`   Total debtors processed: ${debtors.length}`);
    console.log(`   Successfully fixed: ${fixedCount}`);
    console.log(`   Errors: ${errorCount}`);
    
    if (fixedCount > 0) {
      console.log('\n🎉 APPLICATION AND DEBTOR LINKING FIXED!');
      console.log('─'.repeat(45));
      console.log('✅ All applications now have:');
      console.log('   - Proper student field linking to User model');
      console.log('✅ All debtors now have:');
      console.log('   - Correct residence links');
      console.log('   - Proper room numbers');
      console.log('   - Accurate total amounts based on room prices');
      console.log('   - Lease duration and billing period information');
      console.log('   - Admin fees and security deposits where applicable');
    }
    
    // Verify the fixes
    console.log('\n🔍 VERIFYING FIXES:');
    console.log('─'.repeat(40));
    
    // Check application
    const updatedApp = await Application.findById(application._id)
      .populate('student', 'firstName lastName email')
      .lean();
    
    console.log('\n📝 UPDATED APPLICATION:');
    console.log(`   Application Code: ${updatedApp.applicationCode}`);
    console.log(`   Student: ${updatedApp.student ? `${updatedApp.student.firstName} ${updatedApp.student.lastName}` : 'Not linked'}`);
    console.log(`   Status: ${updatedApp.status}`);
    console.log(`   Room: ${updatedApp.allocatedRoom}`);
    console.log(`   Residence: ${updatedApp.residence}`);
    
    // Check debtors
    const updatedDebtors = await Debtor.find()
      .populate('user', 'firstName lastName email')
      .populate('residence', 'name')
      .lean();
    
    console.log('\n👤 UPDATED DEBTORS:');
    updatedDebtors.forEach(debtor => {
      console.log(`\n   ${debtor.user.firstName} ${debtor.user.lastName}:`);
      console.log(`      Residence: ${debtor.residence?.name || 'Not linked'}`);
      console.log(`      Room: ${debtor.roomNumber || 'Not set'}`);
      console.log(`      Total Owed: $${debtor.totalOwed}`);
      console.log(`      Current Balance: $${debtor.currentBalance}`);
      
      if (debtor.billingPeriod) {
        console.log(`      Billing: ${debtor.billingPeriod.duration.value} months at $${debtor.billingPeriod.roomPrice}/month`);
        console.log(`      Period: ${debtor.billingPeriod.startDate} to ${debtor.billingPeriod.endDate}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error fixing application and debtor linking:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

fixApplicationAndDebtorLinking();
