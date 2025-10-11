#!/usr/bin/env node

/**
 * Test script to verify the monthly income statement fix
 * This script tests the backend fix for proper month distribution
 */

const axios = require('axios');

async function testMonthlyIncomeStatementFix() {
    console.log('🧪 Testing Monthly Income Statement Fix...\n');
    
    try {
        // Test the monthly breakdown endpoint
        const response = await axios.get('http://localhost:5000/api/financial-reports/monthly-breakdown', {
            params: {
                period: '2025',
                basis: 'accrual'
            }
        });
        
        if (response.data.success) {
            const data = response.data.data;
            console.log('✅ API Response received successfully');
            console.log('📊 Monthly Revenue Distribution:');
            
            // Check each month for revenue
            Object.entries(data.monthly).forEach(([month, monthData]) => {
                const revenue = monthData.revenue.total;
                if (revenue > 0) {
                    console.log(`  Month ${month} (${monthData.monthName}): $${revenue.toFixed(2)}`);
                }
            });
            
            console.log('\n📈 Annual Summary:');
            console.log(`  Total Revenue: $${data.annualSummary.totalAnnualRevenue.toFixed(2)}`);
            console.log(`  Total Expenses: $${data.annualSummary.totalAnnualExpenses.toFixed(2)}`);
            console.log(`  Net Income: $${data.annualSummary.totalAnnualNetIncome.toFixed(2)}`);
            
            // Verify the fix: Check if revenue is properly distributed
            const monthsWithRevenue = Object.values(data.monthly).filter(month => month.revenue.total > 0);
            console.log(`\n🔍 Analysis:`);
            console.log(`  Months with revenue: ${monthsWithRevenue.length}`);
            
            if (monthsWithRevenue.length > 1) {
                console.log('  ✅ Revenue is properly distributed across multiple months');
            } else if (monthsWithRevenue.length === 1) {
                console.log('  ⚠️  Revenue is still consolidated into one month - fix may need more work');
            } else {
                console.log('  ❌ No revenue found - check data');
            }
            
        } else {
            console.log('❌ API returned error:', response.data.message);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testMonthlyIncomeStatementFix();
