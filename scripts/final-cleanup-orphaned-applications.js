/**
 * 🧹 Final Cleanup - Orphaned Applications
 * 
 * This script cleans up the remaining orphaned applications
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Application = require('../src/models/Application');
const ExpiredStudent = require('../src/models/ExpiredStudent');

async function finalCleanupOrphanedApplications() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        console.log('🧹 Final cleanup of orphaned applications...\n');

        // Get all data
        const users = await User.find({ role: 'student' });
        const applications = await Application.find({});
        const expiredStudents = await ExpiredStudent.find({});

        console.log('📊 Current State:');
        console.log(`   Users: ${users.length}`);
        console.log(`   Applications: ${applications.length}`);
        console.log(`   Expired Students: ${expiredStudents.length}`);

        // Find orphaned applications
        const orphanedApplications = [];
        
        for (const app of applications) {
            if (app.student) {
                const isInUsers = users.some(u => u._id.toString() === app.student.toString());
                const isInExpired = expiredStudents.some(e => 
                    e.student && e.student.toString() === app.student.toString()
                );
                
                if (!isInUsers && !isInExpired) {
                    orphanedApplications.push(app);
                }
            }
        }

        console.log(`\n🚨 Found ${orphanedApplications.length} orphaned applications:`);
        
        for (const app of orphanedApplications) {
            console.log(`   👤 ${app.firstName} ${app.lastName} (${app._id})`);
            console.log(`      Student ID: ${app.student}`);
            console.log(`      Email: ${app.email}`);
            console.log(`      Status: ${app.status}`);
            console.log(`      Application Code: ${app.applicationCode}`);
            
            // Check if application should be expired based on dates
            const now = new Date();
            const shouldBeExpired = app.endDate && new Date(app.endDate) < now;
            
            if (shouldBeExpired && app.status !== 'expired') {
                console.log(`      🔄 Updating to expired (end date: ${app.endDate})`);
                app.status = 'expired';
                app.rejectionReason = 'Student not found in system - application expired';
                app.actionDate = new Date();
                await app.save();
            } else if (!shouldBeExpired) {
                console.log(`      ⚠️ Application still valid - manual review needed`);
            } else {
                console.log(`      ✅ Already expired`);
            }
        }

        // Final summary
        console.log('\n📊 Final Summary:');
        
        const finalApplications = await Application.find({});
        const appStatusCounts = {};
        for (const app of finalApplications) {
            const status = app.status || 'unknown';
            appStatusCounts[status] = (appStatusCounts[status] || 0) + 1;
        }
        
        console.log('   📋 Final Application Statuses:');
        for (const [status, count] of Object.entries(appStatusCounts)) {
            console.log(`      ${status}: ${count}`);
        }

        // Check for remaining orphaned applications
        const remainingOrphaned = [];
        for (const app of finalApplications) {
            if (app.student) {
                const isInUsers = users.some(u => u._id.toString() === app.student.toString());
                const isInExpired = expiredStudents.some(e => 
                    e.student && e.student.toString() === app.student.toString()
                );
                
                if (!isInUsers && !isInExpired) {
                    remainingOrphaned.push(app);
                }
            }
        }

        if (remainingOrphaned.length === 0) {
            console.log('\n✅ All orphaned applications have been resolved!');
        } else {
            console.log(`\n⚠️ ${remainingOrphaned.length} orphaned applications still need manual review:`);
            for (const app of remainingOrphaned) {
                console.log(`   👤 ${app.firstName} ${app.lastName} (${app._id})`);
            }
        }

        console.log('\n✅ Final cleanup completed!');

    } catch (error) {
        console.error('❌ Error in final cleanup:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the final cleanup
finalCleanupOrphanedApplications();


