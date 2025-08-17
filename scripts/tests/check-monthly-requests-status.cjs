// Script to check the current status of all monthly requests
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Import models
require('./src/models/User');
require('./src/models/MonthlyRequest');
require('./src/models/finance/Expense');
require('./src/models/TransactionEntry');
require('./src/models/Residence');

const MonthlyRequest = require('./src/models/MonthlyRequest');
const Expense = require('./src/models/finance/Expense');
const TransactionEntry = require('./src/models/TransactionEntry');

async function checkMonthlyRequestsStatus() {
    try {
        console.log('🔍 Checking monthly requests status...\n');

        // Get all monthly requests
        const allRequests = await MonthlyRequest.find({})
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .sort({ createdAt: -1 });

        console.log(`📋 Total monthly requests: ${allRequests.length}\n`);

        // Group by status
        const statusCounts = {};
        allRequests.forEach(request => {
            statusCounts[request.status] = (statusCounts[request.status] || 0) + 1;
        });

        console.log('📊 Status breakdown:');
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`   ${status}: ${count}`);
        });

        console.log('\n📋 Recent requests:');
        allRequests.slice(0, 10).forEach((request, index) => {
            console.log(`   ${index + 1}. ${request.title} - Status: ${request.status} - Created: ${request.createdAt.toISOString().split('T')[0]}`);
        });

        // Check for completed requests and their expenses
        const completedRequests = allRequests.filter(r => r.status === 'completed');
        console.log(`\n✅ Completed requests: ${completedRequests.length}`);

        for (const request of completedRequests) {
            const expenses = await Expense.find({ monthlyRequestId: request._id });
            const transactions = await TransactionEntry.find({ 
                sourceType: 'monthly_request',
                sourceId: request._id 
            });

            console.log(`   📋 ${request.title}:`);
            console.log(`      💰 Expenses: ${expenses.length}`);
            console.log(`      💳 Transactions: ${transactions.length}`);
            
            if (expenses.length === 0) {
                console.log(`      ⚠️  WARNING: No expenses found for completed request!`);
            }
        }

        // Check for approved requests that might not have been converted
        const approvedRequests = allRequests.filter(r => r.status === 'approved');
        console.log(`\n🔄 Approved requests (not completed): ${approvedRequests.length}`);

        for (const request of approvedRequests) {
            const expenses = await Expense.find({ monthlyRequestId: request._id });
            console.log(`   📋 ${request.title}: ${expenses.length} expenses`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Check completed');
    }
}

checkMonthlyRequestsStatus(); 