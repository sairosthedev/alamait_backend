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
            enum: ['single', 'double', 'studio', 'apartment', 'triple', 'quad'],
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
        currentOccupancy: {
            type: Number,
            default: 0
        },
        capacity: {
            type: Number,
            default: function() {
                // Set default capacity based on room type
                switch(this.type) {
                    case 'single': return 1;
                    case 'double': return 2;
                    case 'studio': return 1;
                    case 'apartment': return 4;
                    case 'triple': return 3;
                    case 'quad': return 4;
                    default: return 1;
                }
            }
        },
        features: [String],
        amenities: [String],
        floor: Number,
        area: Number, // in square meters/feet
        images: [String] // Add the images field as an array of strings
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

// Method to increment room occupancy
residenceSchema.methods.incrementRoomOccupancy = function(roomNumber) {
    const room = this.rooms.find(r => r.roomNumber === roomNumber);
    if (room && room.currentOccupancy < room.capacity) {
        room.currentOccupancy += 1;
        // If room is now at capacity, update status
        if (room.currentOccupancy >= room.capacity) {
            room.status = 'occupied';
        }
        return true;
    }
    return false;
};

// Method to decrement room occupancy
residenceSchema.methods.decrementRoomOccupancy = function(roomNumber) {
    const room = this.rooms.find(r => r.roomNumber === roomNumber);
    if (room && room.currentOccupancy > 0) {
        room.currentOccupancy -= 1;
        // If room was at capacity but now has space, update status
        if (room.currentOccupancy < room.capacity && room.status === 'occupied') {
            room.status = 'available';
        }
        return true;
    }
    return false;
};

// Pre-save hook to ensure room status is consistent with occupancy
residenceSchema.pre('save', function(next) {
    // Update room status based on occupancy for all rooms
    this.rooms.forEach(room => {
        if (room.currentOccupancy === 0) {
            room.status = 'available';
        } else if (room.currentOccupancy >= room.capacity) {
            room.status = 'occupied';
        } else if (room.currentOccupancy > 0 && room.currentOccupancy < room.capacity) {
            room.status = 'reserved';
        }
    });
    next();
});

const Residence = mongoose.model('Residence', residenceSchema);

module.exports = Residence; 