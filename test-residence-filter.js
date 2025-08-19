const axios = require('axios');

// Test residence filtering for income statement
async function testResidenceFilter() {
  try {
    console.log('🧪 Testing Residence Filtering for Income Statement...\n');
    
    const baseUrl = 'http://localhost:5000'; // Adjust if different
    
    // Test 1: All residences (no filter)
    console.log('📊 Test 1: All Residences (no filter)');
    const allResidencesResponse = await axios.get(`${baseUrl}/api/financial-reports/income-statement`, {
      params: {
        period: '2025',
        basis: 'accrual'
      }
    });
    
    console.log('✅ All residences response:');
    console.log('  - Success:', allResidencesResponse.data.success);
    console.log('  - Transaction count:', allResidencesResponse.data.data?.transaction_count);
    console.log('  - Revenue:', allResidencesResponse.data.data?.revenue);
    console.log('  - Expenses:', allResidencesResponse.data.data?.expenses);
    console.log('');
    
    // Test 2: Specific residence (replace with actual residence ID from your database)
    console.log('📊 Test 2: Specific Residence (filtered)');
    const specificResidenceResponse = await axios.get(`${baseUrl}/api/financial-reports/income-statement`, {
      params: {
        period: '2025',
        basis: 'accrual',
        residence: '67d723cf20f89c4ae69804f3' // Replace with actual residence ID
      }
    });
    
    console.log('✅ Specific residence response:');
    console.log('  - Success:', specificResidenceResponse.data.success);
    console.log('  - Transaction count:', specificResidenceResponse.data.data?.transaction_count);
    console.log('  - Revenue:', specificResidenceResponse.data.data?.revenue);
    console.log('  - Expenses:', specificResidenceResponse.data.data?.expenses);
    console.log('');
    
    // Compare the results
    const allCount = allResidencesResponse.data.data?.transaction_count || 0;
    const specificCount = specificResidenceResponse.data.data?.transaction_count || 0;
    
    console.log('🔍 Comparison:');
    console.log(`  - All residences transactions: ${allCount}`);
    console.log(`  - Specific residence transactions: ${specificCount}`);
    console.log(`  - Are they different? ${allCount !== specificCount ? '✅ YES' : '❌ NO'}`);
    
    if (allCount === specificCount) {
      console.log('\n⚠️  WARNING: Both responses have the same transaction count!');
      console.log('   This suggests residence filtering is not working properly.');
    } else {
      console.log('\n✅ SUCCESS: Residence filtering is working correctly!');
    }
    
  } catch (error) {
    console.error('❌ Error testing residence filter:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testResidenceFilter();
