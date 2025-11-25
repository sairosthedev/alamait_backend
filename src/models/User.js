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
    enum: ['admin', 'student', 'finance', 'finance_admin', 'finance_user', 'ceo'],
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
  resetPasswordOtp: String,
  resetPasswordOtpExpires: Date,
  resetPasswordOtpVerified: {
    type: Boolean,
    default: false
  },
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
    enum: ['active', 'inactive', 'suspended', 'expired'],
    default: 'active'
  },
  // Profile fields
  bio: {
    type: String,
    trim: true,
    maxlength: 500
  },
  department: {
    type: String,
    trim: true
  },
  office: {
    type: String,
    trim: true
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

// Pre-save middleware removed - no more auto-creation of StudentAccount or TenantAccount
// We now use the Debtor system for students, created only when applications are approved

// Post-save middleware to create debtor account for students
// REMOVED: Auto-creation of debtor - now only created when application is approved
// This ensures proper linking between application → debtor → residence → room

// 🆕 NEW: Auto-link user to existing applications when user is created
userSchema.post('save', async function(doc) {
    console.log('🔍 POST-SAVE MIDDLEWARE EXECUTING for:', this.firstName, this.lastName);
    try {
        // Run this for newly created users OR when application code exists
        console.log(`🔍 Checking middleware conditions:`);
        console.log(`   isNew: ${this.isNew}`);
        console.log(`   applicationCode: ${this.applicationCode}`);
        console.log(`   Condition result: ${this.isNew || this.applicationCode}`);
        
        if (this.isNew || this.applicationCode) {
            console.log(`🔗 Auto-linking middleware triggered for: ${this.firstName} ${this.lastName}`);
            
            // Check if there are any applications with matching email or application code but no student field
            const Application = require('./Application');
            console.log(`   🔍 Looking for applications with:`);
            console.log(`      Email: ${this.email}`);
            console.log(`      Application Code: ${this.applicationCode}`);
            
            const applicationsToLink = await Application.find({
                $and: [
                    { $or: [{ email: this.email }, { applicationCode: this.applicationCode }] },
                    { $or: [{ student: { $exists: false } }, { student: null }, { student: undefined }] }
                ]
            });
            
            console.log(`   📋 Found ${applicationsToLink.length} applications to link`);
            
            if (applicationsToLink.length > 0) {
                console.log(`   📋 Found ${applicationsToLink.length} applications to link`);
                
                for (const application of applicationsToLink) {
                    try {
                        // Update the application with the student field
                        application.student = this._id;
                        await application.save();
                        
                        console.log(`   ✅ Linked application ${application._id} to user ${this._id}`);
                        console.log(`      Application: ${application.firstName} ${application.lastName}`);
                        console.log(`      Status: ${application.status}`);
                        console.log(`      Room: ${application.allocatedRoom}`);
                        
                        // If application is approved, create debtor account
                        if (application.status === 'approved') {
                            console.log(`   🏗️  Application is approved, creating debtor account...`);
                            
                            try {
                                const { createDebtorForStudent } = require('../services/debtorService');
                                
                                // Pass the FULL application object so debtor service can extract all data
                                const debtor = await createDebtorForStudent(this, {
                                    createdBy: this._id,
                                    application: application._id,           // Application ID
                                    applicationCode: application.applicationCode,  // Application code
                                    // Let the debtor service extract data from the application
                                    // Don't pass individual fields - let it use the application object
                                });
                                
                                if (debtor) {
                                    console.log(`   ✅ Created debtor account: ${debtor.debtorCode}`);
                                    
                                    // Link the debtor back to the application
                                    application.debtor = debtor._id;
                                    await application.save();
                                    console.log(`   🔗 Linked debtor ${debtor._id} to application ${application._id}`);
                                    
                                    // 🆕 TRIGGER RENTAL ACCRUAL SERVICE - Lease starts now!
                                    try {
                                        console.log(`   🏠 Triggering rental accrual service for lease start...`);
                                        const RentalAccrualService = require('../services/rentalAccrualService');
                                        
                                        const accrualResult = await RentalAccrualService.processLeaseStart(application);
                                        
                                        if (accrualResult && accrualResult.success) {
                                            console.log(`   ✅ Rental accrual service completed successfully`);
                                            console.log(`      - Initial accounting entries created`);
                                            console.log(`      - Prorated rent, admin fees, and deposits recorded`);
                                            console.log(`      - Lease start transaction: ${accrualResult.transactionId || 'N/A'}`);
                                        } else {
                                            console.log(`   ⚠️  Rental accrual service completed with warnings:`, accrualResult?.error || 'Unknown issue');
                                        }
                                    } catch (accrualError) {
                                        console.error(`   ❌ Error in rental accrual service:`, accrualError.message);
                                        // Don't fail the registration process if accrual fails
                                        console.log(`   ℹ️  Student registration completed, but rental accrual failed. Manual intervention may be needed.`);
                                    }
                                }
                            } catch (debtorError) {
                                console.error(`   ❌ Error creating debtor account:`, debtorError.message);
                            }
                        }
                        
                    } catch (linkError) {
                        console.error(`   ❌ Error linking application ${application._id}:`, linkError.message);
                    }
                }
                
                console.log(`   🎯 Auto-linking completed for ${this.firstName} ${this.lastName}`);
                
            } else {
                console.log(`   ℹ️  No applications found to link for ${this.email}`);
            }
        }
    } catch (error) {
        console.error(`❌ Error in auto-linking middleware for ${this.firstName} ${this.lastName}:`, error);
        // Don't throw error to prevent user creation from failing
    }
});

// createStudentAccount method removed - we now use the Debtor system

// Method to create tenant account
userSchema.methods.createTenantAccount = async function() {
    try {
        // Check if TenantAccount model exists
        let TenantAccount;
        try {
            TenantAccount = require('./TenantAccount');
        } catch (error) {
            console.log('TenantAccount model not found, skipping tenant account creation');
            return null;
        }
        
        const Account = require('./Account');
        
        // Check if account already exists
        const existingAccount = await TenantAccount.findOne({ tenant: this._id });
        if (existingAccount) {
            console.log(`Tenant account already exists for ${this.firstName} ${this.lastName}`);
            return existingAccount;
        }
        
        // Create tenant account
        const tenantAccount = new TenantAccount({
            tenant: this._id,
            balance: 0,
            notes: `Auto-created account for tenant ${this.firstName} ${this.lastName}`,
            createdBy: this._id // Self-created
        });
        
        await tenantAccount.save();
        
        // Create corresponding chart of accounts entry
        const chartAccount = new Account({
            code: tenantAccount.accountCode,
            name: `Tenant Account - ${this.firstName} ${this.lastName}`,
            type: 'Asset'
        });
        
        await chartAccount.save();
        
        console.log(`✅ Auto-created tenant account for ${this.firstName} ${this.lastName} (${tenantAccount.accountCode})`);
        return tenantAccount;
        
    } catch (error) {
        console.error(`❌ Error creating tenant account for ${this.firstName} ${this.lastName}:`, error);
        // Don't throw error to prevent user creation from failing
        return null;
    }
};

// Method to compare password
// Supports both plain text passwords and client-side pre-hashed passwords (SHA-256)
// Handles backward compatibility: existing users have bcrypt(plain), new users have bcrypt(SHA256)
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    const { isSha256Hash, hashPasswordSha256 } = require('../utils/clientPasswordHash');
    
    // Handle both old format (bcrypt(plain)) and new format (bcrypt(SHA256))
    if (isSha256Hash(candidatePassword)) {
      // Client sent SHA-256 hash
      // Try 1: Compare SHA-256 hash directly (for new users with bcrypt(SHA256))
      const matchWithHash = await bcrypt.compare(candidatePassword, this.password);
      if (matchWithHash) {
        console.log('✅ Password match: SHA-256 hash with bcrypt(SHA256) format');
        return true;
      }
      
      // Try 2: If hash doesn't match, the stored password might be old format (bcrypt(plain))
      // We can't reverse SHA-256, but we can store the hash and flag for special handling
      // The frontend will need to retry with plain text or the user needs to reset password
      console.log('❌ Password mismatch: SHA-256 hash sent but stored password format mismatch');
      console.log('   Possible causes:');
      console.log('   1. User has old password format (bcrypt(plain)) - needs plain text login or reset');
      console.log('   2. Password is incorrect');
      this._formatMismatch = true;
      this._receivedSha256Hash = candidatePassword; // Store for potential plain text retry check
      return false;
    } else {
      // Client sent plain text password
      // Try 1: Compare plain text directly (for existing users with bcrypt(plain))
      const matchWithPlain = await bcrypt.compare(candidatePassword, this.password);
      if (matchWithPlain) {
        console.log('✅ Password match: Plain text with bcrypt(plain) format');
        // Flag for migration - user logged in with plain text (old format)
        this._plainPasswordLogin = true;
        this._plainPasswordForMigration = candidatePassword;
        return true;
      }
      
      // Try 2: Hash with SHA-256 and compare (for new users with bcrypt(SHA256))
      const hashedPassword = hashPasswordSha256(candidatePassword);
      const matchWithHashed = await bcrypt.compare(hashedPassword, this.password);
      if (matchWithHashed) {
        console.log('✅ Password match: Plain text with bcrypt(SHA256) format');
        return true;
      }
      
      console.log('❌ Password mismatch: Plain text does not match stored password');
    }
    
    return false;
  } catch (error) {
    console.error('Error in comparePassword:', error);
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