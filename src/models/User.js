const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'admin', 'property_manager'],
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  applicationCode: {
    type: String,
    sparse: true // Allows null values while maintaining uniqueness
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  currentRoom: {
    type: String,
    default: null
  },
  roomValidUntil: {
    type: Date,
    default: null
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    ('Comparing passwords for user:', this.email);
    ('Stored hashed password:', this.password);
    ('Candidate password length:', candidatePassword.length);
    
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    ('Password comparison result:', isMatch);
    return isMatch;
  } catch (error) {
    console.error('Error comparing passwords:', error);
    throw new Error('Error comparing passwords');
  }
};

// Method to get public profile (excludes sensitive information)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.applicationCode;
  return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User; 