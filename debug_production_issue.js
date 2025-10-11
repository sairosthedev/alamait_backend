#!/usr/bin/env node

/**
 * Debug script to compare local vs production data
 * This will help identify why local works but production doesn't
 */

const axios = require('axios');

async function debugProductionIssue() {
    console.log('🔍 Debugging Production vs Local Issue...\n');
    
    try {
        // Test local endpoint
        console.log('📊 Testing LOCAL endpoint...');
        const localResponse = await axios.get('http://localhost:5000/api/financial-reports/monthly-breakdown', {
            params: { period: '2025', basis: 'accrual' }
        });
        
        if (localResponse.data.success) {
            console.log('✅ Local API working');
            const localData = localResponse.data.data;
            
            // Check local revenue distribution
            console.log('\n📈 Local Revenue Distribution:');
            Object.entries(localData.monthly).forEach(([month, data]) => {
                if (data.revenue.total > 0) {
                    console.log(`  Month ${month} (${data.monthName}): $${data.revenue.total.toFixed(2)}`);
                }
            });
            
            console.log(`\n💰 Local Annual Total: $${localData.annualSummary.totalAnnualRevenue.toFixed(2)}`);
        }
        
    } catch (localError) {
        console.log('❌ Local API not available:', localError.message);
    }
    
    try {
        // Test production endpoint
        console.log('\n📊 Testing PRODUCTION endpoint...');
        const prodResponse = await axios.get('https://alamait-backend.onrender.com/api/financial-reports/monthly-breakdown', {
            params: { period: '2025', basis: 'accrual' }
        });
        
        if (prodResponse.data.success) {
            console.log('✅ Production API working');
            const prodData = prodResponse.data.data;
            
            // Check production revenue distribution
            console.log('\n📈 Production Revenue Distribution:');
            Object.entries(prodData.monthly).forEach(([month, data]) => {
                if (data.revenue.total > 0) {
                    console.log(`  Month ${month} (${data.monthName}): $${data.revenue.total.toFixed(2)}`);
                }
            });
            
            console.log(`\n💰 Production Annual Total: $${prodData.annualSummary.totalAnnualRevenue.toFixed(2)}`);
            
            // Compare the data
            console.log('\n🔍 Comparison:');
            const localMonthsWithRevenue = localResponse?.data?.data ? 
                Object.entries(localResponse.data.data.monthly).filter(([_, data]) => data.revenue.total > 0).length : 0;
            const prodMonthsWithRevenue = Object.entries(prodData.monthly).filter(([_, data]) => data.revenue.total > 0).length;
            
            console.log(`  Local months with revenue: ${localMonthsWithRevenue}`);
            console.log(`  Production months with revenue: ${prodMonthsWithRevenue}`);
            
            if (prodMonthsWithRevenue === 1) {
                console.log('  ⚠️  Production still consolidating revenue into one month');
                console.log('  🔧 The fix needs to be deployed to production');
            } else if (prodMonthsWithRevenue > 1) {
                console.log('  ✅ Production revenue is properly distributed');
            }
            
        }
        
    } catch (prodError) {
        console.log('❌ Production API error:', prodError.message);
        if (prodError.response) {
            console.log('Response status:', prodError.response.status);
            console.log('Response data:', prodError.response.data);
        }
    }
    
    console.log('\n🎯 Next Steps:');
    console.log('1. If production still consolidates revenue, the fix needs to be deployed');
    console.log('2. If production API is down, check the deployment status');
    console.log('3. If data is different, check database synchronization');
}

// Run the debug
debugProductionIssue();
