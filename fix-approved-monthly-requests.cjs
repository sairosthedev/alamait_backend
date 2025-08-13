// Script to fix all approved monthly requests that don't have expenses
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

const MonthlyRequest = require('./src/models/MonthlyRequest');
const Expense = require('./src/models/finance/Expense');
const TransactionEntry = require('./src/models/TransactionEntry');

// Import the convertRequestToExpenses function
const { convertRequestToExpenses } = require('./src/controllers/monthlyRequestController');

async function fixApprovedMonthlyRequests() {
    try {
        console.log('🔧 Starting to fix approved monthly requests...');
        
        // Find all approved monthly requests
        const approvedRequests = await MonthlyRequest.find({ 
            status: 'approved' 
        }).populate('residence', 'name').populate('submittedBy', 'firstName lastName email');
        
        console.log(`📋 Found ${approvedRequests.length} approved monthly requests`);
        
        let fixedCount = 0;
        let errorCount = 0;
        
        for (const request of approvedRequests) {
            try {
                console.log(`\n🔍 Processing request: ${request._id}`);
                console.log(`   Title: ${request.title}`);
                console.log(`   Status: ${request.status}`);
                console.log(`   Is Template: ${request.isTemplate}`);
                console.log(`   Items: ${request.items?.length || 0}`);
                
                // Check if expenses already exist
                const existingExpenses = await Expense.find({ monthlyRequestId: request._id });
                
                if (existingExpenses.length > 0) {
                    console.log(`   ✅ Already has ${existingExpenses.length} expenses - skipping`);
                    continue;
                }
                
                // Check if request has items
                if (!request.items || request.items.length === 0) {
                    console.log(`   ⚠️ Request has no items - skipping`);
                    continue;
                }
                
                // Check if request has residence
                if (!request.residence) {
                    console.log(`   ⚠️ Request has no residence - skipping`);
                    continue;
                }
                
                console.log(`   🔧 Converting to expenses...`);
                
                // Create a mock user for the conversion (since we don't have the original user)
                const mockUser = {
                    _id: request.approvedBy || request.submittedBy,
                    email: request.approvedByEmail || 'system@alamait.com',
                    firstName: 'System',
                    lastName: 'User'
                };
                
                // Call the expense conversion function
                const conversionResult = await convertRequestToExpenses(request, mockUser);
                
                if (conversionResult && conversionResult.expenses && conversionResult.expenses.length > 0) {
                    console.log(`   ✅ Successfully created ${conversionResult.expenses.length} expenses`);
                    
                    // Update the request status to completed
                    request.status = 'completed';
                    request.requestHistory.push({
                        date: new Date(),
                        action: 'Converted to expenses (retroactive fix)',
                        user: mockUser._id,
                        changes: [`Retroactively converted ${conversionResult.expenses.length} items to expenses`]
                    });
                    
                    await request.save();
                    console.log(`   ✅ Updated request status to 'completed'`);
                    
                    fixedCount++;
                } else {
                    console.log(`   ❌ No expenses created - conversion failed`);
                    errorCount++;
                }
                
            } catch (error) {
                console.error(`   ❌ Error processing request ${request._id}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`\n🎯 Summary:`);
        console.log(`   ✅ Fixed: ${fixedCount} requests`);
        console.log(`   ❌ Errors: ${errorCount} requests`);
        console.log(`   📋 Total processed: ${approvedRequests.length} requests`);
        
        // Show final statistics
        const finalApprovedRequests = await MonthlyRequest.find({ status: 'approved' });
        const finalCompletedRequests = await MonthlyRequest.find({ status: 'completed' });
        const totalExpenses = await Expense.find({ monthlyRequestId: { $exists: true } });
        
        console.log(`\n📊 Final Statistics:`);
        console.log(`   📋 Approved requests: ${finalApprovedRequests.length}`);
        console.log(`   ✅ Completed requests: ${finalCompletedRequests.length}`);
        console.log(`   💰 Total monthly request expenses: ${totalExpenses.length}`);
        
    } catch (error) {
        console.error('❌ Error fixing approved monthly requests:', error);
    } finally {
        mongoose.connection.close();
    }
}

console.log('🚀 Starting approved monthly requests fix...');
fixApprovedMonthlyRequests().then(() => {
    console.log('✅ Fix completed!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
}); 