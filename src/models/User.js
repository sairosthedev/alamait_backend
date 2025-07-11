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
    enum: ['admin', 'student', 'finance', 'finance_admin', 'finance_user'],
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
    sparse: true
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
  roomApprovalDate: {
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
  },
  currentBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  maintenanceRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Maintenance'
  }],
  paymentHistory: [{
    date: Date,
    amount: Number,
    type: String,
    status: String,
    reference: String
  }],
  lastPayment: {
    date: Date,
    amount: Number,
    status: String
  },
  documents: [{
    type: String,
    name: String,
    uploadedAt: Date
  }],
  preferences: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: true
      }
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  // Signed lease fields
  signedLeasePath: {
    type: String,
    default: null
  },
  signedLeaseUploadDate: {
    type: Date,
    default: null
  },
  leases: [{
    filename: String,
    originalname: String,
    path: String,
    mimetype: String,
    size: Number,
    uploadedAt: Date
  }]
}, {
  timestamps: true
});

// Indexes for common queries
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ residence: 1 });
userSchema.index({ currentRoom: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for active maintenance requests
userSchema.virtual('activeMaintenanceRequests').get(function() {
  return this.maintenanceRequests.filter(req => req.status !== 'completed').length;
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
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Method to update last login
userSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save();
};

// Method to add maintenance request
userSchema.methods.addMaintenanceRequest = async function(maintenanceId) {
  this.maintenanceRequests.push(maintenanceId);
  await this.save();
};

// Method to add payment record
userSchema.methods.addPayment = async function(payment) {
  this.paymentHistory.push(payment);
  this.lastPayment = {
    date: payment.date,
    amount: payment.amount,
    status: payment.status
  };
  await this.save();
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