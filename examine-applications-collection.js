require('dotenv').config();
const mongoose = require('mongoose');

async function examineApplicationsCollection() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Examining Applications Collection...');
        console.log('=====================================');

        // Get applications collection
        const applications = await mongoose.connection.db.collection('applications').find({}).toArray();
        console.log(`📝 Found ${applications.length} applications`);

        if (applications.length > 0) {
            console.log('\n📊 Applications Structure:');
            console.log('==========================');
            
            applications.forEach((app, index) => {
                console.log(`\n${index + 1}. Application ID: ${app._id}`);
                console.log(`   Fields: ${Object.keys(app).join(', ')}`);
                console.log(`   Student ID: ${app.student || 'N/A'}`);
                console.log(`   User ID: ${app.user || 'N/A'}`);
                console.log(`   Email: ${app.email || 'N/A'}`);
                console.log(`   Room: ${app.allocatedRoom || app.preferredRoom || 'N/A'}`);
                console.log(`   Residence: ${app.residence || 'N/A'}`);
                console.log(`   Status: ${app.status || 'N/A'}`);
            });
        }

        // Get the 3 unmatched payments to see what we're missing
        console.log('\n🔍 Examining Unmatched Payments:');
        console.log('================================');
        
        const payments = await mongoose.connection.db.collection('payments').find({}).toArray();
        const unmatchedPayments = payments.filter(p => !p.user);
        
        console.log(`Found ${unmatchedPayments.length} unmatched payments:`);
        
        unmatchedPayments.forEach((payment, index) => {
            console.log(`\n${index + 1}. Payment ID: ${payment._id}`);
            console.log(`   Student ID: ${payment.student || 'N/A'}`);
            console.log(`   Room: ${payment.room || 'N/A'}`);
            console.log(`   Residence: ${payment.residence || 'N/A'}`);
            console.log(`   Amount: $${payment.amount || payment.rentAmount || 'N/A'}`);
            
            // Try to find this student ID in applications
            const matchingApp = applications.find(app => 
                app.student && app.student.toString() === payment.student.toString()
            );
            
            if (matchingApp) {
                console.log(`   ✅ Found matching application:`);
                console.log(`      Application ID: ${matchingApp._id}`);
                console.log(`      User ID: ${matchingApp.user || 'N/A'}`);
                console.log(`      Email: ${matchingApp.email || 'N/A'}`);
                console.log(`      Room: ${matchingApp.allocatedRoom || matchingApp.preferredRoom || 'N/A'}`);
            } else {
                console.log(`   ❌ No matching application found for student ID: ${payment.student}`);
            }
        });

        // Check if there are any other collections that might help
        console.log('\n🔍 Checking for Other Relevant Collections:');
        console.log('==========================================');
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`Available collections: ${collections.map(c => c.name).join(', ')}`);
        
        // Check if there's a students collection
        try {
            const students = await mongoose.connection.db.collection('students').find({}).limit(5).toArray();
            if (students.length > 0) {
                console.log(`\n📚 Students collection found with ${students.length} records`);
                console.log(`Sample student fields: ${Object.keys(students[0]).join(', ')}`);
            }
        } catch (error) {
            console.log(`\nℹ️  Students collection not accessible: ${error.message}`);
        }

        // Check if there's a profiles collection
        try {
            const profiles = await mongoose.connection.db.collection('profiles').find({}).limit(5).toArray();
            if (profiles.length > 0) {
                console.log(`\n👤 Profiles collection found with ${profiles.length} records`);
                console.log(`Sample profile fields: ${Object.keys(profiles[0]).join(', ')}`);
            }
        } catch (error) {
            console.log(`\nℹ️  Profiles collection not accessible: ${error.message}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Applications Collection Examination...');
examineApplicationsCollection();
