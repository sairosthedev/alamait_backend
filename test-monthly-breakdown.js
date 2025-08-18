const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

// 🔐 User's actual MongoDB Atlas credentials
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testMonthlyBreakdown() {
    try {
        console.log('🧪 Testing Monthly Breakdown for Revenue and Expenses...\n');
        
        // Connect to your MongoDB Atlas cluster
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to your MongoDB Atlas cluster');
        
        const year = '2025';
        
        // Test 1: Accrual Basis Monthly Breakdown
        console.log('\n🧪 TEST 1: ACCRUAL BASIS MONTHLY BREAKDOWN');
        console.log('='.repeat(60));
        const accrualMonthly = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(year, 'accrual');
        console.log('Accrual Monthly Breakdown:');
        console.log(`  - Basis: ${accrualMonthly.basis}`);
        console.log(`  - Revenue: $${accrualMonthly.revenue?.total_revenue || 0}`);
        console.log(`  - Expenses: $${accrualMonthly.expenses?.total_expenses || 0}`);
        console.log(`  - Net Income: $${accrualMonthly.net_income || 0}`);
        
        // Check if revenue has monthly breakdown
        if (accrualMonthly.revenue && accrualMonthly.revenue.monthly) {
            console.log('  ✅ Revenue has monthly breakdown:');
            Object.entries(accrualMonthly.revenue.monthly).forEach(([month, data]) => {
                if (month !== 'total' && month !== 'total_revenue') {
                    console.log(`    - Month ${month}: $${data}`);
                }
            });
        } else {
            console.log('  ❌ Revenue missing monthly breakdown');
        }
        
        // Check if expenses has monthly breakdown
        if (accrualMonthly.expenses && accrualMonthly.expenses.monthly) {
            console.log('  ✅ Expenses has monthly breakdown:');
            Object.entries(accrualMonthly.expenses.monthly).forEach(([month, data]) => {
                if (month !== 'total' && month !== 'total_expenses') {
                    console.log(`    - Month ${month}: $${data}`);
                }
            });
        } else {
            console.log('  ❌ Expenses missing monthly breakdown');
        }
        
        // Test 2: Cash Basis Monthly Breakdown
        console.log('\n🧪 TEST 2: CASH BASIS MONTHLY BREAKDOWN');
        console.log('='.repeat(60));
        const cashMonthly = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(year, 'cash');
        console.log('Cash Monthly Breakdown:');
        console.log(`  - Basis: ${cashMonthly.basis}`);
        console.log(`  - Revenue: $${cashMonthly.revenue?.total_revenue || 0}`);
        console.log(`  - Expenses: $${cashMonthly.expenses?.total_expenses || 0}`);
        console.log(`  - Net Income: $${cashMonthly.net_income || 0}`);
        
        // Check if revenue has monthly breakdown
        if (cashMonthly.revenue && cashMonthly.revenue.monthly) {
            console.log('  ✅ Revenue has monthly breakdown:');
            Object.entries(cashMonthly.revenue.monthly).forEach(([month, data]) => {
                if (month !== 'total' && month !== 'total_revenue') {
                    console.log(`    - Month ${month}: $${data}`);
                }
            });
        } else {
            console.log('  ❌ Revenue missing monthly breakdown');
        }
        
        // Check if expenses has monthly breakdown
        if (cashMonthly.expenses && cashMonthly.expenses.monthly) {
            console.log('  ✅ Expenses has monthly breakdown:');
            Object.entries(cashMonthly.expenses.monthly).forEach(([month, data]) => {
                if (month !== 'total' && month !== 'total_expenses') {
                    console.log(`    - Month ${month}: $${data}`);
                }
            });
        } else {
            console.log('  ❌ Expenses missing monthly breakdown');
        }
        
        // Test 3: Compare Monthly vs Annual
        console.log('\n🧪 TEST 3: MONTHLY VS ANNUAL COMPARISON');
        console.log('='.repeat(60));
        
        const accrualAnnual = await FinancialReportingService.generateIncomeStatement(year, 'accrual');
        const cashAnnual = await FinancialReportingService.generateIncomeStatement(year, 'cash');
        
        console.log('Annual vs Monthly Comparison:');
        console.log('  Accrual Basis:');
        console.log(`    - Annual Revenue: $${accrualAnnual.revenue?.total_revenue || 0}`);
        console.log(`    - Monthly Revenue: $${accrualMonthly.revenue?.total_revenue || 0}`);
        console.log(`    - Annual Expenses: $${accrualAnnual.expenses?.total_expenses || 0}`);
        console.log(`    - Monthly Expenses: $${accrualMonthly.expenses?.total_expenses || 0}`);
        
        console.log('  Cash Basis:');
        console.log(`    - Annual Revenue: $${cashAnnual.revenue?.total_revenue || 0}`);
        console.log(`    - Monthly Revenue: $${cashMonthly.revenue?.total_revenue || 0}`);
        console.log(`    - Annual Expenses: $${cashAnnual.expenses?.total_expenses || 0}`);
        console.log(`    - Monthly Expenses: $${cashMonthly.expenses?.total_expenses || 0}`);
        
        // Test 4: Check Monthly Structure
        console.log('\n🧪 TEST 4: MONTHLY STRUCTURE ANALYSIS');
        console.log('='.repeat(60));
        
        console.log('Accrual Monthly Structure:');
        console.log('  Revenue keys:', Object.keys(accrualMonthly.revenue || {}));
        console.log('  Expenses keys:', Object.keys(accrualMonthly.expenses || {}));
        
        console.log('Cash Monthly Structure:');
        console.log('  Revenue keys:', Object.keys(cashMonthly.revenue || {}));
        console.log('  Expenses keys:', Object.keys(cashMonthly.expenses || {}));
        
    } catch (error) {
        console.error('❌ Error testing monthly breakdown:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
testMonthlyBreakdown();
