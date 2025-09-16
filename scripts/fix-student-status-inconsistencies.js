/**
 * 🔧 Fix Student Status Inconsistencies
 * 
 * This script fixes all the inconsistencies found in student status management
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Lease = require('../src/models/Lease');
const ExpiredStudent = require('../src/models/ExpiredStudent');
const StudentStatusManager = require('../src/utils/studentStatusManager');

async function fixStudentStatusInconsistencies() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        console.log('🔧 Fixing student status inconsistencies...\n');

        // Get all data
        const users = await User.find({ role: 'student' });
        const applications = await Application.find({});
        const expiredStudents = await ExpiredStudent.find({});
        const leases = await Lease.find({});

        console.log('📊 Current State:');
        console.log(`   Users: ${users.length}`);
        console.log(`   Applications: ${applications.length}`);
        console.log(`   Expired Students: ${expiredStudents.length}`);
        console.log(`   Leases: ${leases.length}`);

        let fixesApplied = 0;

        // Fix 1: Handle orphaned applications
        console.log('\n🔧 Fix 1: Handling orphaned applications...');
        
        for (const app of applications) {
            if (app.student) {
                const isInUsers = users.some(u => u._id.toString() === app.student.toString());
                const isInExpired = expiredStudents.some(e => 
                    e.student && e.student.toString() === app.student.toString()
                );
                
                if (!isInUsers && !isInExpired) {
                    console.log(`   🚨 Orphaned application: ${app.firstName} ${app.lastName} (${app._id})`);
                    
                    // Check if this should be an expired application
                    const now = new Date();
                    const shouldBeExpired = app.endDate && new Date(app.endDate) < now;
                    
                    if (shouldBeExpired && app.status !== 'expired') {
                        app.status = 'expired';
                        app.rejectionReason = 'Student not found in system - application expired';
                        app.actionDate = new Date();
                        await app.save();
                        console.log(`   ✅ Updated application status to 'expired'`);
                        fixesApplied++;
                    } else if (!shouldBeExpired) {
                        console.log(`   ⚠️ Application still valid but student missing - manual review needed`);
                    }
                }
            }
        }

        // Fix 2: Handle expired students with active applications
        console.log('\n🔧 Fix 2: Handling expired students with active applications...');
        
        for (const expired of expiredStudents) {
            if (expired.student) {
                const activeApps = applications.filter(app => 
                    app.student && app.student.toString() === expired.student.toString() &&
                    (app.status === 'approved' || app.status === 'pending')
                );
                
                if (activeApps.length > 0) {
                    console.log(`   🚨 Expired student with active apps: ${expired.student}`);
                    
                    for (const app of activeApps) {
                        app.status = 'expired';
                        app.rejectionReason = `Student expired: ${expired.reason}`;
                        app.actionDate = new Date();
                        await app.save();
                        console.log(`   ✅ Updated application ${app._id} to 'expired'`);
                        fixesApplied++;
                    }
                }
            }
        }

        // Fix 3: Run bulk status update for all users
        console.log('\n🔧 Fix 3: Running bulk status update...');
        
        try {
            const bulkUpdateResult = await StudentStatusManager.bulkUpdateStudentStatuses();
            console.log(`   ✅ Bulk status update completed`);
            console.log(`   📊 Updated: ${bulkUpdateResult.updated || 0} students`);
            console.log(`   📊 Errors: ${bulkUpdateResult.errors || 0} students`);
            fixesApplied += bulkUpdateResult.updated || 0;
        } catch (error) {
            console.log(`   ❌ Bulk update failed: ${error.message}`);
        }

        // Fix 4: Check for users with expired status but active leases
        console.log('\n🔧 Fix 4: Checking for users with expired status but active leases...');
        
        for (const user of users) {
            if (user.status === 'expired') {
                const userLeases = leases.filter(lease => lease.studentId.toString() === user._id.toString());
                const now = new Date();
                const hasActiveLease = userLeases.some(lease => 
                    lease.startDate && lease.endDate && 
                    new Date(lease.startDate) <= now && 
                    new Date(lease.endDate) > now
                );
                
                if (hasActiveLease) {
                    console.log(`   🚨 User ${user.firstName} ${user.lastName} marked as expired but has active lease`);
                    
                    // Update status to active
                    user.status = 'active';
                    await user.save();
                    console.log(`   ✅ Updated user status to 'active'`);
                    fixesApplied++;
                }
            }
        }

        // Fix 5: Check for users with active status but expired leases
        console.log('\n🔧 Fix 5: Checking for users with active status but expired leases...');
        
        for (const user of users) {
            if (user.status === 'active') {
                const userLeases = leases.filter(lease => lease.studentId.toString() === user._id.toString());
                const now = new Date();
                const hasActiveLease = userLeases.some(lease => 
                    lease.startDate && lease.endDate && 
                    new Date(lease.startDate) <= now && 
                    new Date(lease.endDate) > now
                );
                
                const allLeasesExpired = userLeases.length > 0 && !hasActiveLease;
                
                if (allLeasesExpired) {
                    console.log(`   🚨 User ${user.firstName} ${user.lastName} marked as active but all leases expired`);
                    
                    // Check room validity
                    const roomValid = user.roomValidUntil && new Date(user.roomValidUntil) > now;
                    
                    if (!roomValid) {
                        user.status = 'expired';
                        await user.save();
                        console.log(`   ✅ Updated user status to 'expired'`);
                        fixesApplied++;
                    }
                }
            }
        }

        // Summary
        console.log('\n📊 Fix Summary:');
        console.log(`   ✅ Total fixes applied: ${fixesApplied}`);
        
        // Final status check
        console.log('\n🔍 Final Status Check:');
        const finalUsers = await User.find({ role: 'student' });
        const finalApplications = await Application.find({});
        const finalExpiredStudents = await ExpiredStudent.find({});
        
        const userStatusCounts = {};
        for (const user of finalUsers) {
            const status = user.status || 'unknown';
            userStatusCounts[status] = (userStatusCounts[status] || 0) + 1;
        }
        
        const appStatusCounts = {};
        for (const app of finalApplications) {
            const status = app.status || 'unknown';
            appStatusCounts[status] = (appStatusCounts[status] || 0) + 1;
        }
        
        console.log('   👥 Final User Statuses:');
        for (const [status, count] of Object.entries(userStatusCounts)) {
            console.log(`      ${status}: ${count}`);
        }
        
        console.log('   📋 Final Application Statuses:');
        for (const [status, count] of Object.entries(appStatusCounts)) {
            console.log(`      ${status}: ${count}`);
        }
        
        console.log(`   📦 Expired Students: ${finalExpiredStudents.length}`);

        console.log('\n✅ Student status inconsistencies fixed!');

    } catch (error) {
        console.error('❌ Error fixing student status inconsistencies:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the fix
fixStudentStatusInconsistencies();


