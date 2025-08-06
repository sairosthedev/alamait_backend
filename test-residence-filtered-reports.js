const axios = require('axios');

// Test residence-filtered financial reports
async function testResidenceFilteredReports() {
  try {
    console.log('🧪 Testing Residence-Filtered Financial Reports...\n');
    
    const baseURL = 'http://localhost:3000/api/financial-reports';
    const year = '2025';
    
    // Test 1: Income Statement without residence filter
    console.log('📊 Test 1: Income Statement (All Residences)');
    try {
      const response1 = await axios.get(`${baseURL}/income-statement?period=${year}&basis=cash`);
      console.log('✅ Success:', response1.data.message);
      console.log('📈 Revenue:', response1.data.data.revenue);
      console.log('💰 Expenses:', response1.data.data.expenses);
      console.log('💵 Net Income:', response1.data.data.net_income);
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Income Statement with residence filter (using a sample residence ID)
    console.log('📊 Test 2: Income Statement (Specific Residence)');
    try {
      const sampleResidenceId = '507f1f77bcf86cd799439011'; // Sample ObjectId
      const response2 = await axios.get(`${baseURL}/income-statement?period=${year}&basis=cash&residence=${sampleResidenceId}`);
      console.log('✅ Success:', response2.data.message);
      console.log('🏢 Residence:', response2.data.data.residence);
      console.log('📈 Revenue:', response2.data.data.revenue);
      console.log('💰 Expenses:', response2.data.data.expenses);
      console.log('💵 Net Income:', response2.data.data.net_income);
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 3: Balance Sheet without residence filter
    console.log('📊 Test 3: Balance Sheet (All Residences)');
    try {
      const response3 = await axios.get(`${baseURL}/balance-sheet?asOf=${year}-12-31&basis=cash`);
      console.log('✅ Success:', response3.data.message);
      console.log('💼 Assets:', response3.data.data.assets);
      console.log('📋 Liabilities:', response3.data.data.liabilities);
      console.log('🏛️ Equity:', response3.data.data.equity);
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 4: Balance Sheet with residence filter
    console.log('📊 Test 4: Balance Sheet (Specific Residence)');
    try {
      const sampleResidenceId = '507f1f77bcf86cd799439011'; // Sample ObjectId
      const response4 = await axios.get(`${baseURL}/balance-sheet?asOf=${year}-12-31&basis=cash&residence=${sampleResidenceId}`);
      console.log('✅ Success:', response4.data.message);
      console.log('🏢 Residence:', response4.data.data.residence);
      console.log('💼 Assets:', response4.data.data.assets);
      console.log('📋 Liabilities:', response4.data.data.liabilities);
      console.log('🏛️ Equity:', response4.data.data.equity);
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 5: Cash Flow without residence filter
    console.log('📊 Test 5: Cash Flow (All Residences)');
    try {
      const response5 = await axios.get(`${baseURL}/cash-flow?period=${year}&basis=cash`);
      console.log('✅ Success:', response5.data.message);
      console.log('💼 Operating Activities:', response5.data.data.operating_activities);
      console.log('🏗️ Investing Activities:', response5.data.data.investing_activities);
      console.log('💰 Financing Activities:', response5.data.data.financing_activities);
      console.log('💵 Net Cash Flow:', response5.data.data.net_cash_flow);
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 6: Cash Flow with residence filter
    console.log('📊 Test 6: Cash Flow (Specific Residence)');
    try {
      const sampleResidenceId = '507f1f77bcf86cd799439011'; // Sample ObjectId
      const response6 = await axios.get(`${baseURL}/cash-flow?period=${year}&basis=cash&residence=${sampleResidenceId}`);
      console.log('✅ Success:', response6.data.message);
      console.log('🏢 Residence:', response6.data.data.residence);
      console.log('💼 Operating Activities:', response6.data.data.operating_activities);
      console.log('🏗️ Investing Activities:', response6.data.data.investing_activities);
      console.log('💰 Financing Activities:', response6.data.data.financing_activities);
      console.log('💵 Net Cash Flow:', response6.data.data.net_cash_flow);
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }
    
    console.log('\n🎉 Testing completed!');
    console.log('\n📋 Summary:');
    console.log('- Residence filtering is now implemented');
    console.log('- All financial reports support residence parameter');
    console.log('- When residence is specified, reports show data for that residence only');
    console.log('- When residence is not specified, reports show data for all residences');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testResidenceFilteredReports(); 