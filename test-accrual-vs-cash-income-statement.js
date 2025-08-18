const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');
const FinancialReportingService = require('./src/services/financialReportingService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

/**
 * Test Accrual vs Cash Basis Income Statement
 * 
 * This script demonstrates how the income statement handles:
 * 1. ACCRUAL BASIS: Income when earned (rental_accrual)
 * 2. CASH BASIS: Income when cash received (payment)
 * 
 * Scenario: May Rent = $500
 * - Student pays on time (May 1, 2025)
 * - Another student pays late (August 5, 2025) for May rent
 */

async function testAccrualVsCashIncomeStatement() {
    try {
        console.log('🧪 Testing Accrual vs Cash Basis Income Statement\n');
        
        // First, let's check what transaction entries exist
        const allEntries = await TransactionEntry.find({}).sort({ date: 1 });
        console.log(`📊 Found ${allEntries.length} total transaction entries in database`);
        
        // Show sample entries by source type
        const sourceBreakdown = {};
        allEntries.forEach(entry => {
            if (!sourceBreakdown[entry.source]) sourceBreakdown[entry.source] = 0;
            sourceBreakdown[entry.source]++;
        });
        
        console.log('\n📋 Transaction Entries by Source:');
        Object.entries(sourceBreakdown).forEach(([source, count]) => {
            console.log(`  ${source}: ${count} entries`);
        });
        
        // Test ACCRUAL BASIS Income Statement (2025)
        console.log('\n🔵 ACCRUAL BASIS INCOME STATEMENT (2025):');
        console.log('Shows income when earned, expenses when incurred');
        const accrualStatement = await FinancialReportingService.generateIncomeStatement('2025', 'accrual');
        
        console.log('\n📊 ACCRUAL BASIS RESULTS:');
        console.log(`Total Revenue: $${accrualStatement.revenue.total_revenue}`);
        console.log(`Total Expenses: $${accrualStatement.expenses.total_expenses}`);
        console.log(`Net Income: $${accrualStatement.net_income}`);
        console.log(`Transaction Count: ${accrualStatement.transaction_count}`);
        
        // Test CASH BASIS Income Statement (2025)
        console.log('\n🟢 CASH BASIS INCOME STATEMENT (2025):');
        console.log('Shows income when cash received, expenses when cash paid');
        const cashStatement = await FinancialReportingService.generateIncomeStatement('2025', 'cash');
        
        console.log('\n📊 CASH BASIS RESULTS:');
        console.log(`Total Revenue: $${cashStatement.revenue.total_revenue}`);
        console.log(`Total Expenses: $${cashStatement.expenses.total_expenses}`);
        console.log(`Net Income: $${cashStatement.net_income}`);
        console.log(`Transaction Count: ${cashStatement.transaction_count}`);
        
        // Test Monthly Breakdown (Accrual Basis)
        console.log('\n🔵 MONTHLY ACCRUAL BASIS BREAKDOWN (2025):');
        const monthlyAccrual = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement('2025', 'accrual');
        
        console.log('\n📅 Monthly Revenue (Accrual):');
        Object.values(monthlyAccrual.monthly_breakdown).forEach(month => {
            if (month.total_revenue > 0 || month.total_expenses > 0) {
                console.log(`  ${month.month}: Revenue $${month.total_revenue}, Expenses $${month.total_expenses}, Net $${month.net_income}`);
            }
        });
        
        // Test Monthly Breakdown (Cash Basis)
        console.log('\n🟢 MONTHLY CASH BASIS BREAKDOWN (2025):');
        const monthlyCash = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement('2025', 'cash');
        
        console.log('\n📅 Monthly Revenue (Cash):');
        Object.values(monthlyCash.monthly_breakdown).forEach(month => {
            if (month.total_revenue > 0 || month.total_expenses > 0) {
                console.log(`  ${month.month}: Revenue $${month.total_revenue}, Expenses $${month.total_expenses}, Net $${month.net_income}`);
            }
        });
        
        // Show the difference explanation
        console.log('\n🔍 KEY DIFFERENCES EXPLAINED:');
        console.log('1. ACCRUAL BASIS:');
        console.log('   - Shows rental income when rent is due (rental_accrual)');
        console.log('   - Shows expenses when approved (expense_payment)');
        console.log('   - Reflects true financial performance regardless of cash timing');
        
        console.log('\n2. CASH BASIS:');
        console.log('   - Shows rental income when cash is received (payment)');
        console.log('   - Shows expenses when cash is paid (vendor_payment)');
        console.log('   - Reflects actual cash flow timing');
        
        console.log('\n3. EXAMPLE SCENARIO:');
        console.log('   - May Rent Due: Shows in ACCRUAL (May) but not in CASH');
        console.log('   - May Rent Paid: Shows in CASH (May) but not in ACCRUAL (already shown)');
        console.log('   - August Late Payment: Shows in CASH (August) but not in ACCRUAL (already shown in May)');
        
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error testing income statement:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
testAccrualVsCashIncomeStatement();
