require('dotenv').config();
const mongoose = require('mongoose');

async function analyzePaymentLinkingOptions() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Analyzing Payment Linking Options...');
        console.log('======================================');

        // Get all debtors
        const debtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
        console.log(`📊 Found ${debtors.length} debtors`);

        // Get all payments
        const payments = await mongoose.connection.db.collection('payments').find({}).toArray();
        console.log(`💰 Found ${payments.length} payments`);

        // Get users collection to understand the relationship
        let users = [];
        try {
            users = await mongoose.connection.db.collection('users').find({}).toArray();
            console.log(`👥 Found ${users.length} users`);
        } catch (error) {
            console.log(`ℹ️  Users collection not accessible: ${error.message}`);
        }

        console.log('\n🔍 Analysis Results:');
        console.log('===================');

        let emailMatchCount = 0;
        let studentIdMatchCount = 0;
        let userIdMatchCount = 0;
        let roomMatchCount = 0;
        let noMatchCount = 0;

        const analysisResults = [];

        for (const debtor of debtors) {
            const debtorName = debtor.contactInfo?.name || 'Unknown';
            const debtorEmail = debtor.contactInfo?.email || 'N/A';
            
            // Try different payment linking approaches
            const paymentsByEmail = payments.filter(payment => 
                payment.email && 
                debtorEmail !== 'N/A' &&
                payment.email.toLowerCase() === debtorEmail.toLowerCase()
            );
            
            const paymentsByStudent = payments.filter(payment => 
                payment.student && 
                payment.student.toString() === debtor.user.toString()
            );
            
            const paymentsByUser = payments.filter(payment => 
                payment.user && 
                payment.user.toString() === debtor.user.toString()
            );
            
            const paymentsByRoom = payments.filter(payment => 
                payment.room && 
                payment.room === debtor.roomNumber &&
                payment.residence && 
                payment.residence.toString() === (debtor.residence || '').toString()
            );

            // Count matches
            if (paymentsByEmail.length > 0) emailMatchCount++;
            if (paymentsByStudent.length > 0) studentIdMatchCount++;
            if (paymentsByUser.length > 0) userIdMatchCount++;
            if (paymentsByRoom.length > 0) roomMatchCount++;
            if (paymentsByEmail.length === 0 && paymentsByStudent.length === 0 && 
                paymentsByUser.length === 0 && paymentsByRoom.length === 0) {
                noMatchCount++;
            }

            analysisResults.push({
                debtor: debtorName,
                debtorCode: debtor.debtorCode,
                email: debtorEmail,
                user: debtor.user,
                room: debtor.roomNumber,
                emailMatches: paymentsByEmail.length,
                studentMatches: paymentsByStudent.length,
                userMatches: paymentsByUser.length,
                roomMatches: paymentsByRoom.length,
                totalMatches: paymentsByEmail.length + paymentsByStudent.length + 
                             paymentsByUser.length + paymentsByRoom.length
            });
        }

        console.log(`\n📊 Payment Matching Summary:`);
        console.log(`   Email Matches: ${emailMatchCount}/${debtors.length} debtors`);
        console.log(`   Student ID Matches: ${studentIdMatchCount}/${debtors.length} debtors`);
        console.log(`   User ID Matches: ${userIdMatchCount}/${debtors.length} debtors`);
        console.log(`   Room Matches: ${roomMatchCount}/${debtors.length} debtors`);
        console.log(`   No Matches: ${noMatchCount}/${debtors.length} debtors`);

        console.log(`\n🔍 Detailed Analysis by Debtor:`);
        console.log(`================================`);
        analysisResults.forEach((result, index) => {
            console.log(`\n${index + 1}. ${result.debtor} (${result.debtorCode})`);
            console.log(`   Email: ${result.email}`);
            console.log(`   User ID: ${result.user}`);
            console.log(`   Room: ${result.room}`);
            console.log(`   Matches: Email(${result.emailMatches}) | Student(${result.studentMatches}) | User(${result.userMatches}) | Room(${result.roomMatches})`);
        });

        // Check for ID relationships
        console.log(`\n🔍 ID Relationship Analysis:`);
        console.log(`===========================`);
        
        if (users.length > 0) {
            const userWithStudentId = users.filter(u => u.studentId);
            console.log(`Users with studentId field: ${userWithStudentId.length}/${users.length}`);
            
            if (userWithStudentId.length > 0) {
                console.log(`Sample user with studentId:`);
                const sampleUser = userWithStudentId[0];
                console.log(`   User ID: ${sampleUser._id}`);
                console.log(`   Student ID: ${sampleUser.studentId}`);
                console.log(`   Email: ${sampleUser.email}`);
            }
        }

        // Check payment structure
        console.log(`\n🔍 Payment Structure Analysis:`);
        console.log(`==============================`);
        if (payments.length > 0) {
            const samplePayment = payments[0];
            console.log(`Sample payment fields: ${Object.keys(samplePayment).join(', ')}`);
            console.log(`Payment has student field: ${samplePayment.student ? 'Yes' : 'No'}`);
            console.log(`Payment has user field: ${samplePayment.user ? 'Yes' : 'No'}`);
            console.log(`Payment has email field: ${samplePayment.email ? 'Yes' : 'No'}`);
        }

        // Recommendations
        console.log(`\n💡 RECOMMENDATIONS:`);
        console.log(`==================`);
        
        if (emailMatchCount > 0) {
            console.log(`✅ Email matching works for ${emailMatchCount} debtors`);
        }
        
        if (studentIdMatchCount > 0) {
            console.log(`✅ Student ID matching works for ${studentIdMatchCount} debtors`);
        }
        
        if (roomMatchCount > 0) {
            console.log(`✅ Room matching works for ${roomMatchCount} debtors`);
        }

        if (noMatchCount > 0) {
            console.log(`⚠️  ${noMatchCount} debtors have no payment matches`);
        }

        // Best approach recommendation
        console.log(`\n🎯 BEST APPROACH RECOMMENDATION:`);
        console.log(`================================`);
        
        if (emailMatchCount >= debtors.length * 0.8) {
            console.log(`🚀 RECOMMEND: Email-based matching (${emailMatchCount}/${debtors.length} success rate)`);
            console.log(`   - Most reliable for existing data`);
            console.log(`   - Easy to implement and maintain`);
            console.log(`   - Works with current payment structure`);
        } else if (studentIdMatchCount >= debtors.length * 0.8) {
            console.log(`🚀 RECOMMEND: Student ID-based matching (${studentIdMatchCount}/${debtors.length} success rate)`);
            console.log(`   - Direct ID relationship`);
            console.log(`   - Most efficient for queries`);
            console.log(`   - Requires understanding student ID vs user ID relationship`);
        } else if (roomMatchCount >= debtors.length * 0.8) {
            console.log(`🚀 RECOMMEND: Room-based matching (${roomMatchCount}/${debtors.length} success rate)`);
            console.log(`   - Logical room assignment relationship`);
            console.log(`   - Good for room-specific payments`);
            console.log(`   - May miss general payments not tied to rooms`);
        } else {
            console.log(`🔄 RECOMMEND: Hybrid approach combining multiple methods`);
            console.log(`   - Use email matching as primary (${emailMatchCount}/${debtors.length})`);
            console.log(`   - Fallback to student ID matching (${studentIdMatchCount}/${debtors.length})`);
            console.log(`   - Fallback to room matching (${roomMatchCount}/${debtors.length})`);
            console.log(`   - This ensures maximum coverage`);
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

console.log('🔍 Starting Payment Linking Analysis...');
analyzePaymentLinkingOptions();
