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
        street: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        },
        country: {
            type: String,
            required: true
        }
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true,
            validate: {
                validator: function(v) {
                    return v.length === 2 && 
                           v[0] >= -180 && v[0] <= 180 && 
                           v[1] >= -90 && v[1] <= 90;
                },
                message: 'Coordinates must be valid [longitude, latitude] values'
            }
        }
    },
    rooms: [{
        roomNumber: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['single', 'double', 'studio', 'apartment', 'triple', 'quad', 'Six-person room', 'six', 'fife'],
            required: true
        },
        capacity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        status: {
            type: String,
            enum: ['available', 'occupied', 'maintenance', 'reserved'],
            default: 'available'
        },
        currentOccupancy: {
            type: Number,
            default: 0,
            min: 0
        },
        features: [String],
        amenities: [String],
        floor: {
            type: Number,
            required: true,
            min: 0
        },
        area: {
            type: Number,
            required: true,
            min: 0
        },
        images: [String],
        occupants: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        maintenance: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Maintenance'
        }],
        lastCleaned: Date,
        nextMaintenance: Date,
        averageOccupancy: {
            type: Number,
            default: 0,
            min: 0
        },
        maintenanceRequests: {
            type: Number,
            default: 0,
            min: 0
        },
        cleaningFrequency: {
            type: String,
            enum: ['daily', 'weekly', 'biweekly', 'monthly'],
            default: 'weekly'
        }
    }],
    amenities: [{
        name: {
            type: String,
            required: true
        },
        description: String,
        icon: String
    }],
    images: [{
        url: {
            type: String,
            required: true
        },
        caption: String
    }],
    rules: [{
        title: {
            type: String,
            required: true
        },
        description: String
    }],
    features: [{
        name: {
            type: String,
            required: true
        },
        description: String,
        icon: String
    }],
    manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance'],
        default: 'active'
    },
    contactInfo: {
        email: {
            type: String,
            trim: true,
            lowercase: true
        },
        phone: String,
        website: String
    }
}, {
    timestamps: true
});

// Index for location-based queries
residenceSchema.index({ location: '2dsphere' });

// Virtual for total rooms
residenceSchema.virtual('totalRooms').get(function() {
    return this.rooms.length;
});

// Method to update room occupancy
residenceSchema.methods.updateRoomOccupancy = async function(roomNumber, occupancy) {
    const room = this.rooms.find(r => r.roomNumber === roomNumber);
    if (room) {
        room.currentOccupancy = occupancy;
        room.status = occupancy >= room.capacity ? 'occupied' : 'available';
        await this.save();
    }
};

// Method to add maintenance request
residenceSchema.methods.addMaintenanceRequest = async function(roomNumber, maintenanceId) {
    const room = this.rooms.find(r => r.roomNumber === roomNumber);
    if (room) {
        room.maintenance.push(maintenanceId);
        room.maintenanceRequests += 1;
        await this.save();
    }
};

const Residence = mongoose.model('Residence', residenceSchema);

module.exports = Residence; 