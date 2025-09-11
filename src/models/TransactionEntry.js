const mongoose = require('mongoose');

const transactionEntrySchema = new mongoose.Schema({
  // Transaction Info
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  description: {
    type: String,
    required: true
  },
  reference: String,
  
  // Double-Entry Details
  entries: [{
    accountCode: {
      type: String,
      required: true,
      ref: 'Account'
    },
    accountName: String,
    accountType: String,
    debit: {
      type: Number,
      default: 0
    },
    credit: {
      type: Number,
      default: 0
    },
    description: String
  }],
  
  // Total amounts
  totalDebit: {
    type: Number,
    required: true
  },
  totalCredit: {
    type: Number,
    required: true
  },
  
  // Source
  source: {
    type: String,
    enum: ['payment', 'invoice', 'manual', 'adjustment', 'vendor_payment', 'expense_payment', 'rental_accrual', 'rental_accrual_reversal', 'expense_accrual', 'expense_accrual_reversal', 'petty_cash_payment', 'petty_cash_allocation', 'petty_cash_expense', 'petty_cash_replenishment', 'advance_payment'],
    required: true
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'sourceModel'
  },
  sourceModel: {
    type: String,
    enum: ['Payment', 'Invoice', 'Request', 'Vendor', 'Expense', 'Lease', 'TransactionEntry', 'User', 'PettyCash', 'AdvancePayment', 'Debtor'],
    required: true
  },
  
  // Residence (for filtering and reporting)
  residence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Residence',
    required: false // Optional for backward compatibility
  },
  
  // Audit Trail
  createdBy: {
    type: String, // User email or "system"
    required: true,
    validate: {
      validator: function(value) {
        // Allow any string, but give special treatment to "system"
        return typeof value === 'string' && value.length > 0;
      },
      message: 'createdBy must be a non-empty string (user email or "system")'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  approvedBy: {
    type: String, // User email
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'posted', 'reversed'],
    default: 'posted'
  },

  // Metadata for additional info
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Ensure debits equal credits
transactionEntrySchema.pre('save', function(next) {
  if (this.totalDebit !== this.totalCredit) {
    return next(new Error('Total debits must equal total credits'));
  }
  next();
});

// Generate transaction ID if not provided
transactionEntrySchema.pre('save', function(next) {
  if (!this.transactionId) {
    this.transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  }
  next();
});

// 🆕 NEW: Auto-update debtor totals when AR transactions are created
transactionEntrySchema.post('save', async function(doc) {
  try {
    // Skip security deposit reversal transactions to prevent infinite loops
    if (doc.metadata && doc.metadata.type === 'security_deposit_reversal') {
      console.log(`⏭️ Skipping auto-update for security deposit reversal: ${doc.transactionId}`);
      return;
    }

    // Only process AR transactions (account codes starting with 1100-)
    const arEntries = doc.entries.filter(entry => 
      entry.accountCode && entry.accountCode.startsWith('1100-')
    );
    
    // Only process AP transactions (account codes starting with 2000-)
    const apEntries = doc.entries.filter(entry => 
      entry.accountCode && entry.accountCode.startsWith('2000') && entry.accountCode !== '2000'
    );
    
    if (arEntries.length === 0 && apEntries.length === 0) {
      return; // Not an AR or AP transaction
    }
    
    console.log(`🔄 Auto-updating totals for transaction: ${doc.transactionId}`);
    
    // Get the services
    const debtorService = require('../services/debtorService');
    const vendorService = require('../services/vendorService');
    
    // Process AR transactions (debtors)
    if (arEntries.length > 0) {
      // Extract student ID from AR account code (1100-{studentId})
      const studentIds = new Set();
      arEntries.forEach(entry => {
        const accountCode = entry.accountCode;
        if (accountCode.startsWith('1100-')) {
          const studentId = accountCode.replace('1100-', '');
          if (studentId) {
            studentIds.add(studentId);
          }
        }
      });
      
      // Update each affected debtor using the real-time update method
      for (const studentId of studentIds) {
        try {
          // Use the new real-time update method
          const result = await debtorService.updateDebtorFromARTransaction(studentId, doc);
          
          if (result.success) {
            console.log(`   ✅ Real-time debtor update successful for user ${studentId}`);
          } else {
            console.log(`   ⚠️ Real-time debtor update failed for user ${studentId}: ${result.message}`);
          }
        } catch (error) {
          console.error(`   ❌ Error in real-time debtor update for user ${studentId}:`, error.message);
        }
      }
    }
    
    // Process AP transactions (vendors)
    if (apEntries.length > 0) {
      // Extract vendor account codes (2000{xxx})
      const vendorAccountCodes = new Set();
      apEntries.forEach(entry => {
        const accountCode = entry.accountCode;
        if (accountCode.startsWith('2000') && accountCode !== '2000') {
          vendorAccountCodes.add(accountCode);
        }
      });
      
      // Update each affected vendor using the real-time update method
      for (const accountCode of vendorAccountCodes) {
        try {
          // Use the new real-time update method
          const result = await vendorService.updateVendorFromAPTransaction(accountCode, doc);
          
          if (result.success) {
            console.log(`   ✅ Real-time vendor update successful for account ${accountCode}`);
          } else {
            console.log(`   ⚠️ Real-time vendor update failed for account ${accountCode}: ${result.message}`);
          }
        } catch (error) {
          console.error(`   ❌ Error in real-time vendor update for account ${accountCode}:`, error.message);
        }
      }
    }
    
  } catch (error) {
    console.error('⚠️ Error in TransactionEntry post-save hook:', error.message);
    // Don't throw error to avoid breaking the main transaction save
  }
});

module.exports = mongoose.model('TransactionEntry', transactionEntrySchema); 