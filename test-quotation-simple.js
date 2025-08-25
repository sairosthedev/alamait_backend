const mongoose = require('mongoose');
const Request = require('./src/models/Request');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');
const Expense = require('./src/models/finance/Expense');
const Vendor = require('./src/models/Vendor');
const DoubleEntryAccountingService = require('./src/services/doubleEntryAccountingService');

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

async function testSimpleQuotation() {
    console.log('🧪 Testing Simple Quotation Scenario');
    console.log('=' .repeat(50));
    
    try {
        // Get an existing vendor
        const vendor = await Vendor.findOne({ vendorCode: 'V001' });
        if (!vendor) {
            console.log('❌ Vendor V001 not found');
            return;
        }
        
        console.log(`✅ Found vendor: ${vendor.businessName} (ID: ${vendor._id})`);
        
        // Create a simple request with quotation
        const request = new Request({
            title: 'TEST_SIMPLE_QUOTATION',
            description: 'Simple test with quotation',
            type: 'operational',
            submittedBy: new mongoose.Types.ObjectId(),
            department: 'Operations',
            requestedBy: 'Test User',
            deliveryLocation: 'On-site',
            residence: '67c13eb8425a2e078f61d00e', // Belvedere
            items: [
                {
                    title: 'Simple Plumbing Repair',
                    description: 'Test plumbing repair',
                    quantity: 1,
                    estimatedCost: 100,
                    provider: 'Gift Plumber',
                    quotations: [
                        {
                            provider: 'Gift Plumber',
                            vendorId: vendor._id, // Use the actual vendor ID
                            amount: 100,
                            isSelected: true,
                            description: 'Simple repair',
                            uploadedBy: new mongoose.Types.ObjectId()
                        }
                    ]
                }
            ],
            status: 'pending',
            createdBy: new mongoose.Types.ObjectId(),
            createdAt: new Date()
        });
        
        await request.save();
        console.log('✅ Created test request');
        
        // Debug: Check the vendor ID in the request
        console.log('🔍 Debug: Request details:');
        console.log(`   Request ID: ${request._id}`);
        console.log(`   Vendor ID in quotation: ${request.items[0].quotations[0].vendorId}`);
        console.log(`   Vendor ID type: ${typeof request.items[0].quotations[0].vendorId}`);
        console.log(`   Vendor ID stringified: ${JSON.stringify(request.items[0].quotations[0].vendorId)}`);
        
        // Test vendor lookup directly
        const testVendor = await Vendor.findById(request.items[0].quotations[0].vendorId);
        console.log(`   Direct vendor lookup result: ${testVendor ? testVendor.businessName : 'null'}`);
        
        // Test the service method directly
        const user = {
            _id: new mongoose.Types.ObjectId(),
            email: 'test@alamait.com',
            role: 'finance_admin'
        };
        
        console.log('💰 Testing maintenance approval...');
        const result = await DoubleEntryAccountingService.recordMaintenanceApproval(request, user);
        
        if (result && result.transaction) {
            console.log('✅ Transaction created successfully!');
            console.log(`   Transaction ID: ${result.transaction.transactionId}`);
            
            // Get transaction entry
            const entry = await TransactionEntry.findOne({ transactionId: result.transaction.transactionId });
            if (entry) {
                console.log(`   Entries count: ${entry.entries.length}`);
                entry.entries.forEach((e, i) => {
                    console.log(`     Entry ${i + 1}: ${e.accountCode} - ${e.accountName} | Debit: $${e.debit} | Credit: $${e.credit}`);
                });
            }
        } else {
            console.log('⚠️ No transaction created');
        }
        
    } catch (error) {
        console.error('❌ Error in simple quotation test:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
connectToDatabase()
    .then(() => testSimpleQuotation())
    .then(() => {
        console.log('\n✅ Simple quotation test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Simple quotation test failed:', error);
        process.exit(1);
    }); 