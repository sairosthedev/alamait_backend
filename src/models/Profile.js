const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    role: {
        type: String,
        enum: ['admin', 'finance', 'finance_admin', 'finance_user', 'ceo'],
        required: true
    },
    profilePicture: {
        url: {
            type: String,
            required: true
        },
        fileName: {
            type: String,
            required: true
        },
        s3Key: {
            type: String,
            required: true
        },
        size: {
            type: Number,
            required: true
        },
        mimetype: {
            type: String,
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
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

// Index for efficient queries
profileSchema.index({ userId: 1 });
profileSchema.index({ role: 1 });

// Method to update profile picture
profileSchema.methods.updateProfilePicture = function(pictureData) {
    this.profilePicture = pictureData;
    this.updatedAt = new Date();
    return this.save();
};

const Profile = mongoose.model('Profile', profileSchema);

module.exports = Profile;

