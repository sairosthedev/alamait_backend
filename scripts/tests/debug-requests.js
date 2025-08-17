const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');
        console.log('Database name:', mongoose.connection.name);
        console.log('Host:', mongoose.connection.host);
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

// Debug requests in maintenance collection
async function debugRequests() {
    console.log('=== Debugging Requests in Maintenance Collection ===\n');

    try {
        // Get the Request model (now pointing to maintenance collection)
        const Request = mongoose.model('Request');
        
        // Check 1: Count all documents in maintenance collection
        const totalCount = await Request.countDocuments();
        console.log(`1. Total documents in maintenance collection: ${totalCount}`);
        
        // Check 2: Get all documents without any filtering
        const allDocuments = await Request.find({}).sort({ createdAt: -1 }).limit(10);
        console.log(`\n2. Latest 10 documents in maintenance collection:`);
        allDocuments.forEach((doc, index) => {
            console.log(`${index + 1}. ID: ${doc._id}`);
            console.log(`   Title: ${doc.title}`);
            console.log(`   Type: ${doc.type}`);
            console.log(`   Status: ${doc.status}`);
            console.log(`   Submitted by: ${doc.submittedBy}`);
            console.log(`   Residence: ${doc.residence}`);
            console.log(`   Created: ${doc.createdAt}`);
            console.log('---');
        });
        
        // Check 3: Check by type
        const maintenanceCount = await Request.countDocuments({ type: 'maintenance' });
        const financialCount = await Request.countDocuments({ type: 'financial' });
        const operationalCount = await Request.countDocuments({ type: 'operational' });
        
        console.log(`\n3. Documents by type:`);
        console.log(`   Maintenance: ${maintenanceCount}`);
        console.log(`   Financial: ${financialCount}`);
        console.log(`   Operational: ${operationalCount}`);
        
        // Check 4: Check by status
        const pendingCount = await Request.countDocuments({ status: 'pending' });
        const completedCount = await Request.countDocuments({ status: 'completed' });
        const rejectedCount = await Request.countDocuments({ status: 'rejected' });
        
        console.log(`\n4. Documents by status:`);
        console.log(`   Pending: ${pendingCount}`);
        console.log(`   Completed: ${completedCount}`);
        console.log(`   Rejected: ${rejectedCount}`);
        
        // Check 5: Check collections
        console.log(`\n5. Available collections in ${mongoose.connection.name}:`);
        const collections = await mongoose.connection.db.listCollections().toArray();
        collections.forEach(collection => {
            console.log(`   - ${collection.name}`);
        });
        
        // Check 6: Check if there are any documents with specific criteria
        console.log(`\n6. Checking specific queries:`);
        
        // Check for documents submitted by admin users
        const adminDocuments = await Request.find({}).populate('submittedBy', 'role');
        const adminSubmitted = adminDocuments.filter(doc => doc.submittedBy && doc.submittedBy.role === 'admin');
        console.log(`   Documents submitted by admins: ${adminSubmitted.length}`);
        
        // Check for documents with admin approval
        const adminApproved = await Request.countDocuments({ 'approval.admin.approved': true });
        console.log(`   Documents with admin approval: ${adminApproved}`);
        
        // Check for documents with finance approval
        const financeApproved = await Request.countDocuments({ 'approval.finance.approved': true });
        console.log(`   Documents with finance approval: ${financeApproved}`);
        
        // Check 7: Check the most recent document details
        if (allDocuments.length > 0) {
            const latestDocument = allDocuments[0];
            console.log(`\n7. Most recent document details:`);
            console.log(`   ID: ${latestDocument._id}`);
            console.log(`   Title: ${latestDocument.title}`);
            console.log(`   Type: ${latestDocument.type}`);
            console.log(`   Status: ${latestDocument.status}`);
            console.log(`   Approval:`, latestDocument.approval);
            console.log(`   Submitted by: ${latestDocument.submittedBy}`);
            console.log(`   Residence: ${latestDocument.residence}`);
            console.log(`   Created: ${latestDocument.createdAt}`);
            console.log(`   Updated: ${latestDocument.updatedAt}`);
        }
        
        // Check 8: Check if maintenance collection exists and has documents
        const maintenanceCollection = collections.find(c => c.name === 'maintenance');
        if (maintenanceCollection) {
            console.log(`\n8. Maintenance collection details:`);
            console.log(`   Name: ${maintenanceCollection.name}`);
            console.log(`   Type: ${maintenanceCollection.type}`);
            
            // Count documents directly in maintenance collection
            const directCount = await mongoose.connection.db.collection('maintenance').countDocuments();
            console.log(`   Direct document count: ${directCount}`);
            
            if (directCount > 0) {
                // Get a sample document
                const sample = await mongoose.connection.db.collection('maintenance').findOne({});
                console.log('\n9. Sample document from maintenance collection:');
                console.log(JSON.stringify(sample, null, 2));
            }
        } else {
            console.log('\n8. ❌ Maintenance collection not found!');
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Main function
async function main() {
    await connectDB();
    await debugRequests();
    
    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
}

// Run the debug
main().catch(console.error); 