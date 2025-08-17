require('dotenv').config();
const mongoose = require('mongoose');

async function investigateStudentUserRelationship() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Investigating Student ID vs User ID Relationship...');
        console.log('==================================================');

        // Get all debtors
        const debtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
        console.log(`📊 Found ${debtors.length} debtors`);

        // Get all payments
        const payments = await mongoose.connection.db.collection('payments').find({}).toArray();
        console.log(`💰 Found ${payments.length} payments`);

        // Get users collection
        let users = [];
        try {
            users = await mongoose.connection.db.collection('users').find({}).toArray();
            console.log(`👥 Found ${users.length} users`);
        } catch (error) {
            console.log(`ℹ️  Users collection not accessible: ${error.message}`);
        }

        // Get applications collection to understand the relationship
        let applications = [];
        try {
            applications = await mongoose.connection.db.collection('applications').find({}).toArray();
            console.log(`📝 Found ${applications.length} applications`);
        } catch (error) {
            console.log(`ℹ️  Applications collection not accessible: ${error.message}`);
        }

        console.log('\n🔍 Analysis Results:');
        console.log('===================');

        // Analyze the relationship between student IDs and user IDs
        console.log('\n📊 Student ID vs User ID Analysis:');
        console.log('==================================');

        const studentIdMapping = {};
        const userIdMapping = {};

        // Check applications for student -> user relationship
        if (applications.length > 0) {
            console.log('\n📝 Applications Analysis:');
            applications.forEach((app, index) => {
                if (app.student && app.user) {
                    studentIdMapping[app.student.toString()] = app.user.toString();
                    userIdMapping[app.user.toString()] = app.student.toString();
                    console.log(`   ${index + 1}. Student ID: ${app.student} -> User ID: ${app.user}`);
                }
            });
        }

        // Check users for studentId field
        if (users.length > 0) {
            console.log('\n👥 Users with Student ID Analysis:');
            const usersWithStudentId = users.filter(u => u.studentId);
            console.log(`Users with studentId field: ${usersWithStudentId.length}/${users.length}`);
            
            usersWithStudentId.forEach((user, index) => {
                studentIdMapping[user.studentId.toString()] = user._id.toString();
                userIdMapping[user._id.toString()] = user.studentId.toString();
                console.log(`   ${index + 1}. Student ID: ${user.studentId} -> User ID: ${user._id}`);
            });
        }

        console.log(`\n📊 Created ${Object.keys(studentIdMapping).length} student ID mappings`);

        // Now try to match payments using these mappings
        console.log('\n🔍 Payment Matching with New Mappings:');
        console.log('======================================');

        let matchedCount = 0;
        let unmatchedCount = 0;

        for (const payment of payments) {
            console.log(`\n💳 Payment: ${payment._id}`);
            console.log(`   Student ID: ${payment.student || 'N/A'}`);
            console.log(`   Room: ${payment.room || 'N/A'}`);
            console.log(`   Residence: ${payment.residence || 'N/A'}`);

            let userIdToAdd = null;
            let matchMethod = '';

            // Try to match using student ID mapping
            if (payment.student && studentIdMapping[payment.student.toString()]) {
                userIdToAdd = studentIdMapping[payment.student.toString()];
                matchMethod = 'student ID mapping';
                console.log(`   ✅ Matched via student ID mapping: ${payment.student} -> ${userIdToAdd}`);
            }
            // Try to match using room and residence (fallback)
            else if (payment.room && payment.residence) {
                const matchingDebtor = debtors.find(d => 
                    d.roomNumber === payment.room && 
                    d.residence && 
                    d.residence.toString() === payment.residence.toString()
                );
                if (matchingDebtor) {
                    userIdToAdd = matchingDebtor.user;
                    matchMethod = 'room matching';
                    console.log(`   🏠 Matched via room: ${payment.room} -> User ID: ${userIdToAdd}`);
                }
            }

            if (userIdToAdd) {
                // Update payment with user ID
                await mongoose.connection.db.collection('payments').updateOne(
                    { _id: payment._id },
                    { 
                        $set: { 
                            user: userIdToAdd,
                            updatedAt: new Date()
                        }
                    }
                );
                
                matchedCount++;
                console.log(`   ✅ Updated payment with user ID: ${userIdToAdd} (${matchMethod})`);
            } else {
                unmatchedCount++;
                console.log(`   ❌ Could not determine user ID`);
            }
        }

        console.log('\n🎉 Summary:');
        console.log('===========');
        console.log(`✅ Successfully matched and updated ${matchedCount} payments`);
        console.log(`❌ ${unmatchedCount} payments still unmatched`);

        // Show final state
        console.log('\n🔍 Final Payment Status:');
        console.log('========================');
        const finalPayments = await mongoose.connection.db.collection('payments').find({}).toArray();
        const paymentsWithUser = finalPayments.filter(p => p.user);
        const paymentsWithoutUser = finalPayments.filter(p => !p.user);
        
        console.log(`📊 Total Payments: ${finalPayments.length}`);
        console.log(`✅ Payments with User ID: ${paymentsWithUser.length}`);
        console.log(`❌ Payments without User ID: ${paymentsWithoutUser.length}`);

        // Show the mapping relationships found
        console.log('\n🔗 Student ID to User ID Mappings Found:');
        console.log('==========================================');
        Object.entries(studentIdMapping).forEach(([studentId, userId], index) => {
            console.log(`   ${index + 1}. Student ID: ${studentId} -> User ID: ${userId}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Student ID vs User ID Investigation...');
investigateStudentUserRelationship();
