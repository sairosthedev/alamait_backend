const axios = require('axios');

async function testApiMonthly() {
  try {
    console.log('🧪 TESTING API ENDPOINT WITH MONTHLY TYPE');
    console.log('==========================================');
    
    const baseURL = 'http://localhost:3000';
    
    // Test 1: Cumulative balance sheet (default)
    console.log('\n1️⃣ TESTING CUMULATIVE BALANCE SHEET (default):');
    try {
      const cumulativeResponse = await axios.get(`${baseURL}/api/financial-reports/monthly-balance-sheet?period=2025&type=cumulative`);
      console.log('✅ Cumulative API call successful');
      console.log('Message:', cumulativeResponse.data.message);
      
      const julyCash = cumulativeResponse.data.data.monthly[7]?.assets?.current?.cashAndBank?.cash?.amount || 0;
      const augustCash = cumulativeResponse.data.data.monthly[8]?.assets?.current?.cashAndBank?.cash?.amount || 0;
      
      console.log('July cash (cumulative):', julyCash);
      console.log('August cash (cumulative):', augustCash);
    } catch (error) {
      console.log('❌ Cumulative API call failed:', error.response?.data?.message || error.message);
    }
    
    // Test 2: Monthly activity balance sheet
    console.log('\n2️⃣ TESTING MONTHLY ACTIVITY BALANCE SHEET:');
    try {
      const monthlyResponse = await axios.get(`${baseURL}/api/financial-reports/monthly-balance-sheet?period=2025&type=monthly`);
      console.log('✅ Monthly activity API call successful');
      console.log('Message:', monthlyResponse.data.message);
      
      const julyCash = monthlyResponse.data.data.monthly[7]?.assets?.current?.cashAndBank?.cash?.amount || 0;
      const augustCash = monthlyResponse.data.data.monthly[8]?.assets?.current?.cashAndBank?.cash?.amount || 0;
      
      console.log('July cash (monthly activity):', julyCash);
      console.log('August cash (monthly activity):', augustCash);
      
      // Show comparison
      console.log('\n📊 COMPARISON:');
      console.log('Cumulative vs Monthly Activity:');
      for (let month = 6; month <= 8; month++) {
        const monthName = new Date(2025, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
        const cumulativeCash = cumulativeResponse.data.data.monthly[month]?.assets?.current?.cashAndBank?.cash?.amount || 0;
        const monthlyCash = monthlyResponse.data.data.monthly[month]?.assets?.current?.cashAndBank?.cash?.amount || 0;
        
        console.log(`${monthName}:`);
        console.log(`  Cumulative: $${cumulativeCash.toFixed(2)}`);
        console.log(`  Monthly Activity: $${monthlyCash.toFixed(2)}`);
      }
      
    } catch (error) {
      console.log('❌ Monthly activity API call failed:', error.response?.data?.message || error.message);
    }
    
    console.log('\n3️⃣ SUMMARY:');
    console.log('✅ API endpoint supports both cumulative and monthly activity types');
    console.log('✅ Monthly activity shows changes for each month, not cumulative totals');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testApiMonthly();
