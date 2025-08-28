const mongoose = require('mongoose');
require('dotenv').config();

async function testUpdatedAPI() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    // Import the controller method directly
    const { getStudentARBalances } = require('./src/controllers/admin/paymentAllocationController');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6';
    
    console.log(`\n🧪 TESTING UPDATED API ENDPOINT`);
    console.log('================================');
    console.log(`Student ID: ${studentId}`);
    
    const mockReq = {
      params: {
        studentId: studentId
      }
    };
    
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`Status: ${code}`);
          console.log('Response:', JSON.stringify(data, null, 2));
          
          // Verify the response
          if (data.success && data.data) {
            console.log('\n✅ VERIFICATION:');
            console.log(`Total Balance: $${data.data.totalBalance.toFixed(2)}`);
            console.log(`Months with Balance: ${data.data.summary.monthsWithBalance}`);
            console.log(`Oldest Balance: ${data.data.summary.oldestBalance}`);
            console.log(`Newest Balance: ${data.data.summary.newestBalance}`);
            
            console.log('\n📅 Monthly Breakdown:');
            data.data.monthlyBalances.forEach((month, index) => {
              console.log(`${index + 1}. ${month.monthKey} (${month.monthName}): $${month.balance.toFixed(2)}`);
            });
            
            // Check if we have all expected months
            const expectedMonths = ['2025-06', '2025-07', '2025-08'];
            const foundMonths = data.data.monthlyBalances.map(m => m.monthKey);
            
            console.log('\n🔍 EXPECTED vs FOUND:');
            expectedMonths.forEach(month => {
              const found = foundMonths.includes(month);
              console.log(`${found ? '✅' : '❌'} ${month}`);
            });
            
            if (foundMonths.length === expectedMonths.length) {
              console.log('\n🎉 SUCCESS: All expected months are now included!');
            } else {
              console.log('\n⚠️ WARNING: Some months are still missing');
            }
          }
        }
      })
    };
    
    await getStudentARBalances(mockReq, mockRes);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testUpdatedAPI();
