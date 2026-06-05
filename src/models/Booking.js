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

function formatAvailabilityDate(date) {
    const value = new Date(date);
    if (Number.isNaN(value.getTime())) {
        return 'unknown date';
    }
    return value.toISOString().split('T')[0];
}

function formatAvailabilityConflict(conflict) {
    const tenant = conflict.name
        || conflict.email
        || (conflict.studentId ? `student ${String(conflict.studentId).slice(-8)}` : 'Unknown tenant');
    const range = `${formatAvailabilityDate(conflict.startDate)} to ${formatAvailabilityDate(conflict.endDate)}`;
    const code = conflict.applicationCode ? `, ${conflict.applicationCode}` : '';
    return `${tenant} (lease: ${range}${code})`;
}

bookingSchema.statics.formatAvailabilityConflicts = function(roomNumber, conflicts) {
    if (!conflicts.length) {
        return `Room ${roomNumber} is not available for the specified dates`;
    }
    const summary = conflicts.map(formatAvailabilityConflict).join('; ');
    const noun = conflicts.length === 1 ? 'lease' : 'leases';
    return `Room ${roomNumber} conflicts with existing ${noun}: ${summary}`;
};

// Check if booking dates overlap with existing bookings / approved leases
bookingSchema.statics.checkAvailability = async function(residenceId, roomNumber, startDate, endDate, excludeBookingId = null) {
    const result = await this.getAvailabilityDetails(residenceId, roomNumber, startDate, endDate, excludeBookingId);
    return result;
};

bookingSchema.statics.getAvailabilityDetails = async function(residenceId, roomNumber, startDate, endDate, excludeBookingId = null) {
    const { Residence } = require('./Residence');

    const residence = await Residence.findById(residenceId);
    if (!residence) {
        return { available: false, capacity: 0, conflicts: [], message: 'Residence not found' };
    }

    const room = residence.rooms.find(r => r.roomNumber === roomNumber);
    if (!room) {
        return { available: false, capacity: 0, conflicts: [], message: 'Room not found' };
    }

    const roomCapacity = room.capacity || 1;
    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);

    const RoomOccupancyUtils = require('../utils/roomOccupancyUtils');

    // Approved application leases are the source of truth for occupancy.
    // Orphan/stale Booking records without a matching lease must not block availability.
    const conflicts = await RoomOccupancyUtils.getOverlappingLeasesForPeriod(
        residenceId,
        roomNumber,
        periodStart,
        periodEnd
    );

    const totalOccupancy = conflicts.length;
    const available = roomCapacity === 1
        ? totalOccupancy === 0
        : totalOccupancy < roomCapacity;

    return {
        available,
        capacity: roomCapacity,
        currentOccupancy: totalOccupancy,
        conflicts,
        message: available
            ? null
            : this.formatAvailabilityConflicts(roomNumber, conflicts)
    };
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