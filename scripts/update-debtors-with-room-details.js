const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Debtor = require('../src/models/Debtor');
const Application = require('../src/models/Application');
const Residence = require('../src/models/Residence');

async function updateDebtorsWithRoomDetails() {
  try {
    console.log('🔗 Updating debtors with room details from applications...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Get all debtors with their linked applications
    const debtors = await Debtor.find({
      application: { $exists: true, $ne: null }
    }).populate('application', 'allocatedRoom residence firstName lastName applicationCode startDate endDate');
    
    console.log(`📋 Found ${debtors.length} debtors with linked applications\n`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const debtor of debtors) {
      console.log(`\n🔍 Processing debtor: ${debtor.debtorCode}`);
      
      if (!debtor.application) {
        console.log('   ❌ No application linked, skipping...');
        continue;
      }
      
      const application = debtor.application;
      console.log(`   Application: ${application.applicationCode} - ${application.firstName} ${application.lastName}`);
      console.log(`   Allocated Room: ${application.allocatedRoom || 'None'}`);
      
      if (!application.allocatedRoom) {
        console.log('   ⚠️  No allocated room in application, skipping...');
        continue;
      }
      
      if (!application.residence) {
        console.log('   ❌ No residence linked in application, skipping...');
        continue;
      }
      
      try {
        // Get the residence with its rooms
        const residence = await Residence.findById(application.residence);
        if (!residence) {
          console.log('   ❌ Residence not found, skipping...');
          errorCount++;
          continue;
        }
        
        console.log(`   Residence: ${residence.name}`);
        
        // Find the allocated room in the residence
        const allocatedRoom = residence.rooms.find(room => 
          room.roomNumber === application.allocatedRoom ||
          room.roomNumber.toLowerCase() === application.allocatedRoom.toLowerCase()
        );
        
        if (!allocatedRoom) {
          console.log(`   ❌ Room '${application.allocatedRoom}' not found in residence '${residence.name}'`);
          errorCount++;
          continue;
        }
        
        console.log(`   Found room: ${allocatedRoom.roomNumber} - $${allocatedRoom.price} (${allocatedRoom.type})`);
        
        // Calculate number of months from start to end date
        let numberOfMonths = 0;
        let adminFee = 0;
        let deposit = 0;
        
        if (application.startDate && application.endDate) {
          console.log(`   📅 Raw Dates - Start: ${application.startDate}, End: ${application.endDate}`);
          
          // Handle both Date objects and date strings
          const startDate = application.startDate instanceof Date ? application.startDate : new Date(application.startDate);
          const endDate = application.endDate instanceof Date ? application.endDate : new Date(application.endDate);
          
          console.log(`   📅 Parsed Dates - Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`);
          
          // More robust month calculation
          const yearDiff = endDate.getFullYear() - startDate.getFullYear();
          const monthDiff = endDate.getMonth() - startDate.getMonth();
          numberOfMonths = (yearDiff * 12) + monthDiff;
          
          // Add partial month if end date is not at month end
          if (endDate.getDate() > 1) {
            numberOfMonths += 1;
          }
          
          // Ensure at least 1 month
          numberOfMonths = Math.max(1, numberOfMonths);
          
          console.log(`   📅 Lease Period: ${startDate.toDateString()} to ${endDate.toDateString()}`);
          console.log(`   📅 Number of Months: ${numberOfMonths}`);
          console.log(`   📅 Debug - Year Diff: ${yearDiff}, Month Diff: ${monthDiff}`);
        } else {
          console.log(`   ❌ Missing dates - Start: ${!!application.startDate}, End: ${!!application.endDate}`);
        }
        
        // Determine admin fee based on residence
        if (residence.name.toLowerCase().includes('st kilda')) {
          adminFee = 20; // St Kilda has $20 admin fee
        } else {
          adminFee = 0; // Other residences don't have admin fees
        }
        
        // Calculate deposit (typically 1 month's rent)
        deposit = allocatedRoom.price;
        
        // Calculate total owed
        const totalOwed = (allocatedRoom.price * numberOfMonths) + adminFee + deposit;
        
        console.log(`   💰 Financial Breakdown:`);
        console.log(`     - Monthly Rent: $${allocatedRoom.price} × ${numberOfMonths} months = $${allocatedRoom.price * numberOfMonths}`);
        console.log(`     - Admin Fee: $${adminFee}`);
        console.log(`     - Deposit: $${deposit}`);
        console.log(`     - Total Owed: $${totalOwed}`);
        
        // Update debtor with room details and calculated financials
        const updateData = {
          residence: residence._id,
          roomNumber: allocatedRoom.roomNumber,
          roomPrice: allocatedRoom.price,
          totalOwed: totalOwed,
          roomDetails: {
            roomId: allocatedRoom._id,
            roomType: allocatedRoom.type,
            roomCapacity: allocatedRoom.capacity,
            roomFeatures: allocatedRoom.features || [],
            roomAmenities: allocatedRoom.amenities || [],
            roomFloor: allocatedRoom.floor,
            roomArea: allocatedRoom.area
          },
          // Add lease period information
          startDate: application.startDate,
          endDate: application.endDate,
          // Add financial breakdown
          financialBreakdown: {
            monthlyRent: allocatedRoom.price,
            numberOfMonths: numberOfMonths,
            totalRent: allocatedRoom.price * numberOfMonths,
            adminFee: adminFee,
            deposit: deposit,
            totalOwed: totalOwed
          }
        };
        
        // Also update billing period monthly amount if it exists
        if (debtor.billingPeriod && debtor.billingPeriod.amount) {
          updateData['billingPeriod.amount.monthly'] = allocatedRoom.price;
        }
        
        await Debtor.findByIdAndUpdate(debtor._id, updateData);
        
        console.log(`   ✅ Updated debtor with room details:`);
        console.log(`     - Room: ${allocatedRoom.roomNumber} ($${allocatedRoom.price})`);
        console.log(`     - Type: ${allocatedRoom.type}`);
        console.log(`     - Capacity: ${allocatedRoom.capacity}`);
        console.log(`     - Floor: ${allocatedRoom.floor}`);
        console.log(`     - Area: ${allocatedRoom.area} sqm`);
        
        updatedCount++;
        
      } catch (updateError) {
        console.error(`   ❌ Error updating debtor:`, updateError.message);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total debtors processed: ${debtors.length}`);
    console.log(`   Debtors updated successfully: ${updatedCount}`);
    console.log(`   Errors encountered: ${errorCount}`);
    
    // Show final status
    console.log(`\n📋 Final debtor status with room details:`);
    const finalDebtors = await Debtor.find({
      roomPrice: { $exists: true, $gt: 0 }
    }).populate('application', 'applicationCode firstName lastName')
      .populate('residence', 'name');
    
    for (const debtor of finalDebtors) {
      console.log(`\n   ${debtor.debtorCode}:`);
      console.log(`     Application: ${debtor.application?.applicationCode} - ${debtor.application?.firstName} ${debtor.application?.lastName}`);
      console.log(`     Residence: ${debtor.residence?.name || 'Unknown'}`);
      console.log(`     Room: ${debtor.roomNumber} - $${debtor.roomPrice}`);
      
      if (debtor.roomDetails) {
        console.log(`     Room Type: ${debtor.roomDetails.roomType}`);
        console.log(`     Room Capacity: ${debtor.roomDetails.roomCapacity}`);
        console.log(`     Room Floor: ${debtor.roomDetails.roomFloor}`);
        console.log(`     Room Area: ${debtor.roomDetails.roomArea} sqm`);
      }
      
      if (debtor.financialBreakdown) {
        console.log(`     💰 Financial Breakdown:`);
        console.log(`       - Monthly Rent: $${debtor.financialBreakdown.monthlyRent}`);
        console.log(`       - Number of Months: ${debtor.financialBreakdown.numberOfMonths}`);
        console.log(`       - Total Rent: $${debtor.financialBreakdown.totalRent}`);
        console.log(`       - Admin Fee: $${debtor.financialBreakdown.adminFee}`);
        console.log(`       - Deposit: $${debtor.financialBreakdown.deposit}`);
        console.log(`       - Total Owed: $${debtor.financialBreakdown.totalOwed}`);
      }
      
      console.log(`     Current Balance: $${debtor.currentBalance}`);
      console.log(`     Total Owed: $${debtor.totalOwed}`);
    }
    
    console.log('\n✅ Room details update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating debtors with room details:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the script
updateDebtorsWithRoomDetails();
