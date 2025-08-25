const mongoose = require('mongoose');
const Vendor = require('./src/models/Vendor');

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

async function debugVendorLookupDetailed() {
    console.log('🔍 Detailed Vendor Lookup Debug');
    console.log('=' .repeat(50));
    
    // Test the exact vendor IDs from the quotation test
    const testVendorIds = [
        '68aceeae37a64ac599222ce6', // V001 - Gift Plumber
        '68aceeae37a64ac599222cf2', // V002 - ABC Electric
        '68aceeae37a64ac599222cfb', // V003 - Climate Control
        '68aceeae37a64ac599222d03'  // V004 - Roof Masters
    ];
    
    for (const vendorId of testVendorIds) {
        console.log(`\n🧪 Testing vendor lookup for ID: ${vendorId}`);
        
        // Test with findById
        const vendor = await Vendor.findById(vendorId);
        if (vendor) {
            console.log(`✅ Vendor found by ID: ${vendor.businessName} (${vendor.vendorCode})`);
        } else {
            console.log(`❌ Vendor NOT found by ID: ${vendorId}`);
        }
        
        // Test with findOne
        const vendor2 = await Vendor.findOne({ _id: vendorId });
        if (vendor2) {
            console.log(`✅ Vendor found by findOne: ${vendor2.businessName} (${vendor2.vendorCode})`);
        } else {
            console.log(`❌ Vendor NOT found by findOne: ${vendorId}`);
        }
        
        // Test if it's a valid ObjectId
        if (mongoose.Types.ObjectId.isValid(vendorId)) {
            console.log(`✅ Valid ObjectId format: ${vendorId}`);
        } else {
            console.log(`❌ Invalid ObjectId format: ${vendorId}`);
        }
    }
    
    // Test the exact method from the service
    console.log('\n🔧 Testing the exact service method logic:');
    
    async function testGetOrCreateVendorPayableAccount(vendorId) {
        console.log(`\n📋 Testing getOrCreateVendorPayableAccount with: ${vendorId}`);
        
        const vendor = await Vendor.findById(vendorId);
        console.log(`Vendor.findById result:`, vendor ? `Found: ${vendor.businessName}` : 'null');
        
        if (!vendor) {
            throw new Error('Vendor not found');
        }
        
        console.log(`✅ Vendor found: ${vendor.businessName}`);
        return vendor.chartOfAccountsCode;
    }
    
    try {
        const result = await testGetOrCreateVendorPayableAccount('68aceeae37a64ac599222ce6');
        console.log(`✅ Method succeeded, returned: ${result}`);
    } catch (error) {
        console.log(`❌ Method failed: ${error.message}`);
    }
}

// Run the debug
connectToDatabase()
    .then(() => debugVendorLookupDetailed())
    .then(() => {
        console.log('\n✅ Detailed debug completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Detailed debug failed:', error);
        process.exit(1);
    }); 