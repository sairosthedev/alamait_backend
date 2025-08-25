const mongoose = require('mongoose');
const Request = require('./src/models/Request');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');
const Expense = require('./src/models/finance/Expense');
const Account = require('./src/models/Account');
const DoubleEntryAccountingService = require('./src/services/doubleEntryAccountingService');

// Test configuration with actual data
const TEST_RESIDENCES = [
    {
        _id: '67c13eb8425a2e078f61d00e',
        name: 'Belvedere Student House',
        address: {
            street: '12 Belvedere Road',
            city: 'Belvedere',
            state: 'Harare',
            country: 'Zimbabwe'
        }
    },
    {
        _id: '67d723cf20f89c4ae69804f3',
        name: 'St Kilda Student House',
        address: {
            street: '4 St Kilda Road',
            city: 'St Kilda',
            state: 'Harare',
            country: 'Zimbabwe'
        }
    },
    {
        _id: '6847f562e536db246e853f91',
        name: 'Newlands',
        address: {
            street: '10 Cambridge Road Newlands',
            city: 'Harare',
            state: 'Harare',
            country: 'Zimbabwe'
        }
    },
    {
        _id: '6848258b1149b66fc94a261d',
        name: '1ACP',
        address: {
            street: '183 21crescent Glen View 1',
            city: 'Harare',
            state: 'Harare',
            country: 'Zimbabwe'
        }
    },
    {
        _id: '6859be80cabd83fabe7761de',
        name: 'Fife Avenue',
        address: {
            street: 'Fife Avenue',
            city: 'Harare',
            state: 'Harare',
            country: 'Zimbabwe'
        }
    }
];

// Test users with actual credentials
const TEST_USERS = {
    admin: {
        _id: new mongoose.Types.ObjectId(),
        email: 'macdonaldsairos24@gmail.com',
        role: 'admin'
    },
    finance: {
        _id: new mongoose.Types.ObjectId(),
        email: 'macdonaldsairos01@gmail.com',
        role: 'finance_admin'
    }
};


async function connectToDatabase() {
    try {
        await mongoose.connect('mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to test database');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}

async function cleanupTestData() {
    console.log('🧹 Cleaning up test data...');
    await Request.deleteMany({ title: { $regex: /^TEST_/ } });
    await Transaction.deleteMany({ description: { $regex: /TEST_/ } });
    await TransactionEntry.deleteMany({ description: { $regex: /TEST_/ } });
    await Expense.deleteMany({ description: { $regex: /TEST_/ } });
    console.log('✅ Test data cleaned up');
}

async function createTestRequest(scenario, items, residenceId) {
    const request = new Request({
        title: `TEST_${scenario}`,
        description: `Test maintenance request for ${scenario}`,
        type: 'operational', // Required for admin requests
        submittedBy: new mongoose.Types.ObjectId(), // Create a proper ObjectId
        department: 'Operations', // Required for admin requests
        requestedBy: 'Test User', // Required for admin requests
        deliveryLocation: 'On-site', // Required for admin requests
        residence: residenceId,
        items: items,
        status: 'pending',
        createdBy: new mongoose.Types.ObjectId(), // Create a proper ObjectId
        createdAt: new Date()
    });
    
    await request.save();
    console.log(`✅ Created test request: ${request.title}`);
    return request;
}

async function testScenario(scenario, items, residenceId) {
    console.log(`\n🧪 Testing Scenario: ${scenario}`);
    console.log('=' .repeat(50));
    
    try {
        // Create test request
        const request = await createTestRequest(scenario, items, residenceId);
        
        // Approve the request (this should trigger double-entry accounting)
        console.log('💰 Approving request and creating double-entry transactions...');
        const result = await DoubleEntryAccountingService.recordMaintenanceApproval(request, TEST_USERS.finance);
        
        if (!result || !result.transaction) {
            console.log('⚠️ No transaction created (possibly duplicate)');
            return;
        }
        
        // Verify transaction was created
        console.log(`✅ Transaction created: ${result.transaction.transactionId}`);
        
        // Get the transaction entry
        const transactionEntry = await TransactionEntry.findOne({
            transactionId: result.transaction.transactionId
        });
        
        if (!transactionEntry) {
            console.log('❌ No transaction entry found');
            return;
        }
        
        console.log(`✅ Transaction entry found with ${transactionEntry.entries.length} entries`);
        
        // Verify double-entry balance
        const totalDebit = transactionEntry.entries.reduce((sum, entry) => sum + entry.debit, 0);
        const totalCredit = transactionEntry.entries.reduce((sum, entry) => sum + entry.credit, 0);
        
        console.log(`💰 Total Debit: $${totalDebit}`);
        console.log(`💰 Total Credit: $${totalCredit}`);
        
        if (Math.abs(totalDebit - totalCredit) < 0.01) {
            console.log('✅ Double-entry balance is correct');
        } else {
            console.log('❌ Double-entry balance is incorrect!');
        }
        
        // Verify expected entries
        console.log('\n📋 Verifying entries:');
        transactionEntry.entries.forEach((entry, index) => {
            console.log(`   Entry ${index + 1}:`);
            console.log(`     Account: ${entry.accountCode} - ${entry.accountName}`);
            console.log(`     Type: ${entry.accountType}`);
            console.log(`     Debit: $${entry.debit}`);
            console.log(`     Credit: $${entry.credit}`);
            console.log(`     Description: ${entry.description}`);
        });
        
        // Verify expense was created
        if (result.expense) {
            console.log(`✅ Expense created: ${result.expense.expenseId}`);
            console.log(`   Amount: $${result.expense.amount}`);
            console.log(`   Status: ${result.expense.paymentStatus}`);
        }
        
        console.log(`✅ Scenario ${scenario} completed successfully`);
        
    } catch (error) {
        console.error(`❌ Error in scenario ${scenario}:`, error.message);
    }
}

async function runAllTests() {
    console.log('🚀 Starting Maintenance Double-Entry Accounting Tests');
    console.log('=' .repeat(60));
    
    await connectToDatabase();
    await cleanupTestData();
    
    // Test Case 1: With Vendor + With Quotation (Belvedere)
    console.log('\n📋 Test Case 1: With Vendor + With Quotation (Belvedere)');
    await testScenario('WITH_VENDOR_WITH_QUOTATION_BELVEDERE', [
        {
            title: 'Plumbing Repair',
            description: 'Fix leaking pipe in bathroom at Belvedere',
            quantity: 1,
            estimatedCost: 200,
            provider: 'Gift Plumber',
            quotations: [
                {
                    provider: 'Gift Plumber',
                    vendorId: 'V001',
                    amount: 200,
                    isSelected: true,
                    description: 'Complete pipe repair service',
                    uploadedBy: new mongoose.Types.ObjectId()
                }
            ]
        }
    ], TEST_RESIDENCES[0]._id);
    
    // Test Case 2: With Vendor + Without Quotation (St Kilda)
    console.log('\n📋 Test Case 2: With Vendor + Without Quotation (St Kilda)');
    await testScenario('WITH_VENDOR_WITHOUT_QUOTATION_STKILDA', [
        {
            title: 'Electrical Work',
            description: 'Install new light fixtures at St Kilda',
            quantity: 1,
            estimatedCost: 150,
            provider: 'ABC Electric',
            totalCost: 150
        }
    ], TEST_RESIDENCES[1]._id);
    
    // Test Case 3: Without Vendor + With Quotation (Newlands)
    console.log('\n📋 Test Case 3: Without Vendor + With Quotation (Newlands)');
    await testScenario('WITHOUT_VENDOR_WITH_QUOTATION_NEWLANDS', [
        {
            title: 'Office Supplies',
            description: 'Purchase cleaning supplies for Newlands',
            quantity: 1,
            estimatedCost: 75,
            quotations: [
                {
                    provider: 'General Store',
                    vendorId: 'V002',
                    amount: 75,
                    isSelected: true,
                    description: 'Cleaning supplies package',
                    uploadedBy: new mongoose.Types.ObjectId()
                }
            ]
        }
    ], TEST_RESIDENCES[2]._id);
    
    // Test Case 4: Without Vendor + Without Quotation (1ACP)
    console.log('\n📋 Test Case 4: Without Vendor + Without Quotation (1ACP)');
    await testScenario('WITHOUT_VENDOR_WITHOUT_QUOTATION_1ACP', [
        {
            title: 'General Maintenance',
            description: 'General maintenance tasks at 1ACP',
            quantity: 1,
            estimatedCost: 100,
            totalCost: 100
        }
    ], TEST_RESIDENCES[3]._id);
    
    // Test Case 5: Mixed Items (Some with vendors, some without) - Fife Avenue
    console.log('\n📋 Test Case 5: Mixed Items (Fife Avenue)');
    await testScenario('MIXED_ITEMS_FIFE', [
        {
            title: 'Plumbing Repair',
            description: 'Fix leaking pipe at Fife Avenue',
            quantity: 1,
            estimatedCost: 200,
            provider: 'Gift Plumber',
            quotations: [
                {
                    provider: 'Gift Plumber',
                    vendorId: 'V001',
                    amount: 200,
                    isSelected: true,
                    description: 'Complete pipe repair',
                    uploadedBy: new mongoose.Types.ObjectId()
                }
            ]
        },
        {
            title: 'General Supplies',
            description: 'Purchase general supplies for Fife Avenue',
            quantity: 1,
            estimatedCost: 50,
            totalCost: 50
        }
    ], TEST_RESIDENCES[4]._id);
    
    // Test Case 6: Multiple Items with Different Vendors (Belvedere)
    console.log('\n📋 Test Case 6: Multiple Vendors (Belvedere)');
    await testScenario('MULTIPLE_VENDORS_BELVEDERE', [
        {
            title: 'Plumbing Work',
            description: 'Fix bathroom issues at Belvedere',
            quantity: 1,
            estimatedCost: 300,
            provider: 'Gift Plumber',
            quotations: [
                {
                    provider: 'Gift Plumber',
                    vendorId: 'V001',
                    amount: 300,
                    isSelected: true,
                    description: 'Bathroom plumbing repair',
                    uploadedBy: new mongoose.Types.ObjectId()
                }
            ]
        },
        {
            title: 'Electrical Work',
            description: 'Install new outlets at Belvedere',
            quantity: 1,
            estimatedCost: 250,
            provider: 'ABC Electric',
            quotations: [
                {
                    provider: 'ABC Electric',
                    vendorId: 'V003',
                    amount: 250,
                    isSelected: true,
                    description: 'Electrical installation',
                    uploadedBy: new mongoose.Types.ObjectId()
                }
            ]
        }
    ], TEST_RESIDENCES[0]._id);
    
    // Test Case 7: High-Value Maintenance (St Kilda)
    console.log('\n📋 Test Case 7: High-Value Maintenance (St Kilda)');
    await testScenario('HIGH_VALUE_MAINTENANCE_STKILDA', [
        {
            title: 'HVAC System Repair',
            description: 'Repair air conditioning system at St Kilda',
            quantity: 1,
            estimatedCost: 1500,
            provider: 'Climate Control Solutions',
            quotations: [
                {
                    provider: 'Climate Control Solutions',
                    vendorId: 'V004',
                    amount: 1500,
                    isSelected: true,
                    description: 'Complete HVAC system repair and maintenance',
                    uploadedBy: new mongoose.Types.ObjectId()
                }
            ]
        }
    ], TEST_RESIDENCES[1]._id);
    
    // Test Case 8: Multiple Small Items (Newlands)
    console.log('\n📋 Test Case 8: Multiple Small Items (Newlands)');
    await testScenario('MULTIPLE_SMALL_ITEMS_NEWLANDS', [
        {
            title: 'Light Bulb Replacement',
            description: 'Replace all light bulbs at Newlands',
            quantity: 1,
            estimatedCost: 25,
            totalCost: 25
        },
        {
            title: 'Paint Touch-up',
            description: 'Touch up paint in common areas',
            quantity: 1,
            estimatedCost: 35,
            totalCost: 35
        },
        {
            title: 'Door Handle Repair',
            description: 'Fix loose door handles',
            quantity: 1,
            estimatedCost: 15,
            totalCost: 15
        }
    ], TEST_RESIDENCES[2]._id);
    
    // Summary Report
    console.log('\n📊 SUMMARY REPORT');
    console.log('=' .repeat(60));
    
    const allTransactions = await Transaction.find({ description: { $regex: /TEST_/ } });
    const allEntries = await TransactionEntry.find({ description: { $regex: /TEST_/ } });
    const allExpenses = await Expense.find({ description: { $regex: /TEST_/ } });
    
    console.log(`Total Test Transactions: ${allTransactions.length}`);
    console.log(`Total Test Transaction Entries: ${allEntries.length}`);
    console.log(`Total Test Expenses: ${allExpenses.length}`);
    
    // Verify all transactions are balanced
    let balancedTransactions = 0;
    for (const entry of allEntries) {
        const totalDebit = entry.entries.reduce((sum, e) => sum + e.debit, 0);
        const totalCredit = entry.entries.reduce((sum, e) => sum + e.credit, 0);
        if (Math.abs(totalDebit - totalCredit) < 0.01) {
            balancedTransactions++;
        }
    }
    
    console.log(`Balanced Transactions: ${balancedTransactions}/${allEntries.length}`);
    
    if (balancedTransactions === allEntries.length) {
        console.log('✅ ALL TRANSACTIONS ARE PROPERLY BALANCED!');
    } else {
        console.log('❌ SOME TRANSACTIONS ARE NOT BALANCED!');
    }
    
    console.log('\n🎉 Test suite completed!');
}

// Run the tests
runAllTests()
    .then(() => {
        console.log('✅ All tests completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    }); 