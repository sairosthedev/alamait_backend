const mongoose = require('mongoose');
require('dotenv').config();

async function testApiEndpoints() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    // Import the controller methods directly
    const {
      getOutstandingBalancesSummary,
      getARInvoices,
      getStudentsWithOutstandingBalances
    } = require('./src/controllers/admin/paymentAllocationController');
    
    console.log('\n🧪 TESTING API ENDPOINTS');
    console.log('=========================');
    
    // 1. Test outstanding balances summary endpoint
    console.log('\n1️⃣ TESTING /api/admin/payment-allocation/outstanding-balances:');
    
    const mockReq1 = {
      query: {
        residence: null,
        startDate: null,
        endDate: null
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
    
    await getOutstandingBalancesSummary(mockReq1, mockRes1);
    
    // 2. Test AR invoices endpoint
    console.log('\n2️⃣ TESTING /api/admin/payment-allocation/ar-invoices:');
    
    const mockReq2 = {
      query: {
        studentId: null,
        residence: null,
        startDate: null,
        endDate: null,
        limit: 5,
        page: 1
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
    
    await getARInvoices(mockReq2, mockRes2);
    
    // 3. Test students with outstanding balances endpoint
    console.log('\n3️⃣ TESTING /api/admin/payment-allocation/students/outstanding-balances:');
    
    const mockReq3 = {
      query: {
        residence: null,
        limit: 10,
        sortBy: 'totalBalance',
        sortOrder: 'desc'
      }
    };
    
    const mockRes3 = {
      status: (code) => ({
        json: (data) => {
          console.log(`Status: ${code}`);
          console.log('Response:', JSON.stringify(data, null, 2));
        }
      })
    };
    
    await getStudentsWithOutstandingBalances(mockReq3, mockRes3);
    
    console.log('\n✅ All API endpoints tested successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testApiEndpoints();
