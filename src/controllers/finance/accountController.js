const Account = require('../../models/Account');
const AccountCodeService = require('../../services/accountCodeService');
const mongoose = require('mongoose');
const { logAccountOperation } = require('../../utils/auditHelpers'); // Added for database connection check

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

    console.log('Account found:', account.code, account.name);
    res.status(200).json(account);
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
      metadata
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
    console.log('Generating account code for:', type, category);
    const code = await AccountCodeService.generateAccountCode(type, category);
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
      metadata: metadata || new Map()
    };

    const account = new Account(accountData);
    await account.save();

    // Populate parent account info
    await account.populate('parentAccount', 'code name');

    // Log the account creation
    await logAccountOperation(
      'create',
      account,
      req.user._id,
      `Created account ${account.code} - ${account.name}`,
      req
    );

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
 * Update account
 */
exports.updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove code from update data to prevent manual code changes
    delete updateData.code;

    const account = await Account.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('parentAccount', 'code name');

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.status(200).json({
      message: 'Account updated successfully',
      account
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

    const account = await Account.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.status(200).json({
      message: 'Account deactivated successfully',
      account
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