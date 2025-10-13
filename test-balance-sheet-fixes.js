/**
 * Test Script for Balance Sheet Fixes
 * 
 * This script tests the fixed simple balance sheet API to ensure:
 * 1. No NaN values in response
 * 2. Proper number formatting
 * 3. Correct balance calculations
 * 4. Proper retained earnings handling
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_ENDPOINT = '/api/financial-reports/simple-monthly-balance-sheet';

async function testBalanceSheetFixes() {
  try {
    console.log('🔧 Testing Balance Sheet Fixes...');
    console.log(`📡 Endpoint: ${BASE_URL}${API_ENDPOINT}`);
    
    // Test with 2025 data
    const response = await axios.get(`${BASE_URL}${API_ENDPOINT}`, {
      params: {
        period: 2025,
        type: 'cumulative'
      },
      timeout: 120000
    });
    
    console.log('✅ API Response received successfully!');
    
    if (response.data && response.data.success) {
      const data = response.data.data;
      
      // Test 1: Check for NaN values
      console.log('\n🧪 Test 1: Checking for NaN values...');
      let hasNaN = false;
      
      Object.keys(data.monthly).forEach(month => {
        const monthData = data.monthly[month];
        
        // Check equity total
        if (isNaN(monthData.equity.total) || monthData.equity.total === '0[object Promise]') {
          console.log(`❌ Month ${month}: Equity total is NaN or Promise object`);
          hasNaN = true;
        }
        
        // Check retained earnings amount
        if (typeof monthData.equity.retainedEarnings.amount === 'object' || isNaN(monthData.equity.retainedEarnings.amount)) {
          console.log(`❌ Month ${month}: Retained earnings amount is not a number`);
          hasNaN = true;
        }
        
        // Check balance check
        if (monthData.balanceCheck === 'Off by $NaN') {
          console.log(`❌ Month ${month}: Balance check shows NaN`);
          hasNaN = true;
        }
      });
      
      if (!hasNaN) {
        console.log('✅ No NaN values found in response');
      }
      
      // Test 2: Check data types
      console.log('\n🧪 Test 2: Checking data types...');
      const sampleMonth = data.monthly[1]; // January
      
      console.log(`Equity total type: ${typeof sampleMonth.equity.total}`);
      console.log(`Retained earnings amount type: ${typeof sampleMonth.equity.retainedEarnings.amount}`);
      console.log(`Balance check: ${sampleMonth.balanceCheck}`);
      
      // Test 3: Check annual summary
      console.log('\n🧪 Test 3: Checking annual summary...');
      console.log(`Annual assets: ${data.annualSummary.totalAnnualAssets} (type: ${typeof data.annualSummary.totalAnnualAssets})`);
      console.log(`Annual liabilities: ${data.annualSummary.totalAnnualLiabilities} (type: ${typeof data.annualSummary.totalAnnualLiabilities})`);
      console.log(`Annual equity: ${data.annualSummary.totalAnnualEquity} (type: ${typeof data.annualSummary.totalAnnualEquity})`);
      
      // Test 4: Check if values are proper numbers
      console.log('\n🧪 Test 4: Checking if values are proper numbers...');
      const isAssetsNumber = typeof data.annualSummary.totalAnnualAssets === 'number' && !isNaN(data.annualSummary.totalAnnualAssets);
      const isLiabilitiesNumber = typeof data.annualSummary.totalAnnualLiabilities === 'number' && !isNaN(data.annualSummary.totalAnnualLiabilities);
      const isEquityNumber = typeof data.annualSummary.totalAnnualEquity === 'number' && !isNaN(data.annualSummary.totalAnnualEquity);
      
      console.log(`Assets is number: ${isAssetsNumber}`);
      console.log(`Liabilities is number: ${isLiabilitiesNumber}`);
      console.log(`Equity is number: ${isEquityNumber}`);
      
      if (isAssetsNumber && isLiabilitiesNumber && isEquityNumber) {
        console.log('✅ All annual summary values are proper numbers');
      } else {
        console.log('❌ Some annual summary values are not proper numbers');
      }
      
      // Test 5: Check balance equation
      console.log('\n🧪 Test 5: Checking balance equation...');
      const totalAssets = parseFloat(data.annualSummary.totalAnnualAssets) || 0;
      const totalLiabilities = parseFloat(data.annualSummary.totalAnnualLiabilities) || 0;
      const totalEquity = parseFloat(data.annualSummary.totalAnnualEquity) || 0;
      
      const balanceDifference = Math.abs(totalAssets - (totalLiabilities + totalEquity));
      console.log(`Assets: $${totalAssets}`);
      console.log(`Liabilities: $${totalLiabilities}`);
      console.log(`Equity: $${totalEquity}`);
      console.log(`Liabilities + Equity: $${totalLiabilities + totalEquity}`);
      console.log(`Difference: $${balanceDifference}`);
      
      if (balanceDifference < 0.01) {
        console.log('✅ Balance equation is correct (Assets = Liabilities + Equity)');
      } else {
        console.log('❌ Balance equation is incorrect');
      }
      
      // Test 6: Check performance metrics
      console.log('\n🧪 Test 6: Checking performance metrics...');
      if (data.performance) {
        console.log(`Generation time: ${data.performance.generationTime}s`);
        console.log(`Service: ${data.performance.service}`);
        console.log(`Type: ${data.performance.type}`);
        console.log('✅ Performance metrics are present');
      } else {
        console.log('❌ Performance metrics are missing');
      }
      
    } else {
      console.log('❌ Response structure is incorrect');
    }
    
    console.log('\n🎉 Balance sheet fixes test completed!');
    
  } catch (error) {
    console.error('❌ Error testing balance sheet fixes:', error.message);
    
    if (error.response) {
      console.error(`📊 Status: ${error.response.status}`);
      console.error(`📋 Response:`, error.response.data);
    }
  }
}

// Run the test
testBalanceSheetFixes().catch(console.error);
