/**
 * Debug script to check the cash flow data structure
 */

const FinancialReportingService = require('../services/financialReportingService');

async function debugCashFlowStructure() {
    try {
        console.log('🔍 Debugging Cash Flow Data Structure...\n');
        
        // Generate cash flow for August 2025
        const cashFlowData = await FinancialReportingService.generateMonthlyCashFlow('2025', 'cash');
        
        console.log('📊 Cash Flow Data Structure:');
        console.log('============================');
        
        // Check if August data exists
        const augustData = cashFlowData.monthly_breakdown['august'];
        if (augustData) {
            console.log('✅ August 2025 data found');
            console.log(`💰 Operating Activities - Inflows: $${augustData.operating_activities.inflows}`);
            console.log(`💸 Operating Activities - Outflows: $${augustData.operating_activities.outflows}`);
            
            console.log('\n📋 Account Breakdowns:');
            const breakdown = augustData.operating_activities.breakdown;
            Object.entries(breakdown).forEach(([accountCode, data]) => {
                console.log(`   ${accountCode}: ${data.accountName}`);
                console.log(`      - Inflows: $${data.inflows}`);
                console.log(`      - Outflows: $${data.outflows}`);
                console.log(`      - Account Code: ${data.accountCode}`);
                console.log(`      - Account Name: ${data.accountName}`);
                console.log('');
            });
            
            // Check for specific account codes
            console.log('🎯 Checking for specific account codes:');
            console.log(`   Admin Fees (4002): ${breakdown['4002'] ? '✅ Found' : '❌ Not found'}`);
            console.log(`   Rental Income (4001): ${breakdown['4001'] ? '✅ Found' : '❌ Not found'}`);
            console.log(`   Cash (1000): ${breakdown['1000'] ? '✅ Found' : '❌ Not found'}`);
            
            if (breakdown['4002']) {
                console.log(`   Admin Fees details: $${breakdown['4002'].inflows}`);
            }
            if (breakdown['4001']) {
                console.log(`   Rental Income details: $${breakdown['4001'].inflows}`);
            }
            if (breakdown['1000']) {
                console.log(`   Cash details: $${breakdown['1000'].inflows}`);
            }
            
        } else {
            console.log('❌ No August 2025 data found');
            console.log('Available months:', Object.keys(cashFlowData.monthly_breakdown));
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

debugCashFlowStructure();


