const mongoose = require('mongoose');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Debtor = require('../src/models/Debtor');
const Residence = require('../src/models/Residence');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

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
        console.error('❌ Failed to disconnect from MongoDB:', error);
    }
}

async function checkDatabase() {
    try {
        console.log('\n🔍 Checking Database Contents...');
        console.log('=' .repeat(60));

        // Check collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`📚 Collections found: ${collections.length}`);
        collections.forEach(col => {
            console.log(`   - ${col.name}`);
        });

        // Check Users
        const users = await User.find({});
        console.log(`\n👥 Users: ${users.length}`);
        if (users.length > 0) {
            users.forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
                console.log(`      Role: ${user.role}`);
                console.log(`      Application Code: ${user.applicationCode || 'NOT SET'}`);
            });
        }

        // Check Applications
        const applications = await Application.find({});
        console.log(`\n📋 Applications: ${applications.length}`);
        if (applications.length > 0) {
            applications.forEach((app, index) => {
                console.log(`   ${index + 1}. ${app.firstName} ${app.lastName} (${app.email})`);
                console.log(`      Status: ${app.status}`);
                console.log(`      Application Code: ${app.applicationCode || 'NOT SET'}`);
            });
        }

        // Check Debtors
        const debtors = await Debtor.find({});
        console.log(`\n💰 Debtors: ${debtors.length}`);
        if (debtors.length > 0) {
            debtors.forEach((debtor, index) => {
                console.log(`   ${index + 1}. ${debtor.debtorCode} (${debtor.contactInfo?.name || 'Unknown'})`);
                console.log(`      Application: ${debtor.application || 'NOT LINKED'}`);
                console.log(`      Application Code: ${debtor.applicationCode || 'NOT SET'}`);
            });
        }

        // Check Residences
        const residences = await Residence.find({});
        console.log(`\n🏠 Residences: ${residences.length}`);
        if (residences.length > 0) {
            residences.forEach((residence, index) => {
                console.log(`   ${index + 1}. ${residence.name}`);
                console.log(`      Rooms: ${residence.rooms ? residence.rooms.length : 0}`);
            });
        }

    } catch (error) {
        console.error('❌ Error checking database:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await checkDatabase();
    } catch (error) {
        console.error('❌ Main error:', error);
    } finally {
        await disconnectFromDatabase();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { checkDatabase };
