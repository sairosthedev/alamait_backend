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
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
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
        enum: ['social', 'academic', 'sports', 'cultural', 'other'],
        required: true
    },
    organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    capacity: {
        type: Number,
        required: true
    },
    participants: [{
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['registered', 'attended', 'cancelled'],
            default: 'registered'
        },
        registeredAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
        default: 'upcoming'
    },
    image: {
        url: String,
        caption: String
    },
    requirements: [String],
    resources: [{
        name: String,
        url: String
    }],
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
    }]
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

const Event = mongoose.model('Event', eventSchema);

module.exports = Event; 