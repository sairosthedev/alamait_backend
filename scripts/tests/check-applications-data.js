const mongoose = require('mongoose');

async function checkApplicationsData() {
    try {
        await mongoose.connect('mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');

        console.log('\n🔍 CHECKING APPLICATIONS COLLECTION FOR STUDENT DATA...\n');

        // 1. Check total applications
        const totalApplications = await mongoose.connection.db
            .collection('applications')
            .find({}).toArray();
        console.log(`📊 Total applications: ${totalApplications.length}`);

        if (totalApplications.length === 0) {
            console.log('❌ No applications found at all!');
            return;
        }

        // 2. Check applications by status
        const statusCounts = {};
        totalApplications.forEach(app => {
            const status = app.status || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        console.log('\n📋 Applications by status:');
        Object.keys(statusCounts).forEach(status => {
            console.log(`  ${status}: ${statusCounts[status]}`);
        });

        // 3. Check approved applications
        const approvedApplications = await mongoose.connection.db
            .collection('applications')
            .find({ status: 'approved' }).toArray();
        console.log(`\n✅ Approved applications: ${approvedApplications.length}`);

        if (approvedApplications.length > 0) {
            console.log('\n📅 Sample approved application dates:');
            approvedApplications.slice(0, 5).forEach((app, index) => {
                console.log(`  ${index + 1}. ${app.firstName} ${app.lastName}:`);
                console.log(`     Start: ${app.startDate}`);
                console.log(`     End: ${app.endDate}`);
                console.log(`     Payment Status: ${app.paymentStatus || 'N/A'}`);
                console.log(`     Residence: ${app.residence || 'N/A'}`);
                console.log(`     Room: ${app.allocatedRoom || app.preferredRoom || 'N/A'}`);
            });
        }

        // 4. Check applications that should have August 2025 accruals
        console.log('\n🔍 CHECKING FOR AUGUST 2025 ACCRUAL ELIGIBILITY...');
        const august2025Start = new Date(2025, 7, 1);   // August 1, 2025
        const august2025End = new Date(2025, 7, 31);    // August 31, 2025
        
        const augustEligible = approvedApplications.filter(app => {
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
                console.log(`  ${index + 1}. ${app.firstName} ${app.lastName}:`);
                console.log(`     Start: ${app.startDate} (${new Date(app.startDate).toLocaleDateString()})`);
                console.log(`     End: ${app.endDate} (${new Date(app.endDate).toLocaleDateString()})`);
                console.log(`     Payment Status: ${app.paymentStatus || 'N/A'}`);
                console.log(`     Residence: ${app.residence || 'N/A'}`);
                console.log(`     Room: ${app.allocatedRoom || app.preferredRoom || 'N/A'}`);
            });
        } else {
            console.log('\n❌ No students eligible for August 2025 accruals!');
            console.log('\n🔍 Debugging why no students are eligible...');
            
            approvedApplications.forEach((app, index) => {
                const startDate = new Date(app.startDate);
                const endDate = new Date(app.endDate);
                const paymentStatus = app.paymentStatus;
                
                console.log(`\n  Student ${index + 1}: ${app.firstName} ${app.lastName}`);
                console.log(`    Start Date: ${startDate} (Month: ${startDate.getMonth() + 1}, Year: ${startDate.getFullYear()})`);
                console.log(`    End Date: ${endDate} (Month: ${endDate.getMonth() + 1}, Year: ${endDate.getFullYear()})`);
                console.log(`    Payment Status: ${paymentStatus || 'N/A'}`);
                console.log(`    August 2025 Check:`);
                console.log(`      Start <= Aug 31: ${startDate <= august2025End}`);
                console.log(`      End >= Aug 1: ${endDate >= august2025Start}`);
                console.log(`      Payment != cancelled: ${paymentStatus !== 'cancelled'}`);
                console.log(`      ELIGIBLE: ${startDate <= august2025End && endDate >= august2025Start && paymentStatus !== 'cancelled'}`);
            });
        }

        // 5. Check for any applications with 2025 dates
        console.log('\n🔍 CHECKING FOR ANY 2025 APPLICATIONS...');
        const year2025Applications = approvedApplications.filter(app => {
            const startDate = new Date(app.startDate);
            const endDate = new Date(app.endDate);
            return startDate.getFullYear() === 2025 || endDate.getFullYear() === 2025;
        });
        
        console.log(`\n📊 Applications with 2025 dates: ${year2025Applications.length}`);
        
        if (year2025Applications.length > 0) {
            console.log('\n✅ 2025 applications found:');
            year2025Applications.forEach((app, index) => {
                console.log(`  ${index + 1}. ${app.firstName} ${app.lastName}:`);
                console.log(`     Start: ${app.startDate} (${new Date(app.startDate).toLocaleDateString()})`);
                console.log(`     End: ${app.endDate} (${new Date(app.endDate).toLocaleDateString()})`);
            });
        }

    } catch (error) {
        console.error('❌ Error checking applications data:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 MongoDB connection closed');
    }
}

checkApplicationsData();

