/**
 * 🔍 Check All Payments
 * 
 * This script checks all payments in the database to understand the data structure
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Payment = require('../src/models/Payment');
const User = require('../src/models/User');

async function checkAllPayments() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        console.log('🔍 Checking all payments in the database...');
        
        // Get all payments
        const allPayments = await Payment.find({}).limit(10);
        console.log(`📊 Total payments found: ${allPayments.length}`);
        
        if (allPayments.length > 0) {
            console.log('\n📋 Sample payments:');
            allPayments.forEach((payment, index) => {
                console.log(`   ${index + 1}. ID: ${payment._id}`);
                console.log(`      Amount: $${payment.totalAmount}`);
                console.log(`      Date: ${payment.date}`);
                console.log(`      Student field: ${payment.student}`);
                console.log(`      Email field: ${payment.email}`);
                console.log(`      Status: ${payment.status}`);
                console.log(`      Created: ${payment.createdAt}`);
                console.log('');
            });
        }
        
        // Check for Kudzai specifically
        console.log('🔍 Searching for Kudzai Vella payments...');
        const kudzaiPayments = await Payment.find({
            $or: [
                { email: /kudzai/i },
                { email: /vella/i },
                { student: /kudzai/i },
                { student: /vella/i }
            ]
        });
        console.log(`📊 Kudzai payments found: ${kudzaiPayments.length}`);
        
        if (kudzaiPayments.length > 0) {
            console.log('📋 Kudzai payments:');
            kudzaiPayments.forEach((payment, index) => {
                console.log(`   ${index + 1}. ID: ${payment._id}`);
                console.log(`      Amount: $${payment.totalAmount}`);
                console.log(`      Date: ${payment.date}`);
                console.log(`      Student field: ${payment.student}`);
                console.log(`      Email field: ${payment.email}`);
                console.log(`      Status: ${payment.status}`);
            });
        }
        
        // Check User collection for Kudzai
        console.log('\n🔍 Checking User collection for Kudzai...');
        const kudzaiUser = await User.findOne({
            $or: [
                { firstName: /kudzai/i },
                { lastName: /vella/i },
                { email: /kudzai/i }
            ]
        });
        
        if (kudzaiUser) {
            console.log('✅ Kudzai User found:');
            console.log(`   ID: ${kudzaiUser._id}`);
            console.log(`   Name: ${kudzaiUser.firstName} ${kudzaiUser.lastName}`);
            console.log(`   Email: ${kudzaiUser.email}`);
            console.log(`   Status: ${kudzaiUser.status}`);
            
            // Check for payments with this User ID
            const userPayments = await Payment.find({ student: kudzaiUser._id });
            console.log(`   Payments with User ID: ${userPayments.length}`);
        } else {
            console.log('❌ No Kudzai User found');
        }

    } catch (error) {
        console.error('❌ Error checking payments:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the check
checkAllPayments();




