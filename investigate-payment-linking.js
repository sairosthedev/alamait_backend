require('dotenv').config();
const mongoose = require('mongoose');

async function investigatePaymentLinking() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Investigating Payment Linking...');
        console.log('==================================');

        // Get all debtors
        const debtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
        console.log(`📊 Found ${debtors.length} debtors`);

        // Get all payments
        const payments = await mongoose.connection.db.collection('payments').find({}).toArray();
        console.log(`💰 Found ${payments.length} payments`);

        console.log('\n🔍 Payment Structure Analysis:');
        console.log('==============================');
        
        if (payments.length > 0) {
            const samplePayment = payments[0];
            console.log('📄 Sample Payment Structure:');
            console.log(`   Fields: ${Object.keys(samplePayment).join(', ')}`);
            console.log(`   Student ID: ${samplePayment.student || 'N/A'}`);
            console.log(`   User ID: ${samplePayment.user || 'N/A'}`);
            console.log(`   Amount: ${samplePayment.amount || 'N/A'}`);
            console.log(`   Rent Amount: ${samplePayment.rentAmount || 'N/A'}`);
            console.log(`   Status: ${samplePayment.status || 'N/A'}`);
        }

        console.log('\n🔍 Debtor Structure Analysis:');
        console.log('==============================');
        
        if (debtors.length > 0) {
            const sampleDebtor = debtors[0];
            console.log('👤 Sample Debtor Structure:');
            console.log(`   Fields: ${Object.keys(sampleDebtor).join(', ')}`);
            console.log(`   User ID: ${sampleDebtor.user || 'N/A'}`);
            console.log(`   Student ID: ${sampleDebtor.student || 'N/A'}`);
        }

        console.log('\n🔍 Payment to Debtor Mapping:');
        console.log('==============================');

        for (const debtor of debtors) {
            console.log(`\n👤 ${debtor.contactInfo?.name || 'Unknown'} (${debtor.debtorCode})`);
            console.log(`   Debtor User ID: ${debtor.user}`);
            
            // Try different payment linking approaches
            const paymentsByStudent = payments.filter(p => 
                p.student && p.student.toString() === debtor.user.toString()
            );
            
            const paymentsByUser = payments.filter(p => 
                p.user && p.user.toString() === debtor.user.toString()
            );

            const paymentsByEmail = payments.filter(p => 
                p.email && p.email.toLowerCase() === (debtor.contactInfo?.email || '').toLowerCase()
            );

            console.log(`   📄 Payments by Student ID: ${paymentsByStudent.length}`);
            console.log(`   📄 Payments by User ID: ${paymentsByUser.length}`);
            console.log(`   📄 Payments by Email: ${paymentsByEmail.length}`);

            if (paymentsByStudent.length > 0) {
                console.log(`   ✅ Found payments by Student ID`);
                paymentsByStudent.forEach(payment => {
                    console.log(`      - Payment ID: ${payment._id}`);
                    console.log(`      - Amount: $${payment.amount || payment.rentAmount || 'N/A'}`);
                    console.log(`      - Status: ${payment.status || 'N/A'}`);
                    console.log(`      - Date: ${payment.paymentDate || payment.createdAt || 'N/A'}`);
                });
            }

            if (paymentsByUser.length > 0) {
                console.log(`   ✅ Found payments by User ID`);
                paymentsByUser.forEach(payment => {
                    console.log(`      - Payment ID: ${payment._id}`);
                    console.log(`      - Amount: $${payment.amount || payment.rentAmount || 'N/A'}`);
                    console.log(`      - Status: ${payment.status || 'N/A'}`);
                    console.log(`      - Date: ${payment.paymentDate || payment.createdAt || 'N/A'}`);
                });
            }

            if (paymentsByEmail.length > 0) {
                console.log(`   ✅ Found payments by Email`);
                paymentsByEmail.forEach(payment => {
                    console.log(`      - Payment ID: ${payment._id}`);
                    console.log(`      - Amount: $${payment.amount || payment.rentAmount || 'N/A'}`);
                    console.log(`      - Status: ${payment.status || 'N/A'}`);
                    console.log(`      - Date: ${payment.paymentDate || payment.createdAt || 'N/A'}`);
                });
            }

            if (paymentsByStudent.length === 0 && paymentsByUser.length === 0 && paymentsByEmail.length === 0) {
                console.log(`   ❌ No payments found with any linking method`);
            }
        }

        // Check if there are any users collection that might have different IDs
        try {
            const users = await mongoose.connection.db.collection('users').find({}).limit(5).toArray();
            console.log(`\n👥 Sample Users (first 5):`);
            users.forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.firstName || ''} ${user.lastName || ''} (${user.email || 'N/A'})`);
                console.log(`      User ID: ${user._id}`);
                console.log(`      Student ID: ${user.studentId || 'N/A'}`);
            });
        } catch (error) {
            console.log(`\nℹ️  Users collection not accessible: ${error.message}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Payment Linking Investigation...');
investigatePaymentLinking();
