const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('🔌 Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

const FinancialReportingService = require('./src/services/financialReportingService');

async function showResidenceCashFlow() {
    try {
        console.log('\n🏠 RESIDENCE-FILTERED CASH FLOW REPORTS 2025');
        console.log('==============================================');
        
        // Example: Filter by Belvedere Student House
        const belvedereId = '67c13eb8425a2e078f61d00e';
        console.log('\n📊 CASH FLOW FOR: Belvedere Student House');
        console.log('-------------------------------------------');
        
        const belvedereCashFlow = await FinancialReportingService.generateResidenceFilteredCashFlowStatement('2025', belvedereId, 'cash');
        
        if (belvedereCashFlow.success) {
            console.log('✅ Successfully generated residence-filtered cash flow');
            console.log(`📅 Period: ${belvedereCashFlow.data.period}`);
            console.log(`🏠 Residence: Belvedere Student House`);
            console.log(`💰 Basis: ${belvedereCashFlow.data.basis}`);
            
            // Show summary
            const yearly = belvedereCashFlow.data.yearly_totals;
            console.log(`\n💰 YEARLY SUMMARY:`);
            console.log(`   Operating Activities: $${yearly.operating_activities.inflows} inflows, $${yearly.operating_activities.outflows} outflows`);
            console.log(`   Net Cash Flow: $${yearly.operating_activities.net}`);
            
            // Show monthly breakdown
            console.log(`\n📅 MONTHLY BREAKDOWN:`);
            Object.entries(belvedereCashFlow.data.monthly_breakdown).forEach(([month, data]) => {
                if (data.operating_activities.net !== 0) {
                    console.log(`   ${month.charAt(0).toUpperCase() + month.slice(1)}: $${data.operating_activities.net}`);
                }
            });
            
        } else {
            console.log('❌ Failed to generate residence-filtered cash flow');
        }
        
        // Example: Filter by St Kilda Student House
        const stKildaId = '67d723cf20f89c4ae69804f3';
        console.log('\n📊 CASH FLOW FOR: St Kilda Student House');
        console.log('-------------------------------------------');
        
        const stKildaCashFlow = await FinancialReportingService.generateResidenceFilteredCashFlowStatement('2025', stKildaId, 'cash');
        
        if (stKildaCashFlow.success) {
            console.log('✅ Successfully generated residence-filtered cash flow');
            const yearly = stKildaCashFlow.data.yearly_totals;
            console.log(`💰 YEARLY SUMMARY:`);
            console.log(`   Operating Activities: $${yearly.operating_activities.inflows} inflows, $${yearly.operating_activities.outflows} outflows`);
            console.log(`   Net Cash Flow: $${yearly.operating_activities.net}`);
        } else {
            console.log('❌ Failed to generate residence-filtered cash flow');
        }
        
        console.log('\n🔍 HOW TO USE RESIDENCE FILTERING:');
        console.log('===================================');
        console.log('1. Call generateResidenceFilteredCashFlowStatement(period, residenceId, basis)');
        console.log('2. Available residences:');
        console.log('   - Belvedere Student House: 67c13eb8425a2e078f61d00e');
        console.log('   - St Kilda Student House: 67d723cf20f89c4ae69804f3');
        console.log('   - Newlands: 6847f562e536db246e853f91');
        console.log('   - 1ACP: 6848258b1149b66fc94a261d');
        console.log('   - Fife Avenue: 6859be80cabd83fabe7761de');
        
    } catch (error) {
        console.error('❌ Error generating residence-filtered cash flow:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

showResidenceCashFlow();
