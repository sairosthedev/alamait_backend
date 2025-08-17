const mongoose = require('mongoose');

// Set the MongoDB URI from the user's provided connection string
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testConnection() {
    try {
        console.log('🔌 Testing MongoDB connection...');
        console.log('Connection URI:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@'));
        
        const conn = await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 5,
            retryWrites: true,
            retryReads: true
        });

        console.log('✅ MongoDB Connected Successfully!');
        console.log('Host:', conn.connection.host);
        console.log('Database name:', conn.connection.name);
        console.log('Connection state:', conn.connection.readyState);

        // List all collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('\n📋 Available collections:');
        collections.forEach(collection => {
            console.log(`  - ${collection.name}`);
        });

        // Test basic operations
        console.log('\n🧪 Testing basic operations...');
        
        // Test accounts collection
        const accountsCount = await mongoose.connection.db.collection('accounts').countDocuments();
        console.log(`  - Accounts collection: ${accountsCount} documents`);
        
        // Test transactions collection
        const transactionsCount = await mongoose.connection.db.collection('transactions').countDocuments();
        console.log(`  - Transactions collection: ${transactionsCount} documents`);
        
        // Test payments collection
        const paymentsCount = await mongoose.connection.db.collection('payments').countDocuments();
        console.log(`  - Payments collection: ${paymentsCount} documents`);
        
        // Test expenses collection
        const expensesCount = await mongoose.connection.db.collection('expenses').countDocuments();
        console.log(`  - Expenses collection: ${expensesCount} documents`);

        console.log('\n✅ All tests passed! MongoDB connection is working correctly.');
        
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', {
            message: error.message,
            name: error.name,
            code: error.code
        });
        
        if (error.code === 'ENOTFOUND') {
            console.log('\n💡 Troubleshooting tips:');
            console.log('1. Check your internet connection');
            console.log('2. Verify the MongoDB Atlas cluster is running');
            console.log('3. Check if the IP address is whitelisted in MongoDB Atlas');
        } else if (error.code === 'EAUTH') {
            console.log('\n💡 Authentication failed. Check your username and password.');
        }
        
        process.exit(1);
    }
}

// Run the test
testConnection(); 