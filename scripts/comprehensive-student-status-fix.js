/**
 * 🔧 Comprehensive Student Status Fix
 * 
 * This script comprehensively fixes all student status issues
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Lease = require('../src/models/Lease');
const ExpiredStudent = require('../src/models/ExpiredStudent');
const StudentStatusManager = require('../src/utils/studentStatusManager');

async function comprehensiveStudentStatusFix() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        console.log('🔧 Comprehensive student status fix...\n');

        // Step 1: Fix orphaned applications
        console.log('🔧 Step 1: Fixing orphaned applications...');
        
        const applications = await Application.find({});
        const users = await User.find({ role: 'student' });
        const expiredStudents = await ExpiredStudent.find({});
        
        let orphanedFixed = 0;
        for (const app of applications) {
            if (app.student) {
                const isInUsers = users.some(u => u._id.toString() === app.student.toString());
                const isInExpired = expiredStudents.some(e => 
                    e.student && e.student.toString() === app.student.toString()
                );
                
                if (!isInUsers && !isInExpired) {
                    console.log(`   🚨 Fixing orphaned application: ${app.firstName} ${app.lastName}`);
                    
                    // Mark as expired since student doesn't exist
                    app.status = 'expired';
                    app.rejectionReason = 'Student not found in system - application expired';
                    app.actionDate = new Date();
                    await app.save();
                    orphanedFixed++;
                }
            }
        }
        console.log(`   ✅ Fixed ${orphanedFixed} orphaned applications`);

        // Step 2: Fix expired students with active applications
        console.log('\n🔧 Step 2: Fixing expired students with active applications...');
        
        let expiredAppsFixed = 0;
        for (const expired of expiredStudents) {
            if (expired.student) {
                const activeApps = applications.filter(app => 
                    app.student && app.student.toString() === expired.student.toString() &&
                    (app.status === 'approved' || app.status === 'pending')
                );
                
                if (activeApps.length > 0) {
                    console.log(`   🚨 Fixing expired student with active apps: ${expired.student}`);
                    
                    for (const app of activeApps) {
                        app.status = 'expired';
                        app.rejectionReason = `Student expired: ${expired.reason}`;
                        app.actionDate = new Date();
                        await app.save();
                        expiredAppsFixed++;
                    }
                }
            }
        }
        console.log(`   ✅ Fixed ${expiredAppsFixed} applications for expired students`);

        // Step 3: Run comprehensive status update
        console.log('\n🔧 Step 3: Running comprehensive status update...');
        
        try {
            const updateResult = await StudentStatusManager.updateAllStudentStatuses();
            console.log(`   ✅ Status update completed`);
            console.log(`   📊 Result:`, updateResult);
        } catch (error) {
            console.log(`   ❌ Status update failed: ${error.message}`);
        }

        // Step 4: Handle expired students
        console.log('\n🔧 Step 4: Handling expired students...');
        
        try {
            const expiredResult = await StudentStatusManager.handleExpiredStudents();
            console.log(`   ✅ Expired students handled`);
            console.log(`   📊 Result:`, expiredResult);
        } catch (error) {
            console.log(`   ❌ Expired students handling failed: ${error.message}`);
        }

        // Step 5: Manual fixes for specific issues
        console.log('\n🔧 Step 5: Manual fixes for specific issues...');
        
        // Fix users with expired status but should be active
        const currentUsers = await User.find({ role: 'student' });
        let manualFixes = 0;
        
        for (const user of currentUsers) {
            if (user.status === 'expired') {
                // Check if user has valid room or recent activity
                const now = new Date();
                const roomValid = user.roomValidUntil && new Date(user.roomValidUntil) > now;
                const recentActivity = user.updatedAt && (now - new Date(user.updatedAt)) < (30 * 24 * 60 * 60 * 1000); // 30 days
                
                if (roomValid || recentActivity) {
                    console.log(`   🔄 User ${user.firstName} ${user.lastName} should be active`);
                    user.status = 'active';
                    await user.save();
                    manualFixes++;
                }
            }
        }
        console.log(`   ✅ Applied ${manualFixes} manual fixes`);

        // Final summary
        console.log('\n📊 Final Summary:');
        
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
        
        // Check for remaining issues
        console.log('\n🔍 Checking for remaining issues...');
        
        let remainingIssues = 0;
        
        // Check for orphaned applications
        for (const app of finalApplications) {
            if (app.student) {
                const isInUsers = finalUsers.some(u => u._id.toString() === app.student.toString());
                const isInExpired = finalExpiredStudents.some(e => 
                    e.student && e.student.toString() === app.student.toString()
                );
                
                if (!isInUsers && !isInExpired) {
                    remainingIssues++;
                }
            }
        }
        
        if (remainingIssues === 0) {
            console.log('   ✅ No remaining issues found!');
        } else {
            console.log(`   ⚠️ ${remainingIssues} remaining issues found`);
        }

        console.log('\n✅ Comprehensive student status fix completed!');

    } catch (error) {
        console.error('❌ Error in comprehensive student status fix:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the comprehensive fix
comprehensiveStudentStatusFix();




