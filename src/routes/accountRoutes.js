const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const { auth, checkRole } = require('../middleware/auth');

// All routes require authentication and admin/finance/CEO roles
router.use(auth);
router.use(checkRole('admin', 'finance', 'finance_admin', 'finance_user', 'ceo'));

// GET /api/accounts - List all accounts with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      isActive,
      search,
      sortBy = 'code',
      sortOrder = 'asc'
    } = req.query;

    const query = {};

    // Type filter
    if (type && type !== 'all') {
      query.type = type;
    }

    // Active status filter
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    };

    const accounts = await Account.find(query, null, options);
    const total = await Account.countDocuments(query);

    res.status(200).json({
      success: true,
      data: accounts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalAccounts: total,
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    console.error('Error fetching accounts:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch accounts',
      message: err.message 
    });
  }
});

// GET /api/accounts/:id - Get account by ID
router.get('/:id', async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    res.status(200).json({
      success: true,
      data: account
    });
  } catch (err) {
    console.error('Error fetching account:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch account',
      message: err.message 
    });
  }
});

// POST /api/accounts - Add a new account (admin/finance only)
router.post('/', 
  checkRole('admin', 'finance', 'finance_admin', 'finance_user'),
  async (req, res) => {
    try {
      const { code, name, type, description, parentAccount, isActive = true } = req.body;
      
      // Validate required fields
      if (!code || !name || !type) {
        return res.status(400).json({
          success: false,
          error: 'Code, name, and type are required'
        });
      }

      // Check if account code already exists
      const existingAccount = await Account.findOne({ code });
      if (existingAccount) {
        return res.status(400).json({
          success: false,
          error: 'Account code already exists'
        });
      }

      const account = new Account({ 
        code, 
        name, 
        type, 
        description, 
        parentAccount, 
        isActive,
        createdBy: req.user._id
      });
      
      await account.save();
      
      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: account
      });
    } catch (err) {
      console.error('Error creating account:', err);
      res.status(400).json({ 
        success: false,
        error: 'Failed to create account',
        message: err.message 
      });
    }
  }
);

// PUT /api/accounts/:id - Update account (admin/finance only)
router.put('/:id', 
  checkRole('admin', 'finance', 'finance_admin', 'finance_user'),
  async (req, res) => {
    try {
      const { code, name, type, description, parentAccount, isActive } = req.body;
      
      const account = await Account.findById(req.params.id);
      
      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      // Check if new code conflicts with existing account
      if (code && code !== account.code) {
        const existingAccount = await Account.findOne({ code });
        if (existingAccount) {
          return res.status(400).json({
            success: false,
            error: 'Account code already exists'
          });
        }
      }

      // Update fields
      if (code !== undefined) account.code = code;
      if (name !== undefined) account.name = name;
      if (type !== undefined) account.type = type;
      if (description !== undefined) account.description = description;
      if (parentAccount !== undefined) account.parentAccount = parentAccount;
      if (isActive !== undefined) account.isActive = isActive;
      
      account.updatedBy = req.user._id;
      account.updatedAt = new Date();

      await account.save();
      
      res.status(200).json({
        success: true,
        message: 'Account updated successfully',
        data: account
      });
    } catch (err) {
      console.error('Error updating account:', err);
      res.status(400).json({ 
        success: false,
        error: 'Failed to update account',
        message: err.message 
      });
    }
  }
);

// DELETE /api/accounts/:id - Delete account (admin/finance only)
router.delete('/:id', 
  checkRole('admin', 'finance', 'finance_admin', 'finance_user'),
  async (req, res) => {
    try {
      const account = await Account.findById(req.params.id);
      
      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      // Check if account has any transactions
      const TransactionEntry = require('../models/TransactionEntry');
      const hasTransactions = await TransactionEntry.findOne({ account: account._id });
      
      if (hasTransactions) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete account with existing transactions'
        });
      }

      await Account.findByIdAndDelete(req.params.id);
      
      res.status(200).json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (err) {
      console.error('Error deleting account:', err);
      res.status(500).json({ 
        success: false,
        error: 'Failed to delete account',
        message: err.message 
      });
    }
  }
);

module.exports = router; 