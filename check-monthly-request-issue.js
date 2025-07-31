const mongoose = require('mongoose');

// Simple script to check database state
async function checkMonthlyRequestIssue() {
    try {
        console.log('🔍 Checking Monthly Request Issue...\n');
        
        // Connect to MongoDB (you'll need to set the correct connection string)
        const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://cluster0.ulvve.mongodb.net/test';
        console.log('Connecting to MongoDB...');
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to MongoDB\n');
        
        // Check if we can access the collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Available collections:', collections.map(c => c.name));
        
        // Try to access the models
        const MonthlyRequest = require('./src/models/MonthlyRequest');
        const Residence = require('./src/models/Residence');
        const User = require('./src/models/User');
        
        console.log('\n📊 Database Statistics:');
        
        // Count documents in each collection
        const monthlyRequestCount = await MonthlyRequest.countDocuments();
        const residenceCount = await Residence.countDocuments();
        const userCount = await User.countDocuments();
        
        console.log(`Monthly Requests: ${monthlyRequestCount}`);
        console.log(`Residences: ${residenceCount}`);
        console.log(`Users: ${userCount}`);
        
        // Get sample data
        if (residenceCount > 0) {
            const sampleResidence = await Residence.findOne();
            console.log('\n🏠 Sample Residence:', {
                id: sampleResidence._id,
                name: sampleResidence.name
            });
        }
        
        if (userCount > 0) {
            const adminUsers = await User.find({ role: 'admin' });
            console.log(`\n👥 Admin Users: ${adminUsers.length}`);
            adminUsers.forEach(user => {
                console.log(`  - ${user.firstName} ${user.lastName} (${user.email})`);
            });
        }
        
        // Check current month/year
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        console.log(`\n📅 Current Date: ${currentMonth}/${currentYear}`);
        
        // Check for existing monthly requests this month
        const existingRequests = await MonthlyRequest.find({
            month: currentMonth,
            year: currentYear
        });
        
        console.log(`\n📋 Existing Monthly Requests for ${currentMonth}/${currentYear}: ${existingRequests.length}`);
        existingRequests.forEach(req => {
            console.log(`  - ${req.title} (${req.residence}) - Status: ${req.status}`);
        });
        
        console.log('\n✅ Database check complete!');
        
    } catch (error) {
        console.error('❌ Error during database check:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('\nDatabase connection closed.');
        }
    }
}

// Run the check
checkMonthlyRequestIssue(); 