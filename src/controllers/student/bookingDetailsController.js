const Booking = require('../../models/Booking');
const Room = require('../../models/Room');
const Residence = require('../../models/Residence');

exports.getBookingDetails = async (req, res) => {
    try {
        // Get current active booking
        const currentBooking = await Booking.findOne({
            student: req.user._id,
            status: 'active'
        })
        .populate('residence', 'name address image')
        .populate('room', 'roomNumber type features price');

        // Get booking history
        const bookingHistory = await Booking.find({
            student: req.user._id,
            status: { $in: ['completed', 'cancelled'] }
        })
        .sort({ endDate: -1 })
        .select('roomNumber roomType startDate endDate status');

        // If there's no current booking, return early
        if (!currentBooking) {
            return res.status(404).json({ error: 'No active booking found' });
        }

        // Get room options (upgrades and downgrades)
        const currentRoom = await Room.findOne({
            residence: currentBooking.residence._id,
            roomNumber: currentBooking.room.roomNumber
        });

        const roomOptions = await Room.find({
            residence: currentBooking.residence._id,
            status: 'available',
            _id: { $ne: currentRoom._id }
        }).select('roomNumber type price features amenities size floor image');

        // Categorize rooms as upgrades or downgrades
        const processedRoomOptions = roomOptions.map(room => ({
            ...room.toObject(),
            type: room.price > currentRoom.price ? 'upgrade' : 'downgrade'
        }));

        // Format response
        const response = {
            currentBooking: {
                id: currentBooking._id,
                roomNumber: currentBooking.room.roomNumber,
                roomType: currentBooking.room.type,
                startDate: currentBooking.startDate,
                endDate: currentBooking.endDate,
                monthlyRent: currentBooking.room.price,
                status: currentBooking.status,
                image: currentBooking.residence.image,
                features: currentBooking.room.features
            },
            bookingHistory: bookingHistory.map(booking => ({
                id: booking._id,
                roomNumber: booking.roomNumber,
                roomType: booking.roomType,
                startDate: booking.startDate,
                endDate: booking.endDate,
                status: booking.status
            })),
            roomOptions: processedRoomOptions
        };

        res.json(response);
    } catch (error) {
        console.error('Error in getBookingDetails:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 