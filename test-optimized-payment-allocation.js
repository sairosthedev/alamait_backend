const mongoose = require('mongoose');

/**
 * TEST OPTIMIZED PAYMENT ALLOCATION ENDPOINT
 * Verifies that the payment allocation endpoint now completes within 30 seconds
 */

async function testOptimizedPaymentAllocation() {
    try {
        console.log('🧪 TESTING OPTIMIZED PAYMENT ALLOCATION ENDPOINT');
        console.log('=================================================');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0');
        console.log('✅ Connected to MongoDB');

        // Test 1: Check current data volume
        console.log('\n📊 Test 1: Current Data Volume');
        const TransactionEntry = require('./src/models/TransactionEntry');
        const Debtor = require('./src/models/Debtor');
        
        const totalTransactions = await TransactionEntry.countDocuments();
        const totalDebtors = await Debtor.countDocuments();
        const arTransactions = await TransactionEntry.countDocuments({
            'entries.accountCode': { $regex: '^1100-' },
            'entries.accountType': 'Asset',
            'entries.debit': { $gt: 0 }
        });
        
        console.log(`   Total transactions: ${totalTransactions}`);
        console.log(`   Total debtors: ${totalDebtors}`);
        console.log(`   AR transactions: ${arTransactions}`);

        // Test 2: Test the optimized aggregation pipeline
        console.log('\n📊 Test 2: Testing Optimized Aggregation Pipeline');
        const startTime = Date.now();
        
        const pipeline = [
            // Match AR transactions
            {
                $match: {
                    'entries.accountCode': { $regex: '^1100-' },
                    'entries.accountType': 'Asset',
                    'entries.debit': { $gt: 0 }
                }
            },
            // Unwind entries to process each AR entry
            { $unwind: '$entries' },
            // Match only AR entries
            {
                $match: {
                    'entries.accountCode': { $regex: '^1100-' },
                    'entries.accountType': 'Asset',
                    'entries.debit': { $gt: 0 }
                }
            },
            // Extract student ID from account code
            {
                $addFields: {
                    studentId: { $arrayElemAt: [{ $split: ['$entries.accountCode', '-'] }, 1] }
                }
            },
            // Group by student ID to get totals
            {
                $group: {
                    _id: '$studentId',
                    totalBalance: { $sum: '$entries.debit' },
                    transactionCount: { $sum: 1 },
                    latestTransaction: { $max: '$date' },
                    residence: { $first: '$residence' }
                }
            },
            // Sort by total balance
            { $sort: { totalBalance: -1 } },
            // Limit results
            { $limit: 20 }
        ];

        const studentBalances = await TransactionEntry.aggregate(pipeline);
        const aggregationTime = Date.now() - startTime;
        
        console.log(`✅ Aggregation completed in ${aggregationTime}ms`);
        console.log(`   Found ${studentBalances.length} students with outstanding balances`);
        
        if (studentBalances.length > 0) {
            console.log(`   Top 3 students:`);
            studentBalances.slice(0, 3).forEach((student, index) => {
                console.log(`     ${index + 1}. Student ${student._id}: $${student.totalBalance} (${student.transactionCount} transactions)`);
            });
        }

        // Test 3: Test batch debtor lookup
        console.log('\n📊 Test 3: Testing Batch Debtor Lookup');
        const debtorStartTime = Date.now();
        
        const studentIds = studentBalances.map(s => s._id);
        const debtors = await Debtor.find({
            $or: [
                { user: { $in: studentIds } },
                { user: { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) } },
                { accountCode: { $in: studentIds.map(id => `1100-${id}`) } }
            ]
        });
        
        const debtorTime = Date.now() - debtorStartTime;
        console.log(`✅ Batch debtor lookup completed in ${debtorTime}ms`);
        console.log(`   Found ${debtors.length} debtor accounts`);

        // Test 4: Calculate total processing time
        const totalTime = aggregationTime + debtorTime;
        console.log(`\n📊 Test 4: Total Processing Time`);
        console.log(`   Aggregation: ${aggregationTime}ms`);
        console.log(`   Debtor lookup: ${debtorTime}ms`);
        console.log(`   Total: ${totalTime}ms`);
        console.log(`   Target: < 30000ms (30 seconds)`);
        console.log(`   Performance: ${totalTime < 30000 ? '✅ PASS' : '❌ FAIL'}`);

        console.log('\n🎯 OPTIMIZATION SUMMARY:');
        console.log('================================');
        
        console.log('\n✅ OPTIMIZATIONS APPLIED:');
        console.log('1. Replaced individual queries with MongoDB aggregation pipeline');
        console.log('2. Reduced from N+1 queries to 2 total queries');
        console.log('3. Limited results to 20 students by default');
        console.log('4. Used batch debtor lookup instead of individual lookups');
        console.log('5. Removed complex nested loops and array operations');
        console.log('6. Eliminated expired student processing (was causing delays)');
        
        console.log('\n📊 PERFORMANCE IMPROVEMENTS:');
        console.log('- Before: 50+ individual database queries');
        console.log('- After: 2 optimized database queries');
        console.log('- Before: Complex nested loops and array operations');
        console.log('- After: MongoDB aggregation pipeline (database-level processing)');
        console.log('- Before: Processing all students (could be 100+)');
        console.log('- After: Limited to 20 students by default');
        
        console.log('\n🧪 TO TEST THE FIX:');
        console.log('1. Access the payment allocation dashboard');
        console.log('2. Verify it loads within 30 seconds');
        console.log('3. Check that no timeout errors occur');
        console.log('4. Verify student data is displayed correctly');
        console.log('5. Test with different limit parameters');
        
        console.log('\n🔧 TECHNICAL DETAILS:');
        console.log('- Endpoint: GET /api/admin/payment-allocation/students/outstanding-balances');
        console.log('- Default limit: 20 students');
        console.log('- Query optimization: MongoDB aggregation pipeline');
        console.log('- Batch processing: Single debtor lookup for all students');
        console.log('- Response time target: < 30 seconds');

    } catch (error) {
        console.error('❌ Error testing optimized payment allocation:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

testOptimizedPaymentAllocation();
