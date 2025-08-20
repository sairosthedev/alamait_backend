const mongoose = require('mongoose');
const Application = require('../src/models/Application');

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

async function checkApplications() {
    try {
        console.log('\n🔍 Checking Applications in Database...');
        console.log('=' .repeat(60));

        // Get all applications
        const applications = await Application.find({}).sort({ createdAt: -1 });

        if (applications.length === 0) {
            console.log('❌ No applications found in database');
            return;
        }

        console.log(`📊 Found ${applications.length} applications:`);

        applications.forEach((app, index) => {
            console.log(`\n${index + 1}. Application ID: ${app._id}`);
            console.log(`   Status: ${app.status}`);
            console.log(`   Application Code: ${app.applicationCode || 'NOT SET'}`);
            console.log(`   Email: ${app.email}`);
            console.log(`   Name: ${app.firstName} ${app.lastName}`);
            console.log(`   Student Field: ${app.student || 'NOT SET'}`);
            console.log(`   Debtor Field: ${app.debtor || 'NOT SET'}`);
            console.log(`   Room: ${app.allocatedRoom || 'Not set'}`);
            console.log(`   Residence: ${app.residence || 'Not set'}`);
            console.log(`   Created: ${app.createdAt}`);
        });

        // Summary by status
        const statusCounts = {};
        const hasApplicationCode = applications.filter(app => app.applicationCode).length;
        const hasStudent = applications.filter(app => app.student).length;
        const hasDebtor = applications.filter(app => app.debtor).length;

        applications.forEach(app => {
            statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
        });

        console.log('\n' + '=' .repeat(60));
        console.log('📊 SUMMARY');
        console.log('=' .repeat(60));
        console.log(`Total Applications: ${applications.length}`);
        console.log(`With Application Code: ${hasApplicationCode}`);
        console.log(`With Student Field: ${hasStudent}`);
        console.log(`With Debtor Field: ${hasDebtor}`);
        
        console.log('\nStatus Breakdown:');
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`   ${status}: ${count}`);
        });

    } catch (error) {
        console.error('❌ Error checking applications:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await checkApplications();
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

module.exports = { checkApplications };
