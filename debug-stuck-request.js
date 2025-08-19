const mongoose = require('mongoose');
require('dotenv').config();
const Request = require('./src/models/Request');

// The stuck request ID from the user's data
const STUCK_REQUEST_ID = '689e0d1f213b061bd87d194b';

async function debugStuckRequest() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:12345678@cluster0.qzq1z.mongodb.net/alamait?retryWrites=true&w=majority&appName=Cluster0');
        console.log(`✅ Connected to: ${conn.connection.host}`);

        // Find the stuck request
        const stuckRequest = await Request.findById(STUCK_REQUEST_ID);
        
        if (!stuckRequest) {
            console.error(`❌ Request with ID ${STUCK_REQUEST_ID} not found`);
            
            // Let's search for requests with similar titles
            console.log('\n🔍 Searching for requests with "Pipes" in title...');
            const pipeRequests = await Request.find({ 
                $or: [
                    { title: { $regex: /pipes/i } },
                    { description: { $regex: /pipes/i } },
                    { issue: { $regex: /pipes/i } }
                ]
            }).select('title issue description status financeStatus _id');
            
            if (pipeRequests.length > 0) {
                console.log('📋 Found similar requests:');
                pipeRequests.forEach((req, index) => {
                    console.log(`${index + 1}. ID: ${req._id}`);
                    console.log(`   Title: ${req.title || req.issue || 'Untitled'}`);
                    console.log(`   Status: ${req.status}`);
                    console.log(`   Finance Status: ${req.financeStatus || 'not set'}`);
                    console.log('');
                });
            }
            return;
        }

        console.log('\n📋 === REQUEST DETAILS ===');
        console.log(`ID: ${stuckRequest._id}`);
        console.log(`Title: ${stuckRequest.title || stuckRequest.issue || 'Untitled'}`);
        console.log(`Description: ${stuckRequest.description || 'No description'}`);
        console.log(`Type: ${stuckRequest.type || 'not set'}`);
        console.log(`Status: ${stuckRequest.status}`);
        console.log(`Finance Status: ${stuckRequest.financeStatus || 'not set'}`);
        console.log(`Priority: ${stuckRequest.priority || 'not set'}`);
        console.log(`Category: ${stuckRequest.category || 'not set'}`);
        console.log(`Created: ${stuckRequest.createdAt || 'not set'}`);

        console.log('\n📋 === APPROVAL STATUS ===');
        if (stuckRequest.approval) {
            console.log('Admin Approval:');
            console.log(`  Approved: ${stuckRequest.approval.admin?.approved || false}`);
            console.log(`  Approved By: ${stuckRequest.approval.admin?.approvedBy || 'not set'}`);
            console.log(`  Approved At: ${stuckRequest.approval.admin?.approvedAt || 'not set'}`);
            
            console.log('Finance Approval:');
            console.log(`  Approved: ${stuckRequest.approval.finance?.approved || false}`);
            console.log(`  Rejected: ${stuckRequest.approval.finance?.rejected || false}`);
            console.log(`  Waitlisted: ${stuckRequest.approval.finance?.waitlisted || false}`);
            console.log(`  Approved By: ${stuckRequest.approval.finance?.approvedBy || 'not set'}`);
            console.log(`  Approved At: ${stuckRequest.approval.finance?.approvedAt || 'not set'}`);
            
            console.log('CEO Approval:');
            console.log(`  Approved: ${stuckRequest.approval.ceo?.approved || false}`);
            console.log(`  Approved By: ${stuckRequest.approval.ceo?.approvedBy || 'not set'}`);
            console.log(`  Approved At: ${stuckRequest.approval.ceo?.approvedAt || 'not set'}`);
        } else {
            console.log('❌ No approval object found');
        }

        console.log('\n📋 === QUOTATIONS ===');
        console.log(`Request-level quotations: ${stuckRequest.quotations?.length || 0}`);
        if (stuckRequest.quotations && stuckRequest.quotations.length > 0) {
            stuckRequest.quotations.forEach((q, index) => {
                console.log(`  ${index + 1}. Provider: ${q.provider}`);
                console.log(`     Amount: ${q.amount}`);
                console.log(`     Selected: ${q.isSelected || false}`);
            });
        }

        console.log('\n📋 === ITEMS ===');
        console.log(`Items: ${stuckRequest.items?.length || 0}`);
        if (stuckRequest.items && stuckRequest.items.length > 0) {
            stuckRequest.items.forEach((item, index) => {
                console.log(`  ${index + 1}. Description: ${item.description}`);
                console.log(`     Cost: ${item.totalCost || item.unitCost || 'not set'}`);
                console.log(`     Quotations: ${item.quotations?.length || 0}`);
                if (item.quotations && item.quotations.length > 0) {
                    item.quotations.forEach((q, qIndex) => {
                        console.log(`       ${qIndex + 1}. Provider: ${q.provider}`);
                        console.log(`          Amount: ${q.amount}`);
                        console.log(`          Selected: ${q.isSelected || false}`);
                    });
                }
            });
        }

        console.log('\n📋 === REQUEST HISTORY ===');
        if (stuckRequest.requestHistory && stuckRequest.requestHistory.length > 0) {
            console.log('Recent history:');
            stuckRequest.requestHistory
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5)
                .forEach((history, index) => {
                    console.log(`  ${index + 1}. ${history.date}: ${history.action}`);
                    if (history.changes && history.changes.length > 0) {
                        history.changes.forEach(change => {
                            console.log(`     - ${change}`);
                        });
                    }
                });
        } else {
            console.log('❌ No request history found');
        }

        console.log('\n📋 === DIAGNOSIS ===');
        const isFinanceApproved = stuckRequest.financeStatus === 'approved' || 
                                 stuckRequest.approval?.finance?.approved === true;
        
        if (!isFinanceApproved) {
            console.log('❌ ISSUE: Request has NOT been approved by finance');
            console.log('💡 SOLUTION: Finance needs to approve this request first');
        } else if (stuckRequest.status !== 'pending-ceo-approval') {
            console.log('🔧 ISSUE: Request approved by finance but status not updated');
            console.log('💡 SOLUTION: Need to update status to pending-ceo-approval');
        } else {
            console.log('✅ Request appears to be correctly configured');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.message.includes('ECONNREFUSED')) {
            console.log('\n💡 Database connection failed. Make sure:');
            console.log('   1. MongoDB is running');
            console.log('   2. Connection string is correct');
            console.log('   3. Network access is available');
        }
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the debug
if (require.main === module) {
    console.log('🔍 Debugging Stuck "Pipes" Request');
    console.log('=====================================');
    debugStuckRequest();
}

module.exports = { debugStuckRequest }; 