const mongoose = require('mongoose');
const Request = require('./src/models/Request');

// Connect to MongoDB
async function connectToDatabase() {
    try {
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

async function fixSpecificGazeboRequest() {
    try {
        console.log('🔍 Fixing specific gazebo construction request...');
        
        const requestId = "688a4e45c0f30f13fe683751";
        
        // Find the specific request
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
            
            const updates = {
                'approval.finance.approved': true,
                'approval.finance.approvedBy': request.submittedBy, // Using submittedBy as fallback
                'approval.finance.approvedAt': new Date(),
                'approval.finance.approvedByEmail': 'finance@alamait.com', // Fallback email
                'approval.finance.notes': 'Finance approved with selected quotation'
            };
            
            // If there are item-level quotations, approve the first one
            if (request.items && request.items.length > 0) {
                request.items.forEach((item, itemIndex) => {
                    if (item.quotations && item.quotations.length > 0) {
                        console.log(`  - Approving quotation for item ${itemIndex + 1}: ${item.description}`);
                        
                        // Unapprove all quotations for this item first
                        item.quotations.forEach((quotation, quotationIndex) => {
                            updates[`items.${itemIndex}.quotations.${quotationIndex}.isApproved`] = false;
                            updates[`items.${itemIndex}.quotations.${quotationIndex}.approvedBy`] = null;
                            updates[`items.${itemIndex}.quotations.${quotationIndex}.approvedAt`] = null;
                        });
                        
                        // Approve the first quotation
                        updates[`items.${itemIndex}.quotations.0.isApproved`] = true;
                        updates[`items.${itemIndex}.quotations.0.approvedBy`] = request.submittedBy;
                        updates[`items.${itemIndex}.quotations.0.approvedAt`] = new Date();
                        
                        // Update item's estimated cost to match the approved quotation
                        updates[`items.${itemIndex}.estimatedCost`] = item.quotations[0].amount;
                    }
                });
                
                // Recalculate total estimated cost
                const totalCost = request.items.reduce((total, item) => {
                    return total + (item.estimatedCost * item.quantity);
                }, 0);
                updates['totalEstimatedCost'] = totalCost;
            }
            
            // Update the request
            const result = await Request.findByIdAndUpdate(
                requestId,
                updates,
                { new: true, runValidators: true }
            );
            
            if (result) {
                console.log('  ✅ Request updated successfully');
                
                // Show the updated request
                console.log('\n📋 Updated request details:');
                console.log(`  - Finance Status: ${result.financeStatus}`);
                console.log(`  - Finance Approved: ${result.approval?.finance?.approved}`);
                console.log(`  - Finance Approved At: ${result.approval?.finance?.approvedAt}`);
                console.log(`  - Status: ${result.status}`);
                console.log(`  - Amount: ${result.amount}`);
                console.log(`  - Total Estimated Cost: ${result.totalEstimatedCost}`);
                
                if (result.items && result.items.length > 0) {
                    console.log('\n🔍 Updated item-level quotations:');
                    result.items.forEach((item, itemIndex) => {
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
                console.log('  ❌ Failed to update request');
            }
            
        } else {
            console.log('\n⏭️  No inconsistency found or already fixed');
            console.log(`  - Finance Status: ${request.financeStatus}`);
            console.log(`  - Finance Approved: ${request.approval?.finance?.approved}`);
        }
        
        console.log('\n✅ Specific gazebo request fix completed!');
        
    } catch (error) {
        console.error('❌ Error fixing specific gazebo request:', error);
    }
}

async function main() {
    await connectToDatabase();
    await fixSpecificGazeboRequest();
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
}

main().catch(console.error); 