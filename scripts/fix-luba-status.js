/**
 * 🎯 Fix Luba's Status Script
 * 
 * This script fixes Luba's status if her lease ended in July
 * but she's still showing as "active"
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Lease = require('../src/models/Lease');
const ExpiredStudent = require('../src/models/ExpiredStudent');
const Payment = require('../src/models/Payment');

async function fixLubaStatus() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        // Find Luba (case insensitive search)
        const luba = await User.findOne({
            role: 'student',
            $or: [
                { firstName: { $regex: /luba/i } },
                { lastName: { $regex: /luba/i } },
                { email: { $regex: /luba/i } }
            ]
        });

        if (!luba) {
            console.log('❌ Luba not found in active users');
            
            // Check if she's already in ExpiredStudent collection
            const expiredLuba = await ExpiredStudent.findOne({
                $or: [
                    { 'student.firstName': { $regex: /luba/i } },
                    { 'student.lastName': { $regex: /luba/i } },
                    { 'student.email': { $regex: /luba/i } }
                ]
            });

            if (expiredLuba) {
                console.log('✅ Luba is already in ExpiredStudent collection');
                console.log(`   Archived at: ${expiredLuba.archivedAt}`);
                console.log(`   Reason: ${expiredLuba.reason}`);
            } else {
                console.log('❌ Luba not found in either active users or expired students');
            }
            
            await mongoose.disconnect();
            return;
        }

        console.log(`🔍 Found Luba: ${luba.firstName} ${luba.lastName} (${luba.email})`);
        console.log(`   Current Status: ${luba.status}`);
        console.log(`   Current Room: ${luba.currentRoom}`);
        console.log(`   Room Valid Until: ${luba.roomValidUntil}`);

        // Get Luba's applications and leases
        const applications = await Application.find({ 
            $or: [
                { student: luba._id },
                { email: luba.email }
            ]
        });

        const leases = await Lease.find({ studentId: luba._id });

        console.log(`📋 Applications: ${applications.length}`);
        console.log(`📋 Leases: ${leases.length}`);

        // Check if Luba should be expired
        const now = new Date();
        const hasExpiredLease = leases.some(lease => new Date(lease.endDate) < now);
        const hasExpiredRoom = luba.roomValidUntil && new Date(luba.roomValidUntil) < now;

        console.log(`🔍 Has Expired Lease: ${hasExpiredLease}`);
        console.log(`🔍 Has Expired Room: ${hasExpiredRoom}`);

        if (hasExpiredLease || hasExpiredRoom) {
            console.log('🚫 Luba should be expired - processing...');

            // Get Luba's payments
            const payments = await Payment.find({ student: luba._id });

            // Create expired student record
            const expiredStudentData = new ExpiredStudent({
                student: luba.toObject(),
                application: applications.length > 0 ? applications[0].toObject() : null,
                previousApplicationCode: luba.applicationCode || (applications[0] && applications[0].applicationCode),
                archivedAt: new Date(),
                reason: 'lease_expired',
                paymentHistory: payments.map(p => p.toObject()),
                leases: leases.map(l => l.toObject()),
                archivedBy: 'system',
                archivedByEmail: 'system@alamait.com'
            });

            await expiredStudentData.save();
            console.log('✅ Luba archived to ExpiredStudent collection');

            // Update applications to expired
            for (const application of applications) {
                if (application.status === 'approved') {
                    application.status = 'expired';
                    application.rejectionReason = 'Lease end date reached';
                    application.actionDate = new Date();
                    await application.save();
                    console.log(`✅ Application ${application._id} marked as expired`);
                }
            }

            // Handle room availability
            if (luba.currentRoom && luba.residence) {
                const Residence = require('../src/models/Residence');
                const residence = await Residence.findById(luba.residence);
                if (residence) {
                    const room = residence.rooms.find(r => r.roomNumber === luba.currentRoom);
                    if (room) {
                        room.currentOccupancy = Math.max(0, (room.currentOccupancy || 1) - 1);
                        if (room.currentOccupancy === 0) {
                            room.status = 'available';
                        } else if (room.currentOccupancy < room.capacity) {
                            room.status = 'reserved';
                        } else {
                            room.status = 'occupied';
                        }
                        await residence.save();
                        console.log(`✅ Room ${luba.currentRoom} updated - occupancy: ${room.currentOccupancy}, status: ${room.status}`);
                    }
                }
            }

            // Delete Luba from active users
            await User.findByIdAndDelete(luba._id);
            console.log('✅ Luba removed from active users');

            console.log('🎉 Luba\'s status has been fixed!');
            console.log('   Status: active → expired');
            console.log('   Action: archived to ExpiredStudent collection');
            console.log('   Room: freed and available');

        } else {
            console.log('ℹ️ Luba\'s status appears to be correct');
            console.log('   No expired leases found');
            console.log('   Room validity is still active');
        }

    } catch (error) {
        console.error('❌ Error fixing Luba\'s status:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the script
if (require.main === module) {
    fixLubaStatus();
}

module.exports = { fixLubaStatus };




