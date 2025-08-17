const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Import the Vendor model
const Vendor = require('./src/models/Vendor');

async function testVendorCodeGeneration() {
    try {
        console.log('Testing vendor code generation...');
        
        // Generate vendor code manually (like in controller)
        const timestamp = Date.now().toString().substr(-8);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const year = new Date().getFullYear().toString().substr(-2);
        const vendorCode = `V${year}${timestamp}${random}`;
        
        console.log('Generated vendorCode:', vendorCode);
        
        // Create a test vendor with the generated vendorCode
        const testVendor = new Vendor({
            vendorCode,
            businessName: 'Test Vendor',
            tradingName: 'Test Trading',
            contactPerson: {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@test.com',
                phone: '1234567890'
            },
            businessAddress: {
                street: '123 Test Street',
                city: 'Test City',
                country: 'South Africa'
            },
            category: 'maintenance',
            chartOfAccountsCode: '200001',
            createdBy: new mongoose.Types.ObjectId() // Create a dummy ObjectId
        });
        
        console.log('Before save - vendorCode:', testVendor.vendorCode);
        
        // Save the vendor
        const savedVendor = await testVendor.save();
        
        console.log('After save - vendorCode:', savedVendor.vendorCode);
        console.log('Vendor saved successfully!');
        
        // Clean up - delete the test vendor
        await Vendor.findByIdAndDelete(savedVendor._id);
        console.log('Test vendor cleaned up');
        
    } catch (error) {
        console.error('Error testing vendor code generation:', error);
    } finally {
        mongoose.connection.close();
    }
}

testVendorCodeGeneration(); 