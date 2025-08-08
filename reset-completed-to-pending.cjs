// Script to reset completed monthly requests back to pending for proper approval
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

async function resetCompletedToPending() {
    try {
        console.log('🔧 Resetting completed monthly requests to pending...\n');

        // Find all completed requests
        const completedRequests = await MonthlyRequest.find({ 
            status: 'completed',
            isTemplate: false 
        });

        console.log(`📋 Found ${completedRequests.length} completed requests`);

        if (completedRequests.length === 0) {
            console.log('✅ No completed requests to reset');
            return;
        }

        let resetCount = 0;

        for (const request of completedRequests) {
            console.log(`\n🔍 Processing: ${request.title}`);
            
            // Check if this request already has expenses
            const existingExpenses = await Expense.find({ 
                monthlyRequestId: request._id 
            });

            if (existingExpenses.length > 0) {
                console.log(`   ⚠️  Skipping - already has ${existingExpenses.length} expenses`);
                continue;
            }

            // Reset to pending
            request.status = 'pending';
            request.approvedBy = null;
            request.approvedAt = null;
            request.approvedByEmail = null;
            
            // Add to request history
            request.requestHistory.push({
                date: new Date(),
                action: 'Reset to pending for proper approval',
                user: null, // System action
                changes: ['Status reset from completed to pending for proper expense conversion']
            });

            await request.save();
            resetCount++;
            console.log(`   ✅ Reset to pending`);
        }

        console.log(`\n🎯 Summary:`);
        console.log(`   ✅ Reset: ${resetCount} requests`);
        console.log(`   ⚠️  Skipped: ${completedRequests.length - resetCount} requests (already have expenses)`);

        // Show the updated status
        const pendingRequests = await MonthlyRequest.find({ status: 'pending' });
        const completedRequestsAfter = await MonthlyRequest.find({ status: 'completed' });
        
        console.log(`\n📊 Updated status:`);
        console.log(`   🔄 Pending: ${pendingRequests.length}`);
        console.log(`   ✅ Completed: ${completedRequestsAfter.length}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Reset completed');
    }
}

resetCompletedToPending(); 