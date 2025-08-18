const mongoose = require('mongoose');

// 🔐 User's actual MongoDB Atlas credentials
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugBasisDifference() {
    try {
        console.log('🔍 Debugging Accrual vs Cash Basis Difference...\n');
        
        // Connect to your MongoDB Atlas cluster
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to your MongoDB Atlas cluster');
        
        // Get the database
        const db = mongoose.connection.db;
        
        const year = '2025';
        const startDate = new Date(`${year}-01-01`);
        const endDate = new Date(`${year}-12-31`);
        
        console.log('📊 ANALYZING DATA FOR 2025:');
        console.log('='.repeat(60));
        
        // 1. Check rental accrual entries (should only appear in accrual basis)
        console.log('\n🔵 RENTAL ACCRUAL ENTRIES (Accrual Basis Only):');
        const accrualEntries = await db.collection('transactionentries').find({
            date: { $gte: startDate, $lte: endDate },
            source: 'rental_accrual',
            status: 'posted'
        }).toArray();
        
        console.log(`Found ${accrualEntries.length} rental accrual entries`);
        
        let accrualRevenue = 0;
        accrualEntries.forEach(entry => {
            if (entry.entries) {
                entry.entries.forEach(lineItem => {
                    if (lineItem.accountType === 'Income') {
                        accrualRevenue += lineItem.credit || 0;
                    }
                });
            }
        });
        console.log(`Total accrual revenue: $${accrualRevenue}`);
        
        // 2. Check payment entries (should only appear in cash basis)
        console.log('\n🟢 PAYMENT ENTRIES (Cash Basis Only):');
        const paymentEntries = await db.collection('transactionentries').find({
            date: { $gte: startDate, $lte: endDate },
            source: 'payment',
            status: 'posted'
        }).toArray();
        
        console.log(`Found ${paymentEntries.length} payment entries`);
        
        let cashRevenue = 0;
        paymentEntries.forEach(entry => {
            if (entry.entries) {
                entry.entries.forEach(lineItem => {
                    if (lineItem.accountType === 'Income') {
                        cashRevenue += lineItem.credit || 0;
                    }
                });
            }
        });
        console.log(`Total cash revenue: $${cashRevenue}`);
        
        // 3. Check expense entries (should only appear in cash basis)
        console.log('\n💸 EXPENSE ENTRIES (Cash Basis Only):');
        const expenseEntries = await db.collection('transactionentries').find({
            date: { $gte: startDate, $lte: endDate },
            source: { $in: ['expense_payment', 'manual'] },
            status: 'posted'
        }).toArray();
        
        console.log(`Found ${expenseEntries.length} expense entries`);
        
        let totalExpenses = 0;
        expenseEntries.forEach(entry => {
            if (entry.entries) {
                entry.entries.forEach(lineItem => {
                    if (lineItem.accountType === 'Expense') {
                        totalExpenses += lineItem.debit || 0;
                    }
                });
            }
        });
        console.log(`Total expenses: $${totalExpenses}`);
        
        // 4. Summary
        console.log('\n\n🎯 EXPECTED RESULTS:');
        console.log('='.repeat(60));
        console.log('🔵 ACCRUAL BASIS:');
        console.log(`  Revenue: $${accrualRevenue}`);
        console.log(`  Expenses: $0`);
        console.log(`  Net Income: $${accrualRevenue}`);
        console.log(`  Source: rental_accrual entries only`);
        
        console.log('\n🟢 CASH BASIS:');
        console.log(`  Revenue: $${cashRevenue}`);
        console.log(`  Expenses: $${totalExpenses}`);
        console.log(`  Net Income: $${cashRevenue - totalExpenses}`);
        console.log(`  Source: payment + expense entries`);
        
        console.log('\n❌ CURRENT ISSUE:');
        console.log('Both basis are showing the same data, which means:');
        console.log('1. Either the basis parameter is not being processed correctly');
        console.log('2. Or the monthly breakdown is incorrectly merging data');
        console.log('3. Or there\'s a bug in the response structure');
        
    } catch (error) {
        console.error('❌ Error debugging basis difference:', error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

// Run the debug
debugBasisDifference();
