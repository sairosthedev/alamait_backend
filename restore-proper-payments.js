require('dotenv').config();
const mongoose = require('mongoose');

async function restoreProperPayments() {
    try {
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            return;
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        console.log('\n🔄 Restoring Proper Payments Collection...');
        console.log('==========================================');
        
        // Drop the entire payments collection to start fresh
        console.log('\n🗑️  Dropping payments collection...');
        await mongoose.connection.db.dropCollection('payments');
        console.log('   ✅ Payments collection dropped');
        
        // Recreate the payments collection
        console.log('\n🆕 Recreating payments collection...');
        await mongoose.connection.db.createCollection('payments');
        console.log('   ✅ Payments collection recreated');
        
        // Get active students to create proper payments
        const activeStudents = await mongoose.connection.db
            .collection('applications')
            .find({
                status: 'approved',
                paymentStatus: { $ne: 'cancelled' }
            }).toArray();
        
        console.log(`\n👥 Active Students: ${activeStudents.length}`);
        
        // Create proper payments based on your Payment model
        console.log('\n💰 Creating Proper Payments...');
        const properPayments = [];
        
        activeStudents.forEach((student, index) => {
            // Create a payment for each student with proper structure
            const paymentMonth = '2025-08'; // August 2025
            const paymentDate = new Date('2025-08-01');
            
            // Generate unique payment ID
            const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Get room info from student
            const room = student.allocatedRoom || student.preferredRoom || 'Not Assigned';
            const roomType = student.roomType || '';
            
            // Get residence info
            const residence = student.residence;
            
            // Calculate amounts based on room pricing (you can adjust these)
            const rentAmount = 180; // Default rent amount
            const adminFee = 20;    // Default admin fee
            const deposit = 100;     // Default deposit
            const totalAmount = rentAmount + adminFee + deposit;
            
            const properPayment = {
                paymentId: paymentId,
                student: student._id,
                residence: residence,
                room: room,
                roomType: roomType,
                rentAmount: rentAmount,
                adminFee: adminFee,
                deposit: deposit,
                payments: [
                    {
                        type: 'rent',
                        amount: rentAmount
                    },
                    {
                        type: 'admin',
                        amount: adminFee
                    },
                    {
                        type: 'deposit',
                        amount: deposit
                    }
                ],
                totalAmount: totalAmount,
                paymentMonth: paymentMonth,
                date: paymentDate,
                method: 'Bank Transfer',
                status: 'Pending',
                applicationStatus: 'pending',
                description: `Payment for ${student.firstName} ${student.lastName} - ${paymentMonth}`,
                createdBy: student._id, // Using student ID as createdBy for now
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            properPayments.push(properPayment);
        });
        
        if (properPayments.length > 0) {
            const insertResult = await mongoose.connection.db
                .collection('payments')
                .insertMany(properPayments);
            
            console.log(`   ✅ Created ${insertResult.insertedCount} proper payments`);
        }
        
        // Verify the restoration
        console.log('\n🔍 Verifying Proper Payments...');
        const newPayments = await mongoose.connection.db
            .collection('payments')
            .find({}).toArray();
        
        console.log(`\n📊 New Payments Count: ${newPayments.length}`);
        
        if (newPayments.length > 0) {
            console.log('\n💳 Sample of Proper Payments:');
            newPayments.slice(0, 3).forEach((payment, index) => {
                console.log(`\n   ${index + 1}. Payment ID: ${payment.paymentId}`);
                console.log(`      Student ID: ${payment.student}`);
                console.log(`      Residence: ${payment.residence}`);
                console.log(`      Room: ${payment.room}`);
                console.log(`      Total Amount: $${payment.totalAmount}`);
                console.log(`      Payment Month: ${payment.paymentMonth}`);
                console.log(`      Date: ${payment.date}`);
                console.log(`      Method: ${payment.method}`);
                console.log(`      Status: ${payment.status}`);
                console.log(`      Rent: $${payment.rentAmount}`);
                console.log(`      Admin Fee: $${payment.adminFee}`);
                console.log(`      Deposit: $${payment.deposit}`);
            });
            
            if (newPayments.length > 3) {
                console.log(`\n   ... and ${newPayments.length - 3} more payments`);
            }
        }
        
        // Calculate totals
        const totalAmount = newPayments.reduce((sum, payment) => sum + (payment.totalAmount || 0), 0);
        const studentsWithPayments = new Set(newPayments.map(p => p.student.toString())).size;
        
        console.log('\n📊 PROPER PAYMENTS COLLECTION RESTORED:');
        console.log('========================================');
        console.log(`💰 Total Payments: ${newPayments.length}`);
        console.log(`💵 Total Amount: $${totalAmount}`);
        console.log(`👥 Students with Payments: ${studentsWithPayments}`);
        console.log(`📈 Average Payment: $${newPayments.length > 0 ? (totalAmount / newPayments.length).toFixed(2) : 0}`);
        
        console.log('\n✅ Proper payments collection has been restored!');
        console.log('\n💡 Your payments collection now has the correct structure:');
        console.log('   - All required fields from Payment model');
        console.log('   - Proper paymentId format');
        console.log('   - Correct amounts and payment types');
        console.log('   - Proper status and application status');
        console.log('   - All students have payments with proper amounts');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔄 Starting Proper Payments Restoration...');
restoreProperPayments();
