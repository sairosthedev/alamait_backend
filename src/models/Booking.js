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

    const existingBooking = await this.findOne(query);
    return !existingBooking;
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking; 