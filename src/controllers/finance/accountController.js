const Account = require('../../models/Account');
const AccountCodeService = require('../../services/accountCodeService');

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
      page = 1,
      limit = 50
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

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const accounts = await Account.find(filter)
      .populate('parentAccount', 'code name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Account.countDocuments(filter);

    res.status(200).json({
      accounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
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
    
    const account = await Account.findById(id)
      .populate('parentAccount', 'code name');
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.status(200).json(account);
  } catch (error) {
    console.error('Error fetching account:', error);
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

    // Validate account data
    const validation = await AccountCodeService.validateAccountData({
      name,
      type,
      category
    });

    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.errors 
      });
    }

    // Generate account code automatically
    const code = await AccountCodeService.generateAccountCode(type, category);

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