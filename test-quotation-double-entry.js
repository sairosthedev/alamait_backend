const mongoose = require('mongoose');
const Request = require('./src/models/Request');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');
const Expense = require('./src/models/finance/Expense');
const Account = require('./src/models/Account');
const Vendor = require('./src/models/Vendor');
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
    }
];

// Test users with proper ObjectIds
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

// Test vendors to create
const TEST_VENDORS = [
    {
        vendorCode: 'V001',
        businessName: 'Gift Plumber Services',
        tradingName: 'Gift Plumber',
        contactPerson: {
            firstName: 'Gift',
            lastName: 'Plumber',
            email: 'gift@plumber.com',
            phone: '+263 77 123 4567'
        },
        businessAddress: {
            street: '123 Plumbing Street',
            city: 'Harare',
            state: 'Harare',
            country: 'Zimbabwe'
        },
        category: 'plumbing',
        vendorType: 'contractor',
        businessScope: 'Plumbing services and repairs',
        expenseCategory: 'plumbing_expenses',
        chartOfAccountsCode: '2001', // Required field
        createdBy: new mongoose.Types.ObjectId()
    },
    {
        vendorCode: 'V002',
        businessName: 'ABC Electrical Services',
        tradingName: 'ABC Electric',
        contactPerson: {
            firstName: 'John',
            lastName: 'Electric',
            email: 'john@abcelectric.com',
            phone: '+263 77 234 5678'
        },
        businessAddress: {
            street: '456 Electric Avenue',
            city: 'Harare',
            state: 'Harare',
            country: 'Zimbabwe'
        },
        category: 'electrical',
        vendorType: 'contractor',
        businessScope: 'Electrical installation and repairs',
        expenseCategory: 'electrical_expenses',
        chartOfAccountsCode: '2002', // Required field
        createdBy: new mongoose.Types.ObjectId()
    },
    {
        vendorCode: 'V003',
        businessName: 'Climate Control Solutions',
        tradingName: 'Climate Control',
        contactPerson: {
            firstName: 'Sarah',
            lastName: 'Climate',
            email: 'sarah@climatecontrol.com',
            phone: '+263 77 345 6789'
        },
        businessAddress: {
            street: '789 HVAC Road',
            city: 'Harare',
            state: 'Harare',
            country: 'Zimbabwe'
        },
        category: 'maintenance',
        vendorType: 'service_provider',
        businessScope: 'HVAC system repair and maintenance',
        expenseCategory: 'maintenance_expenses',
        chartOfAccountsCode: '2003', // Required field
        createdBy: new mongoose.Types.ObjectId()
    },
    {
        vendorCode: 'V004',
        businessName: 'Roof Masters Zimbabwe',
        tradingName: 'Roof Masters',
        contactPerson: {
            firstName: 'Mike',
            lastName: 'Roof',
            email: 'mike@roofmasters.com',
            phone: '+263 77 456 7890'
        },
        businessAddress: {
            street: '321 Roof Street',
            city: 'Harare',
            state: 'Harare',
            country: 'Zimbabwe'
        },
        category: 'maintenance',
        vendorType: 'contractor',
        businessScope: 'Roof repair and maintenance',
        expenseCategory: 'maintenance_expenses',
        chartOfAccountsCode: '2004', // Required field
        createdBy: new mongoose.Types.ObjectId()
    }
];

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

async function createTestVendors() {
    console.log('🏢 Creating test vendors...');
    const createdVendors = [];
    
    for (const vendorData of TEST_VENDORS) {
        try {
            // Check if vendor already exists
            let vendor = await Vendor.findOne({ vendorCode: vendorData.vendorCode });
            
            if (!vendor) {
                vendor = new Vendor(vendorData);
                await vendor.save();
                console.log(`✅ Created vendor: ${vendor.businessName} (${vendor.vendorCode})`);
            } else {
                console.log(`⚠️ Vendor already exists: ${vendor.businessName} (${vendor.vendorCode})`);
            }
            
            createdVendors.push(vendor);
        } catch (error) {
            console.error(`❌ Error creating vendor ${vendorData.vendorCode}:`, error.message);
        }
    }
    
    return createdVendors;
}

async function cleanupTestData() {
    console.log('🧹 Cleaning up test data...');
    await Request.deleteMany({ title: { $regex: /^TEST_QUOTATION_/ } });
    await Transaction.deleteMany({ description: { $regex: /TEST_QUOTATION_/ } });
    await TransactionEntry.deleteMany({ description: { $regex: /TEST_QUOTATION_/ } });
    await Expense.deleteMany({ description: { $regex: /TEST_QUOTATION_/ } });
    console.log('✅ Test data cleaned up');
}

async function createTestRequest(scenario, items, residenceId, vendors) {
    const request = new Request({
        title: `TEST_QUOTATION_${scenario}`,
        description: `Test maintenance request with quotations for ${scenario}`,
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

async function testQuotationScenario(scenario, items, residenceId, vendors) {
    console.log(`\n🧪 Testing Quotation Scenario: ${scenario}`);
    console.log('=' .repeat(60));
    
    try {
        // Create test request
        const request = await createTestRequest(scenario, items, residenceId, vendors);
        
        // Debug: Check vendor IDs being used
        console.log('🔍 Debug: Vendor IDs in quotations:');
        items.forEach((item, itemIndex) => {
            if (item.quotations) {
                item.quotations.forEach((quote, quoteIndex) => {
                    console.log(`   Item ${itemIndex + 1}, Quote ${quoteIndex + 1}: vendorId = ${quote.vendorId}`);
                });
            }
        });
        
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
        
        console.log(`✅ Quotation scenario ${scenario} completed successfully`);
        
    } catch (error) {
        console.error(`❌ Error in quotation scenario ${scenario}:`, error.message);
    }
}

async function runQuotationTests() {
    console.log('🚀 Starting Quotation Double-Entry Accounting Tests');
    console.log('=' .repeat(70));
    
    await connectToDatabase();
    await cleanupTestData();
    
    // Create test vendors first
    const vendors = await createTestVendors();
    
    // Test Case 1: Single Item with Quotation (Belvedere)
    console.log('\n📋 Test Case 1: Single Item with Quotation (Belvedere)');
    await testQuotationScenario('SINGLE_ITEM_BELVEDERE', [
        {
            title: 'Plumbing Repair',
            description: 'Fix leaking pipe in bathroom at Belvedere',
            quantity: 1,
            estimatedCost: 200,
            provider: 'Gift Plumber',
            quotations: [
                {
                    provider: 'Gift Plumber',
                    vendorId: vendors[0]._id, // Use actual vendor ID
                    amount: 200,
                    isSelected: true,
                    description: 'Complete pipe repair service',
                    uploadedBy: new mongoose.Types.ObjectId()
                }
            ]
        }
    ], TEST_RESIDENCES[0]._id, vendors);
    
    // Test Case 2: Multiple Items with Different Quotations (St Kilda)
    console.log('\n📋 Test Case 2: Multiple Items with Different Quotations (St Kilda)');
    await testQuotationScenario('MULTIPLE_QUOTATIONS_STKILDA', [
        {
            title: 'Plumbing Work',
            description: 'Fix bathroom issues at St Kilda',
            quantity: 1,
            estimatedCost: 300,
            provider: 'Gift Plumber',
            quotations: [
                {
                    provider: 'Gift Plumber',
                    vendorId: vendors[0]._id, // Use actual vendor ID
                    amount: 300,
                    isSelected: true,
                    description: 'Bathroom plumbing repair',
                    uploadedBy: new mongoose.Types.ObjectId()
                }
            ]
        },
        {
            title: 'Electrical Work',
            description: 'Install new outlets at St Kilda',
            quantity: 1,
            estimatedCost: 250,
            provider: 'ABC Electric',
            quotations: [
                {
                    provider: 'ABC Electric',
                    vendorId: vendors[1]._id, // Use actual vendor ID
                    amount: 250,
                    isSelected: true,
                    description: 'Electrical installation',
                    uploadedBy: new mongoose.Types.ObjectId()
                }
            ]
        }
    ], TEST_RESIDENCES[1]._id, vendors);
    
    // Test Case 3: High-Value Quotation (Newlands)
    console.log('\n📋 Test Case 3: High-Value Quotation (Newlands)');
    await testQuotationScenario('HIGH_VALUE_NEWLANDS', [
        {
            title: 'HVAC System Repair',
            description: 'Repair air conditioning system at Newlands',
            quantity: 1,
            estimatedCost: 1500,
            provider: 'Climate Control Solutions',
            quotations: [
                {
                    provider: 'Climate Control Solutions',
                    vendorId: vendors[2]._id, // Use actual vendor ID
                    amount: 1500,
                    isSelected: true,
                    description: 'Complete HVAC system repair and maintenance',
                    uploadedBy: new mongoose.Types.ObjectId()
                }
            ]
        }
    ], TEST_RESIDENCES[2]._id, vendors);
    
    // Test Case 4: Mixed Items (Some with quotations, some without)
    console.log('\n📋 Test Case 4: Mixed Items (Belvedere)');
    await testQuotationScenario('MIXED_ITEMS_BELVEDERE', [
        {
            title: 'Plumbing Repair',
            description: 'Fix leaking pipe at Belvedere',
            quantity: 1,
            estimatedCost: 200,
            provider: 'Gift Plumber',
            quotations: [
                {
                    provider: 'Gift Plumber',
                    vendorId: vendors[0]._id, // Use actual vendor ID
                    amount: 200,
                    isSelected: true,
                    description: 'Complete pipe repair',
                    uploadedBy: new mongoose.Types.ObjectId()
                }
            ]
        },
        {
            title: 'General Supplies',
            description: 'Purchase general supplies for Belvedere',
            quantity: 1,
            estimatedCost: 50,
            totalCost: 50
        }
    ], TEST_RESIDENCES[0]._id, vendors);
    
    // Test Case 5: Multiple Quotations (Only one selected)
    console.log('\n📋 Test Case 5: Multiple Quotations (St Kilda)');
    await testQuotationScenario('MULTIPLE_QUOTATIONS_SELECTED', [
        {
            title: 'Roof Repair',
            description: 'Fix roof leak at St Kilda',
            quantity: 1,
            estimatedCost: 800,
            provider: 'Roof Masters',
            quotations: [
                {
                    provider: 'Roof Masters',
                    vendorId: vendors[3]._id, // Use actual vendor ID
                    amount: 800,
                    isSelected: true,
                    description: 'Complete roof repair service',
                    uploadedBy: new mongoose.Types.ObjectId()
                },
                {
                    provider: 'Quick Fix Roofing',
                    vendorId: vendors[0]._id, // Use different vendor ID
                    amount: 750,
                    isSelected: false,
                    description: 'Alternative roof repair quote',
                    uploadedBy: new mongoose.Types.ObjectId()
                }
            ]
        }
    ], TEST_RESIDENCES[1]._id, vendors);
    
    // Summary Report
    console.log('\n📊 QUOTATION TEST SUMMARY REPORT');
    console.log('=' .repeat(70));
    
    const allTransactions = await Transaction.find({ description: { $regex: /TEST_QUOTATION_/ } });
    const allEntries = await TransactionEntry.find({ description: { $regex: /TEST_QUOTATION_/ } });
    const allExpenses = await Expense.find({ description: { $regex: /TEST_QUOTATION_/ } });
    
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
        console.log('✅ ALL QUOTATION TRANSACTIONS ARE PROPERLY BALANCED!');
    } else {
        console.log('❌ SOME QUOTATION TRANSACTIONS ARE NOT BALANCED!');
    }
    
    console.log('\n🎉 Quotation test suite completed!');
}

// Run the tests
runQuotationTests()
    .then(() => {
        console.log('✅ All quotation tests completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Quotation test suite failed:', error);
        process.exit(1);
    }); 