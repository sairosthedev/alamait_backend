const mongoose = require('mongoose');
const Request = require('./src/models/Request');

// Connect to MongoDB
async function connectToDatabase() {
    try {
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

async function testFinanceApprovalFlow() {
    try {
        console.log('🧪 Testing Finance Approval Flow');
        console.log('================================');
        
        // Find a request with quotations to test
        const request = await Request.findOne({
            $or: [
                { 'quotations.0': { $exists: true } },
                { 'items.quotations.0': { $exists: true } }
            ]
        }).populate('submittedBy', 'firstName lastName email');
        
        if (!request) {
            console.log('❌ No requests with quotations found for testing');
            return;
        }
        
        console.log(`\n📋 Testing with request: ${request.title}`);
        console.log(`  - ID: ${request._id}`);
        console.log(`  - Status: ${request.status}`);
        console.log(`  - Finance approved: ${request.approval?.finance?.approved}`);
        
        // Show current quotation status
        if (request.quotations && request.quotations.length > 0) {
            console.log('\n🔍 Request-level quotations:');
            request.quotations.forEach((quotation, index) => {
                console.log(`  - Quotation ${index + 1}: ${quotation.provider} - $${quotation.amount} (approved: ${quotation.isApproved})`);
            });
        }
        
        if (request.items && request.items.length > 0) {
            console.log('\n🔍 Item-level quotations:');
            request.items.forEach((item, itemIndex) => {
                if (item.quotations && item.quotations.length > 0) {
                    console.log(`  - Item ${itemIndex + 1}: ${item.description}`);
                    item.quotations.forEach((quotation, qIndex) => {
                        console.log(`    * Quotation ${qIndex + 1}: ${quotation.provider} - $${quotation.amount} (approved: ${quotation.isApproved})`);
                    });
                }
            });
        }
        
        console.log('\n📋 Correct Finance Approval Flow:');
        console.log('1. Finance approves the request (sets approval.finance.approved = true)');
        console.log('2. Finance manually selects and approves specific quotations');
        console.log('3. Only selected quotations get isApproved = true');
        console.log('4. Request amount is updated based on approved quotations');
        
        console.log('\n🔧 Available endpoints for finance:');
        console.log('- POST /api/requests/:id/finance-approval (approve/reject entire request)');
        console.log('- POST /api/requests/:id/approve-quotation (approve request-level quotation)');
        console.log('- POST /api/requests/:id/items/:itemIndex/quotations/:quotationIndex/approve (approve item-level quotation)');
        
        // Check for inconsistencies
        console.log('\n⚠️  Current Inconsistencies:');
        let hasInconsistencies = false;
        
        if (request.approval?.finance?.approved && request.quotations && request.quotations.length > 0) {
            const approvedQuotations = request.quotations.filter(q => q.isApproved);
            if (approvedQuotations.length === 0) {
                console.log('  ❌ Finance approved request but no quotations are approved (this is correct - finance must manually approve)');
            } else if (approvedQuotations.length > 1) {
                console.log('  ❌ Multiple quotations approved (should only be one)');
                hasInconsistencies = true;
            }
        }
        
        if (request.items && request.items.length > 0) {
            request.items.forEach((item, itemIndex) => {
                if (item.quotations && item.quotations.length > 0) {
                    const approvedQuotations = item.quotations.filter(q => q.isApproved);
                    if (approvedQuotations.length > 1) {
                        console.log(`  ❌ Item ${itemIndex + 1} has multiple approved quotations (should only be one)`);
                        hasInconsistencies = true;
                    }
                }
            });
        }
        
        if (!hasInconsistencies) {
            console.log('  ✅ No inconsistencies found');
        }
        
        console.log('\n✅ Finance approval flow test completed!');
        
    } catch (error) {
        console.error('❌ Error testing finance approval flow:', error);
    }
}

async function main() {
    await connectToDatabase();
    await testFinanceApprovalFlow();
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
}

main().catch(console.error); 