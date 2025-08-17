// Debug script to understand why expense conversion is failing
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

async function debugConversionFailure() {
    try {
        console.log('🔍 Debugging expense conversion failure...\n');

        // Find the specific request that's failing
        const request = await MonthlyRequest.findById('6895a9c25205ee508a3744a9')
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email');

        if (!request) {
            console.log('❌ Request not found');
            return;
        }

        console.log('📋 Request Details:');
        console.log(`   ID: ${request._id}`);
        console.log(`   Title: ${request.title}`);
        console.log(`   Status: ${request.status}`);
        console.log(`   Is Template: ${request.isTemplate}`);
        console.log(`   Items Count: ${request.items.length}`);
        console.log(`   Total Estimated Cost: ${request.totalEstimatedCost}`);
        console.log(`   Residence: ${request.residence ? request.residence.name : 'N/A'}`);
        console.log(`   Submitted By: ${request.submittedBy ? `${request.submittedBy.firstName} ${request.submittedBy.lastName}` : 'N/A'}`);

        console.log('\n📦 Items:');
        request.items.forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.title} - $${item.estimatedCost} (${item.category})`);
        });

        // Create a mock user for the conversion
        const mockUser = {
            _id: '67f4ef0fcb87ffa3fb7e2d73',
            firstName: 'Finance',
            lastName: 'User',
            email: 'finance@alamait.com',
            role: 'finance'
        };

        console.log('\n🔄 Attempting conversion...');
        
        try {
            const result = await convertRequestToExpenses(request, mockUser);
            console.log('✅ Conversion Result:');
            console.log(JSON.stringify(result, null, 2));
        } catch (error) {
            console.log('❌ Conversion Error:');
            console.log('Error message:', error.message);
            console.log('Error stack:', error.stack);
        }

        // Check if any expenses were created
        const expenses = await Expense.find({ 
            monthlyRequestId: request._id 
        });

        console.log(`\n💰 Expenses found: ${expenses.length}`);
        if (expenses.length > 0) {
            expenses.forEach((expense, index) => {
                console.log(`   ${index + 1}. ${expense.title} - $${expense.amount} (${expense.category})`);
            });
        }

        // Check if any transaction entries were created
        const transactions = await TransactionEntry.find({ 
            sourceType: 'monthly_request',
            sourceId: request._id 
        });

        console.log(`\n💳 Transaction entries found: ${transactions.length}`);
        if (transactions.length > 0) {
            transactions.forEach((transaction, index) => {
                console.log(`   ${index + 1}. ${transaction.description} - $${transaction.amount} (${transaction.type})`);
            });
        }

    } catch (error) {
        console.error('❌ Debug script error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Debug completed');
    }
}

debugConversionFailure(); 