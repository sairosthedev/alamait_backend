const mongoose = require('mongoose');
const Request = require('./src/models/Request');
const Expense = require('./src/models/finance/Expense');

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function testItemizedExpenseCreation() {
    try {
        console.log('🧪 Testing Itemized Expense Creation System');
        console.log('==========================================\n');

        // Find requests with items that have financeStatus = 'approved'
        const approvedRequests = await Request.find({ 
            financeStatus: 'approved',
            'items.0': { $exists: true } // Has at least one item
        }).populate('residence', 'name');

        console.log(`📊 Found ${approvedRequests.length} approved requests with items`);

        if (approvedRequests.length === 0) {
            console.log('⚠️  No approved requests with items found. Creating test data...');
            await createTestRequest();
            return;
        }

        // Check each approved request
        for (const request of approvedRequests) {
            console.log(`\n🔍 Checking request: ${request._id}`);
            console.log(`   Title: ${request.title}`);
            console.log(`   Items: ${request.items.length}`);
            console.log(`   Converted to expense: ${request.convertedToExpense}`);

            // Check if expenses exist for this request
            const expenses = await Expense.find({ requestId: request._id });
            console.log(`   Expenses found: ${expenses.length}`);

            if (expenses.length === 0) {
                console.log('   ❌ No expenses found for this approved request!');
            } else {
                console.log('   ✅ Expenses found:');
                expenses.forEach((expense, index) => {
                    console.log(`     ${index + 1}. ${expense.expenseId} - $${expense.amount} - ${expense.description}`);
                    if (expense.vendorName) {
                        console.log(`        Vendor: ${expense.vendorName}`);
                    }
                    if (expense.itemIndex !== undefined) {
                        console.log(`        Item Index: ${expense.itemIndex}`);
                    }
                });
            }

            // Check items and their quotations
            console.log('   📋 Items and quotations:');
            request.items.forEach((item, index) => {
                console.log(`     Item ${index}: ${item.description}`);
                console.log(`       Estimated cost: $${item.estimatedCost || item.totalCost || 0}`);
                
                if (item.quotations && item.quotations.length > 0) {
                    console.log(`       Quotations: ${item.quotations.length}`);
                    item.quotations.forEach((quotation, qIndex) => {
                        const status = quotation.isSelected ? '✅ SELECTED' : '❌ Not selected';
                        console.log(`         ${qIndex + 1}. ${quotation.provider} - $${quotation.amount} - ${status}`);
                    });
                } else {
                    console.log(`       No quotations`);
                }
            });
        }

        // Summary
        console.log('\n📈 SUMMARY');
        console.log('==========');
        const totalExpenses = await Expense.countDocuments({});
        const requestsWithExpenses = await Request.countDocuments({ 
            financeStatus: 'approved', 
            convertedToExpense: true 
        });
        
        console.log(`Total expenses in system: ${totalExpenses}`);
        console.log(`Approved requests converted to expenses: ${requestsWithExpenses}`);
        console.log(`Approved requests with items: ${approvedRequests.length}`);

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

async function createTestRequest() {
    try {
        console.log('Creating test request with items and quotations...');
        
        // Create a test request with items and quotations
        const testRequest = new Request({
            title: 'Test Request with Items',
            description: 'Test request for expense creation',
            type: 'operational',
            submittedBy: new mongoose.Types.ObjectId(),
            residence: new mongoose.Types.ObjectId(),
            status: 'pending',
            financeStatus: 'approved',
            items: [
                {
                    description: 'Item 1 - With Quotation',
                    quantity: 1,
                    unitCost: 100,
                    totalCost: 100,
                    estimatedCost: 100,
                    category: 'supplies',
                    quotations: [
                        {
                            provider: 'Test Vendor 1',
                            amount: 90,
                            description: 'Best quote',
                            isSelected: true,
                            selectedBy: new mongoose.Types.ObjectId(),
                            selectedAt: new Date(),
                            vendorId: new mongoose.Types.ObjectId(),
                            vendorName: 'Test Vendor 1',
                            vendorCode: 'V001',
                            vendorType: 'supplier'
                        },
                        {
                            provider: 'Test Vendor 2',
                            amount: 110,
                            description: 'Alternative quote',
                            isSelected: false
                        }
                    ]
                },
                {
                    description: 'Item 2 - Without Quotation',
                    quantity: 1,
                    unitCost: 200,
                    totalCost: 200,
                    estimatedCost: 200,
                    category: 'equipment',
                    quotations: []
                }
            ]
        });

        await testRequest.save();
        console.log('✅ Test request created:', testRequest._id);
        
        // Now test the expense creation
        await testItemizedExpenseCreation();
        
    } catch (error) {
        console.error('❌ Error creating test request:', error);
    }
}

// Run the test
connectDB().then(() => {
    testItemizedExpenseCreation();
}); 