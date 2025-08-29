const mongoose = require('mongoose');
const Request = require('./src/models/Request');
const Vendor = require('./src/models/Vendor');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function debugVendorPersistence() {
    try {
        console.log('🔍 DEBUGGING VENDOR PERSISTENCE ISSUE');
        
        // Test 1: Check if vendor exists
        const vendor = await Vendor.findOne({ businessName: 'ABC Electrical Services' });
        console.log('\n1️⃣ VENDOR LOOKUP:');
        if (vendor) {
            console.log('✅ Vendor found:', {
                _id: vendor._id,
                businessName: vendor.businessName,
                chartOfAccountsCode: vendor.chartOfAccountsCode,
                vendorType: vendor.vendorType
            });
        } else {
            console.log('❌ Vendor not found for "ABC Electrical Services"');
        }
        
        // Test 2: Check the specific request that was created
        const request = await Request.findById('68b1afa24344f4884050a3ed');
        console.log('\n2️⃣ REQUEST ANALYSIS:');
        if (request) {
            console.log('✅ Request found:', {
                _id: request._id,
                title: request.title,
                itemsCount: request.items ? request.items.length : 0
            });
            
            if (request.items && request.items.length > 0) {
                request.items.forEach((item, index) => {
                    console.log(`\n   📦 Item ${index}:`, {
                        description: item.description,
                        quotationsCount: item.quotations ? item.quotations.length : 0
                    });
                    
                    if (item.quotations && item.quotations.length > 0) {
                        item.quotations.forEach((quotation, qIndex) => {
                            console.log(`      📄 Quotation ${qIndex}:`, {
                                provider: quotation.provider,
                                amount: quotation.amount,
                                vendorId: quotation.vendorId,
                                vendorCode: quotation.vendorCode,
                                vendorName: quotation.vendorName,
                                vendorType: quotation.vendorType,
                                hasVendorFields: !!(quotation.vendorId || quotation.vendorCode || quotation.vendorName)
                            });
                        });
                    }
                });
            }
        } else {
            console.log('❌ Request not found');
        }
        
        // Test 3: Check if there are any requests with vendor details
        const requestsWithVendors = await Request.find({
            'items.quotations.vendorId': { $exists: true, $ne: null }
        });
        
        console.log('\n3️⃣ REQUESTS WITH VENDOR DETAILS:');
        console.log(`Found ${requestsWithVendors.length} requests with vendor details`);
        
        requestsWithVendors.forEach((req, index) => {
            console.log(`   Request ${index + 1}:`, {
                _id: req._id,
                title: req.title,
                createdAt: req.createdAt
            });
        });
        
        // Test 4: Check the raw MongoDB document
        console.log('\n4️⃣ RAW MONGODB DOCUMENT:');
        const rawRequest = await Request.collection.findOne({ _id: new mongoose.Types.ObjectId('68b1afa24344f4884050a3ed') });
        if (rawRequest) {
            console.log('Raw document structure:');
            console.log(JSON.stringify(rawRequest, null, 2));
        }
        
        // Test 5: Try to manually update a quotation with vendor details
        console.log('\n5️⃣ MANUAL UPDATE TEST:');
        if (vendor && request) {
            const updateResult = await Request.updateOne(
                { 
                    _id: request._id,
                    'items.quotations.provider': 'ABC Electrical Services'
                },
                {
                    $set: {
                        'items.$.quotations.$.vendorId': vendor._id,
                        'items.$.quotations.$.vendorCode': vendor.chartOfAccountsCode,
                        'items.$.quotations.$.vendorName': vendor.businessName,
                        'items.$.quotations.$.vendorType': vendor.vendorType
                    }
                }
            );
            
            console.log('Manual update result:', updateResult);
            
            // Check if the update worked
            const updatedRequest = await Request.findById(request._id);
            if (updatedRequest && updatedRequest.items && updatedRequest.items.length > 0) {
                const quotation = updatedRequest.items[0].quotations[0];
                console.log('After manual update:', {
                    vendorId: quotation.vendorId,
                    vendorCode: quotation.vendorCode,
                    vendorName: quotation.vendorName
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

debugVendorPersistence();
