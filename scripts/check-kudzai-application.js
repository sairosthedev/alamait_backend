/**
 * 🔍 Check Kudzai's Application Data
 * 
 * This script checks the detailed application data for Kudzai Vella
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Application = require('../src/models/Application');
const Payment = require('../src/models/Payment');

async function checkKudzaiApplication() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        const applicationId = '68c308dacad4b54252cec896';
        console.log(`🔍 Checking application data for ID: ${applicationId}`);

        // Get the full application data
        const application = await Application.findById(applicationId);
        if (application) {
            console.log('\n📋 Application Details:');
            console.log(`   ID: ${application._id}`);
            console.log(`   Name: ${application.firstName} ${application.lastName}`);
            console.log(`   Email: ${application.email}`);
            console.log(`   Status: ${application.status}`);
            console.log(`   Application Code: ${application.applicationCode}`);
            console.log(`   Allocated Room: ${application.allocatedRoom}`);
            console.log(`   Residence: ${application.residence}`);
            console.log(`   Start Date: ${application.startDate}`);
            console.log(`   End Date: ${application.endDate}`);
            console.log(`   Created At: ${application.createdAt}`);
            console.log(`   Updated At: ${application.updatedAt}`);
            
            // Check if there are any room-related fields
            console.log('\n🏠 Room Information:');
            console.log(`   allocatedRoom: ${application.allocatedRoom}`);
            console.log(`   residence: ${application.residence}`);
            console.log(`   roomPreference: ${application.roomPreference || 'Not set'}`);
            
            // Check for payments by email
            console.log('\n💰 Payment Search:');
            const paymentsByEmail = await Payment.find({ student: application.email });
            console.log(`   Payments found by email: ${paymentsByEmail.length}`);
            
            const paymentsByStudentId = await Payment.find({ student: applicationId });
            console.log(`   Payments found by student ID: ${paymentsByStudentId.length}`);
            
            if (paymentsByEmail.length > 0) {
                console.log('   Payment details:');
                paymentsByEmail.forEach((payment, index) => {
                    console.log(`     ${index + 1}. Amount: $${payment.totalAmount}, Date: ${payment.date}`);
                });
            }
            
            // Check if room should be freed
            console.log('\n🔧 Room Freedom Analysis:');
            if (application.allocatedRoom && application.residence) {
                console.log(`✅ Student has room: ${application.allocatedRoom}`);
                console.log(`✅ Student has residence: ${application.residence}`);
                console.log(`✅ Room should be freed during forfeiture`);
            } else {
                console.log(`❌ Student missing room or residence data`);
                console.log(`   allocatedRoom: ${application.allocatedRoom || 'Not set'}`);
                console.log(`   residence: ${application.residence || 'Not set'}`);
                console.log(`   This explains why room was not freed`);
            }
            
        } else {
            console.log('❌ Application not found');
        }

    } catch (error) {
        console.error('❌ Error checking application:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the check
checkKudzaiApplication();




