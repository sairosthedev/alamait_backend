const mongoose = require('mongoose');
const Request = require('../src/models/Request');

// Connect to MongoDB
async function connectToDatabase() {
    try {
        // Use the same connection string as the main application
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');
        console.log('Database:', mongoose.connection.name);
    } catch (error) {
        console.error('❌ Error connecting to MongoDB:', error);
        process.exit(1);
    }
}

async function fixRequestFinanceApproval() {
    try {
        console.log('🔍 Starting to fix request finance approval data...');
        console.log('Collection: maintenance');
        
        // Find all requests that have a financeStatus field (incorrect field)
        const requestsWithFinanceStatus = await Request.find({
            $or: [
                { financeStatus: { $exists: true } },
                { 'approval.finance.approved': { $exists: false } }
            ]
        });
        
        console.log(`📊 Found ${requestsWithFinanceStatus.length} requests that need fixing`);
        
        let fixedCount = 0;
        let skippedCount = 0;
        
        for (const request of requestsWithFinanceStatus) {
            console.log(`\n🔧 Processing request: ${request.title} (ID: ${request._id})`);
            
            let needsUpdate = false;
            const updates = {};
            
            // Check if financeStatus field exists and is set to 'approved'
            if (request.financeStatus === 'approved') {
                console.log('  - financeStatus is "approved", setting approval.finance.approved to true');
                updates['approval.finance.approved'] = true;
                updates['approval.finance.approvedAt'] = new Date();
                needsUpdate = true;
            } else if (request.financeStatus === 'rejected') {
                console.log('  - financeStatus is "rejected", setting approval.finance.approved to false');
                updates['approval.finance.approved'] = false;
                needsUpdate = true;
            }
            
            // Remove the incorrect financeStatus field
            if (request.financeStatus !== undefined) {
                console.log('  - Removing incorrect financeStatus field');
                updates['$unset'] = { financeStatus: 1 };
                needsUpdate = true;
            }
            
            // Ensure approval.finance structure exists
            if (!request.approval || !request.approval.finance) {
                console.log('  - Creating missing approval.finance structure');
                updates['approval.finance'] = {
                    approved: false,
                    approvedBy: null,
                    approvedByEmail: null,
                    approvedAt: null,
                    notes: null
                };
                needsUpdate = true;
            }
            
            // Note: We do NOT automatically approve quotations when finance approves the request
            // Finance must manually select and approve specific quotations using the approveQuotation endpoints
            if (request.financeStatus === 'approved') {
                console.log('  - Finance approved request - quotations should be manually approved by finance');
                console.log('  - No automatic quotation approval (finance must select specific quotations)');
            }
            
            if (needsUpdate) {
                try {
                    // Use findOneAndUpdate to handle the $unset operation
                    const result = await Request.findByIdAndUpdate(
                        request._id,
                        updates,
                        { new: true, runValidators: true }
                    );
                    
                    if (result) {
                        console.log('  ✅ Request updated successfully');
                        fixedCount++;
                    } else {
                        console.log('  ❌ Failed to update request');
                    }
                } catch (updateError) {
                    console.error(`  ❌ Error updating request ${request._id}:`, updateError.message);
                }
            } else {
                console.log('  ⏭️  No updates needed');
                skippedCount++;
            }
        }
        
        console.log(`\n📈 Fix Summary:`);
        console.log(`  - Total requests processed: ${requestsWithFinanceStatus.length}`);
        console.log(`  - Requests fixed: ${fixedCount}`);
        console.log(`  - Requests skipped: ${skippedCount}`);
        
        // Verify the fix by checking a few requests
        console.log('\n🔍 Verifying the fix...');
        const sampleRequests = await Request.find({}).limit(5);
        
        for (const request of sampleRequests) {
            console.log(`\nRequest: ${request.title}`);
            console.log(`  - Has financeStatus field: ${request.financeStatus !== undefined}`);
            console.log(`  - approval.finance.approved: ${request.approval?.finance?.approved}`);
            console.log(`  - approval.finance.approvedAt: ${request.approval?.finance?.approvedAt}`);
            
            if (request.quotations && request.quotations.length > 0) {
                console.log(`  - Quotations approved: ${request.quotations.filter(q => q.isApproved).length}/${request.quotations.length}`);
            }
            
            if (request.items && request.items.length > 0) {
                request.items.forEach((item, index) => {
                    if (item.quotations && item.quotations.length > 0) {
                        const approvedCount = item.quotations.filter(q => q.isApproved).length;
                        console.log(`  - Item ${index + 1} quotations approved: ${approvedCount}/${item.quotations.length}`);
                    }
                });
            }
        }
        
        console.log('\n✅ Request finance approval fix completed!');
        console.log('\n📋 Next Steps:');
        console.log('  - Finance should manually approve specific quotations using:');
        console.log('    * POST /api/requests/:id/approve-quotation (for request-level quotations)');
        console.log('    * POST /api/requests/:id/items/:itemIndex/quotations/:quotationIndex/approve (for item-level quotations)');
        
    } catch (error) {
        console.error('❌ Error fixing request finance approval:', error);
    }
}

async function main() {
    await connectToDatabase();
    await fixRequestFinanceApproval();
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
}

main().catch(console.error); 