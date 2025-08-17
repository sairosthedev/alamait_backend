// Test script to see what happens when approving a completed request
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Import models
require('../src/models/User');
require('../src/models/MonthlyRequest');
require('../src/models/finance/Expense');
require('../src/models/TransactionEntry');
require('../src/models/Residence');

const MonthlyRequest = require('../src/models/MonthlyRequest');
const Expense = require('../src/models/finance/Expense');
const TransactionEntry = require('../src/models/TransactionEntry');

// Import the approval function
const { approveMonthlyRequest } = require('../src/controllers/monthlyRequestController');

async function testCompletedRequestApproval() {
    try {
        console.log('🔍 Testing approval of a completed request...\n');

        // Find a completed request
        const completedRequest = await MonthlyRequest.findOne({ 
            status: 'completed',
            isTemplate: false 
        }).populate('residence', 'name');

        if (!completedRequest) {
            console.log('❌ No completed requests found');
            return;
        }

        console.log('📋 Found completed request:');
        console.log(`   ID: ${completedRequest._id}`);
        console.log(`   Title: ${completedRequest.title}`);
        console.log(`   Status: ${completedRequest.status}`);
        console.log(`   Items: ${completedRequest.items.length}`);

        // Check current expenses
        const currentExpenses = await Expense.find({ 
            monthlyRequestId: completedRequest._id 
        });
        console.log(`   💰 Current expenses: ${currentExpenses.length}`);

        // Simulate the frontend API call
        const mockReq = {
            params: { id: completedRequest._id },
            body: {
                approved: true,
                status: 'completed',
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

        console.log('\n🔄 Simulating frontend API call on completed request...');

        // Call the approval function
        await approveMonthlyRequest(mockReq, mockRes);

        // Check if any new expenses were created
        const newExpenses = await Expense.find({ 
            monthlyRequestId: completedRequest._id 
        });

        console.log(`\n💰 Total expenses after approval: ${newExpenses.length}`);
        if (newExpenses.length > currentExpenses.length) {
            console.log('✅ New expenses were created!');
            newExpenses.slice(currentExpenses.length).forEach((expense, index) => {
                console.log(`   ${index + 1}. ${expense.title} - $${expense.amount} (${expense.category})`);
            });
        } else {
            console.log('❌ No new expenses were created');
        }

    } catch (error) {
        console.error('❌ Test error:', error);
        console.error('Error stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Test completed');
    }
}

testCompletedRequestApproval(); 