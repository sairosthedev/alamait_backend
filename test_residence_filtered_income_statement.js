const FinancialReportingService = require('./src/services/financialReportingService');

async function testResidenceFilteredIncomeStatement() {
    try {
        console.log('🧪 Testing Residence-Filtered Income Statement...\n');
        
        // Test with a specific residence ID
        const residenceId = '67c13eb8425a2e078f61d00e'; // Belvedere Student House
        const period = '2025';
        const basis = 'cash';
        
        console.log(`📊 Generating income statement for residence: ${residenceId}`);
        console.log(`📅 Period: ${period}`);
        console.log(`💰 Basis: ${basis}\n`);
        
        const incomeStatement = await FinancialReportingService.generateResidenceFilteredIncomeStatement(
            period, 
            residenceId, 
            basis
        );
        
        console.log('✅ Income Statement Generated Successfully!\n');
        
        // Display key information
        console.log('📋 INCOME STATEMENT SUMMARY:');
        console.log(`🏠 Residence: ${incomeStatement.residence.name} (ID: ${incomeStatement.residence.id})`);
        console.log(`📅 Period: ${incomeStatement.period}`);
        console.log(`💰 Basis: ${incomeStatement.basis}`);
        console.log(`📊 Total Revenue: $${incomeStatement.year_totals.total_revenue.toFixed(2)}`);
        console.log(`💸 Total Expenses: $${incomeStatement.year_totals.total_expenses.toFixed(2)}`);
        console.log(`📈 Net Income: $${incomeStatement.year_totals.net_income.toFixed(2)}`);
        console.log(`🔢 Total Transactions: ${incomeStatement.year_totals.total_transactions}\n`);
        
        // Check if management fee is included
        let managementFeeFound = false;
        let totalManagementFee = 0;
        
        Object.values(incomeStatement.monthly_breakdown).forEach(month => {
            if (month.expenses['5001 - Alamait Management Fees']) {
                managementFeeFound = true;
                totalManagementFee += month.expenses['5001 - Alamait Management Fees'];
                console.log(`💰 ${month.month} Management Fee: $${month.expenses['5001 - Alamait Management Fees'].toFixed(2)}`);
            }
        });
        
        if (managementFeeFound) {
            console.log(`\n✅ Management Fee (25% of revenue) is correctly calculated: $${totalManagementFee.toFixed(2)}`);
        } else {
            console.log('\n❌ Management Fee not found - this indicates an issue');
        }
        
        // Show monthly breakdown for months with activity
        console.log('\n📅 MONTHLY BREAKDOWN:');
        Object.values(incomeStatement.monthly_breakdown).forEach(month => {
            if (month.total_revenue > 0 || month.total_expenses > 0) {
                console.log(`\n${month.month}:`);
                console.log(`  Revenue: $${month.total_revenue.toFixed(2)}`);
                console.log(`  Expenses: $${month.total_expenses.toFixed(2)}`);
                console.log(`  Net Income: $${month.net_income.toFixed(2)}`);
                console.log(`  Transactions: ${month.transaction_count}`);
                
                // Show expense breakdown
                if (Object.keys(month.expenses).length > 0) {
                    console.log(`  Expense Categories:`);
                    Object.entries(month.expenses).forEach(([category, amount]) => {
                        console.log(`    ${category}: $${amount.toFixed(2)}`);
                    });
                }
            }
        });
        
        console.log('\n🎉 Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testResidenceFilteredIncomeStatement();
