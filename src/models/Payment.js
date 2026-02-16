const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const paymentSchema = new mongoose.Schema({
    paymentId: {
        type: String,
        required: true,
        unique: true
    },
    // 🆕 NEW FIELD: User ID for direct debtor mapping
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,                    // ← Made optional for new allocation system
        index: true                        // ← Indexed for performance
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false                    // ← Made optional for new allocation system
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: false                    // ← Made optional for new allocation system
    },
    room: {
        type: String,
        default: 'Not Assigned'
    },
    roomType: {
        type: String,
        default: ''
    },
    rentAmount: {
        type: Number,
        default: 0
    },
    adminFee: {
        type: Number,
        default: 0
    },
    deposit: {
        type: Number,
        default: 0
    },
    amount: {
        type: Number,
        default: 0
    },
    payments: [{
        type: {
            type: String,
            enum: ['rent', 'admin', 'deposit'],
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    totalAmount: {
        type: Number,
        required: false                    // ← Made optional for new allocation system
    },
    paymentMonth: {
        type: String, // Format: "YYYY-MM"
        required: false                    // ← Made optional for new allocation system
    },
    date: {
        type: Date,
        required: false                    // ← Made optional for new allocation system
    },
    method: {
        type: String,
        enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks'],
        required: false                    // ← Made optional for new allocation system
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Failed', 'Verified', 'Rejected', 'Clarification Requested'],
        default: 'Confirmed'
    },
    applicationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'waitlisted', 'expired'],
        default: 'pending'
    },
    description: String,
    proofOfPayment: {
        fileUrl: String,
        fileName: String,
        uploadDate: Date,
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        verificationDate: Date,
        verificationNotes: String
    },
    // 🆕 NEW: Store Smart FIFO allocation results
    allocation: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    clarificationRequests: [{
        message: {
            type: String,
            required: true
        },
        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        requestDate: {
            type: Date,
            default: Date.now
        },
        response: {
            message: String,
            respondedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            responseDate: Date
        }
    }]
}, {
    timestamps: true
});

// Add virtual fields
paymentSchema.virtual('calculatedAmount').get(function() {
    return (this.rentAmount || 0) + (this.adminFee || 0) + (this.deposit || 0);
});

// Pre-save middleware to automatically set amount
paymentSchema.pre('save', function(next) {
    if (this.isModified('rentAmount') || this.isModified('adminFee') || this.isModified('deposit')) {
        this.amount = (this.rentAmount || 0) + (this.adminFee || 0) + (this.deposit || 0);
    }
    next();
});

// Add indexes for common queries
paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ student: 1 });
paymentSchema.index({ user: 1 });         // ← NEW: Index for user field
paymentSchema.index({ residence: 1 });
paymentSchema.index({ date: -1 });

// 🚨 DUPLICATE PREVENTION INDEX
// Compound index to prevent duplicate payments within a time window
paymentSchema.index({
    student: 1, 
    totalAmount: 1, 
    paymentMonth: 1, 
    method: 1,
    createdAt: 1
}, { 
    expireAfterSeconds: 300 // 5 minutes
});

// 🆕 NEW: Compound index for user-based queries
paymentSchema.index({
    user: 1,
    date: -1
});

// Optimize: Compound index for cash flow queries (date range + status + residence)
paymentSchema.index({ date: 1, status: 1, residence: 1 });

// 🆕 NEW: Compound index for user + residence queries
paymentSchema.index({
    user: 1,
    residence: 1,
    date: -1
});

// Add pagination plugin
paymentSchema.plugin(mongoosePaginate);

// 🆕 CRITICAL FIX: Pre-save middleware to ensure user and student fields always match
paymentSchema.pre('save', async function(next) {
    try {
        // If user field is not set, try to set it from student field
        if (!this.user && this.student) {
            this.user = this.student;
        }
        
        // If student field is not set, try to set it from user field
        if (!this.student && this.user) {
            this.student = this.user;
        }
        
        // 🆕 CRITICAL: If both are set but don't match, try to resolve via debtor lookup
        if (this.user && this.student && this.user.toString() !== this.student.toString()) {
            const Debtor = require('./Debtor');
            
            // Try to find debtor by user ID
            let debtor = await Debtor.findOne({ user: this.user });
            
            // If not found, try by student ID
            if (!debtor) {
                debtor = await Debtor.findOne({ user: this.student });
                if (debtor) {
                    // Debtor found by student ID - update user to match
                    console.log(`⚠️  Payment ${this.paymentId}: Found debtor by student ID, updating user field`);
                    this.user = this.student;
                }
            } else {
                // Debtor found by user ID - update student to match
                console.log(`⚠️  Payment ${this.paymentId}: Found debtor by user ID, updating student field`);
                this.student = this.user;
            }
            
            // If still no match and debtor exists, use debtor's user ID
            if (debtor && debtor.user) {
                const debtorUserId = debtor.user.toString();
                if (this.user.toString() !== debtorUserId) {
                    console.log(`⚠️  Payment ${this.paymentId}: Updating both user and student to match debtor.user`);
                    this.user = debtor.user;
                    this.student = debtor.user;
                }
            }
        }
        
        // Final validation: ensure both fields match
        if (this.user && this.student && this.user.toString() !== this.student.toString()) {
            console.warn(`⚠️  Payment ${this.paymentId}: user (${this.user}) and student (${this.student}) still don't match after resolution attempt`);
            // Force them to match - prefer user field
            this.student = this.user;
        }
        
        next();
    } catch (error) {
        console.error(`❌ Error in Payment pre-save hook: ${error.message}`);
        // Don't block save, but log the error
        next();
    }
});

// 🆕 NEW: Virtual for easy debtor lookup
paymentSchema.virtual('debtor', {
    ref: 'Debtor',
    localField: 'user',
    foreignField: 'user',
    justOne: true
});

// 🆕 NEW: Method to get debtor information
paymentSchema.methods.getDebtor = async function() {
    const Debtor = require('./Debtor');
    return await Debtor.findOne({ user: this.user });
};

// 🆕 NEW: Method to validate payment mapping
paymentSchema.methods.validateMapping = async function() {
    const Debtor = require('./Debtor');
    const debtor = await Debtor.findOne({ user: this.user });
    
    if (!debtor) {
        throw new Error(`No debtor found for user ID: ${this.user}`);
    }
    
    return {
        isValid: true,
        debtor: debtor,
        debtorCode: debtor.debtorCode,
        roomNumber: debtor.roomNumber,
        residence: debtor.residence
    };
};

// 🆕 CRITICAL FIX: Ensure double-entry transaction exists after save
// This acts as a safety net to ensure transactions are always created, even if smartFIFOAllocation fails
paymentSchema.post('save', async function(doc) {
    try {
        // Always check if transaction exists, but for new documents, wait a bit to let controller's allocation run first
        if (this.isNew) {
            // For new payments, wait a bit to let the controller's smartFIFOAllocation run first
            // Use setImmediate to run after current execution completes, then setTimeout for additional delay
            setImmediate(async () => {
                // Wait 3 seconds to give allocation service time to complete
                await new Promise(resolve => setTimeout(resolve, 3000));
                await ensurePaymentTransaction(doc);
            });
            return;
        }
        
        // For updates, check immediately
        await ensurePaymentTransaction(doc);
    } catch (hookErr) {
        console.error(`⚠️ Payment post-save hook error for ${doc.paymentId}:`, hookErr.message);
        // Don't throw - payment was saved successfully, transaction creation is secondary
    }
});

// Helper function to ensure payment transaction exists
async function ensurePaymentTransaction(payment) {
    try {
        const TransactionEntry = require('./TransactionEntry');
        const Debtor = require('./Debtor');
        
        // Check if transaction already exists for this payment
        const existingTx = await TransactionEntry.findOne({
            $or: [
                { sourceId: payment._id },
                { 'metadata.paymentId': payment._id.toString() },
                { reference: payment._id.toString() }
            ],
            source: { $in: ['payment', 'advance_payment'] }
        });
        
        if (existingTx) {
            console.log(`✅ Payment ${payment.paymentId} already has transaction: ${existingTx.transactionId}`);
            return;
        }
        
        // If no transaction exists, create a basic payment transaction
        console.log(`⚠️ No transaction found for payment ${payment.paymentId}, creating basic transaction...`);
        
        // Find debtor to get account code
        const userId = payment.user || payment.student;
        if (!userId) {
            console.warn(`⚠️ Payment ${payment.paymentId} has no user/student ID, cannot create transaction`);
            return;
        }
        
        const debtor = await Debtor.findOne({ user: userId });
        if (!debtor) {
            console.warn(`⚠️ No debtor found for user ${userId}, cannot create transaction for payment ${payment.paymentId}`);
            return;
        }
        
        // Determine payment account
        const paymentMethod = payment.method || 'Cash';
        const paymentAccountCode = paymentMethod === 'Bank' || paymentMethod === 'Bank Transfer' ? '1001' : '1000';
        const paymentAccountName = paymentMethod === 'Bank' || paymentMethod === 'Bank Transfer' ? 'Bank Account' : 'Cash';
        
        // Create basic payment transaction
        const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        const paymentTransaction = new TransactionEntry({
            transactionId,
            date: payment.date || new Date(),
            description: `Payment from ${debtor.contactInfo?.name || 'Student'} - ${paymentMethod}`,
            reference: payment._id.toString(),
            entries: [
                // Entry 1: Debit Cash/Bank
                {
                    accountCode: paymentAccountCode,
                    accountName: paymentAccountName,
                    accountType: 'Asset',
                    debit: payment.totalAmount || 0,
                    credit: 0,
                    description: `Payment received from ${debtor.contactInfo?.name || 'Student'} via ${paymentMethod}`
                },
                // Entry 2: Credit AR
                {
                    accountCode: debtor.accountCode,
                    accountName: `Accounts Receivable - ${debtor.contactInfo?.name || 'Student'}`,
                    accountType: 'Asset',
                    debit: 0,
                    credit: payment.totalAmount || 0,
                    description: `Payment allocated to ${debtor.contactInfo?.name || 'Student'} - ${paymentMethod}`
                }
            ],
            totalDebit: payment.totalAmount || 0,
            totalCredit: payment.totalAmount || 0,
            source: 'payment',
            sourceId: payment._id,
            sourceModel: 'Payment',
            residence: payment.residence || debtor.residence,
            createdBy: payment.createdBy || 'system',
            status: 'posted',
            metadata: {
                paymentId: payment._id.toString(),
                studentId: userId.toString(),
                debtorId: debtor._id.toString(),
                paymentType: payment.paymentType || 'rent',
                method: paymentMethod,
                createdByHook: true, // Flag to indicate this was created by the post-save hook
                note: 'Transaction created by Payment post-save hook (fallback)'
            }
        });
        
        await paymentTransaction.save();
        console.log(`✅ Created fallback payment transaction: ${paymentTransaction.transactionId} for payment ${payment.paymentId}`);
        
    } catch (error) {
        console.error(`❌ Error ensuring payment transaction for ${payment.paymentId}:`, error.message);
        // Don't throw - this is a fallback mechanism
    }
}

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment; 