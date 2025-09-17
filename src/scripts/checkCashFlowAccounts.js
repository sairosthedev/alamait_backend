/**
 * Check what account codes are actually being used in the cash flow
 */

const mongoose = require('mongoose');
const FinancialReportingService = require('../services/financialReportingService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

async function checkCashFlowAccounts() {
    try {
        console.log('🔍 Checking Cash Flow Account Codes\n');
        
        // Generate cash flow for August 2025
        const cashFlowData = await FinancialReportingService.generateMonthlyCashFlow('2025', 'cash');
        
        console.log('📊 August 2025 Cash Flow Breakdown:');
        
        if (cashFlowData.monthly_breakdown && cashFlowData.monthly_breakdown.august) {
            const augustData = cashFlowData.monthly_breakdown.august;
            
            console.log('\n💰 Operating Activities:');
            if (augustData.operating_activities && augustData.operating_activities.breakdown) {
                Object.entries(augustData.operating_activities.breakdown).forEach(([accountCode, data]) => {
                    if (data.inflows > 0 || data.outflows > 0) {
                        console.log(`   ${accountCode}: ${data.accountName} - Inflows: $${data.inflows}, Outflows: $${data.outflows}`);
                    }
                });
            }
            
            console.log('\n🏗️ Investing Activities:');
            if (augustData.investing_activities && augustData.investing_activities.breakdown) {
                Object.entries(augustData.investing_activities.breakdown).forEach(([accountCode, data]) => {
                    if (data.inflows > 0 || data.outflows > 0) {
                        console.log(`   ${accountCode}: ${data.accountName} - Inflows: $${data.inflows}, Outflows: $${data.outflows}`);
                    }
                });
            }
            
            console.log('\n💼 Financing Activities:');
            if (augustData.financing_activities && augustData.financing_activities.breakdown) {
                Object.entries(augustData.financing_activities.breakdown).forEach(([accountCode, data]) => {
                    if (data.inflows > 0 || data.outflows > 0) {
                        console.log(`   ${accountCode}: ${data.accountName} - Inflows: $${data.inflows}, Outflows: $${data.outflows}`);
                    }
                });
            }
        }
        
        console.log('\n✅ Cash flow account check completed');
        
    } catch (error) {
        console.error('❌ Error checking cash flow accounts:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the check
checkCashFlowAccounts();


