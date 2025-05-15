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
    enum: ['admin', 'student'],
    default: 'student'
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
  },
  residence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Residence'
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    console.log('Comparing passwords for user:', this.email);
    console.log('Stored hash length:', this.password.length);
    console.log('Candidate password length:', candidatePassword.length);
    
    // Ensure both passwords exist
    if (!this.password || !candidatePassword) {
      console.error('Missing password data:', {
        hasStoredPassword: !!this.password,
        hasProvidedPassword: !!candidatePassword
      });
      return false;
    }
    
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    console.log('Password comparison result:', isMatch);
    return isMatch;
  } catch (error) {
    console.error('Error comparing passwords:', error);
    // Don't throw, return false for a failed match
    return false;
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