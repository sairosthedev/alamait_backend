const Booking = require('../../models/Booking');
const { Residence } = require('../../models/Residence');
const { validationResult } = require('express-validator');
const EmailNotificationService = require('../../services/emailNotificationService');

// Get all bookings for a student
exports.getBookings = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const query = { student: req.user._id };

        if (status) {
            query.status = status;
        }

        const skip = (page - 1) * limit;

        const bookings = await Booking.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('residence', 'name address');

        const total = await Booking.countDocuments(query);

        res.json({
            bookings,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error in getBookings:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create new booking
exports.createBooking = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            residenceId,
            roomNumber,
            startDate,
            endDate,
            specialRequests,
            emergencyContact
        } = req.body;

        // Check if residence exists and room is available
        const residence = await Residence.findById(residenceId);
        if (!residence) {
            return res.status(404).json({ error: 'Residence not found' });
        }

        const room = residence.rooms.find(r => r.roomNumber === roomNumber);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        if (room.status !== 'available') {
            return res.status(400).json({ error: 'Room is not available' });
        }

        // Check for overlapping bookings
        const overlappingBooking = await Booking.findOne({
            residence: residenceId,
            'room.roomNumber': roomNumber,
            status: { $in: ['pending', 'confirmed'] },
            $or: [
                {
                    startDate: { $lte: new Date(endDate) },
                    endDate: { $gte: new Date(startDate) }
                }
            ]
        });

        if (overlappingBooking) {
            return res.status(400).json({ error: 'Room is already booked for these dates' });
        }

        // Create booking with proper room structure
        const bookingData = {
            student: req.user._id,
            residence: residenceId,
            room: {
                roomNumber: room.roomNumber,
                type: room.type,
                price: room.price
            },
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            specialRequests,
            emergencyContact,
            status: 'pending',
            paymentStatus: 'pending',
            totalAmount: room.price
        };

        const booking = new Booking(bookingData);
        await booking.save();

        // Update room status
        room.status = 'reserved';
        await residence.save();

        const populatedBooking = await Booking.findById(booking._id)
            .populate('residence', 'name address');

        // Send booking confirmation email (non-blocking)
        try {
            await EmailNotificationService.sendBookingConfirmationNotification(populatedBooking, req.user);
        } catch (emailError) {
            console.error('Failed to send booking confirmation email notification:', emailError);
            // Don't fail the request if email fails
        }

        res.status(201).json(populatedBooking);
    } catch (error) {
        console.error('Error in createBooking:', error);
        // Send more detailed error information in development
        const errorResponse = {
            error: 'Server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        };
        res.status(500).json(errorResponse);
    }
};

// Get booking details
exports.getBookingDetails = async (req, res) => {
    try {
        const booking = await Booking.findOne({
            _id: req.params.bookingId,
            student: req.user._id
        }).populate('residence', 'name address');

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json(booking);
    } catch (error) {
        console.error('Error in getBookingDetails:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update booking
exports.updateBooking = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const booking = await Booking.findOne({
            _id: req.params.bookingId,
            student: req.user._id
        });

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.status !== 'pending') {
            return res.status(400).json({ error: 'Cannot update confirmed or cancelled booking' });
        }

        const { specialRequests, emergencyContact } = req.body;

        if (specialRequests) booking.specialRequests = specialRequests;
        if (emergencyContact) booking.emergencyContact = emergencyContact;

        await booking.save();

        const updatedBooking = await Booking.findById(booking._id)
            .populate('residence', 'name address');

        res.json(updatedBooking);
    } catch (error) {
        console.error('Error in updateBooking:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findOne({
            _id: req.params.bookingId,
            student: req.user._id
        });

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.status === 'cancelled') {
            return res.status(400).json({ error: 'Booking is already cancelled' });
        }

        if (booking.status === 'completed') {
            return res.status(400).json({ error: 'Cannot cancel completed booking' });
        }

        // Update booking status
        booking.status = 'cancelled';
        await booking.save();

        // Update room status
        const residence = await Residence.findById(booking.residence);
        const room = residence.rooms.find(r => r.roomNumber === booking.room.roomNumber);
        room.status = 'available';
        await residence.save();

        res.json({ message: 'Booking cancelled successfully' });
    } catch (error) {
        console.error('Error in cancelBooking:', error);
        res.status(500).json({ error: 'Server error' });
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