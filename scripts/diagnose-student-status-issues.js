/**
 * 🔍 Diagnose Student Status Issues
 * 
 * This script identifies inconsistencies in student statuses
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Lease = require('../src/models/Lease');
const ExpiredStudent = require('../src/models/ExpiredStudent');

async function diagnoseStudentStatusIssues() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        console.log('🔍 Diagnosing student status issues...\n');

        // Get all students
        const students = await User.find({ role: 'student' });
        console.log(`📊 Total students in User collection: ${students.length}`);

        // Get all expired students
        const expiredStudents = await ExpiredStudent.find({});
        console.log(`📊 Total students in ExpiredStudent collection: ${expiredStudents.length}`);

        // Analyze current statuses
        const statusCounts = {};
        const issues = [];

        for (const student of students) {
            const status = student.status || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;

            // Check for inconsistencies
            const applications = await Application.find({ 
                $or: [
                    { student: student._id },
                    { email: student.email }
                ]
            });

            const leases = await Lease.find({ studentId: student._id });

            // Check if student should be expired based on lease dates
            const now = new Date();
            const hasExpiredLease = leases.some(lease => 
                lease.endDate && new Date(lease.endDate) < now
            );

            const hasActiveLease = leases.some(lease => 
                lease.startDate && lease.endDate && 
                new Date(lease.startDate) <= now && 
                new Date(lease.endDate) > now
            );

            // Check room validity
            const roomValid = student.roomValidUntil && new Date(student.roomValidUntil) > now;

            // Identify issues
            if (student.status === 'expired' && hasActiveLease) {
                issues.push({
                    type: 'EXPIRED_BUT_ACTIVE_LEASE',
                    student: `${student.firstName} ${student.lastName}`,
                    studentId: student._id,
                    currentStatus: student.status,
                    issue: 'Marked as expired but has active lease',
                    activeLease: hasActiveLease,
                    expiredLease: hasExpiredLease,
                    roomValid: roomValid,
                    applications: applications.length,
                    leases: leases.length
                });
            }

            if (student.status === 'active' && hasExpiredLease && !hasActiveLease) {
                issues.push({
                    type: 'ACTIVE_BUT_EXPIRED_LEASE',
                    student: `${student.firstName} ${student.lastName}`,
                    studentId: student._id,
                    currentStatus: student.status,
                    issue: 'Marked as active but all leases expired',
                    activeLease: hasActiveLease,
                    expiredLease: hasExpiredLease,
                    roomValid: roomValid,
                    applications: applications.length,
                    leases: leases.length
                });
            }

            if (student.status === 'active' && !roomValid && !hasActiveLease) {
                issues.push({
                    type: 'ACTIVE_BUT_INVALID_ROOM',
                    student: `${student.firstName} ${student.lastName}`,
                    studentId: student._id,
                    currentStatus: student.status,
                    issue: 'Marked as active but room validity expired',
                    activeLease: hasActiveLease,
                    expiredLease: hasExpiredLease,
                    roomValid: roomValid,
                    applications: applications.length,
                    leases: leases.length
                });
            }
        }

        // Display status counts
        console.log('\n📊 Current Status Distribution:');
        for (const [status, count] of Object.entries(statusCounts)) {
            console.log(`   ${status}: ${count}`);
        }

        // Display issues
        console.log(`\n🚨 Found ${issues.length} status inconsistencies:`);
        
        const issueTypes = {};
        for (const issue of issues) {
            issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
        }

        console.log('\n📋 Issue Types:');
        for (const [type, count] of Object.entries(issueTypes)) {
            console.log(`   ${type}: ${count}`);
        }

        if (issues.length > 0) {
            console.log('\n🔍 Detailed Issues:');
            for (const issue of issues) {
                console.log(`\n   👤 ${issue.student} (${issue.studentId})`);
                console.log(`      Status: ${issue.currentStatus}`);
                console.log(`      Issue: ${issue.issue}`);
                console.log(`      Active Lease: ${issue.activeLease}`);
                console.log(`      Expired Lease: ${issue.expiredLease}`);
                console.log(`      Room Valid: ${issue.roomValid}`);
                console.log(`      Applications: ${issue.applications}`);
                console.log(`      Leases: ${issue.leases}`);
            }
        }

        // Recommendations
        console.log('\n💡 Recommendations:');
        if (issues.length > 0) {
            console.log('   1. Run bulk status update to fix all inconsistencies');
            console.log('   2. Check if the student status job is running properly');
            console.log('   3. Verify lease and application data integrity');
            console.log('   4. Consider running individual status fixes for critical cases');
        } else {
            console.log('   ✅ No status inconsistencies found!');
        }

    } catch (error) {
        console.error('❌ Error diagnosing student status issues:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the diagnosis
diagnoseStudentStatusIssues();




