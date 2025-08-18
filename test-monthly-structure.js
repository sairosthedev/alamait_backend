const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

// 🔐 User's actual MongoDB Atlas credentials
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testMonthlyStructure() {
    try {
        console.log('🧪 Testing Monthly Structure in Enhanced FinancialReportingService...\n');
        
        // Connect to your MongoDB Atlas cluster
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to your MongoDB Atlas cluster');
        
        const year = '2025';
        
        // Test 1: Accrual Basis with Monthly Breakdown
        console.log('\n🧪 TEST 1: ACCRUAL BASIS MONTHLY STRUCTURE');
        console.log('='.repeat(60));
        const accrualResult = await FinancialReportingService.generateIncomeStatement(year, 'accrual');
        
        console.log('✅ Accrual Basis Result:');
        console.log(`  - Basis: ${accrualResult.basis}`);
        console.log(`  - Revenue: $${accrualResult.revenue?.total_revenue || 0}`);
        console.log(`  - Expenses: $${accrualResult.expenses?.total_expenses || 0}`);
        
        // Check revenue monthly structure
        if (accrualResult.revenue?.monthly) {
            console.log('  ✅ Revenue Monthly Breakdown:');
            Object.entries(accrualResult.revenue.monthly).forEach(([month, monthData]) => {
                console.log(`    - Month ${month}:`);
                Object.entries(monthData).forEach(([account, amount]) => {
                    console.log(`      ${account}: $${amount}`);
                });
            });
        } else {
            console.log('  ❌ Revenue missing monthly breakdown');
        }
        
        // Check expenses monthly structure
        if (accrualResult.expenses?.monthly) {
            console.log('  ✅ Expenses Monthly Breakdown:');
            Object.entries(accrualResult.expenses.monthly).forEach(([month, monthData]) => {
                console.log(`    - Month ${month}:`);
                Object.entries(monthData).forEach(([account, amount]) => {
                    console.log(`      ${account}: $${amount}`);
                });
            });
        } else {
            console.log('  ❌ Expenses missing monthly breakdown');
        }
        
        // Test 2: Cash Basis with Monthly Breakdown
        console.log('\n🧪 TEST 2: CASH BASIS MONTHLY STRUCTURE');
        console.log('='.repeat(60));
        const cashResult = await FinancialReportingService.generateIncomeStatement(year, 'cash');
        
        console.log('✅ Cash Basis Result:');
        console.log(`  - Basis: ${cashResult.basis}`);
        console.log(`  - Revenue: $${cashResult.revenue?.total_revenue || 0}`);
        console.log(`  - Expenses: $${cashResult.expenses?.total_expenses || 0}`);
        
        // Check revenue monthly structure
        if (cashResult.revenue?.monthly) {
            console.log('  ✅ Revenue Monthly Breakdown:');
            Object.entries(cashResult.revenue.monthly).forEach(([month, monthData]) => {
                console.log(`    - Month ${month}:`);
                Object.entries(monthData).forEach(([account, amount]) => {
                    console.log(`      ${account}: $${amount}`);
                });
            });
        } else {
            console.log('  ❌ Revenue missing monthly breakdown');
        }
        
        // Check expenses monthly structure
        if (cashResult.expenses?.monthly) {
            console.log('  ✅ Expenses Monthly Breakdown:');
            Object.entries(cashResult.expenses.monthly).forEach(([month, monthData]) => {
                console.log(`    - Month ${month}:`);
                Object.entries(monthData).forEach(([account, amount]) => {
                    console.log(`      ${account}: $${amount}`);
                });
            });
        } else {
            console.log('  ❌ Expenses missing monthly breakdown');
        }
        
        // Test 3: Structure Analysis
        console.log('\n🧪 TEST 3: STRUCTURE ANALYSIS');
        console.log('='.repeat(60));
        
        console.log('Accrual Revenue Structure:');
        console.log('  Keys:', Object.keys(accrualResult.revenue || {}));
        console.log('  Has monthly:', !!accrualResult.revenue?.monthly);
        console.log('  Monthly keys:', Object.keys(accrualResult.revenue?.monthly || {}));
        
        console.log('Accrual Expenses Structure:');
        console.log('  Keys:', Object.keys(accrualResult.expenses || {}));
        console.log('  Has monthly:', !!accrualResult.expenses?.monthly);
        console.log('  Monthly keys:', Object.keys(accrualResult.expenses?.monthly || {}));
        
        console.log('Cash Revenue Structure:');
        console.log('  Keys:', Object.keys(cashResult.revenue || {}));
        console.log('  Has monthly:', !!cashResult.revenue?.monthly);
        console.log('  Monthly keys:', Object.keys(cashResult.revenue?.monthly || {}));
        
        console.log('Cash Expenses Structure:');
        console.log('  Keys:', Object.keys(cashResult.expenses || {}));
        console.log('  Has monthly:', !!cashResult.expenses?.monthly);
        console.log('  Monthly keys:', Object.keys(cashResult.expenses?.monthly || {}));
        
    } catch (error) {
        console.error('❌ Error testing monthly structure:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
testMonthlyStructure();
