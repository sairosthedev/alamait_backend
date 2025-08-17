const axios = require('axios');

// Test the monthly financial reports
async function testMonthlyReports() {
  try {
    console.log('🧪 Testing Monthly Financial Reports...\n');
    
    const baseURL = 'http://localhost:3000/api/financial-reports';
    const period = '2025';
    
    // Test 1: Monthly Income Statement
    console.log('📊 Testing Monthly Income Statement...');
    try {
      const response = await axios.get(`${baseURL}/monthly-income-statement?period=${period}&basis=cash`);
      console.log('✅ Monthly Income Statement Response:');
      console.log('Status:', response.status);
      console.log('Data Structure:', Object.keys(response.data));
      
      if (response.data.monthly_breakdown) {
        console.log('Monthly Breakdown Keys:', Object.keys(response.data.monthly_breakdown));
        console.log('January Revenue:', response.data.monthly_breakdown.january?.total_revenue || 0);
        console.log('January Expenses:', response.data.monthly_breakdown.january?.total_expenses || 0);
      }
      
      if (response.data.yearly_totals) {
        console.log('Yearly Revenue:', response.data.yearly_totals.total_revenue || 0);
        console.log('Yearly Expenses:', response.data.yearly_totals.total_expenses || 0);
      }
    } catch (error) {
      console.log('❌ Monthly Income Statement Error:', error.response?.data || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Monthly Balance Sheet
    console.log('📊 Testing Monthly Balance Sheet...');
    try {
      const response = await axios.get(`${baseURL}/monthly-balance-sheet?period=${period}&basis=cash`);
      console.log('✅ Monthly Balance Sheet Response:');
      console.log('Status:', response.status);
      console.log('Data Structure:', Object.keys(response.data));
      
      if (response.data.monthly_breakdown) {
        console.log('Monthly Breakdown Keys:', Object.keys(response.data.monthly_breakdown));
        console.log('January Assets:', response.data.monthly_breakdown.january?.assets?.total_assets || 0);
        console.log('January Liabilities:', response.data.monthly_breakdown.january?.liabilities?.total_liabilities || 0);
      }
    } catch (error) {
      console.log('❌ Monthly Balance Sheet Error:', error.response?.data || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 3: Monthly Cash Flow
    console.log('📊 Testing Monthly Cash Flow...');
    try {
      const response = await axios.get(`${baseURL}/monthly-cash-flow?period=${period}&basis=cash`);
      console.log('✅ Monthly Cash Flow Response:');
      console.log('Status:', response.status);
      console.log('Data Structure:', Object.keys(response.data));
      
      if (response.data.monthly_breakdown) {
        console.log('Monthly Breakdown Keys:', Object.keys(response.data.monthly_breakdown));
        console.log('January Operating Cash Flow:', response.data.monthly_breakdown.january?.operating_cash_flow || 0);
        console.log('January Net Cash Flow:', response.data.monthly_breakdown.january?.net_cash_flow || 0);
      }
    } catch (error) {
      console.log('❌ Monthly Cash Flow Error:', error.response?.data || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 4: Annual Income Statement (for comparison)
    console.log('📊 Testing Annual Income Statement (for comparison)...');
    try {
      const response = await axios.get(`${baseURL}/income-statement?period=${period}&basis=cash`);
      console.log('✅ Annual Income Statement Response:');
      console.log('Status:', response.status);
      console.log('Data Structure:', Object.keys(response.data));
      
      if (response.data.revenue) {
        console.log('Total Revenue:', response.data.revenue.total_revenue || 0);
        console.log('Total Expenses:', response.data.expenses.total_expenses || 0);
        console.log('Net Income:', response.data.net_income || 0);
      }
    } catch (error) {
      console.log('❌ Annual Income Statement Error:', error.response?.data || error.message);
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log('===========');
    console.log('✅ Monthly reports should now show data for each month');
    console.log('✅ January should show: Revenue $300, Expenses $150');
    console.log('✅ February should show: Revenue $300, Expenses $80');
    console.log('✅ March should show: Revenue $300, Expenses $120');
    console.log('✅ Other months should show: Revenue $300, Expenses $0');
    console.log('✅ Yearly totals should match the sum of all months');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testMonthlyReports(); 