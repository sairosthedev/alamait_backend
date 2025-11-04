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
  // Opening balance captured at account creation (optional)
  openingBalance: {
    type: Number,
    default: 0
  },
  openingBalanceDate: {
    type: Date,
    default: null
  },
  currency: {
    type: String,
    default: 'USD'
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
AccountSchema.statics.getNextCode = async function(type, category = null, accountName = null) {
  try {
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
    if (!basePrefix) {
      throw new Error(`Invalid account type: ${type}`);
    }
    
    // CRITICAL: Special handling for non-AP liability accounts
    // Management fees and other non-vendor payables should use subprefix '1' instead of '0'
    // This prevents them from getting codes like 20001, 20002 which could be confused with AP accounts (2000)
    // Management fees will get codes like 20101, 20102, etc. (Liability type '2' + subprefix '1' + number)
    let subPrefix = category && categorySubPrefixes[category] ? categorySubPrefixes[category] : '0';
    
    if (type === 'Liability' && category === 'Current Liabilities' && accountName) {
      // Check if the account name contains non-AP terms (management fee, deposit, advance, etc.)
      const accountNameLower = accountName.toLowerCase();
      const nonAPTerms = [
        'management fee',
        'management fees',
        'deposit',
        'deposits',
        'advance',
        'advances',
        'security deposit',
        'tenant deposit',
        'deferred income',
        'accrued expense',
        'accrued expenses'
      ];
      
      const isNonAPAccount = nonAPTerms.some(term => accountNameLower.includes(term));
      
      if (isNonAPAccount) {
        // Use subprefix '1' for non-AP current liabilities (codes like 20101, 20102, etc.)
        subPrefix = '1';
        console.log(`📝 Non-AP liability account detected: "${accountName}" - using subprefix '1' (will generate codes like 201xx)`);
      }
    }
    
    const searchPrefix = `${basePrefix}${subPrefix}`;

    // Find all existing codes with this prefix
    const existingAccounts = await this.find({
      code: { $regex: `^${searchPrefix}` }
    }).sort({ code: -1 });

    if (existingAccounts.length === 0) {
      // No existing accounts with this prefix, start with 001
      return `${searchPrefix}001`;
    }

    // Get all existing numeric parts
    const existingNumbers = existingAccounts
      .map(acc => parseInt(acc.code.slice(-3)))
      .filter(num => !isNaN(num))
      .sort((a, b) => b - a);

    // Find the next available number
    let nextNumber = 1;
    for (let i = 0; i < existingNumbers.length; i++) {
      if (existingNumbers[i] === nextNumber) {
        nextNumber++;
      } else {
        break;
      }
    }
    
    // Format with leading zeros
    const nextCode = `${searchPrefix}${nextNumber.toString().padStart(3, '0')}`;
    
    // Final check that this code doesn't already exist
    const existingAccount = await this.findOne({ code: nextCode });
    if (existingAccount) {
      // If it still exists, find the next available number
      let alternativeNumber = nextNumber + 1;
      while (alternativeNumber <= 999) {
        const alternativeCode = `${searchPrefix}${alternativeNumber.toString().padStart(3, '0')}`;
        const checkAccount = await this.findOne({ code: alternativeCode });
        if (!checkAccount) {
          return alternativeCode;
        }
        alternativeNumber++;
      }
      throw new Error('No available codes found for this type and category');
    }
    
    return nextCode;
  } catch (error) {
    console.error('Error in getNextCode:', error);
    throw error;
  }
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