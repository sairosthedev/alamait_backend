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

async function debugVendorLookup() {
    console.log('🔍 Debugging Vendor Lookup');
    console.log('=' .repeat(50));
    
    // Find all vendors
    const vendors = await Vendor.find({});
    console.log(`Found ${vendors.length} vendors in database:`);
    
    vendors.forEach((vendor, index) => {
        console.log(`\n${index + 1}. Vendor Details:`);
        console.log(`   ID: ${vendor._id}`);
        console.log(`   Vendor Code: ${vendor.vendorCode}`);
        console.log(`   Business Name: ${vendor.businessName}`);
        console.log(`   Chart of Accounts Code: ${vendor.chartOfAccountsCode}`);
    });
    
    // Test vendor lookup by ID
    if (vendors.length > 0) {
        const testVendor = vendors[0];
        console.log(`\n🧪 Testing vendor lookup by ID: ${testVendor._id}`);
        
        const foundVendor = await Vendor.findById(testVendor._id);
        if (foundVendor) {
            console.log('✅ Vendor found by ID');
        } else {
            console.log('❌ Vendor not found by ID');
        }
        
        // Test vendor lookup by vendorCode
        console.log(`\n🧪 Testing vendor lookup by vendorCode: ${testVendor.vendorCode}`);
        const foundByCode = await Vendor.findOne({ vendorCode: testVendor.vendorCode });
        if (foundByCode) {
            console.log('✅ Vendor found by vendorCode');
        } else {
            console.log('❌ Vendor not found by vendorCode');
        }
    }
}

// Run the debug
connectToDatabase()
    .then(() => debugVendorLookup())
    .then(() => {
        console.log('\n✅ Debug completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Debug failed:', error);
        process.exit(1);
    }); 