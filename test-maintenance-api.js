const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const BASE_URL = 'https://alamait-backend.onrender.com/api';
const ADMIN_TOKEN = 'your-admin-token-here'; // Replace with actual admin token

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

// Test API and database
async function testMaintenanceAPI() {
    console.log('=== Testing Maintenance API and Database ===\n');

    try {
        // Test 1: Create a maintenance request via API
        console.log('1. Creating maintenance request via API...');
        
        const maintenanceRequest = {
            title: 'Test Maintenance Request via API',
            description: 'This is a test maintenance request created via API',
            type: 'maintenance',
            residence: '507f1f77bcf86cd799439011', // Replace with actual residence ID
            room: 'Room 101',
            category: 'plumbing',
            priority: 'medium',
            amount: 150
        };

        let createdRequestId = null;

        try {
            const response = await axios.post(
                `${BASE_URL}/requests`,
                maintenanceRequest,
                {
                    headers: {
                        'Authorization': `Bearer ${ADMIN_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );
            
            console.log('✅ Maintenance request created via API:', response.data);
            createdRequestId = response.data._id;
            console.log('Request ID:', createdRequestId);
        } catch (error) {
            console.log('❌ API request creation failed:', error.response?.data || error.message);
        }

        // Test 2: Check if the request was saved to maintenance collection
        console.log('\n2. Checking if request was saved to maintenance collection...');
        
        const Request = mongoose.model('Request');
        
        if (createdRequestId) {
            const savedRequest = await Request.findById(createdRequestId);
            if (savedRequest) {
                console.log('✅ Request found in maintenance collection:');
                console.log(`   ID: ${savedRequest._id}`);
                console.log(`   Title: ${savedRequest.title}`);
                console.log(`   Type: ${savedRequest.type}`);
                console.log(`   Status: ${savedRequest.status}`);
                console.log(`   Created: ${savedRequest.createdAt}`);
            } else {
                console.log('❌ Request not found in maintenance collection');
            }
        }

        // Test 3: Check total count in maintenance collection
        console.log('\n3. Checking total count in maintenance collection...');
        
        const totalCount = await Request.countDocuments();
        console.log(`Total documents in maintenance collection: ${totalCount}`);

        // Test 4: Get all documents from maintenance collection
        console.log('\n4. Getting all documents from maintenance collection...');
        
        const allDocuments = await Request.find({}).sort({ createdAt: -1 }).limit(5);
        console.log(`Found ${allDocuments.length} documents:`);
        allDocuments.forEach((doc, index) => {
            console.log(`${index + 1}. ID: ${doc._id}`);
            console.log(`   Title: ${doc.title}`);
            console.log(`   Type: ${doc.type}`);
            console.log(`   Status: ${doc.status}`);
            console.log(`   Created: ${doc.createdAt}`);
            console.log('---');
        });

        // Test 5: Check collections in database
        console.log('\n5. Checking collections in database...');
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Available collections:');
        collections.forEach(collection => {
            console.log(`   - ${collection.name}`);
        });

        // Test 6: Check maintenance collection directly
        console.log('\n6. Checking maintenance collection directly...');
        
        const maintenanceCollection = collections.find(c => c.name === 'maintenance');
        if (maintenanceCollection) {
            const directCount = await mongoose.connection.db.collection('maintenance').countDocuments();
            console.log(`Direct count in maintenance collection: ${directCount}`);
            
            if (directCount > 0) {
                const sample = await mongoose.connection.db.collection('maintenance').findOne({});
                console.log('Sample document from maintenance collection:');
                console.log(JSON.stringify(sample, null, 2));
            }
        } else {
            console.log('❌ Maintenance collection not found');
        }

        // Test 7: Clean up - delete the test request
        if (createdRequestId) {
            console.log('\n7. Cleaning up test request...');
            try {
                await Request.findByIdAndDelete(createdRequestId);
                console.log('✅ Test request cleaned up');
            } catch (error) {
                console.log('❌ Failed to clean up test request:', error.message);
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Main function
async function main() {
    await connectDB();
    await testMaintenanceAPI();
    
    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
}

// Run the test
main().catch(console.error); 