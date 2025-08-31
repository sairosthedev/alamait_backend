const mongoose = require('mongoose');
require('dotenv').config();

async function updateDebtorsAllocationField() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const Debtor = require('./src/models/Debtor');
    const Payment = require('./src/models/Payment');
    
    console.log('🔄 Updating debtors with allocation field...');
    
    // Get all debtors
    const debtors = await Debtor.find({});
    console.log(`📊 Found ${debtors.length} debtors to update`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const debtor of debtors) {
      try {
        // Check if debtor already has allocation field
        if (debtor.allocation !== undefined) {
          console.log(`⏭️  Debtor ${debtor.debtorCode} already has allocation field, skipping`);
          skippedCount++;
          continue;
        }
        
        // Find payments for this debtor
        const payments = await Payment.find({
          $or: [
            { student: debtor.user },
            { user: debtor.user }
          ]
        }).sort({ createdAt: -1 });
        
        if (payments.length === 0) {
          console.log(`📭 No payments found for debtor ${debtor.debtorCode}, setting allocation to null`);
          debtor.allocation = null;
          await debtor.save();
          updatedCount++;
          continue;
        }
        
        // Get the most recent payment with allocation data
        const paymentWithAllocation = payments.find(p => p.allocation);
        
        if (paymentWithAllocation && paymentWithAllocation.allocation) {
          console.log(`💰 Found allocation data for debtor ${debtor.debtorCode} from payment ${paymentWithAllocation.paymentId}`);
          
          // Copy allocation data from payment to debtor
          debtor.allocation = paymentWithAllocation.allocation;
          await debtor.save();
          
          console.log(`✅ Updated debtor ${debtor.debtorCode} with allocation data`);
          updatedCount++;
        } else {
          console.log(`📭 No allocation data found in payments for debtor ${debtor.debtorCode}, setting to null`);
          debtor.allocation = null;
          await debtor.save();
          updatedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error updating debtor ${debtor.debtorCode}:`, error.message);
      }
    }
    
    console.log('\n📊 UPDATE SUMMARY:');
    console.log('==================');
    console.log(`Total debtors processed: ${debtors.length}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped (already had allocation): ${skippedCount}`);
    console.log(`Failed: ${debtors.length - updatedCount - skippedCount}`);
    
    // Verify the update
    console.log('\n🔍 VERIFICATION:');
    console.log('================');
    
    const debtorsWithAllocation = await Debtor.find({ allocation: { $exists: true } });
    const debtorsWithoutAllocation = await Debtor.find({ allocation: { $exists: false } });
    
    console.log(`Debtors with allocation field: ${debtorsWithAllocation.length}`);
    console.log(`Debtors without allocation field: ${debtorsWithoutAllocation.length}`);
    
    // Show some examples
    const sampleDebtors = await Debtor.find({ allocation: { $ne: null } }).limit(3);
    console.log('\n📋 SAMPLE ALLOCATION DATA:');
    console.log('==========================');
    
    sampleDebtors.forEach((debtor, index) => {
      console.log(`\n${index + 1}. Debtor: ${debtor.debtorCode}`);
      console.log(`   Allocation: ${debtor.allocation ? 'Present' : 'Null'}`);
      if (debtor.allocation && debtor.allocation.summary) {
        console.log(`   Total Allocated: $${debtor.allocation.summary.totalAllocated || 0}`);
        console.log(`   Months Covered: ${debtor.allocation.summary.monthsCovered || 0}`);
        console.log(`   Allocation Method: ${debtor.allocation.summary.allocationMethod || 'Unknown'}`);
      }
    });
    
    console.log('\n✅ Debtor allocation field update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating debtors:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the update
updateDebtorsAllocationField();
