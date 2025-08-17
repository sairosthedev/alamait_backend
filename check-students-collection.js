require('dotenv').config();
const mongoose = require('mongoose');

async function checkStudentsCollection() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Checking Students Collection...');
        console.log('================================');

        // Get students collection
        const students = await mongoose.connection.db.collection('students').find({}).toArray();
        console.log(`📚 Found ${students.length} students`);

        if (students.length > 0) {
            console.log('\n📊 Students Structure:');
            console.log('======================');
            
            students.forEach((student, index) => {
                console.log(`\n${index + 1}. Student ID: ${student._id}`);
                console.log(`   Fields: ${Object.keys(student).join(', ')}`);
                console.log(`   User ID: ${student.user || 'N/A'}`);
                console.log(`   Email: ${student.email || 'N/A'}`);
                console.log(`   Name: ${student.firstName || ''} ${student.lastName || ''}`);
                console.log(`   Student Number: ${student.studentNumber || 'N/A'}`);
                console.log(`   Application ID: ${student.application || 'N/A'}`);
            });
        }

        // Get the 3 unmatched payments again
        console.log('\n🔍 Analyzing Unmatched Payments with Students Collection:');
        console.log('========================================================');
        
        const payments = await mongoose.connection.db.collection('payments').find({}).toArray();
        const unmatchedPayments = payments.filter(p => !p.user);
        
        console.log(`Found ${unmatchedPayments.length} unmatched payments:`);
        
        unmatchedPayments.forEach((payment, index) => {
            console.log(`\n${index + 1}. Payment ID: ${payment._id}`);
            console.log(`   Student ID: ${payment.student || 'N/A'}`);
            console.log(`   Room: ${payment.room || 'N/A'}`);
            console.log(`   Residence: ${payment.residence || 'N/A'}`);
            console.log(`   Amount: $${payment.amount || payment.rentAmount || 'N/A'}`);
            
            // Try to find this student ID in students collection
            const matchingStudent = students.find(s => 
                s._id && s._id.toString() === payment.student.toString()
            );
            
            if (matchingStudent) {
                console.log(`   ✅ Found matching student:`);
                console.log(`      Student ID: ${matchingStudent._id}`);
                console.log(`      User ID: ${matchingStudent.user || 'N/A'}`);
                console.log(`      Email: ${matchingStudent.email || 'N/A'}`);
                console.log(`      Name: ${matchingStudent.firstName || ''} ${matchingStudent.lastName || ''}`);
            } else {
                console.log(`   ❌ No matching student found for student ID: ${payment.student}`);
                
                // Try to find by application ID (since some payments might use application ID as student ID)
                const matchingApp = students.find(s => 
                    s.application && s.application.toString() === payment.student.toString()
                );
                
                if (matchingApp) {
                    console.log(`   🔍 Found student by application ID:`);
                    console.log(`      Student ID: ${matchingApp._id}`);
                    console.log(`      User ID: ${matchingApp.user || 'N/A'}`);
                    console.log(`      Application ID: ${matchingApp.application}`);
                }
            }
        });

        // Create a comprehensive mapping
        console.log('\n🔗 Creating Comprehensive ID Mapping:');
        console.log('=====================================');
        
        const idMapping = {};
        
        // Map 1: Student ID -> User ID (from students collection)
        students.forEach(student => {
            if (student._id && student.user) {
                idMapping[student._id.toString()] = student.user.toString();
            }
        });
        
        // Map 2: Application ID -> User ID (from applications collection)
        const applications = await mongoose.connection.db.collection('applications').find({}).toArray();
        applications.forEach(app => {
            if (app._id && app.student) {
                idMapping[app._id.toString()] = app.student.toString();
            }
        });
        
        console.log(`Created ${Object.keys(idMapping).length} ID mappings`);
        Object.entries(idMapping).forEach(([fromId, toId], index) => {
            console.log(`   ${index + 1}. ${fromId} -> ${toId}`);
        });

        // Now try to match all unmatched payments using this comprehensive mapping
        console.log('\n🔍 Final Payment Matching Attempt:');
        console.log('==================================');
        
        let finalMatchedCount = 0;
        
        for (const payment of unmatchedPayments) {
            let userIdToAdd = null;
            let matchMethod = '';
            
            // Try the comprehensive mapping
            if (payment.student && idMapping[payment.student.toString()]) {
                userIdToAdd = idMapping[payment.student.toString()];
                matchMethod = 'comprehensive ID mapping';
                console.log(`   ✅ Payment ${payment._id}: ${payment.student} -> ${userIdToAdd} (${matchMethod})`);
            }
            // Try room matching as fallback
            else if (payment.room && payment.residence) {
                const debtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
                const matchingDebtor = debtors.find(d => 
                    d.roomNumber === payment.room && 
                    d.residence && 
                    d.residence.toString() === payment.residence.toString()
                );
                if (matchingDebtor) {
                    userIdToAdd = matchingDebtor.user;
                    matchMethod = 'room matching fallback';
                    console.log(`   🏠 Payment ${payment._id}: Room ${payment.room} -> User ID ${userIdToAdd} (${matchMethod})`);
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
                
                finalMatchedCount++;
            } else {
                console.log(`   ❌ Payment ${payment._id}: Could not determine user ID`);
            }
        }
        
        console.log(`\n🎉 Final Summary:`);
        console.log(`=================`);
        console.log(`✅ Successfully matched ${finalMatchedCount} additional payments`);
        
        // Show final payment status
        const finalPayments = await mongoose.connection.db.collection('payments').find({}).toArray();
        const paymentsWithUser = finalPayments.filter(p => p.user);
        const paymentsWithoutUser = finalPayments.filter(p => !p.user);
        
        console.log(`📊 Total Payments: ${finalPayments.length}`);
        console.log(`✅ Payments with User ID: ${paymentsWithUser.length}`);
        console.log(`❌ Payments without User ID: ${paymentsWithoutUser.length}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Students Collection Check...');
checkStudentsCollection();
