const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    room: {
        roomNumber: {
            type: String,
            required: true
        },
        type: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        }
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'partial', 'paid'],
        default: 'pending'
    },
    totalAmount: {
        type: Number,
        required: true
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    payments: [{
        amount: Number,
        date: Date,
        method: String,
        status: String,
        transactionId: String
    }],
    specialRequests: String,
    emergencyContact: {
        name: String,
        relationship: String,
        phone: String
    },
    documents: [{
        type: String,
        name: String,
        url: String,
        uploadDate: Date
    }],
    checkInDetails: {
        actualCheckIn: Date,
        checkInNotes: String
    },
    checkOutDetails: {
        actualCheckOut: Date,
        checkOutNotes: String,
        roomCondition: String
    }
}, {
    timestamps: true
});

// Calculate remaining balance
bookingSchema.methods.getRemainingBalance = function() {
    return this.totalAmount - this.paidAmount;
};

// Add payment
bookingSchema.methods.addPayment = function(payment) {
    this.payments.push(payment);
    this.paidAmount += payment.amount;
    
    if (this.paidAmount >= this.totalAmount) {
        this.paymentStatus = 'paid';
    } else if (this.paidAmount > 0) {
        this.paymentStatus = 'partial';
    }
};

// Check if booking dates overlap with existing bookings
bookingSchema.statics.checkAvailability = async function(residenceId, roomNumber, startDate, endDate, excludeBookingId = null) {
    const { Residence } = require('./Residence');
    const User = require('./User');
    
    // Get room capacity
    const residence = await Residence.findById(residenceId);
    if (!residence) {
        return false;
    }
    
    const room = residence.rooms.find(r => r.roomNumber === roomNumber);
    if (!room) {
        return false;
    }
    
    const roomCapacity = room.capacity || 1;
    
    // Find all overlapping bookings
    const query = {
        residence: residenceId,
        'room.roomNumber': roomNumber,
        status: { $nin: ['cancelled', 'completed'] },
        $or: [
            { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
        ]
    };

    if (excludeBookingId) {
        query._id = { $ne: excludeBookingId };
    }

    const overlappingBookings = await this.find(query);
    
    // Use the room occupancy utility to get accurate occupancy count
    const RoomOccupancyUtils = require('../utils/roomOccupancyUtils');
    const occupancyDetails = await RoomOccupancyUtils.calculateAccurateRoomOccupancy(residenceId, roomNumber);
    
    // Use the accurate occupancy count (this already includes all approved applications)
    const totalOccupancy = occupancyDetails.currentOccupancy;
    
    // For shared rooms, check if adding this booking would exceed capacity
    // For single rooms (capacity = 1), any overlap means unavailable
    if (roomCapacity === 1) {
        return totalOccupancy === 0;
    } else {
        // For shared rooms, check if we're at capacity
        return totalOccupancy < roomCapacity;
    }
};

// Performance indexes for Booking
// Index on student for finding student's bookings
bookingSchema.index({ student: 1 });

// Index on residence for filtering by residence
bookingSchema.index({ residence: 1 });

// Index on status for filtering by status
bookingSchema.index({ status: 1 });

// Index on paymentStatus for filtering by payment status
bookingSchema.index({ paymentStatus: 1 });

// Index on dates for availability checks and date range queries
bookingSchema.index({ startDate: 1, endDate: 1 });

// Compound indexes for common query patterns
// Residence + room + status (for availability checks)
bookingSchema.index({ residence: 1, 'room.roomNumber': 1, status: 1 });

// Student + status (get student's active bookings)
bookingSchema.index({ student: 1, status: 1 });

// Residence + status + dates (for availability queries)
bookingSchema.index({ residence: 1, status: 1, startDate: 1, endDate: 1 });

// Date range index for finding overlapping bookings
bookingSchema.index({ startDate: 1, endDate: 1, status: 1 });

// Student + dates (get student's bookings in date range)
bookingSchema.index({ student: 1, startDate: -1 });

// Residence + dates (get residence bookings in date range)
bookingSchema.index({ residence: 1, startDate: -1 });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking; 