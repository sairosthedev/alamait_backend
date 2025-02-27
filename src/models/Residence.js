const mongoose = require('mongoose');

const residenceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    rooms: [{
        roomNumber: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['single', 'double', 'studio', 'apartment'],
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['available', 'occupied', 'maintenance', 'reserved'],
            default: 'available'
        },
        features: [String],
        floor: Number,
        area: Number // in square meters/feet
    }],
    amenities: [{
        name: String,
        description: String,
        icon: String
    }],
    images: [{
        url: String,
        caption: String
    }],
    rules: [{
        title: String,
        description: String
    }],
    features: [{
        name: String,
        description: String,
        icon: String
    }],
    manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance'],
        default: 'active'
    },
    contactInfo: {
        email: String,
        phone: String,
        website: String
    }
}, {
    timestamps: true
});

// Index for location-based queries
residenceSchema.index({ location: '2dsphere' });

// Method to check room availability
residenceSchema.methods.isRoomAvailable = function(roomNumber) {
    const room = this.rooms.find(r => r.roomNumber === roomNumber);
    return room && room.status === 'available';
};

// Method to get available rooms
residenceSchema.methods.getAvailableRooms = function() {
    return this.rooms.filter(room => room.status === 'available');
};

// Method to update room status
residenceSchema.methods.updateRoomStatus = function(roomNumber, status) {
    const room = this.rooms.find(r => r.roomNumber === roomNumber);
    if (room) {
        room.status = status;
        return true;
    }
    return false;
};

const Residence = mongoose.model('Residence', residenceSchema);

module.exports = Residence; 