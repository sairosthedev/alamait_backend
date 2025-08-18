const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

// 🔐 User's actual MongoDB Atlas credentials
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testResidenceFiltering() {
    try {
        console.log('🧪 Testing Residence Filtering in Enhanced FinancialReportingService...\n');
        
        // Connect to your MongoDB Atlas cluster
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to your MongoDB Atlas cluster');
        
        const year = '2025';
        
        // Test 1: No Residence Filter (All Residences)
        console.log('\n🧪 TEST 1: NO RESIDENCE FILTER (ALL RESIDENCES)');
        console.log('='.repeat(60));
        const allResidencesResult = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(year, 'accrual');
        
        console.log('✅ All Residences Result:');
        console.log(`  - Basis: ${allResidencesResult.basis}`);
        console.log(`  - Total Revenue: $${allResidencesResult.year_totals?.total_revenue || 0}`);
        console.log(`  - Total Expenses: $${allResidencesResult.year_totals?.total_expenses || 0}`);
        console.log(`  - Total Net Income: $${allResidencesResult.year_totals?.net_income || 0}`);
        console.log(`  - Total Transactions: ${allResidencesResult.year_totals?.total_transactions || 0}`);
        
        // Test 2: Specific Residence Filter
        console.log('\n🧪 TEST 2: SPECIFIC RESIDENCE FILTER');
        console.log('='.repeat(60));
        const specificResidence = '67d723cf20f89c4ae69804f3'; // From your data
        const filteredResult = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(year, 'accrual', specificResidence);
        
        console.log('✅ Specific Residence Result:');
        console.log(`  - Basis: ${filteredResult.basis}`);
        console.log(`  - Residence: ${specificResidence}`);
        console.log(`  - Total Revenue: $${filteredResult.year_totals?.total_revenue || 0}`);
        console.log(`  - Total Expenses: $${filteredResult.year_totals?.total_expenses || 0}`);
        console.log(`  - Total Net Income: $${filteredResult.year_totals?.net_income || 0}`);
        console.log(`  - Total Transactions: ${filteredResult.year_totals?.total_transactions || 0}`);
        
        // Test 3: Compare Results
        console.log('\n🧪 TEST 3: COMPARISON');
        console.log('='.repeat(60));
        const revenueDiff = (allResidencesResult.year_totals?.total_revenue || 0) - (filteredResult.year_totals?.total_revenue || 0);
        const expensesDiff = (allResidencesResult.year_totals?.total_expenses || 0) - (filteredResult.year_totals?.total_expenses || 0);
        const netIncomeDiff = (allResidencesResult.year_totals?.net_income || 0) - (filteredResult.year_totals?.net_income || 0);
        
        console.log('Difference (All - Specific):');
        console.log(`  - Revenue: $${revenueDiff}`);
        console.log(`  - Expenses: $${expensesDiff}`);
        console.log(`  - Net Income: $${netIncomeDiff}`);
        
        if (revenueDiff > 0 || expensesDiff > 0) {
            console.log('✅ Residence filtering is working - different amounts for different residences');
        } else {
            console.log('⚠️ Residence filtering may not be working - same amounts for all vs specific');
        }
        
        // Test 4: Check Monthly Breakdown Structure
        console.log('\n🧪 TEST 4: MONTHLY BREAKDOWN STRUCTURE');
        console.log('='.repeat(60));
        
        if (filteredResult.monthly_breakdown) {
            console.log('✅ Monthly breakdown structure:');
            Object.entries(filteredResult.monthly_breakdown).forEach(([monthIndex, monthData]) => {
                const month = parseInt(monthIndex) + 1;
                if (monthData.total_revenue > 0 || monthData.total_expenses > 0) {
                    console.log(`  - Month ${month} (${monthData.month}):`);
                    console.log(`    Revenue: $${monthData.total_revenue}`);
                    console.log(`    Expenses: $${monthData.total_expenses}`);
                    console.log(`    Net Income: $${monthData.net_income}`);
                    console.log(`    Transactions: ${monthData.transaction_count}`);
                }
            });
        } else {
            console.log('❌ Monthly breakdown missing');
        }
        
        // Test 5: Cash Basis with Residence Filter
        console.log('\n🧪 TEST 5: CASH BASIS WITH RESIDENCE FILTER');
        console.log('='.repeat(60));
        const cashFilteredResult = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(year, 'cash', specificResidence);
        
        console.log('✅ Cash Basis with Residence Filter:');
        console.log(`  - Basis: ${cashFilteredResult.basis}`);
        console.log(`  - Residence: ${specificResidence}`);
        console.log(`  - Total Revenue: $${cashFilteredResult.year_totals?.total_revenue || 0}`);
        console.log(`  - Total Expenses: $${cashFilteredResult.year_totals?.total_expenses || 0}`);
        console.log(`  - Total Net Income: $${cashFilteredResult.year_totals?.net_income || 0}`);
        
    } catch (error) {
        console.error('❌ Error testing residence filtering:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
testResidenceFiltering();
