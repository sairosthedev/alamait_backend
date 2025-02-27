const Application = require('../../models/Application');
const User = require('../../models/User');
const Residence = require('../../models/Residence');
const { validationResult } = require('express-validator');

// Get all applications with room status
exports.getApplications = async (req, res) => {
    try {
        const { type, status } = req.query;
        const query = {};

        if (type) query.requestType = type;
        if (status) query.status = status;

        // Get applications
        const applications = await Application.find(query)
            .populate('student', 'firstName lastName email phone program year')
            .sort({ applicationDate: -1 });

        // Get all residences to check room status
        const residences = await Residence.find({}, 'name rooms');
        
        // Create a map of room statuses
        const roomStatusMap = {};
        residences.forEach(residence => {
            residence.rooms.forEach(room => {
                roomStatusMap[room.roomNumber] = {
                    capacity: room.type === 'single' ? 1 : room.type === 'double' ? 2 : room.type === 'studio' ? 1 : 2,
                    price: room.price,
                    status: room.status,
                    residenceName: residence.name
                };
            });
        });

        // Transform applications to match frontend format
        const transformedApplications = applications.map(app => ({
            id: app._id,
            studentId: app.student._id,
            studentName: `${app.student.firstName} ${app.student.lastName}`,
            email: app.student.email,
            contact: app.student.phone,
            program: app.student.program,
            year: app.student.year,
            requestType: app.requestType,
            status: app.status,
            paymentStatus: app.paymentStatus,
            applicationDate: app.applicationDate.toISOString().split('T')[0],
            preferredRoom: app.preferredRoom,
            alternateRooms: app.alternateRooms,
            currentRoom: app.currentRoom,
            requestedRoom: app.requestedRoom,
            reason: app.reason,
            allocatedRoom: app.allocatedRoom,
            waitlistedRoom: app.waitlistedRoom
        }));

        res.json({
            applications: transformedApplications,
            rooms: Object.entries(roomStatusMap).map(([roomNumber, details]) => ({
                name: roomNumber,
                ...details
            }))
        });
    } catch (error) {
        console.error('Error in getApplications:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update application status
exports.updateApplicationStatus = async (req, res) => {
    try {
        const { action, roomNumber } = req.body;
        const { applicationId } = req.params;

        const application = await Application.findById(applicationId)
            .populate('student', 'firstName lastName email');

        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Check if room exists and has capacity (for approve and waitlist actions)
        if ((action === 'approve' || action === 'waitlist') && !roomNumber) {
            return res.status(400).json({ error: 'Room number is required for this action' });
        }

        if (action === 'approve' || action === 'waitlist') {
            // Find residence containing the room
            const residence = await Residence.findOne({ 'rooms.roomNumber': roomNumber });
            if (!residence) {
                return res.status(404).json({ error: 'Room not found' });
            }

            const room = residence.rooms.find(r => r.roomNumber === roomNumber);
            if (room.status !== 'available' && action === 'approve') {
                return res.status(400).json({ error: 'Room is not available' });
            }
        }

        // Update application based on action
        switch (action) {
            case 'approve':
                application.status = 'approved';
                application.allocatedRoom = roomNumber;
                application.paymentStatus = 'unpaid';
                // Update room status to reserved
                await Residence.findOneAndUpdate(
                    { 'rooms.roomNumber': roomNumber },
                    { $set: { 'rooms.$.status': 'reserved' } }
                );
                break;

            case 'reject':
                application.status = 'rejected';
                break;

            case 'waitlist':
                application.status = 'waitlisted';
                application.waitlistedRoom = roomNumber;
                break;

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        application.actionDate = new Date();
        application.actionBy = req.user._id;
        await application.save();

        // TODO: Send notification to student about application status change

        res.json(application);
    } catch (error) {
        console.error('Error in updateApplicationStatus:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update payment status
exports.updatePaymentStatus = async (req, res) => {
    try {
        const { applicationId } = req.params;

        const application = await Application.findById(applicationId)
            .populate('student', 'firstName lastName');

        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        if (application.status !== 'approved') {
            return res.status(400).json({ error: 'Can only update payment for approved applications' });
        }

        if (application.paymentStatus === 'paid') {
            return res.status(400).json({ error: 'Payment already marked as paid' });
        }

        // Update room status from reserved to occupied
        await Residence.findOneAndUpdate(
            { 'rooms.roomNumber': application.allocatedRoom },
            { $set: { 'rooms.$.status': 'occupied' } }
        );

        // Update application payment status
        application.paymentStatus = 'paid';
        await application.save();

        // TODO: Send confirmation to student

        res.json(application);
    } catch (error) {
        console.error('Error in updatePaymentStatus:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete application
exports.deleteApplication = async (req, res) => {
    try {
        const application = await User.findById(req.params.applicationId);
        
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Only delete if not verified
        if (application.isVerified) {
            return res.status(400).json({ 
                error: 'Cannot delete verified application' 
            });
        }

        await application.remove();
        res.json({ message: 'Application deleted successfully' });
    } catch (error) {
        console.error('Error in deleteApplication:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 