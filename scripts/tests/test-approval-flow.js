// Test script to verify approval flow
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
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

async function testApprovalFlow() {
    try {
        console.log('🔍 Testing approval flow...');
        
        const requestId = '6894274655ae453778d2ddc9';
        
        // Check current status
        const request = await MonthlyRequest.findById(requestId);
        console.log('📋 Current request status:', request.status);
        
        // Check if expenses exist
        const expenses = await Expense.find({ monthlyRequestId: requestId });
        console.log('💰 Existing expenses:', expenses.length);
        
        // Check if transactions exist
        const transactions = await TransactionEntry.find({ 
            sourceId: requestId,
            source: { $in: ['expense_payment', 'maintenance_approval'] }
        });
        console.log('💳 Existing transactions:', transactions.length);
        
        // Simulate the approval flow
        console.log('\n🔄 Simulating approval flow...');
        
        // Step 1: Set status to approved (what the button does)
        request.status = 'approved';
        request.approvedBy = '67f4ef0fcb87ffa3fb7e2d73';
        request.approvedAt = new Date();
        request.approvedByEmail = 'finance@alamait.com';
        request.notes = 'Approved by Finance';
        
        await request.save();
        console.log('✅ Step 1: Status set to approved');
        
        // Step 2: Check if convertRequestToExpenses should be called
        console.log('\n🔍 Step 2: Checking conversion logic...');
        console.log('   isTemplate:', request.isTemplate);
        console.log('   status:', request.status);
        console.log('   approved:', true);
        
        if (request.isTemplate) {
            console.log('   → Template logic would be used');
        } else {
            console.log('   → Regular request logic would be used');
            console.log('   → convertRequestToExpenses should be called');
        }
        
        // Step 3: Check what convertRequestToExpenses does
        console.log('\n🔍 Step 3: What convertRequestToExpenses does...');
        console.log('   → Creates expenses for each item');
        console.log('   → Creates double-entry transactions');
        console.log('   → Sets status to "completed"');
        console.log('   → Updates request history');
        
        // Step 4: Check current state after approval
        const updatedRequest = await MonthlyRequest.findById(requestId);
        console.log('\n📋 Step 4: Current state after approval:');
        console.log('   Status:', updatedRequest.status);
        console.log('   Approved by:', updatedRequest.approvedBy);
        console.log('   Approved at:', updatedRequest.approvedAt);
        
        // Step 5: Check if expenses were created
        const updatedExpenses = await Expense.find({ monthlyRequestId: requestId });
        console.log('\n💰 Step 5: Expenses after approval:');
        console.log('   Count:', updatedExpenses.length);
        updatedExpenses.forEach(expense => {
            console.log(`   - ${expense.expenseId}: $${expense.amount} (${expense.category})`);
        });
        
        // Step 6: Check if transactions were created
        const updatedTransactions = await TransactionEntry.find({ 
            sourceId: requestId,
            source: { $in: ['expense_payment', 'maintenance_approval'] }
        });
        console.log('\n💳 Step 6: Transactions after approval:');
        console.log('   Count:', updatedTransactions.length);
        updatedTransactions.forEach(transaction => {
            console.log(`   - ${transaction.transactionId}: $${transaction.totalDebit} debit, $${transaction.totalCredit} credit`);
        });
        
        console.log('\n🎯 Analysis:');
        if (updatedRequest.status === 'approved' && updatedExpenses.length === 0) {
            console.log('❌ ISSUE: Status is approved but no expenses created');
            console.log('   → convertRequestToExpenses was not called or failed silently');
        } else if (updatedRequest.status === 'completed' && updatedExpenses.length > 0) {
            console.log('✅ SUCCESS: Status is completed and expenses created');
        } else if (updatedRequest.status === 'approved' && updatedExpenses.length > 0) {
            console.log('⚠️ PARTIAL: Status is approved but expenses exist');
            console.log('   → convertRequestToExpenses was called but status not updated');
        }
        
    } catch (error) {
        console.error('❌ Error testing approval flow:', error);
    } finally {
        mongoose.connection.close();
    }
}

console.log('🚀 Starting approval flow test...');
testApprovalFlow().then(() => {
    console.log('✅ Test completed!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
