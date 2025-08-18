const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

// 🔐 User's actual MongoDB Atlas credentials
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugBasisParameter() {
    try {
        console.log('🔍 Debugging Basis Parameter Issue...\n');
        
        // Connect to your MongoDB Atlas cluster
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to your MongoDB Atlas cluster');
        
        const year = '2025';
        
        // Test 1: Accrual Basis
        console.log('\n🧪 TEST 1: ACCRUAL BASIS');
        console.log('='.repeat(50));
        const accrualResult = await FinancialReportingService.generateIncomeStatement(year, 'accrual');
        console.log('Accrual Basis Result:');
        console.log(`  - Basis: ${accrualResult.basis}`);
        console.log(`  - Revenue: $${accrualResult.revenue?.total_revenue || 0}`);
        console.log(`  - Expenses: $${accrualResult.expenses?.total_expenses || 0}`);
        console.log(`  - Net Income: $${accrualResult.net_income || 0}`);
        console.log(`  - Transaction Count: ${accrualResult.transaction_count || 0}`);
        console.log(`  - Message: ${accrualResult.accounting_notes?.note || 'No notes'}`);
        
        // Test 2: Cash Basis
        console.log('\n🧪 TEST 2: CASH BASIS');
        console.log('='.repeat(50));
        const cashResult = await FinancialReportingService.generateIncomeStatement(year, 'cash');
        console.log('Cash Basis Result:');
        console.log(`  - Basis: ${cashResult.basis}`);
        console.log(`  - Revenue: $${cashResult.revenue?.total_revenue || 0}`);
        console.log(`  - Expenses: $${cashResult.expenses?.total_expenses || 0}`);
        console.log(`  - Net Income: $${cashResult.net_income || 0}`);
        console.log(`  - Transaction Count: ${cashResult.transaction_count || 0}`);
        console.log(`  - Message: ${cashResult.accounting_notes?.note || 'No notes'}`);
        
        // Test 3: Compare Results
        console.log('\n🧪 TEST 3: COMPARISON');
        console.log('='.repeat(50));
        const revenueSame = accrualResult.revenue?.total_revenue === cashResult.revenue?.total_revenue;
        const expensesSame = accrualResult.expenses?.total_expenses === cashResult.expenses?.total_expenses;
        const netIncomeSame = accrualResult.net_income === cashResult.net_income;
        
        console.log('Are the results identical?');
        console.log(`  - Revenue: ${revenueSame ? '❌ SAME' : '✅ DIFFERENT'}`);
        console.log(`  - Expenses: ${expensesSame ? '❌ SAME' : '✅ DIFFERENT'}`);
        console.log(`  - Net Income: ${netIncomeSame ? '❌ SAME' : '✅ DIFFERENT'}`);
        
        if (revenueSame && expensesSame && netIncomeSame) {
            console.log('\n🚨 PROBLEM FOUND: Both basis return identical data!');
            console.log('This means the basis parameter is not being processed correctly.');
        } else {
            console.log('\n✅ SUCCESS: Basis parameter is working correctly!');
        }
        
        // Test 4: Check Database Data
        console.log('\n🧪 TEST 4: DATABASE DATA CHECK');
        console.log('='.repeat(50));
        const db = mongoose.connection.db;
        
        // Check rental accruals (should only appear in accrual basis)
        const rentalAccruals = await db.collection('transactionentries').find({
            source: 'rental_accrual',
            status: 'posted',
            date: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') }
        }).toArray();
        
        // Check payments (should only appear in cash basis)
        const payments = await db.collection('transactionentries').find({
            source: 'payment',
            status: 'posted',
            date: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') }
        }).toArray();
        
        // Check expense payments (should only appear in cash basis)
        const expensePayments = await db.collection('transactionentries').find({
            source: { $in: ['expense_payment', 'manual'] },
            status: 'posted',
            date: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') }
        }).toArray();
        
        console.log('Database Data Counts:');
        console.log(`  - Rental Accruals: ${rentalAccruals.length} (should only affect accrual basis)`);
        console.log(`  - Payments: ${payments.length} (should only affect cash basis)`);
        console.log(`  - Expense Payments: ${expensePayments.length} (should only affect cash basis)`);
        
        if (rentalAccruals.length > 0 && payments.length > 0) {
            console.log('\n✅ Database has both types of data - basis should work differently');
        } else if (rentalAccruals.length === 0 && payments.length === 0) {
            console.log('\n❌ Database has no data - both basis will show $0');
        } else {
            console.log('\n⚠️ Database has mixed data - check source field values');
        }
        
    } catch (error) {
        console.error('❌ Error debugging basis parameter:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the debug script
debugBasisParameter();
