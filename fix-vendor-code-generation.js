const mongoose = require('mongoose');

// Simple vendor code generation function
async function generateVendorCode() {
    try {
        const Vendor = mongoose.model('Vendor');
        const lastVendor = await Vendor.findOne({}, { vendorCode: 1 }).sort({ vendorCode: -1 });
        
        let nextNumber = 1;
        if (lastVendor && lastVendor.vendorCode) {
            const match = lastVendor.vendorCode.match(/V\d{6}$/);
            if (match) {
                const currentNumber = parseInt(lastVendor.vendorCode.substring(1));
                nextNumber = currentNumber + 1;
            }
        }
        
        const year = new Date().getFullYear().toString().substr(-2);
        const sequence = nextNumber.toString().padStart(4, '0');
        return `V${year}${sequence}`;
    } catch (error) {
        console.error('Error generating vendor code:', error);
        const timestamp = Date.now().toString().substr(-6);
        const year = new Date().getFullYear().toString().substr(-2);
        return `V${year}${timestamp}`;
    }
}

// Test the function
async function testVendorCodeGeneration() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend');
        console.log('Connected to database');
        
        const vendorCode = await generateVendorCode();
        console.log('Generated vendor code:', vendorCode);
        
        await mongoose.disconnect();
        console.log('Disconnected from database');
    } catch (error) {
        console.error('Error:', error);
    }
}

testVendorCodeGeneration(); 