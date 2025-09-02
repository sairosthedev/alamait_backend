const TransactionEntry = require('../models/TransactionEntry');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const AdvancePayment = require('../models/AdvancePayment');

// Get all transactions with entries (for frontend compatibility)
exports.getAllTransactions = async (req, res) => {
  try {
    console.log('🔍 Fetching all transactions with entries');
    
    // Get all transaction entries (this is the main model that contains the data)
    const transactionEntries = await TransactionEntry.find({}).sort({ date: -1 });
    
    console.log(`🔍 Found ${transactionEntries.length} transaction entries`);
    
    // Transform the data to match frontend expectations
    const transactionsWithEntries = transactionEntries.map(entry => {
      // Transform entries to match frontend expectations
      const transformedEntries = (entry.entries || []).map(entryItem => ({
        _id: `${entry._id}_${entryItem.accountCode}`,
        account: {
          code: entryItem.accountCode,
          name: entryItem.accountName,
          type: entryItem.accountType
        },
        debit: entryItem.debit || 0,
        credit: entryItem.credit || 0,
        type: entryItem.accountType,
        date: entry.date
      }));
      
      return {
        _id: entry._id,
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        entries: transformedEntries,
        // Add source information for debugging
        source: entry.source,
        sourceModel: entry.sourceModel,
        sourceId: entry.sourceId
      };
    });
    
    console.log(`🔍 Returning ${transactionsWithEntries.length} transactions with entries`);
    
    // Debug: Log first transaction structure
    if (transactionsWithEntries.length > 0) {
      console.log('🔍 First transaction structure:', JSON.stringify(transactionsWithEntries[0], null, 2));
    }
    
    res.status(200).json(transactionsWithEntries);
    
  } catch (error) {
    console.error('❌ Error fetching all transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching all transactions',
      error: error.message
    });
  }
};

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

// Create transaction entry
exports.createTransactionEntry = async (req, res) => {
  try {
    const {
      description,
      reference,
      residence, // Add residence requirement
      entries
    } = req.body;

    // Validate residence is provided
    if (!residence) {
      return res.status(400).json({
        success: false,
        message: 'Residence/entity is required for transaction creation'
      });
    }

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

    // Create transaction first with residence information
    const transaction = new Transaction({
      date: new Date(),
      description,
      reference,
      residence: residence._id || residence, // Ensure we have the residence ID
      residenceName: residence?.name || 'Unknown Residence',
      type: 'manual',
      createdBy: req.user._id
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
        date: transaction.date,
        residence: residence._id || residence, // Add residence information
        metadata: {
          residenceId: residence._id || residence,
          residenceName: residence?.name || 'Unknown',
          createdBy: req.user.email
        }
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

/**
 * Update transaction entry
 */
exports.updateTransactionEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('🔧 Updating transaction entry:', id, 'with data:', updateData);
    
    // Find the transaction entry
    const transactionEntry = await TransactionEntry.findById(id);
    if (!transactionEntry) {
      return res.status(404).json({
        success: false,
        message: 'Transaction entry not found'
      });
    }
    
    // Store original data for audit
    const originalData = transactionEntry.toObject();
    
    // Validate update data
    const allowedFields = [
      'description', 
      'debit', 
      'credit', 
      'date', 
      'account', 
      'accountName', 
      'accountType',
      'metadata'
    ];
    
    const filteredUpdateData = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredUpdateData[field] = updateData[field];
      }
    }
    
    // Validate debits and credits if both are provided
    if (filteredUpdateData.debit !== undefined && filteredUpdateData.credit !== undefined) {
      if (filteredUpdateData.debit > 0 && filteredUpdateData.credit > 0) {
        return res.status(400).json({
          success: false,
          message: 'Transaction entry cannot have both debit and credit amounts'
        });
      }
    }
    
    // Add audit information
    filteredUpdateData.updatedBy = req.user._id;
    filteredUpdateData.updatedAt = new Date();
    
    // Update the transaction entry
    const updatedEntry = await TransactionEntry.findByIdAndUpdate(
      id,
      filteredUpdateData,
      { new: true, runValidators: true }
    );
    
    console.log('✅ Transaction entry updated successfully');
    
    res.status(200).json({
      success: true,
      message: 'Transaction entry updated successfully',
      data: updatedEntry
    });
    
  } catch (error) {
    console.error('Error updating transaction entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update transaction entry',
      error: error.message
    });
  }
};

/**
 * Delete transaction entry
 */
exports.deleteTransactionEntry = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Deleting transaction entry:', id);
    
    // Find the transaction entry
    const transactionEntry = await TransactionEntry.findById(id);
    if (!transactionEntry) {
      return res.status(404).json({
        success: false,
        message: 'Transaction entry not found'
      });
    }
    
    // Store data for audit
    const deletedData = transactionEntry.toObject();
    
    // Check if this is part of a balanced transaction
    // If it's part of a double-entry transaction, we might need to handle it differently
    if (transactionEntry.source && transactionEntry.sourceId) {
      console.log('⚠️ Transaction entry is part of a source transaction:', {
        source: transactionEntry.source,
        sourceId: transactionEntry.sourceId
      });
      
      // For now, we'll allow deletion but log a warning
      // In a production system, you might want to prevent deletion of system-generated entries
    }
    
    // Delete the transaction entry
    await TransactionEntry.findByIdAndDelete(id);
    
    console.log('✅ Transaction entry deleted successfully');
    
    res.status(200).json({
      success: true,
      message: 'Transaction entry deleted successfully',
      data: {
        deletedEntry: deletedData
      }
    });
    
  } catch (error) {
    console.error('Error deleting transaction entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete transaction entry',
      error: error.message
    });
  }
}; 