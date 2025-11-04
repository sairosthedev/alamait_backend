const Account = require('../../models/Account');
const AccountCodeService = require('../../services/accountCodeService');
const mongoose = require('mongoose');
const { logAccountOperation } = require('../../utils/auditHelpers'); // Added for database connection check
const { createAuditLog } = require('../../utils/auditLogger');

/**
 * Get all accounts with optional filtering
 */
exports.getAllAccounts = async (req, res) => {
  try {
    const { 
      type, 
      category, 
      isActive, 
      search, 
      sortBy = 'code', 
      sortOrder = 'asc',
      page,
      limit
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    // Search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Check if pagination is requested
    const usePagination = page !== undefined || limit !== undefined;
    
    let accounts;
    let total;
    
    if (usePagination) {
      // Use pagination
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 50;
      const skip = (pageNum - 1) * limitNum;
      
      accounts = await Account.find(filter)
        .populate('parentAccount', 'code name')
        .sort(sort)
        .skip(skip)
        .limit(limitNum);
        
      total = await Account.countDocuments(filter);
      
      res.status(200).json({
        accounts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } else {
      // Return all accounts without pagination
      accounts = await Account.find(filter)
        .populate('parentAccount', 'code name')
        .sort(sort);
        
      res.status(200).json(accounts);
    }
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};

/**
 * Get account by ID
 */
exports.getAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Getting account by ID:', id);
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid ObjectId format:', id);
      return res.status(400).json({ 
        error: 'Invalid account ID format',
        providedId: id,
        expectedFormat: '24-character hexadecimal string'
      });
    }
    
    const account = await Account.findById(id)
      .populate('parentAccount', 'code name');
    
    if (!account) {
      console.log('Account not found for ID:', id);
      return res.status(404).json({ error: 'Account not found' });
    }

    // Calculate current balance from transactions
    let currentBalance = 0;
    try {
      const TransactionEntry = require('../../models/TransactionEntry');
      
      // Get all transactions for this account
      const transactions = await TransactionEntry.find({
        'entries.accountCode': account.code
      });

      // Calculate balance from transaction entries
      transactions.forEach(transaction => {
        transaction.entries.forEach(entry => {
          if (entry.accountCode === account.code) {
            if (account.type === 'Asset' || account.type === 'Expense') {
              // Assets and Expenses: Debit increases, Credit decreases
              currentBalance += (entry.debit || 0) - (entry.credit || 0);
            } else {
              // Liabilities, Equity, Income: Credit increases, Debit decreases
              currentBalance += (entry.credit || 0) - (entry.debit || 0);
            }
          }
        });
      });
    } catch (balanceError) {
      console.error('Error calculating current balance:', balanceError);
      // Use opening balance as fallback
      currentBalance = account.openingBalance || 0;
    }

    console.log('Account found:', account.code, account.name, 'Current Balance:', currentBalance);
    res.status(200).json({
      ...account.toObject(),
      currentBalance,
      openingBalance: account.openingBalance || 0
    });
  } catch (error) {
    console.error('Error fetching account:', error);
    
    // Provide more specific error messages
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        error: 'Invalid account ID format',
        details: error.message
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch account' });
  }
};

/**
 * Create new account with automatic code generation
 */
exports.createAccount = async (req, res) => {
  try {
    const {
      name,
      type,
      category,
      subcategory,
      description,
      parentAccount,
      level,
      sortOrder,
      metadata,
      openingBalance,
      openingBalanceDate,
      currency
    } = req.body;

    console.log('Creating account with data:', { name, type, category });

    // Validate account data
    const validation = await AccountCodeService.validateAccountData({
      name,
      type,
      category
    });

    if (!validation.isValid) {
      console.log('Validation failed:', validation.errors);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.errors 
      });
    }

    // Generate account code automatically
    // Pass account name to detect non-AP accounts (management fees, deposits, etc.)
    console.log('Generating account code for:', type, category, 'Account name:', name);
    const code = await AccountCodeService.generateAccountCode(type, category, name);
    console.log('Generated code:', code);

    // Create account object
    const accountData = {
      code,
      name,
      type,
      category,
      subcategory,
      description,
      parentAccount,
      level: level || 1,
      sortOrder: sortOrder || 0,
      metadata: metadata || new Map(),
      // Opening balance fields (optional)
      openingBalance: typeof openingBalance === 'number' ? openingBalance : 0,
      openingBalanceDate: openingBalanceDate ? new Date(openingBalanceDate) : null,
      currency: currency || 'USD'
    };

    const account = new Account(accountData);
    await account.save();

    // Populate parent account info
    await account.populate('parentAccount', 'code name');

    // Create opening balance transaction if amount > 0
    if (account.openingBalance > 0) {
      try {
        const DoubleEntryAccountingService = require('../../services/doubleEntryAccountingService');
        const TransactionEntry = require('../../models/TransactionEntry');
        
        // Generate transaction ID
        const transactionId = `OB-${account.code}-${Date.now()}`;
        
        // Determine offsetting account based on account type
        let offsetAccountCode, offsetAccountName;
        if (account.type === 'Asset') {
          // Asset opening balance: Dr. Asset, Cr. Equity (Owner Capital)
          offsetAccountCode = '3001'; // Owner Capital
          offsetAccountName = 'Owner Capital';
        } else if (account.type === 'Liability') {
          // Liability opening balance: Dr. Equity (Owner Capital), Cr. Liability
          offsetAccountCode = '3001'; // Owner Capital
          offsetAccountName = 'Owner Capital';
        } else if (account.type === 'Equity') {
          // Equity opening balance: Dr. Cash, Cr. Equity
          offsetAccountCode = '1000'; // Cash
          offsetAccountName = 'Cash';
        } else {
          // Income/Expense accounts shouldn't have opening balances
          console.log(`⚠️ Skipping opening balance transaction for ${account.type} account ${account.code}`);
        }
        
        if (offsetAccountCode) {
          // Check if the offsetting account exists
          let offsetAccount = await Account.findOne({ code: offsetAccountCode });
          if (!offsetAccount) {
            console.log(`❌ Offsetting account ${offsetAccountCode} not found in database!`);
            console.log(`Available accounts: Please ensure account ${offsetAccountCode} exists in your chart of accounts.`);
            throw new Error(`Required offsetting account ${offsetAccountCode} (${offsetAccountName}) not found`);
          } else {
            console.log(`✅ Found offsetting account: ${offsetAccountCode} - ${offsetAccount.name}`);
          }
          // Create double-entry transaction
          const transactionData = {
            transactionId,
            date: account.openingBalanceDate || new Date(),
            description: `Opening balance for ${account.name} (${account.code})`,
            reference: `OB-${account.code}`,
            entries: [],
            totalDebit: 0,
            totalCredit: 0,
            source: 'manual',
            sourceId: account._id,
            sourceModel: 'User',
            createdBy: req.user.email || 'system'
          };
          
          if (account.type === 'Asset') {
            // Dr. Asset, Cr. Equity
            transactionData.entries = [
              {
                accountCode: account.code,
                accountName: account.name,
                accountType: account.type,
                debit: account.openingBalance,
                credit: 0,
                description: `Opening balance - ${account.name}`
              },
              {
                accountCode: offsetAccountCode,
                accountName: offsetAccountName,
                accountType: 'Equity',
                debit: 0,
                credit: account.openingBalance,
                description: `Opening balance offset - ${account.name}`
              }
            ];
            transactionData.totalDebit = account.openingBalance;
            transactionData.totalCredit = account.openingBalance;
          } else if (account.type === 'Liability') {
            // Dr. Equity, Cr. Liability
            transactionData.entries = [
              {
                accountCode: offsetAccountCode,
                accountName: offsetAccountName,
                accountType: 'Equity',
                debit: account.openingBalance,
                credit: 0,
                description: `Opening balance offset - ${account.name}`
              },
              {
                accountCode: account.code,
                accountName: account.name,
                accountType: account.type,
                debit: 0,
                credit: account.openingBalance,
                description: `Opening balance - ${account.name}`
              }
            ];
            transactionData.totalDebit = account.openingBalance;
            transactionData.totalCredit = account.openingBalance;
          }
          
          const transaction = new TransactionEntry(transactionData);
          await transaction.save();
          
          console.log(`✅ Created opening balance transaction ${transactionId} for account ${account.code}: $${account.openingBalance}`);
        } else {
          console.log(`⚠️ No offsetting account code determined for ${account.type} account ${account.code}`);
        }
      } catch (transactionError) {
        console.error('❌ Error creating opening balance transaction:', transactionError);
        console.error('Transaction error details:', {
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          openingBalance: account.openingBalance,
          error: transactionError.message,
          stack: transactionError.stack
        });
        // Don't fail account creation if transaction creation fails
      }
    }

    // Log the account creation with comprehensive audit logging
    try {
    await logAccountOperation(
      'create',
      account,
      req.user._id,
      `Created account ${account.code} - ${account.name}`,
      req
    );

      // Additional comprehensive audit log
      await createAuditLog({
        action: 'create',
        collection: 'Account',
        recordId: account._id,
        userId: req.user._id,
        before: null,
        after: account.toObject(),
        details: {
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          category: account.category,
          openingBalance: account.openingBalance || 0,
          openingBalanceDate: account.openingBalanceDate,
          currency: account.currency,
          openingBalanceTransactionCreated: account.openingBalance > 0,
          source: 'Account Management',
          description: `New account ${account.code} (${account.name}) created by ${req.user.email || req.user.firstName + ' ' + req.user.lastName}`
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers?.['user-agent'],
        sessionId: req.sessionID,
        requestId: req.requestId
      });

      console.log(`✅ Account creation audit logged: ${account.code} - ${account.name}`);
    } catch (auditError) {
      console.error('Error creating audit log for account creation:', auditError);
      // Don't fail account creation if audit logging fails
    }

    res.status(201).json({
      message: 'Account created successfully',
      account,
      generatedCode: code
    });
  } catch (error) {
    console.error('Error creating account:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Account code already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create account' });
  }
};

/**
 * Update account with balance adjustment support
 */
exports.updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove code from update data to prevent manual code changes
    delete updateData.code;

    // Get the original account
    const originalAccount = await Account.findById(id);
    if (!originalAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Store original data for audit logging
    const originalData = originalAccount.toObject();

    // Check if opening balance is being changed
    const balanceChanged = updateData.openingBalance !== undefined && 
                          updateData.openingBalance !== originalAccount.openingBalance;

    // Update the account
    const account = await Account.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('parentAccount', 'code name');

    // If balance changed, create adjustment transaction
    if (balanceChanged && updateData.openingBalance > 0) {
      try {
        const TransactionEntry = require('../../models/TransactionEntry');
        
        // Calculate the difference
        const oldBalance = originalAccount.openingBalance || 0;
        const newBalance = updateData.openingBalance;
        const difference = newBalance - oldBalance;
        
        if (Math.abs(difference) > 0.01) { // Only create transaction if significant difference
          // Generate transaction ID
          const transactionId = `ADJ-${account.code}-${Date.now()}`;
          
          // Determine offsetting account based on account type
          let offsetAccountCode, offsetAccountName;
          if (account.type === 'Asset') {
            offsetAccountCode = '3001'; // Owner Capital
            offsetAccountName = 'Owner Capital';
          } else if (account.type === 'Liability') {
            offsetAccountCode = '3001'; // Owner Capital
            offsetAccountName = 'Owner Capital';
          } else if (account.type === 'Equity') {
            offsetAccountCode = '1000'; // Cash
            offsetAccountName = 'Cash';
          }
          
          if (offsetAccountCode) {
            // Create adjustment transaction
            const transactionData = {
              transactionId,
              date: updateData.openingBalanceDate ? new Date(updateData.openingBalanceDate) : new Date(),
              description: `Balance adjustment for ${account.name} (${account.code}) - ${difference > 0 ? 'Increase' : 'Decrease'} of $${Math.abs(difference)}`,
              reference: `ADJ-${account.code}`,
              entries: [],
              totalDebit: 0,
              totalCredit: 0,
              source: 'manual',
              sourceId: account._id,
              sourceModel: 'User',
              createdBy: req.user.email || 'system'
            };
            
            if (account.type === 'Asset') {
              if (difference > 0) {
                // Increase asset: Dr. Asset, Cr. Equity
                transactionData.entries = [
                  {
                    accountCode: account.code,
                    accountName: account.name,
                    accountType: account.type,
                    debit: difference,
                    credit: 0,
                    description: `Balance increase - ${account.name}`
                  },
                  {
                    accountCode: offsetAccountCode,
                    accountName: offsetAccountName,
                    accountType: 'Equity',
                    debit: 0,
                    credit: difference,
                    description: `Balance adjustment offset - ${account.name}`
                  }
                ];
              } else {
                // Decrease asset: Dr. Equity, Cr. Asset
                transactionData.entries = [
                  {
                    accountCode: offsetAccountCode,
                    accountName: offsetAccountName,
                    accountType: 'Equity',
                    debit: Math.abs(difference),
                    credit: 0,
                    description: `Balance adjustment offset - ${account.name}`
                  },
                  {
                    accountCode: account.code,
                    accountName: account.name,
                    accountType: account.type,
                    debit: 0,
                    credit: Math.abs(difference),
                    description: `Balance decrease - ${account.name}`
                  }
                ];
              }
            } else if (account.type === 'Liability') {
              if (difference > 0) {
                // Increase liability: Dr. Equity, Cr. Liability
                transactionData.entries = [
                  {
                    accountCode: offsetAccountCode,
                    accountName: offsetAccountName,
                    accountType: 'Equity',
                    debit: difference,
                    credit: 0,
                    description: `Balance adjustment offset - ${account.name}`
                  },
                  {
                    accountCode: account.code,
                    accountName: account.name,
                    accountType: account.type,
                    debit: 0,
                    credit: difference,
                    description: `Balance increase - ${account.name}`
                  }
                ];
              } else {
                // Decrease liability: Dr. Liability, Cr. Equity
                transactionData.entries = [
                  {
                    accountCode: account.code,
                    accountName: account.name,
                    accountType: account.type,
                    debit: Math.abs(difference),
                    credit: 0,
                    description: `Balance decrease - ${account.name}`
                  },
                  {
                    accountCode: offsetAccountCode,
                    accountName: offsetAccountName,
                    accountType: 'Equity',
                    debit: 0,
                    credit: Math.abs(difference),
                    description: `Balance adjustment offset - ${account.name}`
                  }
                ];
              }
            }
            
            transactionData.totalDebit = Math.abs(difference);
            transactionData.totalCredit = Math.abs(difference);
            
            const transaction = new TransactionEntry(transactionData);
            await transaction.save();
            
            console.log(`✅ Created balance adjustment transaction ${transactionId} for account ${account.code}: $${difference}`);
          }
        }
      } catch (transactionError) {
        console.error('Error creating balance adjustment transaction:', transactionError);
        // Don't fail account update if transaction creation fails
      }
    }

    // Create comprehensive audit log for account update
    try {
      const updatedData = account.toObject();
      const changes = [];
      
      // Identify what fields were changed
      Object.keys(updateData).forEach(key => {
        if (originalData[key] !== updatedData[key]) {
          changes.push({
            field: key,
            oldValue: originalData[key],
            newValue: updatedData[key]
          });
        }
      });

      // Create audit log entry
      await createAuditLog({
        action: 'update',
        collection: 'Account',
        recordId: account._id,
        userId: req.user._id,
        before: originalData,
        after: updatedData,
        details: {
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          changes: changes,
          balanceAdjusted: balanceChanged,
          balanceChange: balanceChanged ? {
            oldBalance: originalData.openingBalance || 0,
            newBalance: updatedData.openingBalance || 0,
            difference: (updatedData.openingBalance || 0) - (originalData.openingBalance || 0)
          } : null,
          source: 'Account Management',
          description: `Account ${account.code} (${account.name}) updated by ${req.user.email || req.user.firstName + ' ' + req.user.lastName}`
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers?.['user-agent'],
        sessionId: req.sessionID,
        requestId: req.requestId
      });

      console.log(`✅ Account update audit logged: ${account.code} - ${account.name}`);
    } catch (auditError) {
      console.error('Error creating audit log for account update:', auditError);
      // Don't fail the update if audit logging fails
    }

    res.status(200).json({
      message: 'Account updated successfully',
      account,
      balanceAdjusted: balanceChanged,
      changesLogged: true
    });
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
};

/**
 * Delete account (soft delete by setting isActive to false)
 */
exports.deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;

    // Get original account data for audit logging
    const originalAccount = await Account.findById(id);
    if (!originalAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const originalData = originalAccount.toObject();

    const account = await Account.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    // Create comprehensive audit log for account deletion
    try {
      await createAuditLog({
        action: 'delete',
        collection: 'Account',
        recordId: account._id,
        userId: req.user._id,
        before: originalData,
        after: account.toObject(),
        details: {
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          category: account.category,
          openingBalance: account.openingBalance || 0,
          deletionType: 'soft_delete',
          isActiveChanged: true,
          source: 'Account Management',
          description: `Account ${account.code} (${account.name}) deactivated by ${req.user.email || req.user.firstName + ' ' + req.user.lastName}`
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers?.['user-agent'],
        sessionId: req.sessionID,
        requestId: req.requestId
      });

      console.log(`✅ Account deletion audit logged: ${account.code} - ${account.name}`);
    } catch (auditError) {
      console.error('Error creating audit log for account deletion:', auditError);
      // Don't fail account deletion if audit logging fails
    }

    res.status(200).json({
      message: 'Account deactivated successfully',
      account,
      changesLogged: true
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};

/**
 * Get account hierarchy
 */
exports.getAccountHierarchy = async (req, res) => {
  try {
    const hierarchy = await Account.getAccountHierarchy();
    
    res.status(200).json(hierarchy);
  } catch (error) {
    console.error('Error fetching account hierarchy:', error);
    res.status(500).json({ error: 'Failed to fetch account hierarchy' });
  }
};

/**
 * Get accounts by type
 */
exports.getAccountsByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { includeInactive = false } = req.query;

    const accounts = await Account.getAccountsByType(type, includeInactive === 'true');
    
    res.status(200).json(accounts);
  } catch (error) {
    console.error('Error fetching accounts by type:', error);
    res.status(500).json({ error: 'Failed to fetch accounts by type' });
  }
};

/**
 * Get account code suggestions
 */
exports.getCodeSuggestions = async (req, res) => {
  try {
    const { type, category } = req.query;

    if (!type) {
      return res.status(400).json({ error: 'Account type is required' });
    }

    const suggestions = await AccountCodeService.getCodeSuggestions(type, category);
    
    res.status(200).json(suggestions);
  } catch (error) {
    console.error('Error generating code suggestions:', error);
    res.status(500).json({ error: 'Failed to generate code suggestions' });
  }
};

/**
 * Validate account code
 */
exports.validateAccountCode = async (req, res) => {
  try {
    const { code } = req.params;

    const isValid = AccountCodeService.validateCodeFormat(code);
    const exists = await AccountCodeService.codeExists(code);

    res.status(200).json({
      code,
      isValid,
      exists,
      available: isValid && !exists
    });
  } catch (error) {
    console.error('Error validating account code:', error);
    res.status(500).json({ error: 'Failed to validate account code' });
  }
};

/**
 * Get next available account code
 */
exports.getNextAccountCode = async (req, res) => {
  try {
    const { type, category } = req.query;
    
    if (!type) {
      return res.status(400).json({ error: 'Account type is required' });
    }
    
    // Validate account type
    const validTypes = ['Asset', 'Liability', 'Equity', 'Income', 'Revenue', 'Expense'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid account type. Must be one of: Asset, Liability, Equity, Income, Revenue, Expense' 
      });
    }
    
    // Check database connection before proceeding
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected. Ready state:', mongoose.connection.readyState);
      return res.status(503).json({ 
        error: 'Database service temporarily unavailable. Please try again in a moment.',
        details: 'Database connection is not ready'
      });
    }
    
    // Map 'Revenue' to 'Income' for the model
    const modelType = type === 'Revenue' ? 'Income' : type;
    
    // Get next available code using the Account model's static method
    const code = await Account.getNextCode(modelType, category);
    
    res.status(200).json({ 
      success: true, 
      code,
      type,
      category: category || 'Default',
      message: `Next available code for ${type}${category ? ` - ${category}` : ''}: ${code}`
    });
  } catch (error) {
    console.error('Error getting next account code:', error);
    
    // Provide more specific error messages
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(503).json({ 
        error: 'Database connection timeout. Please try again.',
        details: 'The database operation timed out while waiting for connection'
      });
    }
    
    if (error.name === 'MongoNetworkError') {
      return res.status(503).json({ 
        error: 'Database network error. Please try again.',
        details: 'Unable to connect to the database server'
      });
    }
    
    res.status(500).json({ error: 'Failed to generate account code' });
  }
};

/**
 * Get account type information
 */
exports.getAccountTypeInfo = async (req, res) => {
  try {
    const { type } = req.params;

    const typeInfo = AccountCodeService.getAccountTypeInfo(type);
    const suggestedCategories = AccountCodeService.getSuggestedCategories(type);

    if (!typeInfo) {
      return res.status(404).json({ error: 'Invalid account type' });
    }

    res.status(200).json({
      type,
      ...typeInfo,
      suggestedCategories
    });
  } catch (error) {
    console.error('Error fetching account type info:', error);
    res.status(500).json({ error: 'Failed to fetch account type info' });
  }
};

/**
 * Bulk create accounts
 */
exports.bulkCreateAccounts = async (req, res) => {
  try {
    const { accounts } = req.body;

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ error: 'Accounts array is required' });
    }

    // Generate codes for all accounts
    const accountsWithCodes = await AccountCodeService.bulkGenerateCodes(accounts);

    // Filter valid accounts
    const validAccounts = accountsWithCodes.filter(acc => acc.code && acc.errors.length === 0);
    const invalidAccounts = accountsWithCodes.filter(acc => !acc.code || acc.errors.length > 0);

    // Create valid accounts
    const createdAccounts = [];
    for (const accountData of validAccounts) {
      try {
        const account = new Account(accountData);
        await account.save();
        await account.populate('parentAccount', 'code name');
        createdAccounts.push(account);
      } catch (error) {
        console.error(`Error creating account ${accountData.name}:`, error);
        invalidAccounts.push({
          ...accountData,
          errors: [error.message]
        });
      }
    }

    res.status(201).json({
      message: 'Bulk account creation completed',
      created: createdAccounts.length,
      failed: invalidAccounts.length,
      createdAccounts,
      failedAccounts: invalidAccounts
    });
  } catch (error) {
    console.error('Error in bulk account creation:', error);
    res.status(500).json({ error: 'Failed to create accounts in bulk' });
  }
};

/**
 * Get account statistics
 */
exports.getAccountStats = async (req, res) => {
  try {
    const stats = await Account.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: ['$isActive', 1, 0] }
          }
        }
      }
    ]);

    const totalAccounts = await Account.countDocuments();
    const activeAccounts = await Account.countDocuments({ isActive: true });

    res.status(200).json({
      totalAccounts,
      activeAccounts,
      inactiveAccounts: totalAccounts - activeAccounts,
      byType: stats
    });
  } catch (error) {
    console.error('Error fetching account statistics:', error);
    res.status(500).json({ error: 'Failed to fetch account statistics' });
  }
};

/**
 * Get debtors by application code
 */
exports.getDebtorsByApplicationCode = async (req, res) => {
  try {
    const { applicationCode } = req.params;
    
    if (!applicationCode) {
      return res.status(400).json({ error: 'Application code is required' });
    }
    
    const Debtor = require('../../models/Debtor');
    
    const debtors = await Debtor.find({ applicationCode })
      .populate('application', 'firstName lastName startDate endDate status')
      .populate('user', 'firstName lastName email')
      .populate('residence', 'name');
    
    if (debtors.length === 0) {
      return res.status(404).json({ 
        error: 'No debtors found with this application code',
        applicationCode 
      });
    }
    
    res.status(200).json({
      success: true,
      applicationCode,
      count: debtors.length,
      debtors
    });
    
  } catch (error) {
    console.error('Error fetching debtors by application code:', error);
    res.status(500).json({ error: 'Failed to fetch debtors' });
  }
}; 