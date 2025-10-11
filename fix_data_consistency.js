#!/usr/bin/env node

/**
 * Script to identify and fix data consistency issues between local and live environments
 */

const axios = require('axios');

async function fixDataConsistency() {
    console.log('🔧 Fixing Data Consistency Between Local and Live...\n');
    
    try {
        // Test both environments
        console.log('📊 Testing LOCAL environment...');
        const localResponse = await axios.get('http://localhost:5000/api/financial-reports/monthly-breakdown', {
            params: { period: '2025', basis: 'accrual' }
        });
        
        console.log('📊 Testing LIVE environment...');
        const liveResponse = await axios.get('https://alamait-backend.onrender.com/api/financial-reports/monthly-breakdown', {
            params: { period: '2025', basis: 'accrual' }
        });
        
        if (localResponse.data.success && liveResponse.data.success) {
            const localData = localResponse.data.data;
            const liveData = liveResponse.data.data;
            
            console.log('\n🔍 DETAILED COMPARISON:');
            console.log('=' .repeat(80));
            
            // Compare each month
            for (let month = 1; month <= 12; month++) {
                const localMonth = localData.monthly[month];
                const liveMonth = liveData.monthly[month];
                
                if (localMonth.revenue.total > 0 || liveMonth.revenue.total > 0) {
                    console.log(`\n📅 Month ${month} (${localMonth.monthName}):`);
                    
                    // Revenue comparison
                    const localRental = localMonth.revenue.rentalIncome;
                    const liveRental = liveMonth.revenue.rentalIncome;
                    const localAdmin = localMonth.revenue.adminIncome;
                    const liveAdmin = liveMonth.revenue.adminIncome;
                    
                    console.log(`  Rental Income:`);
                    console.log(`    Local:  $${localRental.toFixed(2)}`);
                    console.log(`    Live:   $${liveRental.toFixed(2)}`);
                    console.log(`    Diff:   $${(localRental - liveRental).toFixed(2)}`);
                    
                    console.log(`  Admin Income:`);
                    console.log(`    Local:  $${localAdmin.toFixed(2)}`);
                    console.log(`    Live:   $${liveAdmin.toFixed(2)}`);
                    console.log(`    Diff:   $${(localAdmin - liveAdmin).toFixed(2)}`);
                    
                    // Check if there are significant differences
                    const rentalDiff = Math.abs(localRental - liveRental);
                    const adminDiff = Math.abs(localAdmin - liveAdmin);
                    
                    if (rentalDiff > 0.01 || adminDiff > 0.01) {
                        console.log(`  ⚠️  SIGNIFICANT DIFFERENCES FOUND!`);
                        
                        if (rentalDiff > 0.01) {
                            console.log(`    🔴 Rental income differs by $${rentalDiff.toFixed(2)}`);
                        }
                        if (adminDiff > 0.01) {
                            console.log(`    🔴 Admin income differs by $${adminDiff.toFixed(2)}`);
                        }
                    } else {
                        console.log(`  ✅ Data matches perfectly`);
                    }
                }
            }
            
            // Annual totals comparison
            console.log('\n💰 ANNUAL TOTALS:');
            console.log(`  Local Total Revenue:  $${localData.annualSummary.totalAnnualRevenue.toFixed(2)}`);
            console.log(`  Live Total Revenue:   $${liveData.annualSummary.totalAnnualRevenue.toFixed(2)}`);
            console.log(`  Difference:           $${(localData.annualSummary.totalAnnualRevenue - liveData.annualSummary.totalAnnualRevenue).toFixed(2)}`);
            
            // Analysis and recommendations
            console.log('\n🎯 ANALYSIS & RECOMMENDATIONS:');
            
            const totalRevenueDiff = Math.abs(localData.annualSummary.totalAnnualRevenue - liveData.annualSummary.totalAnnualRevenue);
            
            if (totalRevenueDiff < 0.01) {
                console.log('✅ Annual totals match - differences are in month distribution only');
                console.log('💡 This suggests different transaction processing order or timing');
                console.log('🔧 SOLUTION: The sorting fix should resolve this');
            } else {
                console.log('⚠️  Annual totals differ - there are different transactions in the databases');
                console.log('💡 This suggests database synchronization issues');
                console.log('🔧 SOLUTION: Need to sync transaction data between environments');
            }
            
            console.log('\n🚀 NEXT STEPS:');
            console.log('1. Deploy the sorting fix to ensure consistent processing order');
            console.log('2. Check production logs for transaction ID differences');
            console.log('3. If issues persist, sync database data between environments');
            
        } else {
            console.log('❌ One or both APIs returned errors');
            if (!localResponse.data.success) {
                console.log('Local error:', localResponse.data.message);
            }
            if (!liveResponse.data.success) {
                console.log('Live error:', liveResponse.data.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the fix
fixDataConsistency();
