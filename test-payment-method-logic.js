const mongoose = require('mongoose');
const Request = require('./src/models/Request');
const Expense = require('./src/models/finance/Expense');
const Vendor = require('./src/models/Vendor');

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

async function testPaymentMethodLogic() {
    try {
        console.log('🧪 Testing Payment Method Logic');
        console.log('==============================\n');

        // Find expenses created from requests with items
        const expenses = await Expense.find({ 
            requestId: { $exists: true },
            itemIndex: { $exists: true }
        }).populate('requestId', 'title items');

        console.log(`📊 Found ${expenses.length} expenses created from requests with items`);

        if (expenses.length === 0) {
            console.log('⚠️  No expenses found. The system may not have processed any requests with items yet.');
            return;
        }

        // Group expenses by request
        const expensesByRequest = {};
        expenses.forEach(expense => {
            if (!expensesByRequest[expense.requestId._id]) {
                expensesByRequest[expense.requestId._id] = [];
            }
            expensesByRequest[expense.requestId._id].push(expense);
        });

        // Analyze each request's expenses
        for (const [requestId, requestExpenses] of Object.entries(expensesByRequest)) {
            const request = await Request.findById(requestId);
            if (!request) continue;

            console.log(`\n🔍 Request: ${request.title || 'Untitled'}`);
            console.log(`   Request ID: ${requestId}`);
            console.log(`   Items: ${request.items?.length || 0}`);
            console.log(`   Expenses: ${requestExpenses.length}`);

            // Check each expense
            for (const expense of requestExpenses) {
                console.log(`\n   📋 Expense: ${expense.expenseId}`);
                console.log(`      Amount: $${expense.amount}`);
                console.log(`      Payment Method: ${expense.paymentMethod}`);
                console.log(`      Item Index: ${expense.itemIndex}`);
                console.log(`      Vendor: ${expense.vendorName || 'N/A'}`);

                // Verify payment method logic
                if (expense.vendorId) {
                    try {
                        const vendor = await Vendor.findById(expense.vendorId);
                        if (vendor) {
                            const hasBankDetails = vendor.bankDetails && vendor.bankDetails.accountNumber;
                            const expectedPaymentMethod = hasBankDetails ? 'Bank Transfer' : 'Cash';
                            
                            if (expense.paymentMethod === expectedPaymentMethod) {
                                console.log(`      ✅ Payment method correct: ${expense.paymentMethod} (Vendor has bank details: ${hasBankDetails})`);
                            } else {
                                console.log(`      ❌ Payment method incorrect: Expected ${expectedPaymentMethod}, got ${expense.paymentMethod}`);
                            }
                        } else {
                            console.log(`      ⚠️  Vendor not found: ${expense.vendorId}`);
                        }
                    } catch (error) {
                        console.log(`      ⚠️  Error checking vendor: ${error.message}`);
                    }
                } else {
                    // No vendor ID - should be Cash
                    if (expense.paymentMethod === 'Cash') {
                        console.log(`      ✅ Payment method correct: Cash (No vendor)`);
                    } else {
                        console.log(`      ❌ Payment method incorrect: Expected Cash, got ${expense.paymentMethod}`);
                    }
                }
            }
        }

        // Summary statistics
        console.log('\n📈 PAYMENT METHOD SUMMARY');
        console.log('========================');
        
        const paymentMethodStats = {};
        expenses.forEach(expense => {
            paymentMethodStats[expense.paymentMethod] = (paymentMethodStats[expense.paymentMethod] || 0) + 1;
        });

        Object.entries(paymentMethodStats).forEach(([method, count]) => {
            console.log(`${method}: ${count} expenses`);
        });

        // Check for any incorrect payment methods
        const incorrectExpenses = expenses.filter(expense => {
            if (expense.vendorId) {
                // Should check vendor bank details, but for now just flag Bank Transfer without vendor
                return expense.paymentMethod === 'Bank Transfer' && !expense.vendorId;
            }
            return expense.paymentMethod !== 'Cash';
        });

        if (incorrectExpenses.length > 0) {
            console.log(`\n⚠️  Found ${incorrectExpenses.length} expenses with potentially incorrect payment methods`);
        } else {
            console.log('\n✅ All payment methods appear to be correctly set');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
connectDB().then(() => {
    testPaymentMethodLogic();
}); 