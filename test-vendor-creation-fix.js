const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Import the vendor controller
const vendorController = require('./src/controllers/vendorController');

async function testVendorCreation() {
    try {
        console.log('Testing vendor creation with new timestamp-based vendor code generation...');
        
        // Create mock request and response objects
        const mockReq = {
            body: {
                businessName: "Willow Willow",
                tradingName: "The Best",
                contactPerson: {
                    firstName: "kudzai",
                    lastName: "Pemhiwa",
                    email: "kudzaicindyrellapemhiwa@gmail.com",
                    phone: "0786209200",
                    mobile: ""
                },
                businessAddress: {
                    street: "183 21crescent Glen View 1",
                    city: "Harare",
                    state: "",
                    postalCode: "",
                    country: "South Africa"
                },
                category: "landscaping",
                creditLimit: "300",
                notes: "sdfghj; ",
                paymentTerms: 30,
                registrationNumber: "123456789",
                serviceAreas: [],
                specializations: [],
                taxNumber: "",
                vatNumber: "",
                bankDetails: {
                    bankName: "",
                    accountNumber: "",
                    accountType: "",
                    branchCode: "",
                    swiftCode: ""
                }
            },
            user: {
                _id: new mongoose.Types.ObjectId()
            }
        };
        
        const mockRes = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                this.responseData = data;
                console.log('Response Status:', this.statusCode);
                console.log('Response Data:', JSON.stringify(data, null, 2));
                return this;
            }
        };
        
        // Call the createVendor controller function
        await vendorController.createVendor(mockReq, mockRes);
        
        if (mockRes.statusCode === 201) {
            console.log('✅ Vendor created successfully!');
            console.log('Generated vendorCode:', mockRes.responseData.vendor.vendorCode);
        } else {
            console.log('❌ Vendor creation failed');
        }
        
    } catch (error) {
        console.error('❌ Error testing vendor creation:', error.message);
    } finally {
        mongoose.connection.close();
    }
}

testVendorCreation(); 