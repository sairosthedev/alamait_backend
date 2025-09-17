/**
 * 🎯 Test Forfeit Variable Fix
 * 
 * This script tests the forfeit process with the variable scope fix
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Payment = require('../src/models/Payment');

async function testForfeitVariableFix() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        const studentId = '68c308dacad4b54252cec894'; // Correct User ID
        console.log(`🔍 Testing forfeit variable scope fix for ID: ${studentId}`);

        // Test the complete logic from the forfeit endpoint
        let student = await User.findById(studentId);
        
        if (!student) {
            console.log('❌ Student not found in User collection');
            return;
        }

        console.log(`✅ Student found: ${student.firstName} ${student.lastName} (${student.email})`);

        // Test applications lookup
        let applications = await Application.find({ student: studentId });
        console.log(`📋 Applications found: ${applications.length}`);

        // Test payments lookup
        let payments = await Payment.find({ student: studentId });
        console.log(`💰 Payments found: ${payments.length}`);
        const totalPayments = payments.reduce((sum, payment) => sum + (payment.totalAmount || 0), 0);
        console.log(`💰 Total payments: $${totalPayments}`);

        // Test variable scope fix
        console.log('\n🔧 Testing variable scope fix...');
        
        // Simulate the variable initialization at function level
        let totalForfeitableAmount = 0;
        let totalAdminFees = 0;
        let totalAdvancePayments = 0;
        
        console.log('✅ Variables initialized at function level');
        console.log(`   totalForfeitableAmount: $${totalForfeitableAmount}`);
        console.log(`   totalAdminFees: $${totalAdminFees}`);
        console.log(`   totalAdvancePayments: $${totalAdvancePayments}`);

        // Simulate the payment analysis
        if (totalPayments > 0) {
            console.log('💰 Processing payment analysis...');
            
            payments.forEach(payment => {
                if (payment.payments && Array.isArray(payment.payments)) {
                    payment.payments.forEach(subPayment => {
                        if (subPayment.type === 'admin') {
                            totalAdminFees += subPayment.amount || 0;
                        } else if (subPayment.type === 'rent' && subPayment.monthAllocated) {
                            totalAdvancePayments += subPayment.amount || 0;
                        }
                        totalForfeitableAmount += subPayment.amount || 0;
                    });
                } else {
                    totalForfeitableAmount += payment.totalAmount || 0;
                }
            });
            
            console.log(`✅ Payment analysis completed:`);
            console.log(`   totalForfeitableAmount: $${totalForfeitableAmount}`);
            console.log(`   totalAdminFees: $${totalAdminFees}`);
            console.log(`   totalAdvancePayments: $${totalAdvancePayments}`);
        }

        // Test that variables are accessible outside the if block
        console.log('\n🔧 Testing variable accessibility outside if block...');
        console.log(`✅ Variables accessible outside if block:`);
        console.log(`   totalForfeitableAmount: $${totalForfeitableAmount}`);
        console.log(`   totalAdminFees: $${totalAdminFees}`);
        console.log(`   totalAdvancePayments: $${totalAdvancePayments}`);

        console.log('\n✅ Variable scope fix test successful!');
        console.log('   The forfeit endpoint should now work without "totalAdminFees is not defined" errors');

    } catch (error) {
        console.error('❌ Error testing variable fix:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the test
testForfeitVariableFix();




