require('dotenv').config();
const mongoose = require('mongoose');

async function checkPaymentsCollections() {
    try {
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            return;
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        console.log('\n💰 Checking Payments Collection and Collections Calculation...');
        console.log('==========================================================');
        
        // Get all payments
        const payments = await mongoose.connection.db
            .collection('payments')
            .find({}).toArray();
        
        console.log(`\n📊 Total Payments Found: ${payments.length}`);
        
        if (payments.length > 0) {
            console.log('\n💳 Sample Payments:');
            payments.slice(0, 5).forEach((payment, index) => {
                console.log(`\n   ${index + 1}. Payment ID: ${payment._id}`);
                console.log(`      Student ID: ${payment.student}`);
                console.log(`      Amount: $${payment.amount}`);
                console.log(`      Date: ${payment.date || payment.createdAt || 'No date'}`);
                console.log(`      Type: ${payment.type || 'Not specified'}`);
                console.log(`      Status: ${payment.status || 'Not specified'}`);
            });
            
            if (payments.length > 5) {
                console.log(`\n   ... and ${payments.length - 5} more payments`);
            }
        }
        
        // Get active students
        const activeStudents = await mongoose.connection.db
            .collection('applications')
            .find({
                status: 'approved',
                paymentStatus: { $ne: 'cancelled' }
            }).toArray();
        
        console.log(`\n👥 Active Students: ${activeStudents.length}`);
        
        // Check payments for each student
        console.log('\n🔍 Checking Collections per Student:');
        activeStudents.forEach((student, index) => {
            const studentPayments = payments.filter(payment => 
                payment.student && payment.student.toString() === student._id.toString()
            );
            
            const totalCollected = studentPayments.reduce((sum, payment) => {
                return sum + (payment.amount || 0);
            }, 0);
            
            console.log(`\n   ${index + 1}. ${student.firstName} ${student.lastName}`);
            console.log(`      Student ID: ${student._id}`);
            console.log(`      Payments Found: ${studentPayments.length}`);
            console.log(`      Total Collected: $${totalCollected}`);
            
            if (studentPayments.length > 0) {
                studentPayments.forEach(payment => {
                    console.log(`         - $${payment.amount} on ${payment.date || payment.createdAt || 'No date'}`);
                });
            }
        });
        
        // Check if there are any payments without student references
        const orphanedPayments = payments.filter(payment => !payment.student);
        if (orphanedPayments.length > 0) {
            console.log(`\n⚠️  Orphaned Payments (no student reference): ${orphanedPayments.length}`);
            orphanedPayments.slice(0, 3).forEach(payment => {
                console.log(`   - Payment ID: ${payment._id}, Amount: $${payment.amount}`);
            });
        }
        
        // Summary
        const totalAmountInPayments = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
        const totalStudentsWithPayments = new Set(payments.filter(p => p.student).map(p => p.student.toString())).size;
        
        console.log('\n📊 PAYMENTS COLLECTION SUMMARY:');
        console.log('================================');
        console.log(`💰 Total Payments: ${payments.length}`);
        console.log(`💵 Total Amount: $${totalAmountInPayments}`);
        console.log(`👥 Students with Payments: ${totalStudentsWithPayments}`);
        console.log(`📈 Average Payment: $${payments.length > 0 ? (totalAmountInPayments / payments.length).toFixed(2) : 0}`);
        
        console.log('\n✅ Payments collection analysis completed!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('💰 Starting Payments Collection Check...');
checkPaymentsCollections();
