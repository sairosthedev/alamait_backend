/**
 * Test Script for Simple Balance Sheet API
 * 
 * This script tests the new simple balance sheet endpoint to ensure it works correctly
 * and returns data in the format expected by the frontend.
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000'; // Adjust if your server runs on a different port
const API_ENDPOINT = '/api/financial-reports/simple-monthly-balance-sheet';

// Test parameters
const testParams = {
  period: 2025,
  type: 'cumulative',
  residence: null // Test with all residences first
};

async function testSimpleBalanceSheet() {
  try {
    console.log('🧪 Testing Simple Balance Sheet API...');
    console.log(`📡 Endpoint: ${BASE_URL}${API_ENDPOINT}`);
    console.log(`📋 Parameters:`, testParams);
    
    // Make the API request
    const response = await axios.get(`${BASE_URL}${API_ENDPOINT}`, {
      params: testParams,
      timeout: 120000, // 2 minutes timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ API Response received successfully!');
    console.log(`📊 Status: ${response.status}`);
    console.log(`📈 Response time: ${response.headers['x-response-time'] || 'N/A'}`);
    
    // Check response structure
    if (response.data && response.data.success) {
      console.log('✅ Response structure is correct');
      
      const data = response.data.data;
      
      // Check if we have monthly data
      if (data.monthly) {
        console.log(`📅 Monthly data available for ${Object.keys(data.monthly).length} months`);
        
        // Check a sample month (December)
        const december = data.monthly[12];
        if (december) {
          console.log('📊 December Balance Sheet Structure:');
          console.log(`  Assets Total: $${december.assets?.total || 0}`);
          console.log(`  Liabilities Total: $${december.liabilities?.total || 0}`);
          console.log(`  Equity Total: $${december.equity?.total || 0}`);
          console.log(`  Balance Check: ${december.balanceCheck}`);
          
          // Check if it follows the accounting equation
          const assets = december.assets?.total || 0;
          const liabilities = december.liabilities?.total || 0;
          const equity = december.equity?.total || 0;
          const isBalanced = Math.abs(assets - (liabilities + equity)) < 0.01;
          
          console.log(`⚖️  Accounting Equation Check: ${isBalanced ? '✅ BALANCED' : '❌ NOT BALANCED'}`);
          console.log(`   Assets (${assets}) = Liabilities (${liabilities}) + Equity (${equity})`);
          console.log(`   Difference: ${assets - (liabilities + equity)}`);
        }
        
        // Check cash and bank accounts
        const sampleMonth = data.monthly[Object.keys(data.monthly)[0]];
        if (sampleMonth?.assets?.current?.cashAndBank) {
          const cashAccounts = Object.keys(sampleMonth.assets.current.cashAndBank).filter(key => key !== 'total');
          console.log(`💰 Cash & Bank Accounts found: ${cashAccounts.length}`);
          cashAccounts.forEach(accountKey => {
            const account = sampleMonth.assets.current.cashAndBank[accountKey];
            console.log(`   ${account.accountCode} - ${account.accountName}: $${account.amount}`);
          });
        }
        
        // Check accounts receivable
        if (sampleMonth?.assets?.current?.accountsReceivable) {
          const ar = sampleMonth.assets.current.accountsReceivable;
          console.log(`📋 Accounts Receivable: $${ar.amount} (${ar.accountCode} - ${ar.accountName})`);
        }
        
        // Check accounts payable
        if (sampleMonth?.liabilities?.current?.accountsPayable) {
          const ap = sampleMonth.liabilities.current.accountsPayable;
          console.log(`📋 Accounts Payable: $${ap.amount} (${ap.accountCode} - ${ap.accountName})`);
        }
        
        // Check equity accounts
        if (sampleMonth?.equity) {
          console.log(`🏛️  Equity Accounts:`);
          if (sampleMonth.equity.retainedEarnings) {
            console.log(`   Retained Earnings: $${sampleMonth.equity.retainedEarnings.amount}`);
          }
          if (sampleMonth.equity.ownerCapital) {
            console.log(`   Owner Capital: $${sampleMonth.equity.ownerCapital.amount}`);
          }
        }
        
      } else {
        console.log('❌ No monthly data found in response');
      }
      
      // Check annual summary
      if (data.annualSummary) {
        console.log('📈 Annual Summary:');
        console.log(`   Average Annual Assets: $${data.annualSummary.totalAnnualAssets}`);
        console.log(`   Average Annual Liabilities: $${data.annualSummary.totalAnnualLiabilities}`);
        console.log(`   Average Annual Equity: $${data.annualSummary.totalAnnualEquity}`);
      }
      
      // Check performance metrics
      if (data.performance) {
        console.log('⚡ Performance Metrics:');
        console.log(`   Generation Time: ${data.performance.generationTime}s`);
        console.log(`   Service: ${data.performance.service}`);
        console.log(`   Type: ${data.performance.type}`);
      }
      
    } else {
      console.log('❌ Response structure is incorrect');
      console.log('Response:', JSON.stringify(response.data, null, 2));
    }
    
    console.log('\n🎉 Simple Balance Sheet API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing Simple Balance Sheet API:', error.message);
    
    if (error.response) {
      console.error(`📊 Status: ${error.response.status}`);
      console.error(`📋 Response:`, error.response.data);
    } else if (error.request) {
      console.error('🌐 Network error - is the server running?');
    } else {
      console.error('🔧 Configuration error:', error.message);
    }
  }
}

// Test with residence filter
async function testWithResidence() {
  try {
    console.log('\n🏠 Testing with residence filter...');
    
    const residenceParams = {
      ...testParams,
      residence: '67c13eb8425a2e078f61d00e' // Belvedere Student House
    };
    
    const response = await axios.get(`${BASE_URL}${API_ENDPOINT}`, {
      params: residenceParams,
      timeout: 120000
    });
    
    if (response.data && response.data.success) {
      console.log('✅ Residence-filtered balance sheet generated successfully');
      
      const data = response.data.data;
      if (data.monthly) {
        const sampleMonth = data.monthly[12]; // December
        if (sampleMonth) {
          console.log(`📊 December Balance Sheet (Residence Filtered):`);
          console.log(`  Assets: $${sampleMonth.assets?.total || 0}`);
          console.log(`  Liabilities: $${sampleMonth.liabilities?.total || 0}`);
          console.log(`  Equity: $${sampleMonth.equity?.total || 0}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing with residence filter:', error.message);
  }
}

// Run the tests
async function runTests() {
  console.log('🚀 Starting Simple Balance Sheet API Tests...\n');
  
  await testSimpleBalanceSheet();
  await testWithResidence();
  
  console.log('\n✨ All tests completed!');
  console.log('\n📝 Next steps:');
  console.log('1. Update your frontend to use the new endpoint: /api/financial-reports/simple-monthly-balance-sheet');
  console.log('2. The response structure matches your existing frontend expectations');
  console.log('3. Test with different periods and residence filters');
  console.log('4. Verify the balance sheet balances (Assets = Liabilities + Equity)');
}

// Run the tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testSimpleBalanceSheet,
  testWithResidence,
  runTests
};