#!/usr/bin/env node

/**
 * Compare local vs production data to identify exact differences
 */

const axios = require('axios');

async function compareEnvironments() {
    console.log('🔍 Comparing Local vs Production Data...\n');
    
    let localData = null;
    let prodData = null;
    
    try {
        // Get local data
        console.log('📊 Fetching LOCAL data...');
        const localResponse = await axios.get('http://localhost:5000/api/financial-reports/monthly-breakdown', {
            params: { period: '2025', basis: 'accrual' }
        });
        localData = localResponse.data.data;
        console.log('✅ Local data retrieved');
    } catch (error) {
        console.log('❌ Local API not available:', error.message);
    }
    
    try {
        // Get production data
        console.log('📊 Fetching PRODUCTION data...');
        const prodResponse = await axios.get('https://alamait-backend.onrender.com/api/financial-reports/monthly-breakdown', {
            params: { period: '2025', basis: 'accrual' }
        });
        prodData = prodResponse.data.data;
        console.log('✅ Production data retrieved');
    } catch (error) {
        console.log('❌ Production API error:', error.message);
    }
    
    if (localData && prodData) {
        console.log('\n📈 DETAILED COMPARISON:');
        console.log('=' .repeat(60));
        
        // Compare each month
        for (let month = 1; month <= 12; month++) {
            const localMonth = localData.monthly[month];
            const prodMonth = prodData.monthly[month];
            
            if (localMonth.revenue.total > 0 || prodMonth.revenue.total > 0) {
                console.log(`\n📅 Month ${month} (${localMonth.monthName}):`);
                console.log(`  Local Revenue:   $${localMonth.revenue.total.toFixed(2)}`);
                console.log(`  Prod Revenue:    $${prodMonth.revenue.total.toFixed(2)}`);
                console.log(`  Difference:      $${(localMonth.revenue.total - prodMonth.revenue.total).toFixed(2)}`);
                
                console.log(`  Local Expenses:  $${localMonth.expenses.total.toFixed(2)}`);
                console.log(`  Prod Expenses:   $${prodMonth.expenses.total.toFixed(2)}`);
                console.log(`  Difference:      $${(localMonth.expenses.total - prodMonth.expenses.total).toFixed(2)}`);
                
                console.log(`  Local Net:       $${localMonth.netIncome.toFixed(2)}`);
                console.log(`  Prod Net:        $${prodMonth.netIncome.toFixed(2)}`);
                console.log(`  Difference:      $${(localMonth.netIncome - prodMonth.netIncome).toFixed(2)}`);
                
                // Check if there are differences
                const revenueDiff = Math.abs(localMonth.revenue.total - prodMonth.revenue.total);
                const expenseDiff = Math.abs(localMonth.expenses.total - prodMonth.expenses.total);
                
                if (revenueDiff > 0.01 || expenseDiff > 0.01) {
                    console.log(`  ⚠️  SIGNIFICANT DIFFERENCES FOUND!`);
                }
            }
        }
        
        console.log('\n💰 ANNUAL TOTALS:');
        console.log(`  Local Total Revenue:  $${localData.annualSummary.totalAnnualRevenue.toFixed(2)}`);
        console.log(`  Prod Total Revenue:   $${prodData.annualSummary.totalAnnualRevenue.toFixed(2)}`);
        console.log(`  Difference:           $${(localData.annualSummary.totalAnnualRevenue - prodData.annualSummary.totalAnnualRevenue).toFixed(2)}`);
        
        console.log(`  Local Total Expenses: $${localData.annualSummary.totalAnnualExpenses.toFixed(2)}`);
        console.log(`  Prod Total Expenses:  $${prodData.annualSummary.totalAnnualExpenses.toFixed(2)}`);
        console.log(`  Difference:           $${(localData.annualSummary.totalAnnualExpenses - prodData.annualSummary.totalAnnualExpenses).toFixed(2)}`);
        
        console.log(`  Local Net Income:     $${localData.annualSummary.totalAnnualNetIncome.toFixed(2)}`);
        console.log(`  Prod Net Income:      $${prodData.annualSummary.totalAnnualNetIncome.toFixed(2)}`);
        console.log(`  Difference:           $${(localData.annualSummary.totalAnnualNetIncome - prodData.annualSummary.totalAnnualNetIncome).toFixed(2)}`);
        
        // Analysis
        console.log('\n🔍 ANALYSIS:');
        const totalRevenueDiff = Math.abs(localData.annualSummary.totalAnnualRevenue - prodData.annualSummary.totalAnnualRevenue);
        const totalExpenseDiff = Math.abs(localData.annualSummary.totalAnnualExpenses - prodData.annualSummary.totalAnnualExpenses);
        
        if (totalRevenueDiff < 0.01 && totalExpenseDiff < 0.01) {
            console.log('✅ Annual totals match - differences are in month distribution only');
            console.log('💡 This suggests different transaction data or timing between environments');
        } else {
            console.log('⚠️  Annual totals differ - there are different transactions in the databases');
        }
        
    } else {
        console.log('❌ Cannot compare - missing data from one or both environments');
    }
}

// Run the comparison
compareEnvironments();
