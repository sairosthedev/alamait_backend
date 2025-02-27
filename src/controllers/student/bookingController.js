const Booking = require('../../models/Booking');
const Residence = require('../../models/Residence');
const { validationResult } = require('express-validator');

// Create new booking
exports.createBooking = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { residenceId, roomNumber, startDate, endDate } = req.body;

        // Check if room is available
        const isAvailable = await Booking.checkAvailability(
            residenceId,
            roomNumber,
            new Date(startDate),
            new Date(endDate)
        );

        if (!isAvailable) {
            return res.status(400).json({ error: 'Room is not available for selected dates' });
        }

        // Get room details from residence
        const residence = await Residence.findById(residenceId);
        const room = residence.rooms.find(r => r.roomNumber === roomNumber);
        
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const booking = new Booking({
            student: req.user._id,
            residence: residenceId,
            room: {
                roomNumber: room.roomNumber,
                type: room.type,
                price: room.price
            },
            startDate,
            endDate,
            totalAmount: room.price * Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
        });

        await booking.save();

        // Update room status
        room.status = 'reserved';
        await residence.save();

        const populatedBooking = await Booking.findById(booking._id)
            .populate('residence', 'name address')
            .populate('student', 'firstName lastName email');

        res.status(201).json(populatedBooking);
    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({ error: 'Error creating booking' });
    }
};

// Get student's bookings
exports.getMyBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ student: req.user._id })
            .populate('residence', 'name address')
            .sort('-createdAt');

        res.json(bookings);
    } catch (error) {
        console.error('Get bookings error:', error);
        res.status(500).json({ error: 'Error fetching bookings' });
    }
};

// Get single booking
exports.getBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('residence', 'name address')
            .populate('student', 'firstName lastName email');

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Check if user is authorized to view this booking
        if (booking.student._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.json(booking);
    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({ error: 'Error fetching booking' });
    }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Check if user is authorized to cancel this booking
        if (booking.student.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Check if booking can be cancelled (e.g., not too close to start date)
        const today = new Date();
        const startDate = new Date(booking.startDate);
        const daysUntilStart = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntilStart < 7) {
            return res.status(400).json({ error: 'Booking cannot be cancelled within 7 days of start date' });
        }

        booking.status = 'cancelled';
        await booking.save();

        // Update room status
        const residence = await Residence.findById(booking.residence);
        const room = residence.rooms.find(r => r.roomNumber === booking.room.roomNumber);
        room.status = 'available';
        await residence.save();

        res.json(booking);
    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({ error: 'Error cancelling booking' });
    }
};

// Add payment to booking
exports.addPayment = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Check if user is authorized
        if (booking.student.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const payment = {
            amount: req.body.amount,
            method: req.body.method,
            transactionId: req.body.transactionId,
            date: new Date(),
            status: 'completed'
        };

        booking.addPayment(payment);
        await booking.save();

        res.json(booking);
    } catch (error) {
        console.error('Add payment error:', error);
        res.status(500).json({ error: 'Error adding payment' });
    }
};