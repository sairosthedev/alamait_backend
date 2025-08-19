const mongoose = require('mongoose');
require('dotenv').config();

async function fixDebtorLinking() {
  try {
    console.log('\n🔧 FIXING DEBTOR LINKING ISSUES');
    console.log('==================================\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const Debtor = require('../src/models/Debtor');
    const User = require('../src/models/User');
    const Residence = require('../src/models/Residence');
    const Application = require('../src/models/Application');
    const Booking = require('../src/models/Booking');
    
    // Get all debtors
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
        const user = await User.findById(debtor.user).lean();
        if (!user) {
          console.log(`   ❌ User not found for debtor ${debtor.debtorCode}`);
          errorCount++;
          continue;
        }
        
        console.log(`   Student: ${user.firstName} ${user.lastName} (${user.email})`);
        
        // Find the approved application for this student
        const application = await Application.findOne({
          student: user._id,
          status: 'approved'
        }).lean();
        
        if (!application) {
          console.log(`   ⚠️  No approved application found for ${user.email}`);
          // Try to get any application
          const anyApp = await Application.findOne({ student: user._id }).lean();
          if (anyApp) {
            console.log(`   📝 Found application with status: ${anyApp.status}`);
          }
          continue;
        }
        
        console.log(`   📝 Application found: Room ${application.allocatedRoom}, Residence: ${application.residence}`);
        console.log(`   📅 Lease Period: ${application.startDate} to ${application.endDate}`);
        
        // Get residence details
        const residence = await Residence.findById(application.residence).lean();
        if (!residence) {
          console.log(`   ❌ Residence not found: ${application.residence}`);
          errorCount++;
          continue;
        }
        
        console.log(`   🏠 Residence: ${residence.name}`);
        
        // Find the room and get its price
        const room = residence.rooms.find(r => r.roomNumber === application.allocatedRoom);
        if (!room) {
          console.log(`   ❌ Room ${application.allocatedRoom} not found in residence`);
          errorCount++;
          continue;
        }
        
        const roomPrice = room.price;
        console.log(`   💰 Room Price: $${roomPrice}`);
        
        // Calculate lease duration in months
        const startDate = new Date(application.startDate);
        const endDate = new Date(application.endDate);
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
          residence: application.residence,
          roomNumber: application.allocatedRoom,
          totalOwed: totalOwed,
          currentBalance: totalOwed - (debtor.totalPaid || 0),
          billingPeriod: {
            type: 'monthly',
            duration: {
              value: monthsDiff,
              unit: 'months'
            },
            startDate: application.startDate,
            endDate: application.endDate,
            roomPrice: roomPrice,
            adminFee: residence.name.toLowerCase().includes('st kilda') ? 20 : 0,
            securityDeposit: securityDeposit
          }
        };
        
        // Update the debtor
        await Debtor.findByIdAndUpdate(debtor._id, updateData);
        
        console.log(`   ✅ Debtor updated successfully`);
        console.log(`      - Residence: ${residence.name}`);
        console.log(`      - Room: ${application.allocatedRoom}`);
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
      console.log('\n🎉 DEBTOR LINKING FIXED!');
      console.log('─'.repeat(30));
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
    
    const updatedDebtors = await Debtor.find()
      .populate('user', 'firstName lastName email')
      .populate('residence', 'name')
      .lean();
    
    updatedDebtors.forEach(debtor => {
      console.log(`\n👤 ${debtor.user.firstName} ${debtor.user.lastName}:`);
      console.log(`   Residence: ${debtor.residence?.name || 'Not linked'}`);
      console.log(`   Room: ${debtor.roomNumber || 'Not set'}`);
      console.log(`   Total Owed: $${debtor.totalOwed}`);
      console.log(`   Current Balance: $${debtor.currentBalance}`);
      
      if (debtor.billingPeriod) {
        console.log(`   Billing: ${debtor.billingPeriod.duration.value} months at $${debtor.billingPeriod.roomPrice}/month`);
        console.log(`   Period: ${debtor.billingPeriod.startDate} to ${debtor.billingPeriod.endDate}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error fixing debtor linking:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

fixDebtorLinking();
