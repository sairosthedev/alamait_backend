const mongoose = require('mongoose');
const Debtor = require('../src/models/Debtor');
const Application = require('../src/models/Application');
const User = require('../src/models/User');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

async function connectToDatabase() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

async function disconnectFromDatabase() {
    try {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error disconnecting from MongoDB:', error);
    }
}

async function findMacdonaldDebtor() {
    try {
        console.log('🔍 Searching for Macdonald Sairos...');
        
        // First, find the user by email
        const user = await User.findOne({ 
            email: 'macdonald.sairos@students.uz.ac.zw' 
        });
        
        if (!user) {
            console.error('❌ User Macdonald Sairos not found');
            return;
        }
        
        console.log(`✅ Found user: ${user.firstName} ${user.lastName}`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        
        // Find the application
        const application = await Application.findOne({
            student: user._id,
            status: 'approved'
        });
        
        if (!application) {
            console.error('❌ No approved application found for Macdonald');
            return;
        }
        
        console.log(`✅ Found approved application:`);
        console.log(`   ID: ${application._id}`);
        console.log(`   Code: ${application.applicationCode}`);
        console.log(`   Status: ${application.status}`);
        console.log(`   Start Date: ${application.startDate}`);
        console.log(`   End Date: ${application.endDate}`);
        console.log(`   Allocated Room: ${application.allocatedRoom}`);
        console.log(`   Residence: ${application.residence}`);
        
        // Find debtor by user ID
        const debtor = await Debtor.findOne({ user: user._id });
        
        if (!debtor) {
            console.log('❌ No debtor record found for Macdonald');
            console.log('   This means we need to create a new debtor record');
            return;
        }
        
        console.log(`✅ Found debtor record:`);
        console.log(`   ID: ${debtor._id}`);
        console.log(`   Debtor Code: ${debtor.debtorCode}`);
        console.log(`   Account Code: ${debtor.accountCode}`);
        console.log(`   Status: ${debtor.status}`);
        console.log(`   Current Balance: $${debtor.currentBalance}`);
        console.log(`   Total Owed: $${debtor.totalOwed}`);
        console.log(`   Residence: ${debtor.residence}`);
        console.log(`   Room Number: ${debtor.roomNumber}`);
        console.log(`   Application: ${debtor.application}`);
        
        // Check if debtor is linked to application
        if (debtor.application) {
            console.log('✅ Debtor is linked to application');
        } else {
            console.log('⚠️  Debtor is NOT linked to application');
        }
        
        // Check if application is linked to debtor
        if (application.debtor) {
            console.log('✅ Application is linked to debtor');
        } else {
            console.log('⚠️  Application is NOT linked to debtor');
        }
        
        return { user, application, debtor };
        
    } catch (error) {
        console.error('❌ Error finding Macdonald debtor:', error);
        throw error;
    }
}

async function main() {
    try {
        console.log('🚀 Starting Macdonald debtor search...');
        
        const result = await findMacdonaldDebtor();
        
        if (result) {
            console.log('\n📊 Summary:');
            console.log(`   User: ${result.user.firstName} ${result.user.lastName}`);
            console.log(`   Application: ${result.application.applicationCode}`);
            console.log(`   Debtor: ${result.debtor?.debtorCode || 'None'}`);
        }
        
        console.log('\n🏁 Macdonald debtor search completed!');
        
    } catch (error) {
        console.error('❌ Error in main function:', error);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await disconnectFromDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await disconnectFromDatabase();
    process.exit(0);
});

// Run the script
if (require.main === module) {
    (async () => {
        await connectToDatabase();
        await main();
        await disconnectFromDatabase();
        console.log('🏁 Script completed');
    })();
}

module.exports = { main, findMacdonaldDebtor, connectToDatabase, disconnectFromDatabase };
