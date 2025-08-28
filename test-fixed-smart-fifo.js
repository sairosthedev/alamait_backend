const mongoose = require('mongoose');
require('dotenv').config();

async function testFixedSmartFIFO() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    
    const studentId = '68adf1dc088169424e25c8a9'; // Cindy's ID
    
    console.log('\n🔍 Testing FIXED Smart FIFO system...');
    
    // Test the outstanding balances
    const outstandingBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);
    
    console.log('\n📊 What the FIXED Smart FIFO system now finds:');
    console.log(`Found ${outstandingBalances.length} months with outstanding balances`);
    
    outstandingBalances.forEach(month => {
      console.log(`\n  ${month.monthKey} (${month.monthName}):`);
      console.log(`    Transaction ID: ${month.transactionId}`);
      console.log(`    Date: ${month.date}`);
      console.log(`    Is Virtual Month: ${month.isVirtualMonth || false}`);
      console.log(`    Rent: $${month.rent.outstanding.toFixed(2)}`);
      console.log(`    Admin Fee: $${month.adminFee.outstanding.toFixed(2)}`);
      console.log(`    Deposit: $${month.deposit.outstanding.toFixed(2)}`);
      console.log(`    Total Outstanding: $${month.totalOutstanding.toFixed(2)}`);
    });
    
    // Now test a payment allocation
    console.log('\n🎯 Testing payment allocation with $380...');
    
    const paymentData = {
      paymentId: 'TEST-PAYMENT-001',
      studentId: studentId,
      totalAmount: 380,
      payments: [
        { type: 'rent', amount: 180 },
        { type: 'admin', amount: 20 },
        { type: 'deposit', amount: 180 }
      ],
      residence: '67d723cf20f89c4ae69804f3'
    };
    
    const allocationResult = await EnhancedPaymentAllocationService.smartFIFOAllocation(paymentData);
    
    if (allocationResult.success) {
      console.log('\n✅ Payment allocation successful!');
      console.log('📊 Allocation Results:');
      console.log(JSON.stringify(allocationResult.allocation, null, 2));
    } else {
      console.log('\n❌ Payment allocation failed:');
      console.log(allocationResult.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testFixedSmartFIFO();
