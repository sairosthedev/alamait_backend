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

// Test maintenance collection
async function testMaintenanceCollection() {
    console.log('=== Testing Maintenance Collection ===\n');

    try {
        // Get the Request model
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
        
        // Check 5: Check collections in the database
        console.log(`\n5. Available collections in ${mongoose.connection.name}:`);
        const collections = await mongoose.connection.db.listCollections().toArray();
        collections.forEach(collection => {
            console.log(`   - ${collection.name}`);
        });
        
        // Check 6: Check if maintenance collection exists and has documents
        const maintenanceCollection = collections.find(c => c.name === 'maintenance');
        if (maintenanceCollection) {
            console.log(`\n6. Maintenance collection details:`);
            console.log(`   Name: ${maintenanceCollection.name}`);
            console.log(`   Type: ${maintenanceCollection.type}`);
            
            // Count documents directly in maintenance collection
            const directCount = await mongoose.connection.db.collection('maintenance').countDocuments();
            console.log(`   Direct document count: ${directCount}`);
            
            if (directCount > 0) {
                // Get a sample document
                const sample = await mongoose.connection.db.collection('maintenance').findOne({});
                console.log('\n7. Sample document from maintenance collection:');
                console.log(JSON.stringify(sample, null, 2));
            }
        } else {
            console.log('\n6. ❌ Maintenance collection not found!');
        }
        
        // Check 7: Test creating a new document
        console.log('\n8. Testing document creation...');
        
        const testDocument = new Request({
            title: 'Test Maintenance Request',
            description: 'This is a test maintenance request',
            type: 'maintenance',
            submittedBy: new mongoose.Types.ObjectId(), // Create a dummy ObjectId
            residence: new mongoose.Types.ObjectId(), // Create a dummy ObjectId
            room: 'Test Room',
            category: 'plumbing',
            priority: 'medium',
            status: 'pending',
            amount: 150
        });
        
        await testDocument.save();
        console.log('✅ Test document created successfully');
        console.log(`   ID: ${testDocument._id}`);
        console.log(`   Title: ${testDocument.title}`);
        
        // Verify it was saved
        const savedDoc = await Request.findById(testDocument._id);
        if (savedDoc) {
            console.log('✅ Document verified in database');
        } else {
            console.log('❌ Document not found in database');
        }
        
        // Clean up - delete the test document
        await Request.findByIdAndDelete(testDocument._id);
        console.log('✅ Test document cleaned up');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Main function
async function main() {
    await connectDB();
    await testMaintenanceCollection();
    
    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
}

// Run the test
main().catch(console.error); 