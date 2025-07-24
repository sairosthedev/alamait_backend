const OtherIncome = require('../../models/finance/OtherIncome');
const { generateUniqueId } = require('../../utils/idGenerator');
const { validateMongoId } = require('../../utils/validators');
const { createAuditLog } = require('../../utils/auditLogger');
// Payment/receipt method to Account Code mapping (reuse or define as in expenseController)
const RECEIPT_METHOD_TO_ACCOUNT_CODE = {
  'Cash': '1000', // Bank - Main Account (assuming cash is handled here)
  'Bank Transfer': '1000', // Bank - Main Account
  'Ecocash': '3000', // Owner's Capital (placeholder, update if you have Ecocash account)
  'Innbucks': '4000', // Rental Income - Residential (placeholder, update if you have Innbucks account)
  'Petty Cash': '1010', // Petty Cash
  // Add more as needed
};
const CATEGORY_TO_INCOME_ACCOUNT = {
  'Investment': 'Other Income',
  'Interest': 'Other Income',
  'Commission': 'Other Income',
  'Rental': 'Rental Income - Residential',
  'Service': 'Other Income',
  'Other': 'Other Income'
};
const Transaction = require('../../models/Transaction');
const TransactionEntry = require('../../models/TransactionEntry');
const Account = require('../../models/Account');

// Get all other income entries
exports.getAllOtherIncome = async (req, res) => {
    try {
        const {
            residence,
            category,
            paymentStatus,
            startDate,
            endDate,
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};
        
        if (residence) {
            if (!validateMongoId(residence)) {
                return res.status(400).json({ error: 'Invalid residence ID format' });
            }
            filter.residence = residence;
        }
        
        if (category) filter.category = category;
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        
        // Date filtering
        if (startDate || endDate) {
            filter.incomeDate = {};
            if (startDate) filter.incomeDate.$gte = new Date(startDate);
            if (endDate) filter.incomeDate.$lte = new Date(endDate);
        }

        // Sorting
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get other income entries with pagination
        const otherIncomeEntries = await OtherIncome.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('residence', 'name')
            .populate('createdBy', 'firstName lastName email')
            .populate('updatedBy', 'firstName lastName email')
            .populate('receivedBy', 'firstName lastName email');

        // Get total count for pagination
        const totalOtherIncome = await OtherIncome.countDocuments(filter);
        const totalPages = Math.ceil(totalOtherIncome / parseInt(limit));

        res.status(200).json({
            otherIncomeEntries,
            pagination: {
                totalOtherIncome,
                totalPages,
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching other income entries:', error);
        res.status(500).json({ error: 'Failed to retrieve other income entries' });
    }
};

// Get other income by ID
exports.getOtherIncomeById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid other income ID format' });
        }

        const otherIncome = await OtherIncome.findById(id)
            .populate('residence', 'name')
            .populate('createdBy', 'firstName lastName email')
            .populate('updatedBy', 'firstName lastName email')
            .populate('receivedBy', 'firstName lastName email');

        if (!otherIncome) {
            return res.status(404).json({ error: 'Other income entry not found' });
        }

        res.status(200).json({ otherIncome });
    } catch (error) {
        console.error('Error fetching other income entry:', error);
        res.status(500).json({ error: 'Failed to retrieve other income entry' });
    }
};

// Create new other income entry
exports.createOtherIncome = async (req, res) => {
    try {
        const {
            residence,
            category,
            amount,
            description,
            incomeDate,
            paymentStatus,
            paymentMethod,
            receivedBy,
            receivedDate,
            receiptImage
        } = req.body;

        // Validate required fields
        const requiredFields = ['residence', 'category', 'amount', 'description', 'incomeDate'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                error: 'Missing required fields',
                missingFields,
                message: `Please provide: ${missingFields.join(', ')}`
            });
        }

        // Validate residence ID
        if (!validateMongoId(residence)) {
            return res.status(400).json({ 
                error: 'Invalid residence ID format',
                field: 'residence',
                message: 'Please provide a valid residence ID'
            });
        }

        // Validate category
        const validCategories = ['Investment', 'Interest', 'Commission', 'Rental', 'Service', 'Other'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ 
                error: 'Invalid category',
                field: 'category',
                message: `Category must be one of: ${validCategories.join(', ')}`
            });
        }

        // Validate amount
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ 
                error: 'Invalid amount',
                field: 'amount',
                message: 'Amount must be a positive number'
            });
        }

        // Validate income date
        const date = new Date(incomeDate);
        if (isNaN(date.getTime())) {
            return res.status(400).json({ 
                error: 'Invalid income date',
                field: 'incomeDate',
                message: 'Please provide a valid date'
            });
        }

        // Validate payment method if status is Received
        if (paymentStatus === 'Received') {
            const validPaymentMethods = ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal'];
            if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
                return res.status(400).json({ 
                    error: 'Valid payment method is required when status is Received',
                    field: 'paymentMethod',
                    message: `Payment method must be one of: ${validPaymentMethods.join(', ')}`
                });
            }
        }

        // Generate unique income ID
        const incomeId = await generateUniqueId('OI');

        // Create new other income entry
        const newOtherIncome = new OtherIncome({
            incomeId,
            residence,
            category,
            amount: parseFloat(amount),
            description,
            incomeDate: date,
            paymentStatus: paymentStatus || 'Pending',
            paymentMethod: paymentStatus === 'Received' ? paymentMethod : undefined,
            receivedBy: paymentStatus === 'Received' ? receivedBy : undefined,
            receivedDate: paymentStatus === 'Received' ? (receivedDate ? new Date(receivedDate) : new Date()) : undefined,
            receiptImage,
            createdBy: req.user._id
        });

        // Save other income entry
        await newOtherIncome.save();

        // Double-entry transaction for received income
        if (newOtherIncome.paymentStatus === 'Received') {
          try {
            const paymentMethod = newOtherIncome.paymentMethod || 'Petty Cash';
            const destAccountCode = RECEIPT_METHOD_TO_ACCOUNT_CODE[paymentMethod] || '1010';
            const destAccount = await Account.findOne({ code: destAccountCode });
            if (!destAccount) {
              console.error('[Income] Destination account not found for payment method:', paymentMethod, 'using code:', destAccountCode);
              throw new Error('Destination account not found for payment method: ' + paymentMethod);
            }
            const mappedIncomeAccountName = CATEGORY_TO_INCOME_ACCOUNT[newOtherIncome.category] || newOtherIncome.category;
            const incomeAccount = await Account.findOne({ name: new RegExp('^' + mappedIncomeAccountName + '$', 'i'), type: 'Income' });
            if (!incomeAccount) {
              console.error('[Income] Income account not found for category:', newOtherIncome.category, 'using mapping:', mappedIncomeAccountName);
              throw new Error('Income account not found for category: ' + newOtherIncome.category);
            }
            const txn = await Transaction.create({
              date: newOtherIncome.receivedDate || new Date(),
              description: `Income Received: ${newOtherIncome.description}`,
              reference: newOtherIncome.incomeId,
              residence: newOtherIncome.residence?._id || newOtherIncome.residence,
              residenceName: newOtherIncome.residence?.name || undefined
            });
            const entries = await TransactionEntry.insertMany([
              { transaction: txn._id, account: destAccount._id, debit: newOtherIncome.amount, credit: 0, type: destAccount.type.toLowerCase() },
              { transaction: txn._id, account: incomeAccount._id, debit: 0, credit: newOtherIncome.amount, type: 'income' }
            ]);
            await Transaction.findByIdAndUpdate(txn._id, { $push: { entries: { $each: entries.map(e => e._id) } } });
            await createAuditLog({
              user: req.user._id,
              action: 'double_entry_income',
              collection: 'Transaction',
              recordId: txn._id,
              before: null,
              after: txn.toObject(),
              timestamp: new Date(),
              details: {
                source: 'OtherIncome',
                sourceId: newOtherIncome._id,
                description: 'Income received and recorded as double-entry transaction'
              }
            });
            console.log('[Income] Double-entry transaction created for income:', newOtherIncome._id, 'txn:', txn._id);
          } catch (incomeTxnError) {
            console.error('[Income] Failed to create double-entry transaction for income:', newOtherIncome._id, incomeTxnError);
            return res.status(500).json({ error: 'Failed to create double-entry transaction for received income', details: incomeTxnError.message });
          }
        }

        // Populate the saved entry
        await newOtherIncome.populate('residence', 'name');
        await newOtherIncome.populate('createdBy', 'firstName lastName email');

        // Audit log
        await createAuditLog({
            user: req.user._id,
            action: 'create',
            collection: 'OtherIncome',
            recordId: newOtherIncome._id,
            before: null,
            after: newOtherIncome.toObject()
        });

        res.status(201).json({
            message: 'Other income entry created successfully',
            otherIncome: newOtherIncome
        });
    } catch (error) {
        console.error('Error creating other income entry:', error);
        res.status(500).json({ error: 'Failed to create other income entry' });
    }
};

// Update other income entry
exports.updateOtherIncome = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid other income ID format' });
        }

        // Find other income entry
        const otherIncome = await OtherIncome.findById(id);
        if (!otherIncome) {
            return res.status(404).json({ error: 'Other income entry not found' });
        }

        const before = otherIncome.toObject();

        // Validate residence ID if provided
        if (updateData.residence && !validateMongoId(updateData.residence)) {
            return res.status(400).json({ error: 'Invalid residence ID format' });
        }

        // Validate category if provided
        if (updateData.category) {
            const validCategories = ['Investment', 'Interest', 'Commission', 'Rental', 'Service', 'Other'];
            if (!validCategories.includes(updateData.category)) {
                return res.status(400).json({ 
                    error: 'Invalid category',
                    message: `Category must be one of: ${validCategories.join(', ')}`
                });
            }
        }

        // Validate amount if provided
        if (updateData.amount !== undefined) {
            if (isNaN(updateData.amount) || updateData.amount <= 0) {
                return res.status(400).json({ 
                    error: 'Invalid amount',
                    message: 'Amount must be a positive number'
                });
            }
            updateData.amount = parseFloat(updateData.amount);
        }

        // Format dates if provided
        if (updateData.incomeDate) updateData.incomeDate = new Date(updateData.incomeDate);
        if (updateData.receivedDate) updateData.receivedDate = new Date(updateData.receivedDate);

        // Handle payment status changes
        if (updateData.paymentStatus === 'Received') {
            const validPaymentMethods = ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal'];
            if (!updateData.paymentMethod || !validPaymentMethods.includes(updateData.paymentMethod)) {
                return res.status(400).json({ 
                    error: 'Valid payment method is required when status is Received',
                    message: `Payment method must be one of: ${validPaymentMethods.join(', ')}`
                });
            }
            if (!updateData.receivedDate) {
                updateData.receivedDate = new Date();
            }
        } else if (updateData.paymentStatus && updateData.paymentStatus !== 'Received') {
            // Clear payment-related fields if status is not Received
            updateData.paymentMethod = undefined;
            updateData.receivedBy = undefined;
            updateData.receivedDate = undefined;
        }

        // Add updatedBy field
        updateData.updatedBy = req.user._id;

        // Update other income entry
        const updatedOtherIncome = await OtherIncome.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('residence', 'name')
         .populate('createdBy', 'firstName lastName email')
         .populate('updatedBy', 'firstName lastName email')
         .populate('receivedBy', 'firstName lastName email');

        // Audit log
        await createAuditLog({
            user: req.user._id,
            action: 'update',
            collection: 'OtherIncome',
            recordId: updatedOtherIncome._id,
            before,
            after: updatedOtherIncome.toObject()
        });

        res.status(200).json({
            message: 'Other income entry updated successfully',
            otherIncome: updatedOtherIncome
        });
    } catch (error) {
        console.error('Error updating other income entry:', error);
        res.status(500).json({ error: 'Failed to update other income entry' });
    }
};

// Delete other income entry
exports.deleteOtherIncome = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid other income ID format' });
        }

        // Find other income entry
        const otherIncome = await OtherIncome.findById(id);
        if (!otherIncome) {
            return res.status(404).json({ error: 'Other income entry not found' });
        }

        const before = otherIncome.toObject();

        // Delete other income entry
        await OtherIncome.findByIdAndDelete(id);

        // Audit log
        await createAuditLog({
            user: req.user._id,
            action: 'delete',
            collection: 'OtherIncome',
            recordId: id,
            before,
            after: null
        });

        res.status(200).json({
            message: 'Other income entry deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting other income entry:', error);
        res.status(500).json({ error: 'Failed to delete other income entry' });
    }
};

// Get other income summary statistics
exports.getOtherIncomeSummary = async (req, res) => {
    try {
        const { residence, startDate, endDate } = req.query;

        // Build filter object
        const filter = {};
        
        if (residence) {
            if (!validateMongoId(residence)) {
                return res.status(400).json({ error: 'Invalid residence ID format' });
            }
            filter.residence = residence;
        }
        
        // Date filtering
        if (startDate || endDate) {
            filter.incomeDate = {};
            if (startDate) filter.incomeDate.$gte = new Date(startDate);
            if (endDate) filter.incomeDate.$lte = new Date(endDate);
        }

        // Get total other income amount
        const totalOtherIncomeAmount = await OtherIncome.aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Get other income by category
        const otherIncomeByCategory = await OtherIncome.aggregate([
            { $match: filter },
            { $group: { _id: '$category', total: { $sum: '$amount' } } },
            { $sort: { total: -1 } }
        ]);

        // Get other income by payment status
        const otherIncomeByStatus = await OtherIncome.aggregate([
            { $match: filter },
            { $group: { _id: '$paymentStatus', total: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { total: -1 } }
        ]);

        // Get other income by month (last 12 months)
        const otherIncomeByMonth = await OtherIncome.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: {
                        year: { $year: '$incomeDate' },
                        month: { $month: '$incomeDate' }
                    },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
        ]);

        res.status(200).json({
            summary: {
                totalAmount: totalOtherIncomeAmount.length > 0 ? totalOtherIncomeAmount[0].total : 0,
                totalEntries: await OtherIncome.countDocuments(filter)
            },
            byCategory: otherIncomeByCategory,
            byStatus: otherIncomeByStatus,
            byMonth: otherIncomeByMonth
        });
    } catch (error) {
        console.error('Error fetching other income summary:', error);
        res.status(500).json({ error: 'Failed to retrieve other income summary' });
    }
}; 