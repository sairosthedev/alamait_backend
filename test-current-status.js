// Test script to check current request status
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Import models
require('./src/models/MonthlyRequest');

const MonthlyRequest = require('./src/models/MonthlyRequest');

async function checkCurrentStatus() {
    try {
        console.log('🔍 Checking current request status...');
        
        const requestId = '6894274655ae453778d2ddc9';
        
        // Get the request
        const request = await MonthlyRequest.findById(requestId);
        
        if (!request) {
            console.error('❌ Request not found');
            return;
        }
        
        console.log('📋 Request details:');
        console.log(`   ID: ${request._id}`);
        console.log(`   Title: ${request.title}`);
        console.log(`   Status: ${request.status}`);
        console.log(`   Is Template: ${request.isTemplate}`);
        console.log(`   Approved By: ${request.approvedBy}`);
        console.log(`   Approved At: ${request.approvedAt}`);
        console.log(`   Notes: ${request.notes}`);
        
        // Check if it can be approved
        console.log('\n🔍 Approval eligibility:');
        if (request.status === 'pending') {
            console.log('   ✅ Can be approved (status is pending)');
        } else if (request.status === 'approved') {
            console.log('   ⚠️ Already approved (status is approved)');
            console.log('   → Need to convert to expenses instead');
        } else if (request.status === 'completed') {
            console.log('   ✅ Already completed (status is completed)');
        } else {
            console.log(`   ❌ Cannot be approved (status is ${request.status})`);
        }
        
        // Check if expenses exist
        const { Expense } = require('./src/models/finance/Expense');
        const expenses = await Expense.find({ monthlyRequestId: requestId });
        console.log(`\n💰 Existing expenses: ${expenses.length}`);
        
        // Check if transactions exist
        const { TransactionEntry } = require('./src/models/TransactionEntry');
        const transactions = await TransactionEntry.find({ 
            sourceId: requestId,
            source: { $in: ['expense_payment', 'maintenance_approval'] }
        });
        console.log(`💳 Existing transactions: ${transactions.length}`);
        
        console.log('\n🎯 Recommendation:');
        if (request.status === 'approved' && expenses.length === 0) {
            console.log('   → Request is approved but no expenses created');
            console.log('   → Need to call convertRequestToExpenses to create expenses');
        } else if (request.status === 'completed' && expenses.length > 0) {
            console.log('   → Request is completed with expenses');
            console.log('   → Everything is working correctly');
        } else if (request.status === 'pending') {
            console.log('   → Request is pending and can be approved');
            console.log('   → Approval should trigger expense conversion');
        }
        
    } catch (error) {
        console.error('❌ Error checking status:', error);
    } finally {
        mongoose.connection.close();
    }
}

console.log('🚀 Starting status check...');
checkCurrentStatus().then(() => {
    console.log('✅ Status check completed!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Status check failed:', error);
    process.exit(1);
});
