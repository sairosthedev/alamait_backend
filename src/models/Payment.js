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
// BUT: We must be careful not to create duplicates if smartFIFOAllocation already created a transaction
paymentSchema.post('save', async function(doc) {
    try {
        // 🆕 CRITICAL FIX: Check if smartFIFOAllocation will be used BEFORE doing anything
        // This prevents duplicate transactions that would overstate cash received
        const Payment = require('./Payment');
        const TransactionEntry = require('./TransactionEntry');
        
        // Check both the doc passed to hook AND reload from database
        const hasPaymentsInDoc = doc.payments && Array.isArray(doc.payments) && doc.payments.length > 0;
        const hasAllocationFlagInDoc = doc.metadata?.smartFIFOAllocationCalled === true;
        const hasAllocationDataInDoc = doc.allocation && Object.keys(doc.allocation || {}).length > 0;
        
        // Check if ANY transaction already exists (advance_payment OR payment)
        const paymentIdObj = doc._id;
        const paymentIdStr = doc._id.toString();
        const existingTx = await TransactionEntry.findOne({
            $or: [
                { sourceId: paymentIdObj },
                { sourceId: paymentIdStr },
                { 'metadata.paymentId': paymentIdStr },
                { 'metadata.paymentId': doc.paymentId },
                { reference: paymentIdStr },
                { reference: doc.paymentId }
            ],
            status: { $ne: 'reversed' }
        });
        
        // Reload payment to get latest data
        let latestPayment = doc;
        try {
            const reloaded = await Payment.findById(doc._id).select('payments metadata allocation').lean();
            if (reloaded) {
                latestPayment = { ...doc, ...reloaded };
            }
        } catch (reloadError) {
            console.warn(`⚠️ Could not reload payment in hook: ${reloadError.message}`);
        }
        
        const hasPaymentsArray = latestPayment.payments && Array.isArray(latestPayment.payments) && latestPayment.payments.length > 0;
        const hasAllocationFlag = latestPayment.metadata?.smartFIFOAllocationCalled === true;
        const hasAllocationData = latestPayment.allocation && Object.keys(latestPayment.allocation || {}).length > 0;
        
        // 🆕 CRITICAL: If transaction already exists, skip hook entirely
        if (existingTx) {
            console.log(`✅ Payment ${doc.paymentId} already has transaction: ${existingTx.transactionId} (${existingTx.source})`);
            console.log(`   ✅ NOT creating fallback transaction - transaction already exists`);
            return; // Skip hook entirely if transaction exists
        }
        
        // 🆕 CRITICAL: If smartFIFOAllocation was called AND succeeded (has allocation data), skip hook
        // But if it was called but failed (no transaction, no allocation data), we need to create fallback
        if (hasAllocationFlag && hasAllocationData) {
            console.log(`✅ Payment ${doc.paymentId} - smartFIFOAllocation completed successfully`);
            console.log(`   ✅ NOT creating fallback transaction - smartFIFOAllocation handled it`);
            return; // Skip hook if allocation completed successfully
        }
        
        // 🆕 CRITICAL: If payments array exists but smartFIFOAllocation hasn't been called yet,
        // we need to wait for it to run, then check if transaction was created
        // If it fails, we'll create a fallback
        if (hasPaymentsInDoc || hasPaymentsArray) {
            console.log(`⏳ Payment ${doc.paymentId} has payments array - smartFIFOAllocation will be called`);
            console.log(`   ⏳ Waiting for smartFIFOAllocation to complete, then checking if transaction exists...`);
            
            // For new payments with payments array, wait for smartFIFOAllocation to complete
            if (this.isNew) {
                setImmediate(async () => {
                    // Wait longer for smartFIFOAllocation to complete (it can take time)
                    const initialWait = 15000; // 15 seconds
                    
                    console.log(`⏳ Payment ${doc.paymentId} post-save hook: waiting ${initialWait/1000}s for smartFIFOAllocation`);
                    
                    await new Promise(resolve => setTimeout(resolve, initialWait));
                    
                    // After waiting, check if transaction was created
                    const finalCheckTx = await TransactionEntry.findOne({
                        $or: [
                            { sourceId: paymentIdObj },
                            { sourceId: paymentIdStr },
                            { 'metadata.paymentId': paymentIdStr },
                            { 'metadata.paymentId': doc.paymentId },
                            { reference: paymentIdStr },
                            { reference: doc.paymentId }
                        ],
                        status: { $ne: 'reversed' }
                    });
                    
                    if (finalCheckTx) {
                        console.log(`✅ Payment ${doc.paymentId} - Transaction found after wait: ${finalCheckTx.transactionId} (${finalCheckTx.source})`);
                        console.log(`   ✅ NOT creating fallback - smartFIFOAllocation created transaction`);
                        return; // Transaction exists, skip fallback
                    }
                    
                    // No transaction found - create fallback
                    console.log(`⚠️ Payment ${doc.paymentId} - No transaction found after smartFIFOAllocation wait`);
                    console.log(`   🔄 Creating fallback transaction...`);
                    await ensurePaymentTransaction(doc);
                });
                return;
            }
        }
        
        // Only run hook for payments that DON'T use smartFIFOAllocation
        // Always check if transaction exists, but for new documents, wait longer to let controller's allocation run first
        if (this.isNew) {
            // For new payments, wait longer to let the controller's smartFIFOAllocation run first
            // Use setImmediate to run after current execution completes, then setTimeout for additional delay
            setImmediate(async () => {
                // Wait before checking to give any allocation process time to complete
                const initialWait = 10000; // 10 seconds
                
                console.log(`⏳ Payment ${doc.paymentId} post-save hook: waiting ${initialWait/1000}s before checking for transactions`);
                console.log(`   ℹ️ This payment does NOT use smartFIFOAllocation - will create fallback if needed`);
                
                await new Promise(resolve => setTimeout(resolve, initialWait));
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
        const Payment = require('./Payment');
        
        // 🆕 CRITICAL FIX: Reload payment from database to get latest metadata flag
        // The payment object passed to this function may be stale (from first save)
        // We need to check the latest version in the database
        let latestPayment = payment;
        try {
            const reloaded = await Payment.findById(payment._id).select('metadata allocation payments').lean();
            if (reloaded) {
                latestPayment = { ...payment, ...reloaded }; // Merge to keep all fields
                console.log(`🔄 Reloaded payment ${payment.paymentId} to check for smartFIFOAllocation flag`);
            }
        } catch (reloadError) {
            console.warn(`⚠️ Could not reload payment: ${reloadError.message}`);
            // Continue with original payment object
        }
        
        // 🆕 CRITICAL FIX: Check if smartFIFOAllocation was actually called (not just might be called)
        // Only skip fallback if smartFIFOAllocation was definitely called:
        // 1. Metadata flag set (smartFIFOAllocationCalled = true) - means controller called it
        // 2. Allocation field exists (smartFIFOAllocation completed successfully)
        // DO NOT check for payments array - that's not reliable (allocation might fail or not be called)
        const smartFIFOCalled = latestPayment.metadata?.smartFIFOAllocationCalled === true;
        const hasAllocation = latestPayment.allocation && Object.keys(latestPayment.allocation || {}).length > 0;
        const willCallSmartFIFO = smartFIFOCalled || hasAllocation; // Only if actually called, not just might be called
        
        if (willCallSmartFIFO) {
            console.log(`✅ Payment ${payment.paymentId} has smartFIFOAllocation - will NOT create fallback transaction`);
            if (smartFIFOCalled) {
                console.log(`   smartFIFOAllocation flag set at: ${latestPayment.metadata?.smartFIFOAllocationCalledAt}`);
            }
            if (hasAllocation) {
                console.log(`   Allocation data exists (smartFIFOAllocation completed)`);
            }
            console.log(`   Will only check if transaction exists, not create fallback`);
        } else {
            const hasPaymentsArray = latestPayment.payments && Array.isArray(latestPayment.payments) && latestPayment.payments.length > 0;
            if (hasPaymentsArray) {
                console.log(`ℹ️ Payment ${payment.paymentId} has payments array but smartFIFOAllocation was not called`);
                console.log(`   This may indicate smartFIFOAllocation failed or was skipped`);
                console.log(`   Will create fallback transaction if no transaction exists`);
            }
        }
        
        const baseRetries = 7;
        const maxRetries = willCallSmartFIFO ? 15 : baseRetries; // Many more retries if smartFIFO will be called
        const retryDelay = 2000; // 2 seconds between retries
        
        if (hasAllocation) {
            console.log(`ℹ️ Payment ${payment.paymentId} has allocation data - smartFIFOAllocation was called`);
            console.log(`   Will check more carefully for advance_payment transactions (${maxRetries} retries)`);
        }
        
        // 🆕 CRITICAL FIX: Check for ANY transaction related to this payment, including advance payments
        // Priority: Check for advance_payment FIRST (created by smartFIFOAllocation)
        // If advance_payment exists, DO NOT create a fallback payment transaction
        // Check multiple times with increasing delays to catch transactions created by allocation service
        let existingTx = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            // 🆕 CRITICAL FIX: Check for advance_payment transactions FIRST (these are created by smartFIFOAllocation)
            // If an advance_payment exists, we should NOT create a fallback payment transaction
            // Check with multiple query patterns to catch all possible matches
            const paymentIdStr = payment._id.toString();
            const paymentIdObj = payment._id;
            
            existingTx = await TransactionEntry.findOne({
                $or: [
                    // Match by sourceId (ObjectId or string)
                    { sourceId: paymentIdObj },
                    { sourceId: paymentIdStr },
                    // Match by metadata.paymentId
                    { 'metadata.paymentId': paymentIdStr },
                    { 'metadata.paymentId': payment.paymentId },
                    // Match by reference
                    { reference: paymentIdStr },
                    { reference: payment.paymentId },
                    // Match by sourceModel + sourceId
                    { sourceModel: 'Payment', sourceId: paymentIdObj },
                    { sourceModel: 'Payment', sourceId: paymentIdStr }
                ],
                source: { $in: ['payment', 'advance_payment'] },
                status: { $ne: 'reversed' } // Don't count reversed transactions
            });
            
            if (existingTx) {
                console.log(`✅ Payment ${payment.paymentId} already has transaction: ${existingTx.transactionId} (source: ${existingTx.source})`);
                if (existingTx.source === 'advance_payment') {
                    console.log(`   ℹ️ Advance payment transaction exists - this will be allocated when accruals are created`);
                    console.log(`   ℹ️ No fallback payment transaction needed`);
                    console.log(`   ✅ Skipping fallback payment transaction creation`);
                } else {
                    console.log(`   ℹ️ Payment transaction already exists - no fallback needed`);
                }
                return; // Don't create fallback if any transaction exists
            }
            
            // If not found and not last attempt, wait before retrying
            if (attempt < maxRetries - 1) {
                console.log(`⏳ Transaction not found for payment ${payment.paymentId}, waiting ${retryDelay}ms before retry ${attempt + 2}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
        
        // 🆕 CRITICAL FIX: Final check specifically for advance_payment (in case it was created between retries)
        // This is critical because advance_payment transactions are created by smartFIFOAllocation
        // and we should NEVER create a duplicate payment transaction if an advance_payment exists
        console.warn(`⚠️ No transaction found for payment ${payment.paymentId} after ${maxRetries} attempts`);
        console.warn(`   Performing final check for advance_payment before creating fallback...`);
        
        // Final check with comprehensive query patterns
        const paymentIdStr = payment._id.toString();
        const paymentIdObj = payment._id;
        
        const finalAdvanceCheck = await TransactionEntry.findOne({
            $or: [
                // Match by sourceId (ObjectId or string)
                { sourceId: paymentIdObj },
                { sourceId: paymentIdStr },
                // Match by metadata.paymentId
                { 'metadata.paymentId': paymentIdStr },
                { 'metadata.paymentId': payment.paymentId },
                // Match by reference
                { reference: paymentIdStr },
                { reference: payment.paymentId },
                // Match by sourceModel + sourceId
                { sourceModel: 'Payment', sourceId: paymentIdObj },
                { sourceModel: 'Payment', sourceId: paymentIdStr }
            ],
            source: 'advance_payment',
            status: { $ne: 'reversed' }
        });
        
        if (finalAdvanceCheck) {
            console.log(`✅ Found advance_payment transaction ${finalAdvanceCheck.transactionId} - skipping fallback payment transaction`);
            console.log(`   ℹ️ Advance payment will be allocated when accruals are created`);
            console.log(`   ℹ️ Only ONE transaction should exist (the advance_payment)`);
            return; // Don't create fallback if advance_payment exists
        }
        
        // 🆕 CRITICAL FIX: If smartFIFOAllocation will be called, DO NOT create fallback transaction
        // smartFIFOAllocation handles transaction creation, and creating a fallback would cause duplicates
        // This is CRITICAL: Creating both would overstate cash received (double-counting)
        if (willCallSmartFIFO) {
            console.log(`⚠️ No transaction found for payment ${payment.paymentId}, but smartFIFOAllocation will be called`);
            console.log(`   ⚠️ This may indicate smartFIFOAllocation failed or is still processing`);
            console.log(`   ⚠️ NOT creating fallback transaction to avoid duplicates and overstating cash`);
            console.log(`   ⚠️ If no transaction appears, check smartFIFOAllocation logs for errors`);
            return; // Don't create fallback if smartFIFOAllocation will be called
        }
        
        // 🆕 CRITICAL: One more check for advance_payment before creating fallback
        // This is the absolute last check - if advance_payment exists, NEVER create fallback
        // Creating both would overstate cash received (both would debit cash)
        const absoluteFinalCheck = await TransactionEntry.findOne({
            $or: [
                { sourceId: paymentIdObj },
                { sourceId: paymentIdStr },
                { 'metadata.paymentId': paymentIdStr },
                { 'metadata.paymentId': payment.paymentId },
                { reference: paymentIdStr },
                { reference: payment.paymentId },
                { sourceModel: 'Payment', sourceId: paymentIdObj },
                { sourceModel: 'Payment', sourceId: paymentIdStr }
            ],
            source: 'advance_payment',
            status: { $ne: 'reversed' }
        });
        
        if (absoluteFinalCheck) {
            console.log(`🚨 CRITICAL: Found advance_payment transaction ${absoluteFinalCheck.transactionId} in absolute final check`);
            console.log(`   🚨 NOT creating fallback - this would overstate cash received`);
            console.log(`   🚨 Only ONE transaction should exist (the advance_payment)`);
            return; // NEVER create fallback if advance_payment exists
        }
        
        // Only create fallback if NO transaction exists AND smartFIFOAllocation was NOT called
        // AND no advance_payment exists (triple-checked)
        console.warn(`   No advance_payment found after all checks - creating fallback transaction`);
        console.warn(`   ⚠️ This should only happen if smartFIFOAllocation failed or was not called`);
        
        // Find debtor to get account code
        const userId = payment.user || payment.student;
        if (!userId) {
            console.warn(`⚠️ Payment ${payment.paymentId} has no user/student ID, cannot create transaction`);
            return;
        }
        
        let debtor = await Debtor.findOne({ user: userId });
        
        // 🆕 CRITICAL FIX: If no debtor exists, try to create one from payment data
        if (!debtor) {
            console.log(`⚠️ No debtor found for user ${userId}, attempting to create one...`);
            
            try {
                const User = require('./User');
                const user = await User.findById(userId);
                
                if (user) {
                    const { createDebtorForStudent } = require('../services/debtorService');
                    
                    debtor = await createDebtorForStudent(user, {
                        residenceId: payment.residence,
                        roomNumber: payment.room || 'TBD',
                        createdBy: payment.createdBy || 'system',
                        startDate: payment.date || new Date(),
                        roomPrice: payment.totalAmount,
                        notes: 'Created automatically from payment transaction creation'
                    });
                    
                    console.log(`✅ Created debtor ${debtor.debtorCode} for payment transaction`);
                    
                    // Update payment to match debtor user ID
                    if (debtor.user && debtor.user.toString() !== userId.toString()) {
                        payment.user = debtor.user;
                        payment.student = debtor.user;
                        await payment.save();
                        console.log(`✅ Updated payment to match debtor user ID`);
                    }
                } else {
                    console.warn(`⚠️ User ${userId} not found, cannot create debtor or transaction`);
                    return;
                }
            } catch (debtorError) {
                console.error(`❌ Error creating debtor for payment ${payment.paymentId}:`, debtorError.message);
                // Continue anyway - we'll try to create transaction with basic account code
            }
        }
        
        // 🆕 CRITICAL: Final check RIGHT BEFORE creating transaction
        // This is the absolute last chance to prevent duplicate - check one more time
        // Creating both advance_payment and payment would overstate cash received
        const lastSecondCheck = await TransactionEntry.findOne({
            $or: [
                { sourceId: paymentIdObj },
                { sourceId: paymentIdStr },
                { 'metadata.paymentId': paymentIdStr },
                { 'metadata.paymentId': payment.paymentId },
                { reference: paymentIdStr },
                { reference: payment.paymentId },
                { sourceModel: 'Payment', sourceId: paymentIdObj },
                { sourceModel: 'Payment', sourceId: paymentIdStr }
            ],
            source: { $in: ['payment', 'advance_payment'] },
            status: { $ne: 'reversed' }
        });
        
        if (lastSecondCheck) {
            console.log(`🚨 CRITICAL: Found existing transaction ${lastSecondCheck.transactionId} (source: ${lastSecondCheck.source}) RIGHT BEFORE creating fallback`);
            console.log(`   🚨 NOT creating fallback - this would overstate cash received`);
            console.log(`   🚨 Only ONE transaction should exist`);
            return; // NEVER create fallback if any transaction exists
        }
        
        // 🆕 CRITICAL: Determine if this should be an advance payment transaction
        // Check if payment has payments array (indicates it should use smartFIFOAllocation)
        // If smartFIFOAllocation failed or wasn't called, create advance_payment transaction
        const hasPaymentsArray = payment.payments && Array.isArray(payment.payments) && payment.payments.length > 0;
        const isAdvancePayment = hasPaymentsArray; // If payments array exists, treat as advance payment
        
        // Determine payment account
        const paymentMethod = payment.method || 'Cash';
        const paymentAccountCode = paymentMethod === 'Bank' || paymentMethod === 'Bank Transfer' ? '1001' : '1000';
        const paymentAccountName = paymentMethod === 'Bank' || paymentMethod === 'Bank Transfer' ? 'Bank Account' : 'Cash';
        
        // Create transaction ID
        const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        // 🆕 CRITICAL FIX: Use accountCode from payment document if available (from payload)
        // This ensures we use the correct account code that matches accruals
        let arAccountCode = payment.accountCode || payment.debtorAccountCode; // Check payment document first
        
        if (!arAccountCode && debtor?.accountCode) {
            // Fallback to debtor account code
            arAccountCode = debtor.accountCode;
            console.log(`✅ Using debtor account code: ${arAccountCode}`);
        } else if (!arAccountCode) {
            // Last resort: use user ID format
            arAccountCode = `1100-${userId.toString()}`;
            console.warn(`⚠️ No accountCode in payment or debtor - using user ID format: ${arAccountCode}`);
        } else {
            console.log(`✅ Using accountCode from payment document: ${arAccountCode}`);
        }
        
        const arAccountName = debtor?.contactInfo?.name 
            ? `Accounts Receivable - ${debtor.contactInfo.name}` 
            : `Accounts Receivable - Student`;
        
        const studentName = debtor?.contactInfo?.name || 'Student';
        
        // 🆕 CRITICAL FIX: Check for accruals BEFORE determining payment type
        // If accrual exists for payment month, this should be a regular payment, not advance
        let shouldCreateAdvancePayment = isAdvancePayment;
        if (isAdvancePayment && arAccountCode && payment.paymentMonth) {
            console.log(`🔍 Checking for accruals for payment month: ${payment.paymentMonth}`);
            console.log(`   Using account code: ${arAccountCode}`);
            
            try {
                const TransactionEntry = require('./TransactionEntry');
                const paymentMonthDate = new Date(payment.paymentMonth + '-01'); // Parse YYYY-MM format
                const paymentMonthStart = new Date(paymentMonthDate.getFullYear(), paymentMonthDate.getMonth(), 1);
                const paymentMonthEnd = new Date(paymentMonthDate.getFullYear(), paymentMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);
                
                // Check for accrual in payment month
                const accrualForMonth = await TransactionEntry.findOne({
                    'entries.accountCode': arAccountCode,
                    source: { $in: ['rental_accrual', 'lease_start'] },
                    status: { $ne: 'reversed' },
                    voided: { $ne: true },
                    date: {
                        $gte: paymentMonthStart,
                        $lte: paymentMonthEnd
                    }
                }).lean();
                
                if (accrualForMonth) {
                    console.warn(`⚠️  WARNING: Accrual found for payment month ${payment.paymentMonth}!`);
                    console.warn(`   Accrual ID: ${accrualForMonth._id}`);
                    console.warn(`   Accrual Date: ${accrualForMonth.date}`);
                    console.warn(`   This payment should NOT be an advance payment - it should settle the accrual!`);
                    console.warn(`   ⚠️ Creating REGULAR payment transaction instead of advance payment`);
                    console.warn(`   ⚠️ Please check why smartFIFOAllocation didn't allocate this payment correctly`);
                    
                    // 🆕 FIX: Create regular payment transaction to settle accrual (not advance payment)
                    shouldCreateAdvancePayment = false; // Change to regular payment
                    console.log(`   ✅ Changed to regular payment transaction to settle accrual`);
                } else {
                    console.log(`✅ No accrual found for payment month ${payment.paymentMonth} - proceeding with advance payment`);
                }
            } catch (accrualCheckError) {
                console.error(`❌ Error checking for accruals: ${accrualCheckError.message}`);
                console.error(`   Proceeding with advance payment creation (may be incorrect)`);
            }
        }
        
        if (shouldCreateAdvancePayment) {
            console.log(`💳 Creating fallback ADVANCE PAYMENT transaction for ${payment.paymentId}`);
            console.log(`   ⚠️ This should only happen if smartFIFOAllocation failed or was not called`);
            console.log(`   💳 Amount: $${payment.totalAmount || 0}`);
            console.log(`   💳 This will be treated as advance payment (deferred income)`);
            
            // Create advance payment transaction (same structure as createAdvancePaymentTransaction)
            const advanceTransaction = new TransactionEntry({
                transactionId,
                date: payment.date || new Date(),
                description: `Advance rent payment for future periods`,
                reference: payment._id.toString(),
                entries: [
                    // Entry 1: Debit Cash/Bank (we receive money)
                    {
                        accountCode: paymentAccountCode,
                        accountName: paymentAccountName,
                        accountType: 'Asset',
                        debit: payment.totalAmount || 0,
                        credit: 0,
                        description: `Advance rent payment received`
                    },
                    // Entry 2: Credit AR (shows payment from student, but will be reversed)
                    {
                        accountCode: arAccountCode,
                        accountName: arAccountName,
                        accountType: 'Asset',
                        debit: 0,
                        credit: payment.totalAmount || 0,
                        description: `Advance rent payment from Student (${payment._id.toString()}) - shows as credit temporarily`
                    },
                    // Entry 3: Debit AR (transfer to deferred income)
                    {
                        accountCode: arAccountCode,
                        accountName: arAccountName,
                        accountType: 'Asset',
                        debit: payment.totalAmount || 0,
                        credit: 0,
                        description: `Transfer advance payment to deferred income for future periods`
                    },
                    // Entry 4: Credit Deferred Income (liability for future periods)
                    {
                        accountCode: '2200',
                        accountName: 'Advance Payment Liability',
                        accountType: 'Liability',
                        debit: 0,
                        credit: payment.totalAmount || 0,
                        description: `Advance rent payment from Student (${payment._id.toString()})`
                    }
                ],
                totalDebit: (payment.totalAmount || 0) * 2,
                totalCredit: (payment.totalAmount || 0) * 2,
                source: 'advance_payment',
                sourceId: payment._id,
                sourceModel: 'Payment',
                residence: payment.residence || null,
                createdBy: 'system',
                status: 'posted',
                metadata: {
                    paymentId: payment._id.toString(),
                    studentId: userId.toString(),
                    debtorId: debtor?._id?.toString() || null,
                    amount: payment.totalAmount || 0,
                    paymentType: 'rent',
                    isAdvancePayment: true,
                    description: `Advance rent payment for future periods`,
                    createdByFallback: true // Flag to indicate this was created by fallback hook
                }
            });
            
            await advanceTransaction.save();
            console.log(`✅ Fallback advance payment transaction created: ${advanceTransaction.transactionId}`);
            
            // Update debtor deferred income
            if (debtor && payment.totalAmount > 0) {
                try {
                    const EnhancedPaymentAllocationService = require('../services/enhancedPaymentAllocationService');
                    await EnhancedPaymentAllocationService.updateDebtorDeferredIncome(
                        userId.toString(),
                        payment._id.toString(),
                        payment.totalAmount,
                        'rent'
                    );
                    console.log(`✅ Updated debtor deferred income for fallback advance payment`);
                } catch (deferredError) {
                    console.error(`❌ Error updating debtor deferred income: ${deferredError.message}`);
                }
            }
            
            return; // Done - advance payment transaction created
        }
        
        // Regular payment transaction (no payments array)
        console.log(`⚠️ Creating fallback payment transaction for ${payment.paymentId}`);
        console.log(`   ⚠️ This should only happen if smartFIFOAllocation failed or was not called`);
        console.log(`   ⚠️ Amount: $${payment.totalAmount || 0}`);
        
        // 🆕 Determine payment type and month for proper description format
        let paymentType = 'rent'; // Default to rent
        if (payment.payments && payment.payments.length > 0) {
            const firstPayment = payment.payments[0];
            paymentType = firstPayment.type || 'rent';
        } else if (payment.metadata?.paymentType) {
            paymentType = payment.metadata.paymentType;
        } else if (payment.paymentType) {
            paymentType = payment.paymentType;
        }
        
        // 🆕 Determine month settled from paymentMonth or payment date
        let monthSettled = payment.paymentMonth; // Format: "2026-01"
        if (!monthSettled && payment.date) {
            const paymentDate = new Date(payment.date);
            const year = paymentDate.getFullYear();
            const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
            monthSettled = `${year}-${month}`;
        } else if (!monthSettled) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            monthSettled = `${year}-${month}`;
        }
        
        // 🆕 CRITICAL: Check if payment date is before payment month - if so, treat as advance payment
        const paymentDate = new Date(payment.date || new Date());
        const paymentMonthDate = monthSettled ? new Date(monthSettled + '-01') : null;
        const paymentDateMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1);
        const isAdvancePaymentByDate = paymentMonthDate && paymentDateMonth < paymentMonthDate;
        
        if (isAdvancePaymentByDate) {
            console.log(`⚠️ Payment date (${paymentDate.toISOString().split('T')[0]}) is before payment month (${monthSettled})`);
            console.log(`   ✅ Creating ADVANCE PAYMENT transaction instead of regular payment allocation`);
            
            // Create advance payment transaction (4-entry structure: Cash, AR Credit, AR Debit, Deferred Income)
            const deferredIncomeAccountCode = '2200';
            const deferredIncomeAccountName = 'Advance Payment Liability';
            
            const advancePaymentTransaction = new TransactionEntry({
                transactionId,
                date: payment.date || new Date(),
                description: `Advance ${paymentType} payment for ${monthSettled} (no accrual yet)`,
                reference: payment._id.toString(),
                entries: [
                    // Entry 1: Debit Cash (money received)
                    {
                        accountCode: paymentAccountCode,
                        accountName: paymentAccountName,
                        accountType: 'Asset',
                        debit: payment.totalAmount || 0,
                        credit: 0,
                        description: `${paymentType} payment received for ${monthSettled}`
                    },
                    // Entry 2: Credit Student AR (shows student paid, creating credit/advance)
                    {
                        accountCode: arAccountCode,
                        accountName: arAccountName,
                        accountType: 'Asset',
                        debit: 0,
                        credit: payment.totalAmount || 0,
                        description: `${paymentType} payment from ${debtor?.contactInfo?.name || 'Student'} for ${monthSettled} - shows as credit/advance`
                    },
                    // Entry 3: Debit Student AR (transfers credit to deferred income)
                    {
                        accountCode: arAccountCode,
                        accountName: arAccountName,
                        accountType: 'Asset',
                        debit: payment.totalAmount || 0,
                        credit: 0,
                        description: `Transfer advance payment to deferred income for ${monthSettled}`
                    },
                    // Entry 4: Credit Deferred Income (liability for future periods)
                    {
                        accountCode: deferredIncomeAccountCode,
                        accountName: deferredIncomeAccountName,
                        accountType: 'Liability',
                        debit: 0,
                        credit: payment.totalAmount || 0,
                        description: `Advance ${paymentType} payment from ${debtor?.contactInfo?.name || 'Student'} for ${monthSettled}`
                    }
                ],
                totalDebit: (payment.totalAmount || 0) * 2,
                totalCredit: (payment.totalAmount || 0) * 2,
                source: 'advance_payment',
                sourceId: payment._id,
                sourceModel: 'Payment',
                residence: payment.residence || debtor?.residence,
                createdBy: payment.createdBy || 'system',
                status: 'posted',
                metadata: {
                    paymentId: payment._id.toString(),
                    studentId: userId.toString(),
                    debtorId: debtor?._id?.toString() || null,
                    paymentType: paymentType,
                    monthSettled: monthSettled,
                    method: paymentMethod,
                    createdByHook: true,
                    isAdvancePayment: true,
                    note: 'Transaction created by Payment post-save hook (fallback) - advance payment (payment date before payment month)'
                }
            });
            
            await advancePaymentTransaction.save();
            console.log(`✅ Created advance payment transaction: ${advancePaymentTransaction.transactionId} for payment ${payment.paymentId}`);
            return; // Exit early - advance payment created
        }
        
        // 🆕 Use consistent description format matching enhancedPaymentAllocationService
        const transactionDescription = `Payment allocation: ${paymentType} for ${monthSettled}`;
        const cashEntryDescription = `${paymentType} payment received for ${monthSettled}`;
        const arEntryDescription = `${paymentType} payment applied to ${monthSettled}`;
        
        const paymentTransaction = new TransactionEntry({
            transactionId,
            date: payment.date || new Date(),
            description: transactionDescription,
            reference: payment._id.toString(),
            entries: [
                // Entry 1: Debit Cash/Bank
                {
                    accountCode: paymentAccountCode,
                    accountName: paymentAccountName,
                    accountType: 'Asset',
                    debit: payment.totalAmount || 0,
                    credit: 0,
                    description: cashEntryDescription
                },
                // Entry 2: Credit AR
                {
                    accountCode: arAccountCode,
                    accountName: arAccountName,
                    accountType: 'Asset',
                    debit: 0,
                    credit: payment.totalAmount || 0,
                    description: arEntryDescription
                }
            ],
            totalDebit: payment.totalAmount || 0,
            totalCredit: payment.totalAmount || 0,
            source: 'payment',
            sourceId: payment._id,
            sourceModel: 'Payment',
            residence: payment.residence || debtor?.residence,
            createdBy: payment.createdBy || 'system',
            status: 'posted',
            metadata: {
                paymentId: payment._id.toString(),
                studentId: userId.toString(),
                debtorId: debtor?._id?.toString() || null,
                paymentType: paymentType, // Use determined payment type
                monthSettled: monthSettled, // Include month settled for consistency
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