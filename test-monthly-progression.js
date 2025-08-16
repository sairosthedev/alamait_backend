const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testMonthlyProgression() {
    console.log('🧪 Testing Monthly Progression for All Residences...\n');
    
    try {
        // Test the new monthly progression endpoint
        console.log('📋 Testing GET /api/accounting/balance-sheet/residences/monthly?year=2025');
        const response = await axios.get(`${BASE_URL}/api/accounting/balance-sheet/residences/monthly?year=2025`);
        
        if (response.data.success) {
            console.log('✅ SUCCESS! Monthly Progression for All Residences!');
            
            const data = response.data.data;
            console.log(`\n📊 Year: ${data.year}`);
            console.log(`🏠 Total Residences: ${data.summary.totalResidences}`);
            
            // Show monthly progression for each month
            console.log('\n📅 Monthly Progression (January - December):');
            console.log('=' .repeat(100));
            
            for (let month = 1; month <= 12; month++) {
                if (data.monthlyProgression[month]) {
                    const monthData = data.monthlyProgression[month];
                    console.log(`\n📅 ${monthData.monthName} ${monthData.year}:`);
                    console.log(`   Overall Assets: $${monthData.summary.totalAssets}`);
                    console.log(`   Overall Liabilities: $${monthData.summary.totalLiabilities}`);
                    console.log(`   Overall Equity: $${monthData.summary.totalEquity}`);
                    console.log(`   Balance Check: $${monthData.summary.balanceCheck}`);
                    
                    // Show individual residence breakdowns for this month
                    Object.keys(monthData.residences).forEach(residenceId => {
                        const residence = monthData.residences[residenceId];
                        console.log(`     🏠 ${residence.residenceDetails.name}:`);
                        console.log(`        Assets: $${residence.assets.total}, Liabilities: $${residence.liabilities.total}, Equity: $${residence.equity.total}`);
                    });
                }
            }
            
            // Show year-end summary
            console.log('\n📋 YEAR-END SUMMARY:');
            console.log('=' .repeat(50));
            console.log(`Total Assets: $${data.summary.totalAssets}`);
            console.log(`Total Liabilities: $${data.summary.totalLiabilities}`);
            console.log(`Total Equity: $${data.summary.totalEquity}`);
            
        } else {
            console.log('❌ Failed:', response.data.message);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testMonthlyProgression();
