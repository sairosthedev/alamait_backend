const mongoose = require('mongoose');
require('dotenv').config();

async function testCorrectEndpoints() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    // Import the controller methods directly
    const {
      getStudentARBalances,
      getOutstandingBalancesSummary
    } = require('./src/controllers/admin/paymentAllocationController');
    
    console.log('\n🧪 TESTING CORRECT ENDPOINTS');
    console.log('=============================');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6'; // The student ID you're trying to access
    
    // 1. Test the CORRECT endpoint for specific student
    console.log('\n1️⃣ TESTING CORRECT ENDPOINT: /api/admin/payment-allocation/student/:studentId/ar-balances');
    console.log(`Student ID: ${studentId}`);
    
    const mockReq1 = {
      params: {
        studentId: studentId
      }
    };
    
    const mockRes1 = {
      status: (code) => ({
        json: (data) => {
          console.log(`Status: ${code}`);
          console.log('Response:', JSON.stringify(data, null, 2));
        }
      })
    };
    
    await getStudentARBalances(mockReq1, mockRes1);
    
    // 2. Test the general outstanding balances endpoint (no student ID)
    console.log('\n2️⃣ TESTING GENERAL ENDPOINT: /api/admin/payment-allocation/outstanding-balances');
    
    const mockReq2 = {
      query: {
        residence: null,
        startDate: null,
        endDate: null
      }
    };
    
    const mockRes2 = {
      status: (code) => ({
        json: (data) => {
          console.log(`Status: ${code}`);
          console.log('Response:', JSON.stringify(data, null, 2));
        }
      })
    };
    
    await getOutstandingBalancesSummary(mockReq2, mockRes2);
    
    console.log('\n📋 CORRECT ENDPOINTS SUMMARY:');
    console.log('================================');
    console.log('✅ For specific student outstanding balances:');
    console.log('   GET /api/admin/payment-allocation/student/:studentId/ar-balances');
    console.log('');
    console.log('✅ For general outstanding balances summary:');
    console.log('   GET /api/admin/payment-allocation/outstanding-balances');
    console.log('');
    console.log('✅ For AR invoices:');
    console.log('   GET /api/admin/payment-allocation/ar-invoices');
    console.log('');
    console.log('✅ For students with outstanding balances:');
    console.log('   GET /api/admin/payment-allocation/students/outstanding-balances');
    console.log('');
    console.log('❌ INCORRECT (what you tried):');
    console.log('   GET /api/admin/payment-allocation/outstanding-balances/:studentId');
    console.log('   This endpoint does not exist!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testCorrectEndpoints();
