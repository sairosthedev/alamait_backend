const mongoose = require('mongoose');
require('dotenv').config();

async function checkDebtorAllocation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const Debtor = require('./src/models/Debtor');
    const Payment = require('./src/models/Payment');
    
    console.log('🔍 Checking debtor allocation fields...');
    
    // Get all debtors
    const debtors = await Debtor.find({});
    console.log(`📊 Found ${debtors.length} debtors`);
    
    debtors.forEach((debtor, index) => {
      console.log(`\n${index + 1}. Debtor: ${debtor.debtorCode}`);
      console.log(`   User ID: ${debtor.user}`);
      console.log(`   Allocation field exists: ${debtor.allocation !== undefined}`);
      console.log(`   Allocation value: ${debtor.allocation ? 'Present' : 'Null/Undefined'}`);
      
      if (debtor.allocation && typeof debtor.allocation === 'object') {
        console.log(`   Allocation type: ${typeof debtor.allocation}`);
        if (debtor.allocation.summary) {
          console.log(`   Total Allocated: $${debtor.allocation.summary.totalAllocated || 0}`);
          console.log(`   Months Covered: ${debtor.allocation.summary.monthsCovered || 0}`);
        }
      }
    });
    
    // Check payments for allocation data
    console.log('\n🔍 Checking payments for allocation data...');
    const paymentsWithAllocation = await Payment.find({ allocation: { $exists: true, $ne: null } });
    console.log(`📊 Found ${paymentsWithAllocation.length} payments with allocation data`);
    
    paymentsWithAllocation.forEach((payment, index) => {
      console.log(`\n${index + 1}. Payment: ${payment.paymentId}`);
      console.log(`   Student: ${payment.student}`);
      console.log(`   User: ${payment.user}`);
      console.log(`   Allocation: ${payment.allocation ? 'Present' : 'Null'}`);
      
      if (payment.allocation && payment.allocation.summary) {
        console.log(`   Total Allocated: $${payment.allocation.summary.totalAllocated || 0}`);
        console.log(`   Months Covered: ${payment.allocation.summary.monthsCovered || 0}`);
      }
    });
    
    // Test the updateAllocation method
    console.log('\n🧪 Testing updateAllocation method...');
    if (debtors.length > 0) {
      const testDebtor = debtors[0];
      console.log(`Testing with debtor: ${testDebtor.debtorCode}`);
      
      const testAllocation = {
        monthlyBreakdown: [],
        summary: {
          totalAllocated: 100,
          remainingBalance: 0,
          monthsCovered: 1,
          allocationMethod: 'Test Method',
          lastUpdated: new Date()
        }
      };
      
      try {
        await testDebtor.updateAllocation(testAllocation);
        console.log('✅ updateAllocation method works correctly');
        
        // Check if it was saved
        const updatedDebtor = await Debtor.findById(testDebtor._id);
        console.log(`Updated debtor allocation: ${updatedDebtor.allocation ? 'Present' : 'Null'}`);
        
      } catch (error) {
        console.error('❌ updateAllocation method failed:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking debtors:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the check
checkDebtorAllocation();
