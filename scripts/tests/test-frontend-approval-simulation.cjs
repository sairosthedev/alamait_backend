// Test script to simulate the exact frontend approval API call
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

// Import the approval function
const { approveMonthlyRequest } = require('./src/controllers/monthlyRequestController');

async function testFrontendApprovalSimulation() {
    try {
        console.log('🔍 Simulating frontend approval API call...\n');

        // Find a pending request to test with
        const pendingRequest = await MonthlyRequest.findOne({ 
            status: 'pending',
            isTemplate: false 
        }).populate('residence', 'name');

        if (!pendingRequest) {
            console.log('❌ No pending requests found');
            return;
        }

        console.log('📋 Found pending request:');
        console.log(`   ID: ${pendingRequest._id}`);
        console.log(`   Title: ${pendingRequest.title}`);
        console.log(`   Status: ${pendingRequest.status}`);
        console.log(`   Items: ${pendingRequest.items.length}`);

        // Simulate the EXACT frontend API call
        const mockReq = {
            params: { id: pendingRequest._id },
            body: {
                approved: true,
                status: 'completed',  // This is what frontend sends
                notes: 'Approved by Finance - Status set to completed'
            },
            user: {
                _id: '67f4ef0fcb87ffa3fb7e2d73',
                firstName: 'Finance',
                lastName: 'User',
                email: 'finance@alamait.com',
                role: 'finance'
            }
        };

        // Create a mock response object
        const mockRes = {
            status: (code) => ({
                json: (data) => {
                    console.log(`📤 Response Status: ${code}`);
                    console.log('📤 Response Data:', JSON.stringify(data, null, 2));
                    return mockRes;
                }
            })
        };

        console.log('\n🔄 Simulating frontend API call:');
        console.log('📤 Request Body:', JSON.stringify(mockReq.body, null, 2));

        // Call the approval function
        await approveMonthlyRequest(mockReq, mockRes);

        // Check the updated request
        const updatedRequest = await MonthlyRequest.findById(pendingRequest._id);
        console.log('\n📋 Updated request status:', updatedRequest.status);

        // Check if expenses were created
        const expenses = await Expense.find({ 
            monthlyRequestId: pendingRequest._id 
        });

        console.log(`\n💰 Expenses created: ${expenses.length}`);
        if (expenses.length > 0) {
            expenses.forEach((expense, index) => {
                console.log(`   ${index + 1}. ${expense.title} - $${expense.amount} (${expense.category})`);
            });
        } else {
            console.log('   ❌ NO EXPENSES CREATED - This is the problem!');
        }

        // Check if transaction entries were created
        const transactions = await TransactionEntry.find({ 
            sourceType: 'monthly_request',
            sourceId: pendingRequest._id 
        });

        console.log(`\n💳 Transaction entries created: ${transactions.length}`);
        if (transactions.length > 0) {
            transactions.forEach((transaction, index) => {
                console.log(`   ${index + 1}. ${transaction.description} - $${transaction.amount} (${transaction.type})`);
            });
        }

    } catch (error) {
        console.error('❌ Test error:', error);
        console.error('Error stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Test completed');
    }
}

testFrontendApprovalSimulation(); 