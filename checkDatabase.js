const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function checkDatabase() {
    try {
        console.log('Checking database connection...');
        console.log('MongoDB URI:', process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('Connection state:', mongoose.connection.readyState);
        
        // List all collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('\nCollections in database:');
        collections.forEach(collection => {
            console.log(`- ${collection.name}`);
        });
        
        // Check if users collection exists and has data
        if (collections.some(c => c.name === 'users')) {
            const userCount = await mongoose.connection.db.collection('users').countDocuments();
            console.log(`\nUsers collection has ${userCount} documents`);
            
            if (userCount > 0) {
                // Get a sample user
                const sampleUser = await mongoose.connection.db.collection('users').findOne({});
                console.log('Sample user:', JSON.stringify(sampleUser, null, 2));
            }
        } else {
            console.log('\nUsers collection does not exist');
        }
        
        // Check applications collection
        if (collections.some(c => c.name === 'applications')) {
            const appCount = await mongoose.connection.db.collection('applications').countDocuments();
            console.log(`\nApplications collection has ${appCount} documents`);
            
            if (appCount > 0) {
                // Get a sample application
                const sampleApp = await mongoose.connection.db.collection('applications').findOne({});
                console.log('Sample application:', JSON.stringify(sampleApp, null, 2));
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

checkDatabase(); 