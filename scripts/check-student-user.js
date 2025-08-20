const mongoose = require('mongoose');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Debtor = require('../src/models/Debtor');

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

async function checkStudentUser() {
    try {
        console.log('\n🔍 Checking for Student Users...');
        console.log('=' .repeat(60));

        // Check for student role users
        const studentUsers = await User.find({ role: 'student' });
        console.log(`👥 Student Users: ${studentUsers.length}`);
        
        if (studentUsers.length > 0) {
            studentUsers.forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
                console.log(`      Application Code: ${user.applicationCode || 'NOT SET'}`);
                console.log(`      Created: ${user.createdAt}`);
            });
        }

        // Check for users with application codes
        const usersWithCodes = await User.find({ applicationCode: { $exists: true, $ne: null } });
        console.log(`\n🔑 Users with Application Codes: ${usersWithCodes.length}`);
        
        if (usersWithCodes.length > 0) {
            usersWithCodes.forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
                console.log(`      Role: ${user.role}`);
                console.log(`      Application Code: ${user.applicationCode}`);
            });
        }

        // Check applications
        const applications = await Application.find({});
        console.log(`\n📋 All Applications: ${applications.length}`);
        
        if (applications.length > 0) {
            applications.forEach((app, index) => {
                console.log(`   ${index + 1}. ${app.firstName} ${app.lastName} (${app.email})`);
                console.log(`      Status: ${app.status}`);
                console.log(`      Application Code: ${app.applicationCode || 'NOT SET'}`);
                console.log(`      Student Field: ${app.student || 'NOT SET'}`);
                console.log(`      Debtor Field: ${app.debtor || 'NOT SET'}`);
            });
        }

        // Check debtors
        const debtors = await Debtor.find({});
        console.log(`\n💰 All Debtors: ${debtors.length}`);
        
        if (debtors.length > 0) {
            debtors.forEach((debtor, index) => {
                console.log(`   ${index + 1}. ${debtor.debtorCode} (${debtor.contactInfo?.name || 'Unknown'})`);
                console.log(`      User: ${debtor.user || 'NOT LINKED'}`);
                console.log(`      Application: ${debtor.application || 'NOT LINKED'}`);
                console.log(`      Application Code: ${debtor.applicationCode || 'NOT SET'}`);
            });
        }

    } catch (error) {
        console.error('❌ Error checking student user:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await checkStudentUser();
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

module.exports = { checkStudentUser };
