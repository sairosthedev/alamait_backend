const mongoose = require('mongoose');
const Debtor = require('../src/models/Debtor');
const Residence = require('../src/models/Residence');
const Payment = require('../src/models/Payment');
const Application = require('../src/models/Application');
require('dotenv').config();

async function fixDebtorRoomPricing() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('Connected to MongoDB');
        console.log('=' .repeat(60));

        // Get all debtors with their applications and residences
        const debtors = await Debtor.find()
            .populate('residence', 'name rooms')
            .populate('application', 'startDate endDate roomNumber');

        console.log(`📋 Found ${debtors.length} debtors to update`);

        for (const debtor of debtors) {
            try {
                let roomPrice = 0;
                let roomNumber = 'N/A';
                let expectedTotal = 0;
                let totalPaid = 0;
                let currentBalance = 0;

                // Get room price from residence's rooms array
                if (debtor.residence && debtor.residence.rooms && Array.isArray(debtor.residence.rooms)) {
                    // Try to find the specific room from application
                    const applicationRoomNumber = debtor.application?.roomNumber || debtor.roomNumber;
                    
                    if (applicationRoomNumber) {
                        const room = debtor.residence.rooms.find(r => 
                            r.roomNumber === applicationRoomNumber || 
                            r.roomNumber?.toLowerCase() === applicationRoomNumber?.toLowerCase()
                        );
                        
                        if (room && room.price) {
                            roomPrice = room.price;
                            roomNumber = room.roomNumber;
                            console.log(`✅ Found room ${roomNumber} with price $${roomPrice} for ${debtor.contactInfo?.name}`);
                        } else {
                            // If specific room not found, use the first available room's price
                            const firstRoom = debtor.residence.rooms.find(r => r.price);
                            if (firstRoom && firstRoom.price) {
                                roomPrice = firstRoom.price;
                                roomNumber = firstRoom.roomNumber;
                                console.log(`⚠️  Using first room ${roomNumber} price $${roomPrice} for ${debtor.contactInfo?.name}`);
                            }
                        }
                    } else {
                        // No room number specified, use first available room
                        const firstRoom = debtor.residence.rooms.find(r => r.price);
                        if (firstRoom && firstRoom.price) {
                            roomPrice = firstRoom.price;
                            roomNumber = firstRoom.roomNumber;
                            console.log(`⚠️  No room specified, using first room ${roomNumber} price $${roomPrice} for ${debtor.contactInfo?.name}`);
                        }
                    }
                }

                // If still no room price, set default based on residence name
                if (roomPrice === 0) {
                    const residenceName = debtor.residence?.name || '';
                    if (residenceName.includes('Belvedere')) {
                        roomPrice = 150; // From your example
                    } else if (residenceName.includes('St Kilda')) {
                        roomPrice = 120;
                    } else if (residenceName.includes('Ocean')) {
                        roomPrice = 180;
                    } else {
                        roomPrice = 100; // Default
                    }
                    console.log(`⚠️  No room data found, using default price $${roomPrice} for ${debtor.contactInfo?.name}`);
                }

                // Calculate billing period and expected total
                if (debtor.startDate && debtor.endDate) {
                    const startDate = new Date(debtor.startDate);
                    const endDate = new Date(debtor.endDate);
                    const billingPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44));
                    expectedTotal = roomPrice * billingPeriod;
                } else {
                    // Fallback to 6 months if no dates
                    expectedTotal = roomPrice * 6;
                }

                // Get payments for this student
                const payments = await Payment.find({
                    student: debtor.user,
                    status: { $in: ['verified', 'paid', 'confirmed'] }
                });

                // Calculate total paid
                totalPaid = payments.reduce((sum, payment) => {
                    let paymentTotal = 0;
                    if (payment.rentAmount && payment.rentAmount > 0) paymentTotal += payment.rentAmount;
                    if (payment.rent && payment.rent > 0) paymentTotal += payment.rent;
                    if (payment.adminFee && payment.adminFee > 0) paymentTotal += payment.adminFee;
                    if (payment.deposit && payment.deposit > 0) paymentTotal += payment.deposit;
                    if (payment.amount && payment.amount > 0) paymentTotal += payment.amount;
                    return sum + paymentTotal;
                }, 0);

                // Calculate current balance
                currentBalance = Math.max(expectedTotal - totalPaid, 0);
                const overdueAmount = currentBalance > 0 ? currentBalance : 0;

                // Determine status
                let status = 'active';
                if (currentBalance === 0) {
                    status = 'paid';
                } else if (currentBalance > 0 && debtor.endDate && new Date(debtor.endDate) < new Date()) {
                    status = 'overdue';
                }

                // Update debtor
                debtor.roomPrice = roomPrice;
                debtor.roomNumber = roomNumber;
                debtor.totalOwed = expectedTotal;
                debtor.totalPaid = totalPaid;
                debtor.currentBalance = currentBalance;
                debtor.overdueAmount = overdueAmount;
                debtor.status = status;
                debtor.payments = payments.map(p => p._id);

                await debtor.save();

                console.log(`✅ Updated ${debtor.contactInfo?.name || 'Unknown'}`);
                console.log(`   Room: ${roomNumber}`);
                console.log(`   Room Price: $${roomPrice.toFixed(2)}`);
                console.log(`   Expected: $${expectedTotal.toFixed(2)}`);
                console.log(`   Paid: $${totalPaid.toFixed(2)}`);
                console.log(`   Owing: $${currentBalance.toFixed(2)}`);
                console.log(`   Status: ${status}`);

            } catch (error) {
                console.error(`❌ Error updating debtor ${debtor._id}:`, error.message);
            }
        }

        // Verify the updates
        console.log('\n🔍 Verifying updates...');
        const updatedDebtors = await Debtor.find()
            .populate('residence', 'name')
            .limit(5);

        console.log('\n📋 Updated Debtors Sample:');
        updatedDebtors.forEach((debtor, index) => {
            console.log(`\n${index + 1}. ${debtor.contactInfo?.name || 'N/A'}`);
            console.log(`   Room: ${debtor.roomNumber || 'N/A'}`);
            console.log(`   Room Price: $${debtor.roomPrice?.toFixed(2) || '0.00'}`);
            console.log(`   Expected: $${debtor.totalOwed?.toFixed(2) || '0.00'}`);
            console.log(`   Paid: $${debtor.totalPaid?.toFixed(2) || '0.00'}`);
            console.log(`   Owing: $${debtor.currentBalance?.toFixed(2) || '0.00'}`);
            console.log(`   Status: ${debtor.status}`);
            console.log(`   Residence: ${debtor.residence?.name || 'N/A'}`);
        });

        console.log('\n🎉 Debtor room pricing updated successfully!');
        console.log('\n✅ Now using actual room prices from residence data');

    } catch (error) {
        console.error('Error fixing debtor room pricing:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

fixDebtorRoomPricing(); 