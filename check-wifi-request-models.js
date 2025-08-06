// Check WiFi Extension Request using Models
// This script uses the existing models to check the WiFi request

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const Request = require('./src/models/Request');

async function checkWifiRequest() {
    try {
        // Connect to MongoDB using the same connection as the server
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('🔗 Connected to MongoDB');

        console.log('\n📋 Checking WiFi Extension Request...');

        // Find the specific WiFi request
        const wifiRequest = await Request.findById("6893cc82ff504e2cce3d7184")
            .populate('submittedBy', 'firstName lastName email')
            .populate('residence', 'name');

        if (!wifiRequest) {
            console.log('❌ WiFi request not found');
            
            // Try to find any WiFi-related requests
            const wifiRequests = await Request.find({
                $or: [
                    { title: { $regex: /wifi/i } },
                    { description: { $regex: /wifi/i } }
                ]
            }).populate('submittedBy', 'firstName lastName email')
              .populate('residence', 'name');
            
            if (wifiRequests.length > 0) {
                console.log(`\n📋 Found ${wifiRequests.length} WiFi-related requests:`);
                wifiRequests.forEach((req, index) => {
                    console.log(`   ${index + 1}. ID: ${req._id}`);
                    console.log(`      Title: ${req.title}`);
                    console.log(`      Status: ${req.status}`);
                    console.log(`      Finance Status: ${req.financeStatus}`);
                    console.log(`      Amount: $${req.amount}`);
                });
            }
            
            return;
        }

        console.log('✅ Found WiFi request:');
        console.log(`   ID: ${wifiRequest._id}`);
        console.log(`   Title: ${wifiRequest.title}`);
        console.log(`   Description: ${wifiRequest.description}`);
        console.log(`   Type: ${wifiRequest.type}`);
        console.log(`   Status: ${wifiRequest.status}`);
        console.log(`   Finance Status: ${wifiRequest.financeStatus}`);
        console.log(`   Amount: $${wifiRequest.amount}`);
        console.log(`   Items: ${wifiRequest.items?.length || 0}`);
        
        if (wifiRequest.items && wifiRequest.items.length > 0) {
            console.log(`   Item Details:`);
            wifiRequest.items.forEach((item, index) => {
                console.log(`     ${index + 1}. ${item.description} - $${item.totalCost}`);
            });
        }
        
        console.log(`   Quotations: ${wifiRequest.quotations?.length || 0}`);
        console.log(`   Admin Approved: ${wifiRequest.approval?.admin?.approved || false}`);
        console.log(`   Finance Approved: ${wifiRequest.approval?.finance?.approved || false}`);
        console.log(`   CEO Approved: ${wifiRequest.approval?.ceo?.approved || false}`);
        console.log(`   Submitted By: ${wifiRequest.submittedBy?.firstName} ${wifiRequest.submittedBy?.lastName}`);
        console.log(`   Residence: ${wifiRequest.residence?.name}`);

        // Check what needs to be fixed
        console.log('\n🔍 Issues to Fix:');
        if (wifiRequest.amount === 0) {
            console.log('   ❌ Amount is $0 (should be $200)');
        }
        if (wifiRequest.financeStatus === 'pending') {
            console.log('   ❌ Finance status is pending');
        }
        if (!wifiRequest.quotations || wifiRequest.quotations.length === 0) {
            console.log('   ❌ No quotations added');
        }
        if (!wifiRequest.approval?.admin?.approved) {
            console.log('   ❌ Admin approval not granted');
        }

    } catch (error) {
        console.error('❌ Error checking WiFi request:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the script
checkWifiRequest().catch(console.error);
