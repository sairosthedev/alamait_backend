const mongoose = require('mongoose');

/**
 * MongoDB Connection Setup Script
 * 
 * This script helps you connect to your MongoDB cluster.
 * Replace the MONGODB_URI with your actual cluster connection string.
 * 
 * Run with: node setup-mongodb-connection.js
 */

// Replace this with your actual MongoDB cluster connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

async function testConnection() {
    try {
        console.log('🔌 Testing MongoDB Connection...');
        console.log('URI:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@'));
        console.log('');
        
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 5,
            retryWrites: true,
            retryReads: true
        });
        
        console.log('✅ Successfully connected to MongoDB!');
        console.log('Database:', mongoose.connection.name);
        console.log('Host:', mongoose.connection.host);
        console.log('Port:', mongoose.connection.port);
        console.log('Connection State:', mongoose.connection.readyState);
        console.log('');
        
        // Test basic operations
        console.log('🧪 Testing basic database operations...');
        
        // List all collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Available collections:', collections.map(c => c.name));
        console.log('');
        
        // Test if we can read/write
        const testCollection = mongoose.connection.db.collection('test_connection');
        await testCollection.insertOne({ test: true, timestamp: new Date() });
        console.log('✅ Write test: Success');
        
        const testDoc = await testCollection.findOne({ test: true });
        console.log('✅ Read test: Success');
        
        // Clean up test document
        await testCollection.deleteOne({ test: true });
        console.log('✅ Delete test: Success');
        console.log('');
        
        console.log('🎉 MongoDB connection test completed successfully!');
        console.log('Your cluster is ready for the rental accrual system.');
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('');
        console.log('🔧 Troubleshooting tips:');
        console.log('1. Check your MONGODB_URI environment variable');
        console.log('2. Verify your cluster is running and accessible');
        console.log('3. Check network connectivity and firewall settings');
        console.log('4. Verify username/password in connection string');
        console.log('5. Ensure your IP is whitelisted in MongoDB Atlas');
        console.log('');
        console.log('Example connection string format:');
        console.log('mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority');
        
    } finally {
        try {
            await mongoose.connection.close();
            console.log('✅ Connection closed');
        } catch (closeError) {
            console.error('❌ Error closing connection:', closeError.message);
        }
        process.exit(0);
    }
}

// Run the connection test
testConnection();
