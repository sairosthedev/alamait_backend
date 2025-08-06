const mongoose = require('mongoose');

const pettyCashSchema = new mongoose.Schema({
    fundCode: {
        type: String,
        required: true,
        unique: true
    },
    initialAmount: {
        type: Number,
        required: true,
        min: 0
    },
    currentBalance: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    custodian: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'closed'],
        default: 'active'
    },
    description: {
        type: String,
        default: 'Petty Cash Fund'
    },
    lastReplenished: {
        type: Date
    },
    lastReconciled: {
        type: Date
    },
    replenishmentHistory: [{
        amount: {
            type: Number,
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        description: String,
        receipts: [{
            type: String
        }],
        replenishedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    expenseHistory: [{
        amount: {
            type: Number,
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        category: {
            type: String,
            enum: ['office_supplies', 'transportation', 'meals', 'maintenance', 'other'],
            default: 'other'
        },
        description: {
            type: String,
            required: true
        },
        receipt: {
            type: String
        },
        recordedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    notes: [{
        content: String,
        date: {
            type: Date,
            default: Date.now
        },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    closedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    closedDate: {
        type: Date
    },
    closingBalance: {
        type: Number,
        min: 0
    }
}, {
    timestamps: true
});

// Index for efficient queries
pettyCashSchema.index({ status: 1, fundCode: 1 });
pettyCashSchema.index({ 'expenseHistory.date': -1 });
pettyCashSchema.index({ 'replenishmentHistory.date': -1 });

// Virtual for total expenses
pettyCashSchema.virtual('totalExpenses').get(function() {
    return this.expenseHistory.reduce((total, expense) => total + expense.amount, 0);
});

// Virtual for total replenishments
pettyCashSchema.virtual('totalReplenishments').get(function() {
    return this.replenishmentHistory.reduce((total, replenishment) => total + replenishment.amount, 0);
});

// Virtual for expected balance
pettyCashSchema.virtual('expectedBalance').get(function() {
    return this.initialAmount + this.totalReplenishments - this.totalExpenses;
});

// Method to add expense
pettyCashSchema.methods.addExpense = function(amount, category, description, receipt, recordedBy) {
    if (this.currentBalance < amount) {
        throw new Error('Insufficient petty cash balance');
    }

    this.currentBalance -= amount;
    this.expenseHistory.push({
        amount,
        category,
        description,
        receipt,
        recordedBy
    });

    return this.save();
};

// Method to replenish fund
pettyCashSchema.methods.replenish = function(amount, description, receipts, replenishedBy) {
    this.currentBalance += amount;
    this.lastReplenished = new Date();
    this.replenishmentHistory.push({
        amount,
        description,
        receipts,
        replenishedBy
    });

    return this.save();
};

// Method to close fund
pettyCashSchema.methods.close = function(closingBalance, closedBy) {
    this.status = 'closed';
    this.closedDate = new Date();
    this.closingBalance = closingBalance;
    this.closedBy = closedBy;

    return this.save();
};

// Static method to generate fund code
pettyCashSchema.statics.generateFundCode = async function() {
    const count = await this.countDocuments();
    return `PC${String(count + 1).padStart(4, '0')}`;
};

// Pre-save middleware to generate fund code if not provided
pettyCashSchema.pre('save', async function(next) {
    if (!this.fundCode) {
        this.fundCode = await this.constructor.generateFundCode();
    }
    next();
});

// Method to get balance summary
pettyCashSchema.methods.getBalanceSummary = function() {
    return {
        initialAmount: this.initialAmount,
        currentBalance: this.currentBalance,
        totalExpenses: this.totalExpenses,
        totalReplenishments: this.totalReplenishments,
        expectedBalance: this.expectedBalance,
        variance: this.currentBalance - this.expectedBalance
    };
};

// Method to get expense summary by category
pettyCashSchema.methods.getExpenseSummary = function() {
    const summary = {};
    
    this.expenseHistory.forEach(expense => {
        if (!summary[expense.category]) {
            summary[expense.category] = {
                count: 0,
                total: 0
            };
        }
        summary[expense.category].count++;
        summary[expense.category].total += expense.amount;
    });

    return summary;
};

// Method to get recent activity
pettyCashSchema.methods.getRecentActivity = function(limit = 10) {
    const allActivity = [
        ...this.expenseHistory.map(expense => ({
            type: 'expense',
            date: expense.date,
            amount: -expense.amount,
            description: expense.description,
            category: expense.category
        })),
        ...this.replenishmentHistory.map(replenishment => ({
            type: 'replenishment',
            date: replenishment.date,
            amount: replenishment.amount,
            description: replenishment.description
        }))
    ];

    return allActivity
        .sort((a, b) => b.date - a.date)
        .slice(0, limit);
};

module.exports = mongoose.model('FinancePettyCash', pettyCashSchema); 