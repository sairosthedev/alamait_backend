const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['Workshop', 'Social', 'Training', 'Safety'],
        required: true
    },
    status: {
        type: String,
        enum: ['Open', 'Required'],
        default: 'Open'
    },
    visibility: {
        type: String,
        enum: ['all', 'private'],
        default: 'all'
    },
    capacity: {
        type: Number,
        default: 50
    },
    requirements: [{
        type: String
    }],
    resources: [{
        type: String
    }],
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    image: {
        url: String,
        caption: String
    },
    feedback: [{
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Add indexes for common queries
eventSchema.index({ residence: 1, date: 1, status: 1 });
eventSchema.index({ 'participants.student': 1, status: 1 });

// Virtual for number of participants
eventSchema.virtual('participantCount').get(function() {
    return this.participants.filter(p => p.status === 'registered').length;
});

// Method to check if event is full
eventSchema.methods.isFull = function() {
    return this.participantCount >= this.capacity;
};

// Method to register participant
eventSchema.methods.registerParticipant = function(studentId) {
    if (this.isFull()) {
        throw new Error('Event is at full capacity');
    }
    
    if (this.participants.some(p => p.student.toString() === studentId.toString())) {
        throw new Error('Student already registered');
    }

    this.participants.push({
        student: studentId,
        status: 'registered'
    });
};

// Method to calculate average rating
eventSchema.methods.getAverageRating = function() {
    if (this.feedback.length === 0) return 0;
    
    const sum = this.feedback.reduce((acc, curr) => acc + curr.rating, 0);
    return sum / this.feedback.length;
};

// Update the updatedAt field before saving
eventSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event; 