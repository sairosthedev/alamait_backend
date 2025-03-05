const mongoose = require('mongoose');
const User = require('../models/User');
const Application = require('../models/Application');
const Residence = require('../models/Residence');

require('dotenv').config();

async function fixEverything(studentId) {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Get user and application
        const user = await User.findById(studentId);
        const application = await Application.findOne({ email: user.email, status: 'approved' });

        if (!user || !application) {
            console.log('User or application not found');
            return;
        }

        console.log('\nBefore Update:');
        console.log('User:', {
            id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            applicationCode: user.applicationCode,
            currentRoom: user.currentRoom,
            roomValidUntil: user.roomValidUntil,
            roomApprovalDate: user.roomApprovalDate
        });
        console.log('Application:', {
            id: application._id,
            status: application.status,
            applicationCode: application.applicationCode,
            allocatedRoom: application.allocatedRoom,
            student: application.student
        });

        // 1. Set room approval date if not set
        const roomApprovalDate = application.approvedAt || new Date();
        
        // 2. Calculate room validity (4 months from approval)
        const roomValidUntil = new Date(roomApprovalDate);
        roomValidUntil.setMonth(roomValidUntil.getMonth() + 4);

        // 3. Update user data
        await User.findByIdAndUpdate(user._id, {
            $set: {
                applicationCode: application.applicationCode,
                currentRoom: application.allocatedRoom,
                roomApprovalDate: roomApprovalDate,
                roomValidUntil: roomValidUntil
            }
        });

        // 4. Link application to user and update approval date
        await Application.findByIdAndUpdate(application._id, {
            $set: {
                student: user._id,
                approvedAt: roomApprovalDate
            }
        });

        // 5. Update room status in residence
        if (application.allocatedRoom) {
            await Residence.updateOne(
                { 'rooms.roomNumber': application.allocatedRoom },
                { 
                    $set: { 
                        'rooms.$.status': 'occupied',
                        'rooms.$.currentOccupant': user._id
                    }
                }
            );
        }

        // Verify all updates
        const updatedUser = await User.findById(studentId);
        const updatedApplication = await Application.findOne({ email: user.email, status: 'approved' });
        const residence = await Residence.findOne({ 'rooms.roomNumber': application.allocatedRoom });
        const room = residence?.rooms?.find(r => r.roomNumber === application.allocatedRoom);

        console.log('\nAfter Update:');
        console.log('User:', {
            id: updatedUser._id,
            name: `${updatedUser.firstName} ${updatedUser.lastName}`,
            email: updatedUser.email,
            applicationCode: updatedUser.applicationCode,
            currentRoom: updatedUser.currentRoom,
            roomValidUntil: updatedUser.roomValidUntil,
            roomApprovalDate: updatedUser.roomApprovalDate
        });
        console.log('Application:', {
            id: updatedApplication._id,
            status: updatedApplication.status,
            applicationCode: updatedApplication.applicationCode,
            allocatedRoom: updatedApplication.allocatedRoom,
            student: updatedApplication.student,
            approvedAt: updatedApplication.approvedAt
        });
        console.log('Room:', room ? {
            roomNumber: room.roomNumber,
            status: room.status,
            currentOccupant: room.currentOccupant
        } : 'Room not found');

        mongoose.disconnect();
        console.log('\nAll updates completed successfully');
    } catch (error) {
        console.error('Error:', error);
        mongoose.disconnect();
    }
}

// Your user ID from the token
fixEverything('67c0bf38d7be0715d65a3658'); 