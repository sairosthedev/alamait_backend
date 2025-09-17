/**
 * 🔍 Check Student Collections Sync
 * 
 * This script checks the relationship between User, Application, and ExpiredStudent collections
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Lease = require('../src/models/Lease');
const ExpiredStudent = require('../src/models/ExpiredStudent');

async function checkStudentCollectionsSync() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        console.log('🔍 Checking student collections sync...\n');

        // Get counts from all collections
        const userCount = await User.countDocuments({ role: 'student' });
        const applicationCount = await Application.countDocuments({});
        const expiredCount = await ExpiredStudent.countDocuments({});
        const leaseCount = await Lease.countDocuments({});

        console.log('📊 Collection Counts:');
        console.log(`   Users (students): ${userCount}`);
        console.log(`   Applications: ${applicationCount}`);
        console.log(`   Expired Students: ${expiredCount}`);
        console.log(`   Leases: ${leaseCount}`);

        // Check for students in User collection
        const users = await User.find({ role: 'student' }).select('_id firstName lastName email status');
        console.log(`\n👥 Students in User collection (${users.length}):`);
        
        const userStatusCounts = {};
        for (const user of users) {
            const status = user.status || 'unknown';
            userStatusCounts[status] = (userStatusCounts[status] || 0) + 1;
        }
        
        for (const [status, count] of Object.entries(userStatusCounts)) {
            console.log(`   ${status}: ${count}`);
        }

        // Check for students in ExpiredStudent collection
        const expiredStudents = await ExpiredStudent.find({}).select('_id student archivedAt reason');
        console.log(`\n📦 Students in ExpiredStudent collection (${expiredStudents.length}):`);
        
        const expiredReasonCounts = {};
        for (const expired of expiredStudents) {
            const reason = expired.reason || 'unknown';
            expiredReasonCounts[reason] = (expiredReasonCounts[reason] || 0) + 1;
        }
        
        for (const [reason, count] of Object.entries(expiredReasonCounts)) {
            console.log(`   ${reason}: ${count}`);
        }

        // Check for applications with different statuses
        const applications = await Application.find({}).select('_id firstName lastName email status student');
        console.log(`\n📋 Applications (${applications.length}):`);
        
        const appStatusCounts = {};
        for (const app of applications) {
            const status = app.status || 'unknown';
            appStatusCounts[status] = (appStatusCounts[status] || 0) + 1;
        }
        
        for (const [status, count] of Object.entries(appStatusCounts)) {
            console.log(`   ${status}: ${count}`);
        }

        // Check for inconsistencies
        console.log('\n🔍 Checking for inconsistencies...');
        
        const inconsistencies = [];
        
        // Check if any applications have students that are in ExpiredStudent collection
        for (const app of applications) {
            if (app.student) {
                const isInUsers = users.some(u => u._id.toString() === app.student.toString());
                const isInExpired = expiredStudents.some(e => 
                    e.student && e.student.toString() === app.student.toString()
                );
                
                if (!isInUsers && !isInExpired) {
                    inconsistencies.push({
                        type: 'ORPHANED_APPLICATION',
                        applicationId: app._id,
                        studentId: app.student,
                        studentName: `${app.firstName} ${app.lastName}`,
                        issue: 'Application references student not in User or ExpiredStudent collection'
                    });
                }
            }
        }

        // Check if any expired students have active applications
        for (const expired of expiredStudents) {
            if (expired.student) {
                const activeApps = applications.filter(app => 
                    app.student && app.student.toString() === expired.student.toString() &&
                    (app.status === 'approved' || app.status === 'pending')
                );
                
                if (activeApps.length > 0) {
                    inconsistencies.push({
                        type: 'EXPIRED_WITH_ACTIVE_APP',
                        expiredId: expired._id,
                        studentId: expired.student,
                        issue: 'Student is expired but has active applications',
                        activeApps: activeApps.length
                    });
                }
            }
        }

        // Check if any users have expired status but active leases
        for (const user of users) {
            if (user.status === 'expired') {
                const leases = await Lease.find({ studentId: user._id });
                const now = new Date();
                const hasActiveLease = leases.some(lease => 
                    lease.startDate && lease.endDate && 
                    new Date(lease.startDate) <= now && 
                    new Date(lease.endDate) > now
                );
                
                if (hasActiveLease) {
                    inconsistencies.push({
                        type: 'EXPIRED_WITH_ACTIVE_LEASE',
                        userId: user._id,
                        studentName: `${user.firstName} ${user.lastName}`,
                        issue: 'User marked as expired but has active lease',
                        activeLeases: leases.filter(l => 
                            l.startDate && l.endDate && 
                            new Date(l.startDate) <= now && 
                            new Date(l.endDate) > now
                        ).length
                    });
                }
            }
        }

        // Display inconsistencies
        if (inconsistencies.length > 0) {
            console.log(`\n🚨 Found ${inconsistencies.length} inconsistencies:`);
            
            const inconsistencyTypes = {};
            for (const inc of inconsistencies) {
                inconsistencyTypes[inc.type] = (inconsistencyTypes[inc.type] || 0) + 1;
            }
            
            console.log('\n📋 Inconsistency Types:');
            for (const [type, count] of Object.entries(inconsistencyTypes)) {
                console.log(`   ${type}: ${count}`);
            }
            
            console.log('\n🔍 Detailed Inconsistencies:');
            for (const inc of inconsistencies) {
                console.log(`\n   🚨 ${inc.type}`);
                console.log(`      Issue: ${inc.issue}`);
                if (inc.studentName) console.log(`      Student: ${inc.studentName}`);
                if (inc.studentId) console.log(`      Student ID: ${inc.studentId}`);
                if (inc.applicationId) console.log(`      Application ID: ${inc.applicationId}`);
                if (inc.expiredId) console.log(`      Expired ID: ${inc.expiredId}`);
                if (inc.userId) console.log(`      User ID: ${inc.userId}`);
                if (inc.activeApps) console.log(`      Active Apps: ${inc.activeApps}`);
                if (inc.activeLeases) console.log(`      Active Leases: ${inc.activeLeases}`);
            }
        } else {
            console.log('\n✅ No inconsistencies found!');
        }

        // Recommendations
        console.log('\n💡 Recommendations:');
        if (inconsistencies.length > 0) {
            console.log('   1. Run bulk status update to fix all inconsistencies');
            console.log('   2. Check if the student status job is running properly');
            console.log('   3. Verify data integrity between collections');
            console.log('   4. Consider running individual status fixes for critical cases');
        } else {
            console.log('   ✅ All collections are in sync!');
        }

    } catch (error) {
        console.error('❌ Error checking student collections sync:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the check
checkStudentCollectionsSync();




