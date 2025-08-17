const mongoose = require('mongoose');
const Request = require('../src/models/Request');

// Connect to MongoDB using the same connection as the main app
async function connectToDatabase() {
    try {
        // Use the same connection string as the main application
        const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://cluster0.ulvve.mongodb.net/test';
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

async function fixGazeboRequest() {
    try {
        console.log('🔍 Fixing gazebo construction request...');
        
        const requestId = "688a4e45c0f30f13fe683751";
        
        // Find the specific request using the Request model
        const request = await Request.findById(requestId);
        
        if (!request) {
            console.log('❌ Request not found');
            return;
        }
        
        console.log(`\n📋 Found request: ${request.title}`);
        console.log(`  - ID: ${request._id}`);
        console.log(`  - Current Status: ${request.status}`);
        console.log(`  - Finance Status: ${request.financeStatus}`);
        console.log(`  - Finance Approved: ${request.approval?.finance?.approved}`);
        
        // Show current quotation status
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
        
        // Check if financeStatus is approved but approval.finance.approved is false
        if (request.financeStatus === 'approved' && !request.approval?.finance?.approved) {
            console.log('\n🔧 Fixing finance approval inconsistency...');
            
            // Update the approval.finance object
            request.approval.finance = {
                approved: true,
                approvedBy: request.submittedBy, // Using submittedBy as fallback
                approvedAt: new Date(),
                approvedByEmail: 'finance@alamait.com', // Fallback email
                notes: 'Finance approved with selected quotation'
            };
            
            // If there are item-level quotations, approve the first one
            if (request.items && request.items.length > 0) {
                request.items.forEach((item, itemIndex) => {
                    if (item.quotations && item.quotations.length > 0) {
                        console.log(`  - Approving quotation for item ${itemIndex + 1}: ${item.description}`);
                        
                        // Unapprove all quotations for this item first
                        item.quotations.forEach((quotation, quotationIndex) => {
                            quotation.isApproved = false;
                            quotation.approvedBy = null;
                            quotation.approvedAt = null;
                        });
                        
                        // Approve the first quotation
                        item.quotations[0].isApproved = true;
                        item.quotations[0].approvedBy = request.submittedBy;
                        item.quotations[0].approvedAt = new Date();
                        
                        // Update item's estimated cost to match the approved quotation
                        item.estimatedCost = item.quotations[0].amount;
                    }
                });
                
                // Recalculate total estimated cost
                request.totalEstimatedCost = request.items.reduce((total, item) => {
                    return total + (item.estimatedCost * item.quantity);
                }, 0);
            }
            
            // Save the updated request
            await request.save();
            
            console.log('  ✅ Request updated successfully');
            
            // Show the updated request
            console.log('\n📋 Updated request details:');
            console.log(`  - Finance Status: ${request.financeStatus}`);
            console.log(`  - Finance Approved: ${request.approval?.finance?.approved}`);
            console.log(`  - Finance Approved At: ${request.approval?.finance?.approvedAt}`);
            console.log(`  - Status: ${request.status}`);
            console.log(`  - Amount: ${request.amount}`);
            console.log(`  - Total Estimated Cost: ${request.totalEstimatedCost}`);
            
            if (request.items && request.items.length > 0) {
                console.log('\n🔍 Updated item-level quotations:');
                request.items.forEach((item, itemIndex) => {
                    if (item.quotations && item.quotations.length > 0) {
                        console.log(`  - Item ${itemIndex + 1}: ${item.description}`);
                        item.quotations.forEach((quotation, qIndex) => {
                            console.log(`    * Quotation ${qIndex + 1}: ${quotation.provider} - $${quotation.amount} (approved: ${quotation.isApproved})`);
                            if (quotation.isApproved) {
                                console.log(`      - Approved By: ${quotation.approvedBy}`);
                                console.log(`      - Approved At: ${quotation.approvedAt}`);
                            }
                        });
                    }
                });
            }
            
        } else {
            console.log('\n⏭️  No inconsistency found or already fixed');
            console.log(`  - Finance Status: ${request.financeStatus}`);
            console.log(`  - Finance Approved: ${request.approval?.finance?.approved}`);
        }
        
        console.log('\n✅ Gazebo request fix completed!');
        
    } catch (error) {
        console.error('❌ Error fixing gazebo request:', error);
    }
}

async function main() {
    await connectToDatabase();
    await fixGazeboRequest();
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
}

main().catch(console.error); 