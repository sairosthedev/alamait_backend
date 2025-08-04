const TransactionEntry = require('../models/TransactionEntry');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');

// Get transaction entries with filters
exports.getTransactionEntries = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      type,
      account,
      status
    } = req.query;

    console.log('🔍 Transaction entries query params:', req.query);

    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Account filter
    if (account && account !== 'all') {
      query.account = account;
    }

    // Type filter (debit/credit)
    if (type && type !== 'all') {
      if (type === 'debit') {
        query.debit = { $gt: 0 };
      } else if (type === 'credit') {
        query.credit = { $gt: 0 };
      }
    }

    console.log('🔍 Database query:', JSON.stringify(query, null, 2));

    const options = {
      sort: { date: -1 },
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    };

    // Get transaction entries
    const transactionEntries = await TransactionEntry.find(query, null, options);
    const total = await TransactionEntry.countDocuments(query);

    console.log(`🔍 Found ${transactionEntries.length} transaction entries, total: ${total}`);

    // Transform data for frontend
    const transformedTransactions = [];
    
    for (const entry of transactionEntries) {
      console.log(`🔍 Processing entry: ${entry._id}, debit: ${entry.debit}, credit: ${entry.credit}`);
      
      // Get account details
      let accountName = 'Unknown Account';
      let accountType = 'unknown';
      
      try {
        const account = await Account.findById(entry.account);
        if (account) {
          accountName = account.name;
          accountType = account.type;
        }
      } catch (error) {
        console.log(`⚠️ Could not find account ${entry.account}`);
      }

      // Get transaction details
      let transactionDescription = 'No description';
      let transactionReference = 'N/A';
      
      try {
        const transaction = await Transaction.findById(entry.transaction);
        if (transaction) {
          transactionDescription = transaction.description || 'No description';
          transactionReference = transaction.reference || 'N/A';
        }
      } catch (error) {
        console.log(`⚠️ Could not find transaction ${entry.transaction}`);
      }

      // Create debit entry if debit > 0
      if (entry.debit > 0) {
        transformedTransactions.push({
          _id: `${entry._id}_debit`,
          transactionId: entry.transaction,
          timestamp: entry.date,
          type: 'debit',
          accountName: accountName,
          accountType: accountType,
          accountCode: entry.account,
          amount: entry.debit,
          description: transactionDescription,
          reference: transactionReference,
          referenceType: 'transaction',
          referenceId: entry.transaction,
          createdByEmail: 'System',
          createdAt: entry.date,
          metadata: { entryType: entry.type }
        });
      }
      
      // Create credit entry if credit > 0
      if (entry.credit > 0) {
        transformedTransactions.push({
          _id: `${entry._id}_credit`,
          transactionId: entry.transaction,
          timestamp: entry.date,
          type: 'credit',
          accountName: accountName,
          accountType: accountType,
          accountCode: entry.account,
          amount: entry.credit,
          description: transactionDescription,
          reference: transactionReference,
          referenceType: 'transaction',
          referenceId: entry.transaction,
          createdByEmail: 'System',
          createdAt: entry.date,
          metadata: { entryType: entry.type }
        });
      }
    }

    console.log(`🔍 Transformed ${transformedTransactions.length} transactions for frontend`);

    res.status(200).json({
      success: true,
      data: transformedTransactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalEntries: total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching transaction entries:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction entries',
      error: error.message
    });
  }
};

// Get transaction summary
exports.getTransactionSummary = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      type,
      account,
      status
    } = req.query;

    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Account filter
    if (account && account !== 'all') {
      query.account = account;
    }

    // Type filter (debit/credit)
    if (type && type !== 'all') {
      if (type === 'debit') {
        query.debit = { $gt: 0 };
      } else if (type === 'credit') {
        query.credit = { $gt: 0 };
      }
    }

    const transactionEntries = await TransactionEntry.find(query);

    let totalDebits = 0;
    let totalCredits = 0;
    let transactionCount = 0;

    // Count unique transactions
    const uniqueTransactions = new Set();

    transactionEntries.forEach(entry => {
      totalDebits += entry.debit || 0;
      totalCredits += entry.credit || 0;
      uniqueTransactions.add(entry.transaction.toString());
    });

    transactionCount = uniqueTransactions.size;
    const netAmount = totalCredits - totalDebits;

    res.status(200).json({
      success: true,
      data: {
        totalDebits,
        totalCredits,
        netAmount,
        transactionCount
      }
    });

  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction summary',
      error: error.message
    });
  }
};

// Get single transaction entry
exports.getTransactionEntry = async (req, res) => {
  try {
    const { id } = req.params;
    
    const transactionEntry = await TransactionEntry.findById(id);
    
    if (!transactionEntry) {
      return res.status(404).json({
        success: false,
        message: 'Transaction entry not found'
      });
    }

    res.status(200).json({
      success: true,
      data: transactionEntry
    });

  } catch (error) {
    console.error('Error fetching transaction entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction entry',
      error: error.message
    });
  }
};

// Create manual transaction entry
exports.createTransactionEntry = async (req, res) => {
  try {
    const user = req.user;
    const {
      description,
      reference,
      entries,
      source = 'manual',
      sourceId,
      sourceModel = 'Manual',
      metadata = {}
    } = req.body;

    // Validate entries
    if (!entries || entries.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least two entries are required for double-entry accounting'
      });
    }

    // Calculate totals
    let totalDebit = 0;
    let totalCredit = 0;

    entries.forEach(entry => {
      totalDebit += entry.debit || 0;
      totalCredit += entry.credit || 0;
    });

    // Validate debits equal credits
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Total debits must equal total credits'
      });
    }

    // Create transaction first
    const transaction = new Transaction({
      date: new Date(),
      description,
      reference
    });

    await transaction.save();

    // Create transaction entries
    const transactionEntries = [];

    for (const entry of entries) {
      // Validate account exists
      const account = await Account.findById(entry.accountCode);
      if (!account) {
        return res.status(400).json({
          success: false,
          message: `Account with code ${entry.accountCode} not found`
        });
      }

      const transactionEntry = new TransactionEntry({
        transaction: transaction._id,
        account: entry.accountCode,
        debit: entry.debit || 0,
        credit: entry.credit || 0,
        type: account.type,
        date: transaction.date
      });

      await transactionEntry.save();
      transactionEntries.push(transactionEntry);
    }

    res.status(201).json({
      success: true,
      message: 'Transaction entry created successfully',
      data: {
        transaction,
        entries: transactionEntries
      }
    });

  } catch (error) {
    console.error('Error creating transaction entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating transaction entry',
      error: error.message
    });
  }
};

// Get accounts for dropdown
exports.getAccounts = async (req, res) => {
  try {
    const accounts = await Account.find({}, 'code name type');
    
    res.status(200).json({
      success: true,
      data: accounts
    });

  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching accounts',
      error: error.message
    });
  }
};

// ===== NEW TRANSACTION ENDPOINTS =====

// Get all transactions with filtering and pagination
exports.getAllTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      description,
      reference,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    console.log('🔍 Transactions query params:', req.query);

    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Description filter
    if (description) {
      query.description = { $regex: description, $options: 'i' };
    }

    // Reference filter
    if (reference) {
      query.reference = { $regex: reference, $options: 'i' };
    }

    console.log('🔍 Database query:', JSON.stringify(query, null, 2));

    const options = {
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    };

    // Get transactions
    const transactions = await Transaction.find(query, null, options);
    const total = await Transaction.countDocuments(query);

    console.log(`🔍 Found ${transactions.length} transactions, total: ${total}`);

    // Populate transaction entries for each transaction
    const transactionsWithEntries = await Promise.all(
      transactions.map(async (transaction) => {
        const entries = await TransactionEntry.find({ transaction: transaction._id })
          .populate('account', 'code name type');
        
        return {
          ...transaction.toObject(),
          entries: entries
        };
      })
    );

    res.status(200).json({
      success: true,
      data: transactionsWithEntries,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalTransactions: total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
      error: error.message
    });
  }
};

// Get single transaction by ID
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await Transaction.findById(id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Get transaction entries
    const entries = await TransactionEntry.find({ transaction: transaction._id })
      .populate('account', 'code name type');

    res.status(200).json({
      success: true,
      data: {
        ...transaction.toObject(),
        entries: entries
      }
    });

  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction',
      error: error.message
    });
  }
};

// Create new transaction
exports.createTransaction = async (req, res) => {
  try {
    const user = req.user;
    const {
      description,
      reference,
      date = new Date(),
      entries,
      metadata = {}
    } = req.body;

    // Validate entries
    if (!entries || entries.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least two entries are required for double-entry accounting'
      });
    }

    // Calculate totals
    let totalDebit = 0;
    let totalCredit = 0;

    entries.forEach(entry => {
      totalDebit += entry.debit || 0;
      totalCredit += entry.credit || 0;
    });

    // Validate debits equal credits
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Total debits must equal total credits'
      });
    }

    // Create transaction
    const transaction = new Transaction({
      date: new Date(date),
      description,
      reference,
      createdBy: user._id,
      metadata
    });

    await transaction.save();

    // Create transaction entries
    const transactionEntries = [];

    for (const entry of entries) {
      // Validate account exists
      const account = await Account.findById(entry.account);
      if (!account) {
        return res.status(400).json({
          success: false,
          message: `Account with ID ${entry.account} not found`
        });
      }

      const transactionEntry = new TransactionEntry({
        transaction: transaction._id,
        account: entry.account,
        debit: entry.debit || 0,
        credit: entry.credit || 0,
        type: account.type,
        date: transaction.date,
        createdBy: user._id
      });

      await transactionEntry.save();
      transactionEntries.push(transactionEntry);
    }

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: {
        transaction,
        entries: transactionEntries
      }
    });

  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating transaction',
      error: error.message
    });
  }
};

// Update transaction
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const {
      description,
      reference,
      date,
      entries,
      metadata
    } = req.body;

    const transaction = await Transaction.findById(id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Update transaction
    if (description !== undefined) transaction.description = description;
    if (reference !== undefined) transaction.reference = reference;
    if (date !== undefined) transaction.date = new Date(date);
    if (metadata !== undefined) transaction.metadata = metadata;
    
    transaction.updatedBy = user._id;
    transaction.updatedAt = new Date();

    await transaction.save();

    // Update entries if provided
    if (entries) {
      // Validate entries
      if (entries.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'At least two entries are required for double-entry accounting'
        });
      }

      // Calculate totals
      let totalDebit = 0;
      let totalCredit = 0;

      entries.forEach(entry => {
        totalDebit += entry.debit || 0;
        totalCredit += entry.credit || 0;
      });

      // Validate debits equal credits
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return res.status(400).json({
          success: false,
          message: 'Total debits must equal total credits'
        });
      }

      // Delete existing entries
      await TransactionEntry.deleteMany({ transaction: transaction._id });

      // Create new entries
      const transactionEntries = [];

      for (const entry of entries) {
        const account = await Account.findById(entry.account);
        if (!account) {
          return res.status(400).json({
            success: false,
            message: `Account with ID ${entry.account} not found`
          });
        }

        const transactionEntry = new TransactionEntry({
          transaction: transaction._id,
          account: entry.account,
          debit: entry.debit || 0,
          credit: entry.credit || 0,
          type: account.type,
          date: transaction.date,
          createdBy: user._id
        });

        await transactionEntry.save();
        transactionEntries.push(transactionEntry);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Transaction updated successfully',
      data: transaction
    });

  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating transaction',
      error: error.message
    });
  }
};

// Delete transaction
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findById(id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Delete transaction entries first
    await TransactionEntry.deleteMany({ transaction: transaction._id });

    // Delete transaction
    await Transaction.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting transaction',
      error: error.message
    });
  }
};

// Update transaction entry
exports.updateTransactionEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { account, debit, credit, type, date } = req.body;

    const transactionEntry = await TransactionEntry.findById(id);
    
    if (!transactionEntry) {
      return res.status(404).json({
        success: false,
        message: 'Transaction entry not found'
      });
    }

    // Update fields
    if (account !== undefined) transactionEntry.account = account;
    if (debit !== undefined) transactionEntry.debit = debit;
    if (credit !== undefined) transactionEntry.credit = credit;
    if (type !== undefined) transactionEntry.type = type;
    if (date !== undefined) transactionEntry.date = new Date(date);
    
    transactionEntry.updatedBy = user._id;
    transactionEntry.updatedAt = new Date();

    await transactionEntry.save();

    res.status(200).json({
      success: true,
      message: 'Transaction entry updated successfully',
      data: transactionEntry
    });

  } catch (error) {
    console.error('Error updating transaction entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating transaction entry',
      error: error.message
    });
  }
};

// Delete transaction entry
exports.deleteTransactionEntry = async (req, res) => {
  try {
    const { id } = req.params;

    const transactionEntry = await TransactionEntry.findById(id);
    
    if (!transactionEntry) {
      return res.status(404).json({
        success: false,
        message: 'Transaction entry not found'
      });
    }

    await TransactionEntry.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Transaction entry deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting transaction entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting transaction entry',
      error: error.message
    });
  }
};

// ===== NEW ACCOUNT ENDPOINTS =====

// Get accounts with detailed information
exports.getDetailedAccounts = async (req, res) => {
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

    // Calculate account balances
    const accountsWithBalances = await Promise.all(
      accounts.map(async (account) => {
        const debitEntries = await TransactionEntry.find({ account: account._id });
        const totalDebits = debitEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
        const totalCredits = debitEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
        
        let balance = 0;
        if (account.type === 'Asset' || account.type === 'Expense') {
          balance = totalDebits - totalCredits;
        } else {
          balance = totalCredits - totalDebits;
        }

        return {
          ...account.toObject(),
          balance: balance
        };
      })
    );

    res.status(200).json({
      success: true,
      data: accountsWithBalances,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalAccounts: total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching detailed accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching detailed accounts',
      error: error.message
    });
  }
};

// Get account by ID
exports.getAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const account = await Account.findById(id);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Get account balance
    const debitEntries = await TransactionEntry.find({ account: account._id });
    const totalDebits = debitEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalCredits = debitEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    
    let balance = 0;
    if (account.type === 'Asset' || account.type === 'Expense') {
      balance = totalDebits - totalCredits;
    } else {
      balance = totalCredits - totalDebits;
    }

    // Get recent transactions
    const recentEntries = await TransactionEntry.find({ account: account._id })
      .populate('transaction', 'description reference date')
      .sort({ date: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        ...account.toObject(),
        balance: balance,
        totalDebits: totalDebits,
        totalCredits: totalCredits,
        recentEntries: recentEntries
      }
    });

  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching account',
      error: error.message
    });
  }
}; 