const FinancialReportingService = require('./src/services/financialReportingService');

async function testIncomeStatementComparison() {
    try {
        console.log('🧪 Testing Income Statement Residence Filtering...\n');
        
        const period = '2025';
        const basis = 'cash';
        
        // Test 1: All residences (no filter)
        console.log('📊 Test 1: All Residences (No Filter)');
        const allResidences = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(period, basis);
        console.log(`Total Revenue: $${allResidences.year_totals.total_revenue.toFixed(2)}`);
        console.log(`Total Expenses: $${allResidences.year_totals.total_expenses.toFixed(2)}`);
        console.log(`Net Income: $${allResidences.year_totals.net_income.toFixed(2)}\n`);
        
        // Test 2: Specific residence - Belvedere Student House
        console.log('📊 Test 2: Belvedere Student House Only');
        const belvedereId = '67c13eb8425a2e078f61d00e';
        const belvedereStatement = await FinancialReportingService.generateResidenceFilteredIncomeStatement(
            period, 
            belvedereId, 
            basis
        );
        console.log(`Residence: ${belvedereStatement.residence.name}`);
        console.log(`Total Revenue: $${belvedereStatement.year_totals.total_revenue.toFixed(2)}`);
        console.log(`Total Expenses: $${belvedereStatement.year_totals.total_expenses.toFixed(2)}`);
        console.log(`Net Income: $${belvedereStatement.year_totals.net_income.toFixed(2)}`);
        console.log(`Transactions: ${belvedereStatement.year_totals.total_transactions}\n`);
        
        // Test 3: Another residence - St Kilda Student House
        console.log('📊 Test 3: St Kilda Student House Only');
        const stKildaId = '67d723cf20f89c4ae69804f3';
        const stKildaStatement = await FinancialReportingService.generateResidenceFilteredIncomeStatement(
            period, 
            stKildaId, 
            basis
        );
        console.log(`Residence: ${stKildaStatement.residence.name}`);
        console.log(`Total Revenue: $${stKildaStatement.year_totals.total_revenue.toFixed(2)}`);
        console.log(`Total Expenses: $${stKildaStatement.year_totals.total_expenses.toFixed(2)}`);
        console.log(`Net Income: $${stKildaStatement.year_totals.net_income.toFixed(2)}`);
        console.log(`Transactions: ${stKildaStatement.year_totals.total_transactions}\n`);
        
        // Verify that filtered results are different (proving filtering works)
        const belvedereRevenue = belvedereStatement.year_totals.total_revenue;
        const stKildaRevenue = stKildaStatement.year_totals.total_revenue;
        const allRevenue = allResidences.year_totals.total_revenue;
        
        console.log('🔍 FILTERING VERIFICATION:');
        console.log(`Belvedere Revenue: $${belvedereRevenue.toFixed(2)}`);
        console.log(`St Kilda Revenue: $${stKildaRevenue.toFixed(2)}`);
        console.log(`All Residences Revenue: $${allRevenue.toFixed(2)}`);
        
        if (belvedereRevenue !== stKildaRevenue) {
            console.log('✅ Different residences show different revenue - filtering is working!');
        } else {
            console.log('⚠️  Same revenue for different residences - may indicate filtering issue');
        }
        
        if (belvedereRevenue + stKildaRevenue <= allRevenue) {
            console.log('✅ Filtered revenues sum to less than or equal to total - filtering is working!');
        } else {
            console.log('⚠️  Filtered revenues exceed total - may indicate double counting');
        }
        
        // Check management fee calculation
        console.log('\n💰 MANAGEMENT FEE VERIFICATION:');
        
        // Check Belvedere management fee
        let belvedereManagementFee = 0;
        Object.values(belvedereStatement.monthly_breakdown).forEach(month => {
            if (month.expenses['5001 - Alamait Management Fees']) {
                belvedereManagementFee += month.expenses['5001 - Alamait Management Fees'];
            }
        });
        
        const expectedBelvedereFee = belvedereRevenue * 0.25;
        console.log(`Belvedere Revenue: $${belvedereRevenue.toFixed(2)}`);
        console.log(`Expected Management Fee (25%): $${expectedBelvedereFee.toFixed(2)}`);
        console.log(`Actual Management Fee: $${belvedereManagementFee.toFixed(2)}`);
        
        if (Math.abs(belvedereManagementFee - expectedBelvedereFee) < 0.01) {
            console.log('✅ Management fee calculation is correct!');
        } else {
            console.log('❌ Management fee calculation is incorrect!');
        }
        
        console.log('\n🎉 All tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testIncomeStatementComparison();
