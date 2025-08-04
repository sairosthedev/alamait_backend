const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
    // Receipt identification
    receiptNumber: {
        type: String,
        required: true,
        unique: true
    },
    
    // Student information
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Payment information
    payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        required: true
    },
    
    // Residence and room information
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room'
    },
    
    // Receipt details
    items: [{
        description: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            default: 1
        },
        unitPrice: {
            type: Number,
            required: true
        },
        totalPrice: {
            type: Number,
            required: true
        }
    }],
    
    // Financial details
    subtotal: {
        type: Number,
        required: true
    },
    
    tax: {
        type: Number,
        default: 0
    },
    
    totalAmount: {
        type: Number,
        required: true
    },
    
    // Payment method and reference
    paymentMethod: {
        type: String,
        required: true,
        enum: ['bank_transfer', 'mobile_money', 'cash', 'card', 'other']
    },
    
    paymentReference: {
        type: String,
        required: true
    },
    
    // Receipt status
    status: {
        type: String,
        enum: ['generated', 'sent', 'delivered', 'read'],
        default: 'generated'
    },
    
    // S3 storage
    pdfUrl: {
        type: String
    },
    
    s3Key: {
        type: String
    },
    
    // Email tracking
    emailSent: {
        type: Boolean,
        default: false
    },
    
    emailSentAt: {
        type: Date
    },
    
    emailDelivered: {
        type: Boolean,
        default: false
    },
    
    emailDeliveredAt: {
        type: Date
    },
    
    // Receipt period
    receiptDate: {
        type: Date,
        default: Date.now
    },
    
    // Additional information
    notes: {
        type: String
    },
    
    // Created by
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Receipt template
    template: {
        type: String,
        default: 'default'
    }
}, {
    timestamps: true
});

// Indexes for common queries
receiptSchema.index({ receiptNumber: 1 });
receiptSchema.index({ student: 1 });
receiptSchema.index({ payment: 1 });
receiptSchema.index({ status: 1 });
receiptSchema.index({ receiptDate: 1 });
receiptSchema.index({ createdBy: 1 });

// Pre-save middleware to generate receipt number
receiptSchema.pre('save', async function(next) {
    if (this.isNew && !this.receiptNumber) {
        this.receiptNumber = await this.generateReceiptNumber();
    }
    next();
});

// Static method to generate receipt number
receiptSchema.statics.generateReceiptNumber = async function() {
    const year = new Date().getFullYear();
    const count = await this.countDocuments({
        receiptNumber: { $regex: `^RCP${year}` }
    });
    return `RCP${year}${String(count + 1).padStart(4, '0')}`;
};

// Instance method to calculate totals
receiptSchema.methods.calculateTotals = function() {
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    this.totalAmount = this.subtotal + this.tax;
    return this;
};

// Instance method to get student details
receiptSchema.methods.getStudentDetails = async function() {
    await this.populate('student', 'firstName lastName email phone');
    return this.student;
};

// Instance method to get residence details
receiptSchema.methods.getResidenceDetails = async function() {
    await this.populate('residence', 'name address');
    return this.residence;
};

// Instance method to get payment details
receiptSchema.methods.getPaymentDetails = async function() {
    await this.populate('payment', 'amount paymentMethod reference status');
    return this.payment;
};

module.exports = mongoose.model('Receipt', receiptSchema); 