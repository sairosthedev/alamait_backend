const mongoose = require('mongoose');

async function checkAtlasApplications() {
    try {
        // Connect to MongoDB Atlas
        const atlasUri = 'mongodb+srv://cluster0.ulvve.mongodb.net/test';
        console.log('🔌 Connecting to MongoDB Atlas...');
        
        await mongoose.connect(atlasUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to MongoDB Atlas successfully!');
        console.log('Database: test');
        console.log('Collection: applications\n');

        // Check what collections exist
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('📚 Available collections:');
        collections.forEach(col => console.log(`  - ${col.name}`));

        // Check applications collection
        console.log('\n🔍 CHECKING APPLICATIONS COLLECTION...');
        const totalApplications = await mongoose.connection.db
            .collection('applications')
            .find({}).toArray();
        
        console.log(`📊 Total applications: ${totalApplications.length}`);

        if (totalApplications.length === 0) {
            console.log('❌ No applications found in Atlas database!');
            return;
        }

        // Check applications by status
        const statusCounts = {};
        totalApplications.forEach(app => {
            const status = app.status || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        console.log('\n📋 Applications by status:');
        Object.keys(statusCounts).forEach(status => {
            console.log(`  ${status}: ${statusCounts[status]}`);
        });

        // Check approved applications
        const approvedApplications = await mongoose.connection.db
            .collection('applications')
            .find({ status: 'approved' }).toArray();
        console.log(`\n✅ Approved applications: ${approvedApplications.length}`);

        if (approvedApplications.length > 0) {
            console.log('\n📅 Sample approved application details:');
            approvedApplications.slice(0, 5).forEach((app, index) => {
                console.log(`\n  ${index + 1}. ${app.firstName || 'N/A'} ${app.lastName || 'N/A'}:`);
                console.log(`     Start Date: ${app.startDate || 'N/A'}`);
                console.log(`     End Date: ${app.endDate || 'N/A'}`);
                console.log(`     Payment Status: ${app.paymentStatus || 'N/A'}`);
                console.log(`     Residence: ${app.residence || 'N/A'}`);
                console.log(`     Room: ${app.allocatedRoom || app.preferredRoom || 'N/A'}`);
                
                if (app.startDate && app.endDate) {
                    const startDate = new Date(app.startDate);
                    const endDate = new Date(app.endDate);
                    console.log(`     Start Month/Year: ${startDate.getMonth() + 1}/${startDate.getFullYear()}`);
                    console.log(`     End Month/Year: ${endDate.getMonth() + 1}/${endDate.getFullYear()}`);
                }
            });
        }

        // Check for 2025 applications
        console.log('\n🔍 CHECKING FOR 2025 APPLICATIONS...');
        const year2025Applications = approvedApplications.filter(app => {
            if (!app.startDate || !app.endDate) return false;
            const startDate = new Date(app.startDate);
            const endDate = new Date(app.endDate);
            return startDate.getFullYear() === 2025 || endDate.getFullYear() === 2025;
        });
        
        console.log(`\n📊 Applications with 2025 dates: ${year2025Applications.length}`);
        
        if (year2025Applications.length > 0) {
            console.log('\n✅ 2025 applications found:');
            year2025Applications.forEach((app, index) => {
                const startDate = new Date(app.startDate);
                const endDate = new Date(app.endDate);
                console.log(`  ${index + 1}. ${app.firstName} ${app.lastName}:`);
                console.log(`     Start: ${startDate.toLocaleDateString()}`);
                console.log(`     End: ${endDate.toLocaleDateString()}`);
                console.log(`     Duration: ${Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))} days`);
            });
        }

        // Check if any students would be eligible for August 2025 accruals
        console.log('\n🔍 CHECKING AUGUST 2025 ACCRUAL ELIGIBILITY...');
        const august2025Start = new Date(2025, 7, 1);   // August 1, 2025
        const august2025End = new Date(2025, 7, 31);    // August 31, 2025
        
        const augustEligible = approvedApplications.filter(app => {
            if (!app.startDate || !app.endDate) return false;
            const startDate = new Date(app.startDate);
            const endDate = new Date(app.endDate);
            const paymentStatus = app.paymentStatus;
            
            return startDate <= august2025End && 
                   endDate >= august2025Start && 
                   paymentStatus !== 'cancelled';
        });
        
        console.log(`\n📊 Students eligible for August 2025 accruals: ${augustEligible.length}`);
        
        if (augustEligible.length > 0) {
            console.log('\n✅ August 2025 eligible students:');
            augustEligible.forEach((app, index) => {
                console.log(`  ${index + 1}. ${app.firstName} ${app.lastName}`);
            });
        }

    } catch (error) {
        console.error('❌ Error connecting to Atlas:', error.message);
        console.log('\n💡 Make sure you have:');
        console.log('  1. Network access enabled for your IP');
        console.log('  2. Correct username/password in connection string');
        console.log('  3. Database user has read permissions');
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('\n🔌 MongoDB Atlas connection closed');
        }
    }
}

checkAtlasApplications();

