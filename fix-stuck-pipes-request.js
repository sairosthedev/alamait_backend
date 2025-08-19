const mongoose = require('mongoose');
require('dotenv').config(); // Add this line to load environment variables
const Request = require('./src/models/Request');

// The stuck request ID from the user's data
const STUCK_REQUEST_ID = '689e0d1f213b061bd87d194b';

// Use the same approach as other scripts in the project
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:12345678@cluster0.qzq1z.mongodb.net/alamait?retryWrites=true&w=majority&appName=Cluster0';

async function fixStuckPipesRequest() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find the stuck request - first try by ID, then by title
        let stuckRequest = await Request.findById(STUCK_REQUEST_ID);
        
        if (!stuckRequest) {
            console.log(`⚠️ Request with ID ${STUCK_REQUEST_ID} not found, searching by title...`);
            
            // Search for "Pipes" requests
            const pipeRequests = await Request.find({ 
                $or: [
                    { title: { $regex: /pipes/i } },
                    { description: { $regex: /pipes/i } },
                    { issue: { $regex: /pipes/i } }
                ],
                status: 'pending',
                financeStatus: 'approved'
            });
            
            if (pipeRequests.length === 0) {
                console.error('❌ No "Pipes" requests found that are pending with finance approval');
                return;
            }
            
            if (pipeRequests.length > 1) {
                console.log('📋 Found multiple "Pipes" requests:');
                pipeRequests.forEach((req, index) => {
                    console.log(`${index + 1}. ID: ${req._id}, Title: ${req.title || req.issue}`);
                });
                console.log('🔧 Fixing the first one...');
            }
            
            stuckRequest = pipeRequests[0];
            console.log(`✅ Found "Pipes" request: ${stuckRequest.title || stuckRequest.issue} (ID: ${stuckRequest._id})`);
        }

        console.log(`📋 Found request: ${stuckRequest.title || stuckRequest.issue || 'Untitled'}`);
        console.log(`📋 Current status: ${stuckRequest.status}`);
        console.log(`📋 Finance status: ${stuckRequest.financeStatus || 'not set'}`);
        console.log(`📋 Has quotations: ${stuckRequest.quotations?.length || 0}`);
        console.log(`📋 Has items: ${stuckRequest.items?.length || 0}`);

        // Check if this request has been approved by finance
        const isFinanceApproved = stuckRequest.financeStatus === 'approved' || 
                                 stuckRequest.approval?.finance?.approved === true;

        if (isFinanceApproved && stuckRequest.status !== 'pending-ceo-approval') {
            console.log('\n🔧 Fixing stuck request...');
            
            // Fix the status
            const before = {
                status: stuckRequest.status,
                financeStatus: stuckRequest.financeStatus
            };

            stuckRequest.status = 'pending-ceo-approval';
            
            // Add to request history
            stuckRequest.requestHistory.push({
                date: new Date(),
                action: 'Status Fix',
                user: null, // System fix
                changes: [
                    'Fixed stuck request status',
                    `Changed status from ${before.status} to pending-ceo-approval`,
                    'Applied finance approval status fix'
                ]
            });

            await stuckRequest.save();
            console.log('✅ Request status fixed and saved');

            // Verify the fix
            const fixedRequest = await Request.findById(stuckRequest._id);
            console.log('\n📊 After Fix:');
            console.log(`✅ Status: ${fixedRequest.status}`);
            console.log(`✅ Finance Status: ${fixedRequest.financeStatus}`);
            
            if (fixedRequest.status === 'pending-ceo-approval') {
                console.log('\n🎉 SUCCESS: Request is now properly set to pending-ceo-approval!');
                console.log('✅ The request should now appear in the CEO\'s pending approval list.');
            } else {
                console.log('\n❌ Something went wrong - status was not updated correctly');
            }
        } else if (stuckRequest.status === 'pending-ceo-approval') {
            console.log('\n✅ Request is already in pending-ceo-approval status - no fix needed');
        } else {
            console.log('\n⚠️ Request has not been approved by finance yet:');
            console.log(`   Finance Status: ${stuckRequest.financeStatus || 'not set'}`);
            console.log(`   Finance Approved: ${stuckRequest.approval?.finance?.approved || false}`);
            console.log('\n💡 To fix this request, finance needs to approve it first.');
        }

    } catch (error) {
        console.error('❌ Error fixing request:', error.message);
        if (error.message.includes('ECONNREFUSED')) {
            console.log('\n💡 Connection failed. Make sure:');
            console.log('   1. MongoDB connection string is correct in MONGODB_URI environment variable');
            console.log('   2. You have network access to the database');
            console.log('   3. Database credentials are valid');
        }
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Alternative: Manual database query you can run directly in MongoDB
function printManualQuery() {
    console.log('\n🔧 Manual MongoDB Query (if script fails):');
    console.log('Run this directly in your MongoDB client:');
    console.log('```javascript');
    console.log(`db.requests.updateOne(`);
    console.log(`  { _id: ObjectId("${STUCK_REQUEST_ID}") },`);
    console.log(`  {`);
    console.log(`    $set: {`);
    console.log(`      status: "pending-ceo-approval"`);
    console.log(`    },`);
    console.log(`    $push: {`);
    console.log(`      requestHistory: {`);
    console.log(`        date: new Date(),`);
    console.log(`        action: "Status Fix",`);
    console.log(`        user: null,`);
    console.log(`        changes: [`);
    console.log(`          "Fixed stuck request status",`);
    console.log(`          "Changed status to pending-ceo-approval",`);
    console.log(`          "Applied finance approval status fix"`);
    console.log(`        ]`);
    console.log(`      }`);
    console.log(`    }`);
    console.log(`  }`);
    console.log(`);`);
    console.log('```');
}

// Run the fix
if (require.main === module) {
    console.log('🔧 Fixing Stuck "Pipes" Request');
    console.log('=====================================');
    
    if (!process.env.MONGODB_URI) {
        console.log('⚠️ MONGODB_URI environment variable not set');
        console.log('💡 Set it with: export MONGODB_URI="your-mongodb-connection-string"');
        printManualQuery();
    } else {
        fixStuckPipesRequest();
    }
}

module.exports = { fixStuckPipesRequest, printManualQuery }; 