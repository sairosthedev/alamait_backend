require('dotenv').config();
const mongoose = require('mongoose');

async function addUserIdToPayments() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔧 Adding User ID to Existing Payments...');
        console.log('========================================');

        // Get all debtors to create a mapping
        const debtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
        console.log(`📊 Found ${debtors.length} debtors`);

        // Create mapping: email -> user ID and student ID -> user ID
        const emailToUserId = {};
        const studentIdToUserId = {};
        
        debtors.forEach(debtor => {
            if (debtor.contactInfo?.email) {
                emailToUserId[debtor.contactInfo.email.toLowerCase()] = debtor.user;
            }
            // Note: We'll need to check if there's a student ID relationship
        });

        console.log(`📧 Created email to user ID mapping for ${Object.keys(emailToUserId).length} debtors`);

        // Get all payments
        const payments = await mongoose.connection.db.collection('payments').find({}).toArray();
        console.log(`💰 Found ${payments.length} payments`);

        let updatedCount = 0;
        let errors = [];
        let noMatchCount = 0;

        for (const payment of payments) {
            try {
                console.log(`\n💳 Processing Payment: ${payment._id}`);
                console.log(`   Current fields: ${Object.keys(payment).join(', ')}`);
                console.log(`   Has user field: ${payment.user ? 'Yes' : 'No'}`);
                console.log(`   Has student field: ${payment.student ? 'Yes' : 'No'}`);
                console.log(`   Has email field: ${payment.email ? 'Yes' : 'No'}`);

                let userIdToAdd = null;
                let matchMethod = '';

                // Method 1: Payment already has user field
                if (payment.user) {
                    userIdToAdd = payment.user;
                    matchMethod = 'already had user field';
                    console.log(`   ✅ Payment already has user ID: ${userIdToAdd}`);
                }
                // Method 2: Try to match by email
                else if (payment.email && emailToUserId[payment.email.toLowerCase()]) {
                    userIdToAdd = emailToUserId[payment.email.toLowerCase()];
                    matchMethod = 'email matching';
                    console.log(`   📧 Matched by email: ${payment.email} -> User ID: ${userIdToAdd}`);
                }
                // Method 3: Try to match by student ID (if it exists in users collection)
                else if (payment.student) {
                    // Check if this student ID corresponds to a user ID
                    const matchingDebtor = debtors.find(d => d.user.toString() === payment.student.toString());
                    if (matchingDebtor) {
                        userIdToAdd = matchingDebtor.user;
                        matchMethod = 'student ID matching';
                        console.log(`   🎓 Matched by student ID: ${payment.student} -> User ID: ${userIdToAdd}`);
                    }
                }
                // Method 4: Try to match by room and residence (fallback)
                else if (payment.room && payment.residence) {
                    const matchingDebtor = debtors.find(d => 
                        d.roomNumber === payment.room && 
                        d.residence && 
                        d.residence.toString() === payment.residence.toString()
                    );
                    if (matchingDebtor) {
                        userIdToAdd = matchingDebtor.user;
                        matchMethod = 'room matching';
                        console.log(`   🏠 Matched by room: ${payment.room} -> User ID: ${userIdToAdd}`);
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
                    
                    updatedCount++;
                    console.log(`   ✅ Updated payment with user ID: ${userIdToAdd} (${matchMethod})`);
                } else {
                    noMatchCount++;
                    console.log(`   ❌ Could not determine user ID for this payment`);
                    console.log(`      Email: ${payment.email || 'N/A'}`);
                    console.log(`      Student: ${payment.student || 'N/A'}`);
                    console.log(`      Room: ${payment.room || 'N/A'}`);
                    console.log(`      Residence: ${payment.residence || 'N/A'}`);
                }

            } catch (error) {
                console.error(`   ❌ Error processing payment ${payment._id}:`, error.message);
                errors.push({ paymentId: payment._id, error: error.message });
            }
        }

        console.log('\n🎉 Summary:');
        console.log('===========');
        console.log(`✅ Successfully updated ${updatedCount} payments with user ID`);
        console.log(`❌ ${noMatchCount} payments could not be matched`);
        if (errors.length > 0) {
            console.log(`⚠️  ${errors.length} errors occurred`);
            errors.forEach(error => {
                console.log(`   - Payment ${error.paymentId}: ${error.error}`);
            });
        }

        // Show final state
        console.log('\n🔍 Final Payment Status:');
        console.log('========================');
        const finalPayments = await mongoose.connection.db.collection('payments').find({}).toArray();
        const paymentsWithUser = finalPayments.filter(p => p.user);
        const paymentsWithoutUser = finalPayments.filter(p => !p.user);
        
        console.log(`📊 Total Payments: ${finalPayments.length}`);
        console.log(`✅ Payments with User ID: ${paymentsWithUser.length}`);
        console.log(`❌ Payments without User ID: ${paymentsWithoutUser.length}`);
        
        if (paymentsWithoutUser.length > 0) {
            console.log(`\n⚠️  Payments still without User ID:`);
            paymentsWithoutUser.forEach((payment, index) => {
                console.log(`   ${index + 1}. Payment ID: ${payment._id}`);
                console.log(`      Email: ${payment.email || 'N/A'}`);
                console.log(`      Student: ${payment.student || 'N/A'}`);
                console.log(`      Room: ${payment.room || 'N/A'}`);
                console.log(`      Amount: $${payment.amount || payment.rentAmount || 'N/A'}`);
            });
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

console.log('🔧 Starting User ID Addition to Payments...');
addUserIdToPayments();
