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
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

// Test request creation
async function testRequestCreation() {
    console.log('=== Testing Request Creation ===\n');

    try {
        // Test 1: Create a maintenance request
        console.log('1. Creating maintenance request...');
        
        const maintenanceRequest = {
            title: 'Test Maintenance Request',
            description: 'This is a test maintenance request',
            type: 'maintenance',
            residence: '507f1f77bcf86cd799439011', // Replace with actual residence ID
            room: 'Room 101',
            category: 'plumbing',
            priority: 'medium',
            amount: 150
        };

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
            
            console.log('✅ Maintenance request created:', response.data);
            console.log('Request ID:', response.data._id);
        } catch (error) {
            console.log('❌ Maintenance request creation failed:', error.response?.data || error.message);
        }

        // Test 2: Create a financial request
        console.log('\n2. Creating financial request...');
        
        const financialRequest = {
            title: 'Test Financial Request',
            description: 'This is a test financial request',
            type: 'financial',
            residence: '507f1f77bcf86cd799439011', // Replace with actual residence ID
            department: 'Finance Department',
            requestedBy: 'John Doe',
            deliveryLocation: 'Main Office',
            items: [
                {
                    description: 'Office Supplies',
                    quantity: 5,
                    estimatedCost: 50,
                    purpose: 'Daily office operations'
                }
            ],
            proposedVendor: 'Office Supplies Co.'
        };

        try {
            const response = await axios.post(
                `${BASE_URL}/requests`,
                financialRequest,
                {
                    headers: {
                        'Authorization': `Bearer ${ADMIN_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );
            
            console.log('✅ Financial request created:', response.data);
            console.log('Request ID:', response.data._id);
        } catch (error) {
            console.log('❌ Financial request creation failed:', error.response?.data || error.message);
        }

        // Test 3: Check database directly
        console.log('\n3. Checking database directly...');
        
        const Request = mongoose.model('Request');
        const requests = await Request.find({}).sort({ createdAt: -1 }).limit(5);
        
        console.log(`Found ${requests.length} requests in database:`);
        requests.forEach((request, index) => {
            console.log(`${index + 1}. ID: ${request._id}`);
            console.log(`   Title: ${request.title}`);
            console.log(`   Type: ${request.type}`);
            console.log(`   Status: ${request.status}`);
            console.log(`   Created: ${request.createdAt}`);
            console.log(`   Submitted by: ${request.submittedBy}`);
            console.log('---');
        });

        // Test 4: Check specific collection
        console.log('\n4. Checking collections...');
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Available collections:');
        collections.forEach(collection => {
            console.log(`- ${collection.name}`);
        });

        // Test 5: Count documents in requests collection
        console.log('\n5. Counting documents...');
        
        const count = await Request.countDocuments();
        console.log(`Total requests in database: ${count}`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Main function
async function main() {
    await connectDB();
    await testRequestCreation();
    
    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
}

// Run the test
main().catch(console.error); 