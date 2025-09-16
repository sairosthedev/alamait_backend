/**
 * 🔍 Debug Payment Lookup
 * 
 * This script debugs why no payments were found during forfeiture
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Payment = require('../src/models/Payment');

async function debugPaymentLookup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        const studentId = '68c308dacad4b54252cec896'; // Application ID that was used
        console.log(`🔍 Debugging payment lookup for ID: ${studentId}`);

        // Test the current lookup logic
        console.log('\n🔧 Testing current payment lookup logic...');
        
        // 1. Try to find by student ID (this is what the code does)
        let payments = await Payment.find({ student: studentId });
        console.log(`   Payments found by student ID: ${payments.length}`);
        
        // 2. Try to find by email
        const application = await Application.findById(studentId);
        if (application) {
            console.log(`   Application email: ${application.email}`);
            payments = await Payment.find({ email: application.email });
            console.log(`   Payments found by email: ${payments.length}`);
            
            if (payments.length > 0) {
                console.log('   Payment details:');
                payments.forEach((payment, index) => {
                    console.log(`     ${index + 1}. ID: ${payment._id}, Amount: $${payment.totalAmount}, Date: ${payment.date}`);
                    console.log(`        Student field: ${payment.student}`);
                    console.log(`        Email field: ${payment.email}`);
                });
            }
        }
        
        // 3. Try to find by User ID (if we can find the User)
        const user = await User.findById(studentId);
        if (user) {
            console.log(`   User found: ${user.email}`);
            payments = await Payment.find({ student: user._id });
            console.log(`   Payments found by User ID: ${payments.length}`);
        } else {
            console.log(`   No User found with ID: ${studentId}`);
        }
        
        // 4. Try to find all payments for this email to see what's in the database
        if (application) {
            console.log(`\n🔍 Searching all payments for email: ${application.email}`);
            const allPayments = await Payment.find({ email: application.email });
            console.log(`   Total payments found: ${allPayments.length}`);
            
            if (allPayments.length > 0) {
                console.log('   All payment details:');
                allPayments.forEach((payment, index) => {
                    console.log(`     ${index + 1}. ID: ${payment._id}`);
                    console.log(`        Amount: $${payment.totalAmount}`);
                    console.log(`        Date: ${payment.date}`);
                    console.log(`        Student field: ${payment.student}`);
                    console.log(`        Email field: ${payment.email}`);
                    console.log(`        Status: ${payment.status}`);
                });
            }
        }
        
        console.log('\n🔧 The issue is likely:');
        console.log('   The payment lookup is using the Application ID, but payments are stored with User ID');
        console.log('   The fix should be to use the User ID for payment lookup, not the Application ID');

    } catch (error) {
        console.error('❌ Error debugging payment lookup:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the debug
debugPaymentLookup();


