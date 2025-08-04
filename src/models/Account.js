const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['Asset', 'Liability', 'Income', 'Expense', 'Equity'], 
    required: true 
  },
  category: {
    type: String,
    required: true,
    enum: [
      // Assets
      'Current Assets', 'Fixed Assets', 'Other Assets',
      // Liabilities  
      'Current Liabilities', 'Long-term Liabilities',
      // Equity
      'Owner Equity', 'Retained Earnings',
      // Income
      'Operating Revenue', 'Other Income',
      // Expenses
      'Operating Expenses', 'Administrative Expenses', 'Financial Expenses'
    ]
  },
  subcategory: {
    type: String,
    required: false,
    default: null
  },
  description: {
    type: String,
    required: false,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  parentAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: false,
    default: null
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map()
  }
}, {
  timestamps: true
});

// Index for efficient querying
AccountSchema.index({ type: 1, category: 1, code: 1 });
AccountSchema.index({ isActive: 1 });

// Virtual for full account path
AccountSchema.virtual('fullPath').get(function() {
  return `${this.code} - ${this.name}`;
});

// Method to get next available code for a type
AccountSchema.statics.getNextCode = async function(type, category = null) {
  const typePrefixes = {
    'Asset': '1',
    'Liability': '2', 
    'Equity': '3',
    'Income': '4',
    'Expense': '5'
  };

  const categorySubPrefixes = {
    'Current Assets': '0',
    'Fixed Assets': '2',
    'Other Assets': '3',
    'Current Liabilities': '0',
    'Long-term Liabilities': '1',
    'Owner Equity': '0',
    'Retained Earnings': '1',
    'Operating Revenue': '0',
    'Other Income': '2',
    'Operating Expenses': '0',
    'Administrative Expenses': '1',
    'Financial Expenses': '2'
  };

  const basePrefix = typePrefixes[type];
  const subPrefix = category && categorySubPrefixes[category] ? categorySubPrefixes[category] : '0';
  const searchPrefix = `${basePrefix}${subPrefix}`;

  // Find the highest existing code with this prefix
  const highestAccount = await this.findOne({
    code: { $regex: `^${searchPrefix}` }
  }).sort({ code: -1 });

  if (!highestAccount) {
    // No existing accounts with this prefix, start with 001
    return `${searchPrefix}001`;
  }

  // Extract the numeric part and increment
  const currentNumber = parseInt(highestAccount.code.slice(-3));
  const nextNumber = currentNumber + 1;
  
  // Format with leading zeros
  return `${searchPrefix}${nextNumber.toString().padStart(3, '0')}`;
};

// Method to validate code format
AccountSchema.statics.validateCodeFormat = function(code) {
  const codePattern = /^[1-5][0-9]{3}$/;
  return codePattern.test(code);
};

// Method to get accounts by type with hierarchy
AccountSchema.statics.getAccountsByType = async function(type, includeInactive = false) {
  const filter = { type };
  if (!includeInactive) {
    filter.isActive = true;
  }
  
  return await this.find(filter)
    .sort({ code: 1 })
    .populate('parentAccount', 'code name');
};

// Method to get account hierarchy
AccountSchema.statics.getAccountHierarchy = async function() {
  const accounts = await this.find({ isActive: true }).sort({ code: 1 });
  
  const hierarchy = {
    Asset: [],
    Liability: [],
    Equity: [],
    Income: [],
    Expense: []
  };

  accounts.forEach(account => {
    if (hierarchy[account.type]) {
      hierarchy[account.type].push(account);
    }
  });

  return hierarchy;
};

module.exports = mongoose.model('Account', AccountSchema); 