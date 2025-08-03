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
        
        // Create a test vendor without vendorCode
        const testVendor = new Vendor({
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
            createdBy: new mongoose.Types.ObjectId() // Create a dummy ObjectId
        });
        
        console.log('Before save - vendorCode:', testVendor.vendorCode);
        
        // Save the vendor (this should trigger the pre-save middleware)
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