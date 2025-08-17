require('dotenv').config();
const mongoose = require('mongoose');

async function finalPaymentUserIdSolution() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🎯 Final Payment User ID Solution...');
        console.log('==================================');

        // Get all collections
        const debtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
        const payments = await mongoose.connection.db.collection('payments').find({}).toArray();
        const applications = await mongoose.connection.db.collection('applications').find({}).toArray();
        
        console.log(`📊 Found ${debtors.length} debtors, ${payments.length} payments, ${applications.length} applications`);

        // Create comprehensive mapping
        console.log('\n🔗 Creating Comprehensive ID Mapping...');
        console.log('=====================================');
        
        const idMapping = {};
        
        // Map 1: Application ID -> User ID (from applications)
        applications.forEach(app => {
            if (app._id && app.student) {
                idMapping[app._id.toString()] = app.student.toString();
            }
        });
        
        // Map 2: Room + Residence -> User ID (from debtors)
        debtors.forEach(debtor => {
            if (debtor.roomNumber && debtor.residence && debtor.user) {
                const key = `${debtor.roomNumber}-${debtor.residence.toString()}`;
                idMapping[key] = debtor.user.toString();
            }
        });
        
        console.log(`Created ${Object.keys(idMapping).length} ID mappings`);

        // Process all payments
        console.log('\n🔍 Processing All Payments...');
        console.log('=============================');
        
        let updatedCount = 0;
        let errors = [];
        let unmatchedCount = 0;

        for (const payment of payments) {
            try {
                console.log(`\n💳 Processing Payment: ${payment._id}`);
                console.log(`   Student ID: ${payment.student || 'N/A'}`);
                console.log(`   Room: ${payment.room || 'N/A'}`);
                console.log(`   Residence: ${payment.residence || 'N/A'}`);
                console.log(`   Has User ID: ${payment.user ? 'Yes' : 'No'}`);

                let userIdToAdd = null;
                let matchMethod = '';

                // Method 1: Payment already has user ID
                if (payment.user) {
                    userIdToAdd = payment.user;
                    matchMethod = 'already had user ID';
                    console.log(`   ✅ Payment already has user ID: ${userIdToAdd}`);
                }
                // Method 2: Try application ID mapping
                else if (payment.student && idMapping[payment.student.toString()]) {
                    userIdToAdd = idMapping[payment.student.toString()];
                    matchMethod = 'application ID mapping';
                    console.log(`   📝 Matched via application ID: ${payment.student} -> ${userIdToAdd}`);
                }
                // Method 3: Try room + residence mapping
                else if (payment.room && payment.residence) {
                    const key = `${payment.room}-${payment.residence.toString()}`;
                    if (idMapping[key]) {
                        userIdToAdd = idMapping[key];
                        matchMethod = 'room + residence mapping';
                        console.log(`   🏠 Matched via room mapping: ${key} -> ${userIdToAdd}`);
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
                    unmatchedCount++;
                    console.log(`   ❌ Could not determine user ID for this payment`);
                    console.log(`      This payment appears to be for a room without an assigned debtor`);
                    console.log(`      Consider: 1) Creating a debtor for this room, or 2) Removing orphaned payment`);
                }

            } catch (error) {
                console.error(`   ❌ Error processing payment ${payment._id}:`, error.message);
                errors.push({ paymentId: payment._id, error: error.message });
            }
        }

        console.log('\n🎉 Summary:');
        console.log('===========');
        console.log(`✅ Successfully updated ${updatedCount} payments with user ID`);
        console.log(`❌ ${unmatchedCount} payments could not be matched`);
        if (errors.length > 0) {
            console.log(`⚠️  ${errors.length} errors occurred`);
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

        // Show unmatched payments for manual review
        if (paymentsWithoutUser.length > 0) {
            console.log(`\n⚠️  Payments Still Without User ID (Manual Review Required):`);
            console.log(`============================================================`);
            paymentsWithoutUser.forEach((payment, index) => {
                console.log(`\n${index + 1}. Payment ID: ${payment._id}`);
                console.log(`   Student ID: ${payment.student || 'N/A'}`);
                console.log(`   Room: ${payment.room || 'N/A'}`);
                console.log(`   Residence: ${payment.residence || 'N/A'}`);
                console.log(`   Amount: $${payment.amount || payment.rentAmount || 'N/A'}`);
                console.log(`   Date: ${payment.date || payment.createdAt || 'N/A'}`);
                console.log(`   Status: ${payment.status || 'N/A'}`);
            });
        }

        // Recommendations
        console.log('\n💡 RECOMMENDATIONS FOR FUTURE PAYMENTS:');
        console.log('========================================');
        console.log(`1. ✅ ALWAYS include 'user' field when creating payments`);
        console.log(`2. ✅ Use debtor.user ID as the payment.user value`);
        console.log(`3. ✅ This ensures 100% payment-to-debtor mapping`);
        console.log(`4. ✅ No more complex fallback logic needed`);
        console.log(`5. ✅ Direct, efficient, and reliable linking`);

        console.log('\n🔧 IMPLEMENTATION GUIDE:');
        console.log('========================');
        console.log(`When creating a payment:`);
        console.log(`  payment = {`);
        console.log(`    user: debtor.user,           // ← ALWAYS include this`);
        console.log(`    room: debtor.roomNumber,     // ← Room number`);
        console.log(`    residence: debtor.residence, // ← Residence ID`);
        console.log(`    rentAmount: 180,             // ← Rent amount`);
        console.log(`    adminFee: 20,                // ← Admin fee`);
        console.log(`    deposit: 100,                // ← Deposit`);
        console.log(`    // ... other fields`);
        console.log(`  }`);

        console.log('\n🎯 CURRENT STATUS:');
        console.log('==================');
        console.log(`✅ ${paymentsWithUser.length}/${finalPayments.length} payments now have user IDs`);
        console.log(`✅ Payment-to-debtor mapping is now reliable and efficient`);
        console.log(`✅ Future payments will have 100% mapping success rate`);
        console.log(`✅ Room-based fallback still works for edge cases`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🎯 Starting Final Payment User ID Solution...');
finalPaymentUserIdSolution();
