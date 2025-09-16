/**
 * 🎯 Debug Student Forfeit
 * 
 * This script helps debug why a student forfeit is failing
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Payment = require('../src/models/Payment');
const ExpiredStudent = require('../src/models/ExpiredStudent');
const Lease = require('../src/models/Lease');

async function debugStudentForfeit(studentId) {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        console.log(`🔍 Debugging student forfeit for ID: ${studentId}`);

        // Check if student exists in User collection
        const student = await User.findById(studentId);
        if (student) {
            console.log('✅ Student found in User collection:');
            console.log(`   Name: ${student.firstName} ${student.lastName}`);
            console.log(`   Email: ${student.email}`);
            console.log(`   Status: ${student.status}`);
            console.log(`   Role: ${student.role}`);
            console.log(`   Current Room: ${student.currentRoom}`);
            console.log(`   Room Valid Until: ${student.roomValidUntil}`);
            console.log(`   Residence: ${student.residence}`);
        } else {
            console.log('❌ Student NOT found in User collection');
            
            // Check if student is in ExpiredStudent collection
            const expiredStudent = await ExpiredStudent.findOne({
                $or: [
                    { 'student._id': studentId },
                    { 'student': studentId },
                    { 'student': new mongoose.Types.ObjectId(studentId) }
                ]
            });

            if (expiredStudent) {
                console.log('✅ Student found in ExpiredStudent collection:');
                console.log(`   Name: ${expiredStudent.student.firstName} ${expiredStudent.student.lastName}`);
                console.log(`   Email: ${expiredStudent.student.email}`);
                console.log(`   Archived At: ${expiredStudent.archivedAt}`);
                console.log(`   Reason: ${expiredStudent.reason}`);
                console.log('   ⚠️ Student is already archived - cannot forfeit again');
            } else {
                console.log('❌ Student NOT found in ExpiredStudent collection either');
                console.log('   Student ID might be invalid or student was never created');
            }
        }

        // Check applications
        const applications = await Application.find({ 
            $or: [
                { student: studentId },
                { _id: studentId } // Sometimes application ID is used instead of student ID
            ]
        });

        if (applications.length > 0) {
            console.log(`📋 Found ${applications.length} application(s):`);
            applications.forEach((app, index) => {
                console.log(`   ${index + 1}. Application ID: ${app._id}`);
                console.log(`      Student Name: ${app.firstName} ${app.lastName}`);
                console.log(`      Email: ${app.email}`);
                console.log(`      Status: ${app.status}`);
                console.log(`      Application Code: ${app.applicationCode}`);
            });
        } else {
            console.log('❌ No applications found for this student ID');
        }

        // Check payments
        const payments = await Payment.find({ student: studentId });
        if (payments.length > 0) {
            console.log(`💰 Found ${payments.length} payment(s):`);
            payments.forEach((payment, index) => {
                console.log(`   ${index + 1}. Payment ID: ${payment._id}`);
                console.log(`      Amount: $${payment.totalAmount}`);
                console.log(`      Date: ${payment.date}`);
                console.log(`      Status: ${payment.status}`);
            });
        } else {
            console.log('❌ No payments found for this student ID');
        }

        // Check leases
        const leases = await Lease.find({ studentId: studentId });
        if (leases.length > 0) {
            console.log(`📄 Found ${leases.length} lease(s):`);
            leases.forEach((lease, index) => {
                console.log(`   ${index + 1}. Lease ID: ${lease._id}`);
                console.log(`      Start Date: ${lease.startDate}`);
                console.log(`      End Date: ${lease.endDate}`);
                console.log(`      Status: ${lease.status}`);
            });
        } else {
            console.log('❌ No leases found for this student ID');
        }

        // Provide recommendations
        console.log('\n🎯 Recommendations:');
        
        if (student) {
            console.log('✅ Student exists - forfeit should work');
            console.log('   Try the forfeit API again');
        } else if (typeof expiredStudent !== 'undefined' && expiredStudent) {
            console.log('⚠️ Student is already archived');
            console.log('   Cannot forfeit again - student is already in ExpiredStudent collection');
        } else if (applications.length > 0) {
            console.log('⚠️ Student not found but applications exist');
            console.log('   Try using the application ID instead of student ID');
            console.log(`   Application ID: ${applications[0]._id}`);
        } else {
            console.log('❌ Student ID appears to be invalid');
            console.log('   Check if the ID is correct');
            console.log('   Student might have been deleted or never existed');
        }

    } catch (error) {
        console.error('❌ Error debugging student forfeit:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Get student ID from command line argument
const studentId = process.argv[2];

if (!studentId) {
    console.log('❌ Please provide a student ID');
    console.log('Usage: node scripts/debug-student-forfeit.js <studentId>');
    process.exit(1);
}

// Run the debug
debugStudentForfeit(studentId);
