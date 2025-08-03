const TransactionEntry = require('../models/TransactionEntry');
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

    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Account filter
    if (account && account !== 'all') {
      query['entries.accountCode'] = account;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Type filter (debit/credit)
    if (type && type !== 'all') {
      if (type === 'debit') {
        query['entries.debit'] = { $gt: 0 };
      } else if (type === 'credit') {
        query['entries.credit'] = { $gt: 0 };
      }
    }

    const options = {
      sort: { date: -1 },
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    };

    const transactionEntries = await TransactionEntry.find(query, null, options);
    const total = await TransactionEntry.countDocuments(query);

    // Transform data for frontend
    const transformedTransactions = transactionEntries.map(entry => {
      // Flatten entries for table display
      const transactions = [];
      
      entry.entries.forEach(entryItem => {
        if (entryItem.debit > 0) {
          transactions.push({
            _id: `${entry._id}_debit_${entryItem.accountCode}`,
            transactionId: entry.transactionId,
            timestamp: entry.date,
            type: 'debit',
            accountName: entryItem.accountName,
            accountType: entryItem.accountType,
            accountCode: entryItem.accountCode,
            amount: entryItem.debit,
            description: entryItem.description || entry.description,
            reference: entry.reference,
            referenceType: entry.source,
            referenceId: entry.sourceId,
            createdByEmail: entry.createdBy,
            createdAt: entry.createdAt,
            metadata: entry.metadata
          });
        }
        
        if (entryItem.credit > 0) {
          transactions.push({
            _id: `${entry._id}_credit_${entryItem.accountCode}`,
            transactionId: entry.transactionId,
            timestamp: entry.date,
            type: 'credit',
            accountName: entryItem.accountName,
            accountType: entryItem.accountType,
            accountCode: entryItem.accountCode,
            amount: entryItem.credit,
            description: entryItem.description || entry.description,
            reference: entry.reference,
            referenceType: entry.source,
            referenceId: entry.sourceId,
            createdByEmail: entry.createdBy,
            createdAt: entry.createdAt,
            metadata: entry.metadata
          });
        }
      });
      
      return transactions;
    }).flat();

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
    console.error('Error fetching transaction entries:', error);
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
      query['entries.accountCode'] = account;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    const transactionEntries = await TransactionEntry.find(query);

    let totalDebits = 0;
    let totalCredits = 0;
    let transactionCount = 0;

    transactionEntries.forEach(entry => {
      entry.entries.forEach(entryItem => {
        totalDebits += entryItem.debit || 0;
        totalCredits += entryItem.credit || 0;
      });
      transactionCount++;
    });

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

    // Validate accounts exist
    for (const entry of entries) {
      const account = await Account.findOne({ code: entry.accountCode });
      if (!account) {
        return res.status(400).json({
          success: false,
          message: `Account with code ${entry.accountCode} not found`
        });
      }
      // Add account name and type to entry
      entry.accountName = account.name;
      entry.accountType = account.type;
    }

    const transactionEntry = new TransactionEntry({
      description,
      reference,
      entries,
      totalDebit,
      totalCredit,
      source,
      sourceId,
      sourceModel,
      createdBy: user.email,
      metadata
    });

    await transactionEntry.save();

    res.status(201).json({
      success: true,
      message: 'Transaction entry created successfully',
      data: transactionEntry
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