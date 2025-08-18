const Expense = require('../../models/finance/Expense');
const mongoose = require('mongoose');
const { generateUniqueId } = require('../../utils/idGenerator');
const Residence = require('../../models/Residence');
const Maintenance = require('../../models/Maintenance');
const Transaction = require('../../models/Transaction');
const TransactionEntry = require('../../models/TransactionEntry');
const Account = require('../../models/Account');
const AuditLog = require('../../models/AuditLog');
const { getPettyCashAccountByRole } = require('../../utils/pettyCashUtils');

// Category to Account Code mapping for Expense linkage (updated to match chart of accounts)
const CATEGORY_TO_ACCOUNT_CODE = {
  'Maintenance': '5003', // Transportation Expense (for maintenance)
  'Utilities': '5001', // Utilities - Water (for utilities)
  'Water': '5001', // Utilities - Water (specific for water)
  'Taxes': '5099', // Other Operating Expenses (for taxes)
  'Insurance': '5099', // Other Operating Expenses (for insurance)
  'Salaries': '5099', // Other Operating Expenses (for salaries)
  'Supplies': '5099', // Other Operating Expenses (for supplies)
  'Other': '5099' // Other Operating Expenses (fallback)
};

// Payment method to Account Code mapping (updated to match chart of accounts)
const PAYMENT_METHOD_TO_ACCOUNT_CODE = {
  'Cash': '1011', // Admin Petty Cash
  'Bank Transfer': '1000', // Bank - Main Account (assuming this exists)
  'Ecocash': '1011', // Admin Petty Cash
  'Innbucks': '1011', // Admin Petty Cash
  'Petty Cash': '1011', // Admin Petty Cash
  'Online Payment': '1000', // Bank - Main Account
  'MasterCard': '1000', // Bank - Main Account
  'Visa': '1000', // Bank - Main Account
  'PayPal': '1000' // Bank - Main Account
};

// Get expenses with filters
const getExpenses = async (req, res) => {
    try {
        console.log('Fetching expenses with filters:', req.query);
        
        const { date, category, description, amount, residence, period } = req.query;

        // Build a query object based on the provided filters
        const query = {};

        if (date) {
            query.expenseDate = date;
        }

        if (category) {
            query.category = { $regex: category, $options: 'i' };
        }

        if (description) {
            query.description = { $regex: description, $options: 'i' };
        }

        if (amount) {
            query.amount = amount;
        }

        // Only add residence to query if it's not "all"
        if (residence && residence !== 'all') {
            try {
                query.residence = new mongoose.Types.ObjectId(residence);
            } catch (error) {
                return res.status(400).json({
                    message: 'Invalid residence ID format',
                    field: 'residence'
                });
            }
        }

        // Handle weekly or monthly filtering
        if (period === 'weekly') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            query.expenseDate = { $gte: oneWeekAgo };
        } else if (period === 'monthly') {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            query.expenseDate = { $gte: oneMonthAgo };
        }

        // Add pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Get total count for pagination
        const total = await Expense.countDocuments(query);

        // Fetch expenses with filters and pagination
        const expenses = await Expense.find(query)
            .sort({ expenseDate: -1 })
            .skip(skip)
            .limit(limit)
            .populate('residence', 'name')
            .populate('paidBy', 'firstName lastName')
            .populate('createdBy', 'firstName lastName');

        // Add source information for finance users
        const expensesWithSource = expenses.map(expense => ({
            ...expense.toObject(),
            source: 'admin' // Add source information
        }));

        res.status(200).json({
            expenses: expensesWithSource,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ message: error.message });
    }
};

// Add new expense
const addExpense = async (req, res) => {
    try {
        const {
            residence,
            category,
            amount,
            description,
            expenseDate,
            paymentStatus,
            period,
            paymentMethod,
            paidDate,
            type,
            status
        } = req.body;

        // Validate required fields
        if (!residence || !category || !amount || !description || !expenseDate || !period) {
            return res.status(400).json({
                message: 'Missing required fields',
                required: ['residence', 'category', 'amount', 'description', 'expenseDate', 'period']
            });
        }

        // Validate period
        if (!['weekly', 'monthly'].includes(period)) {
            return res.status(400).json({
                message: 'Invalid period value',
                allowed: ['weekly', 'monthly']
            });
        }

        // Validate category
        const validCategories = ['Maintenance', 'Utilities', 'Taxes', 'Insurance', 'Salaries', 'Supplies', 'Other'];
        const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
        
        if (!validCategories.includes(formattedCategory)) {
            return res.status(400).json({
                message: 'Invalid category value',
                allowed: validCategories
            });
        }

        // Validate payment method if status is Paid
        if (paymentStatus === 'Paid') {
            const validPaymentMethods = ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks'];
            if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
                return res.status(400).json({
                    message: 'Valid payment method is required when status is Paid',
                    allowed: validPaymentMethods
                });
            }
        }

        // Generate unique expense ID
        const expenseId = await generateUniqueId('EXP');

        // Create new expense
        const expense = new Expense({
            expenseId,
            residence,
            category: formattedCategory,
            amount: parseFloat(amount),
            description,
            expenseDate: new Date(expenseDate),
            paymentStatus: paymentStatus || 'Pending',
            period,
            paymentMethod: paymentStatus === 'Paid' ? paymentMethod : undefined,
            paidDate: paymentStatus === 'Paid' ? new Date(paidDate) : undefined,
            paidBy: paymentStatus === 'Paid' ? req.user._id : undefined,
            createdBy: req.user._id,
            notes: req.body.provider ? `Provider: ${req.body.provider}` : undefined
        });

        await expense.save();

        // --- Create Transaction Entries for Expense ---
        try {
            console.log('[Admin Expense] Creating transaction entries for expense:', expense._id, 'category:', expense.category);
            
            // Get expense account using the category mapping
            const expenseAccountCode = CATEGORY_TO_ACCOUNT_CODE[expense.category] || '5099';
            const expenseAccount = await Account.findOne({ code: expenseAccountCode, type: 'Expense' });
            
            if (!expenseAccount) {
                console.error('[Admin Expense] Expense account not found for category:', expense.category);
                throw new Error('Expense account not found for category: ' + expense.category);
            }
            
            // If expense is marked as paid, create payment transaction
            if (expense.paymentStatus === 'Paid') {
                // Determine source account based on payment method
                const finalPaymentMethod = expense.paymentMethod || 'Bank Transfer';
                let sourceAccount;
                
                if (finalPaymentMethod === 'Petty Cash') {
                    // Get role-specific petty cash account based on user role
                    sourceAccount = await getPettyCashAccountByRole(req.user.role);
                } else {
                    // Use the mapping for other payment methods
                    const sourceAccountCode = PAYMENT_METHOD_TO_ACCOUNT_CODE[finalPaymentMethod] || '1011';
                    sourceAccount = await Account.findOne({ code: sourceAccountCode });
                }
                
                if (!sourceAccount) {
                    console.error('[Admin Expense] Source account not found for payment method:', finalPaymentMethod);
                    throw new Error('Source account not found for payment method: ' + finalPaymentMethod);
                }
                
                // Create transaction for paid expense
                const txn = await Transaction.create({
                    date: expense.paidDate || new Date(),
                    description: `Admin Expense Payment: ${expense.description}`,
                    reference: expense.expenseId,
                    residence: expense.residence,
                    residenceName: undefined // Will be populated if needed
                });
                
                // Create double-entry transaction entries for paid expense
                const entries = await TransactionEntry.insertMany([
                    { 
                        transaction: txn._id, 
                        account: expenseAccount._id, 
                        debit: expense.amount, 
                        credit: 0, 
                        type: 'expense' 
                    },
                    { 
                        transaction: txn._id, 
                        account: sourceAccount._id, 
                        debit: 0, 
                        credit: expense.amount, 
                        type: sourceAccount.type.toLowerCase() 
                    }
                ]);
                
                // Link entries to transaction
                await Transaction.findByIdAndUpdate(txn._id, { 
                    $push: { entries: { $each: entries.map(e => e._id) } } 
                });
                
                // Create audit log for the transaction
                await AuditLog.create({
                    user: req.user._id,
                    action: `admin_expense_paid_${finalPaymentMethod.replace(/\s+/g, '_').toLowerCase()}`,
                    collection: 'Transaction',
                    recordId: txn._id,
                    before: null,
                    after: txn.toObject(),
                    timestamp: new Date(),
                    details: {
                        source: 'Admin Expense',
                        sourceId: expense._id,
                        expenseCategory: expense.category,
                        expenseAmount: expense.amount,
                        paymentMethod: finalPaymentMethod,
                        sourceAccount: sourceAccount.code,
                        expenseAccount: expenseAccount.code,
                        description: `Admin expense paid via ${finalPaymentMethod} - ${expense.description}`
                    }
                });
                
                console.log('[Admin Expense] Payment transaction created for expense:', expense._id, 'txn:', txn._id);
                
            } else {
                // If expense is pending, create AP liability entry
                const apAccount = await Account.findOne({ code: '2000', type: 'Liability' });
                if (!apAccount) {
                    console.error('[Admin Expense] General Accounts Payable account not found');
                    throw new Error('General Accounts Payable account not found');
                }
                
                // Create transaction for pending expense (creates AP liability)
                const txn = await Transaction.create({
                    date: new Date(),
                    description: `Admin Expense Created: ${expense.description}`,
                    reference: expense.expenseId,
                    residence: expense.residence,
                    residenceName: undefined
                });
                
                // Create double-entry transaction entries for AP creation
                const entries = await TransactionEntry.insertMany([
                    { 
                        transaction: txn._id, 
                        account: expenseAccount._id, 
                        debit: expense.amount, 
                        credit: 0, 
                        type: 'expense' 
                    },
                    { 
                        transaction: txn._id, 
                        account: apAccount._id, 
                        debit: 0, 
                        credit: expense.amount, 
                        type: 'liability' 
                    }
                ]);
                
                // Link entries to transaction
                await Transaction.findByIdAndUpdate(txn._id, { 
                    $push: { entries: { $each: entries.map(e => e._id) } } 
                });
                
                // Create audit log for the AP creation
                await AuditLog.create({
                    user: req.user._id,
                    action: 'admin_expense_created_ap_liability',
                    collection: 'Transaction',
                    recordId: txn._id,
                    before: null,
                    after: txn.toObject(),
                    timestamp: new Date(),
                    details: {
                        source: 'Admin Expense',
                        sourceId: expense._id,
                        expenseCategory: expense.category,
                        expenseAmount: expense.amount,
                        apAccount: apAccount.code,
                        expenseAccount: expenseAccount.code,
                        description: `Admin expense created - AP liability created for ${expense.description}`
                    }
                });
                
                console.log('[Admin Expense] AP liability transaction created for expense:', expense._id, 'txn:', txn._id);
            }
            
        } catch (transactionError) {
            console.error('[Admin Expense] Failed to create transaction entries for expense:', expense._id, transactionError);
            // Don't fail the request, but log the error
            console.error('Transaction creation failed, but expense was saved:', transactionError.message);
        }
        // --- End Transaction Entries Creation ---

        // Create audit log for expense creation
        await AuditLog.create({
            user: req.user._id,
            action: 'create',
            collection: 'Expense',
            recordId: expense._id,
            before: null,
            after: expense.toObject(),
            timestamp: new Date(),
            details: {
                source: 'Admin',
                description: `Admin expense created - ${expense.description}`
            }
        });

        // Return the created expense with populated fields
        const populatedExpense = await Expense.findById(expense._id)
            .populate('residence', 'name')
            .populate('createdBy', 'firstName lastName email')
            .populate('paidBy', 'firstName lastName email');

        res.status(201).json({
            message: 'Expense added successfully',
            expense: populatedExpense
        });
    } catch (error) {
        console.error('Error adding expense:', error);
        res.status(500).json({ message: error.message });
    }
};

//
// Send expenses to finance
const sendToFinance = async (req, res) => {
    try {
        console.log('Sending expenses to finance:', req.body);

        // Validate required fields
        if (!req.body.expenseIds || !Array.isArray(req.body.expenseIds)) {
            return res.status(400).json({
                message: 'expenseIds array is required'
            });
        }

        // Update expenses to mark them as sent to finance
        const result = await Expense.updateMany(
            {
                _id: { $in: req.body.expenseIds },
                paymentStatus: 'Pending'
            },
            {
                $set: {
                    paymentStatus: 'Sent to Finance',
                    updatedBy: req.user._id // Assuming req.user is set by auth middleware
                }
            }
        );

        console.log('Successfully sent expenses to finance:', result);

        res.status(200).json({
            message: 'Expenses sent to finance successfully',
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error sending expenses to finance:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update expense status
const updateExpenseStatus = async (req, res) => {
    try {
        const { expenseId } = req.params;
        const { paymentStatus } = req.body;

        // Validate expense ID
        if (!mongoose.Types.ObjectId.isValid(expenseId)) {
            return res.status(400).json({
                message: 'Invalid expense ID format'
            });
        }

        // Validate paymentStatus
        const validStatuses = ['Pending', 'Paid', 'Overdue'];
        if (!paymentStatus || !validStatuses.includes(paymentStatus)) {
            return res.status(400).json({
                message: 'Valid payment status is required',
                validStatuses
            });
        }

        // Find the expense
        const expense = await Expense.findById(expenseId);
        if (!expense) {
            return res.status(404).json({
                message: 'Expense not found'
            });
        }

        // If status is being set to Paid, ensure paymentMethod is provided
        if (paymentStatus === 'Paid' && !req.body.paymentMethod) {
            return res.status(400).json({
                message: 'Payment method is required when marking expense as paid',
                validPaymentMethods: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks']
            });
        }

        // Update the status
        expense.paymentStatus = paymentStatus;
        expense.updatedBy = req.user._id;
        expense.updatedAt = new Date();

        // If marking as paid, add payment details
        if (paymentStatus === 'Paid') {
            expense.paymentMethod = req.body.paymentMethod;
            expense.paidBy = req.user._id;
            expense.paidDate = new Date();
        }

        // Add to status history
        expense.statusHistory = expense.statusHistory || [];
        expense.statusHistory.push({
            status: paymentStatus,
            date: new Date(),
            updatedBy: req.user._id
        });

        await expense.save();

        // Return the updated expense with populated fields
        const updatedExpense = await Expense.findById(expenseId)
            .populate('residence', 'name')
            .populate('paidBy', 'firstName lastName')
            .populate('createdBy', 'firstName lastName');

        res.status(200).json({
            message: `Expense status updated to ${paymentStatus} successfully`,
            expense: updatedExpense
        });
    } catch (error) {
        console.error('Error updating expense status:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get expense totals
const getExpenseTotals = async (req, res) => {
    try {
        const { period, residence, date } = req.query;
        
        // Build query based on filters
        const query = {};

        // Add residence filter if not 'all'
        if (residence && residence !== 'all') {
            try {
                query.residence = new mongoose.Types.ObjectId(residence);
            } catch (error) {
                return res.status(400).json({
                    message: 'Invalid residence ID format',
                    field: 'residence'
                });
            }
        }

        // Handle date filter
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query.expenseDate = { $gte: startDate, $lte: endDate };
        }

        // Handle period filter
        if (period === 'weekly') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            query.expenseDate = { $gte: oneWeekAgo };
        } else if (period === 'monthly') {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            query.expenseDate = { $gte: oneMonthAgo };
        }

        // Get total expenses
        const totalExpenses = await Expense.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Get expenses by status
        const expensesByStatus = await Expense.aggregate([
            { $match: query },
            { $group: { _id: '$paymentStatus', total: { $sum: '$amount' } } }
        ]);

        // Get expenses by category
        const expensesByCategory = await Expense.aggregate([
            { $match: query },
            { $group: { _id: '$category', total: { $sum: '$amount' } } }
        ]);

        res.status(200).json({
            total: totalExpenses[0]?.total || 0,
            byStatus: expensesByStatus.reduce((acc, curr) => {
                acc[curr._id] = curr.total;
                return acc;
            }, {}),
            byCategory: expensesByCategory.reduce((acc, curr) => {
                acc[curr._id] = curr.total;
                return acc;
            }, {})
        });
    } catch (error) {
        console.error('Error getting expense totals:', error);
        res.status(500).json({ message: error.message });
    }
};

const approveExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentMethod } = req.body;

        // Validate payment method
        const validPaymentMethods = ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks'];
        if (!validPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payment method',
                message: `Payment method must be one of: ${validPaymentMethods.join(', ')}`
            });
        }

        // Find the expense
        const expense = await Expense.findById(id);
        if (!expense) {
            return res.status(404).json({
                success: false,
                error: 'Not found',
                message: 'Expense not found'
            });
        }

        // Check if expense is already paid
        if (expense.paymentStatus === 'Paid') {
            return res.status(400).json({
                success: false,
                error: 'Already paid',
                message: 'This expense has already been paid'
            });
        }

        const before = expense.toObject();

        // Update the expense
        expense.paymentStatus = 'Paid';
        expense.paymentMethod = paymentMethod;
        expense.paidDate = new Date();
        expense.paidBy = req.user._id;
        await expense.save();

        // --- Create Payment Transaction for Approved Expense ---
        try {
            console.log('[Admin Approve] Creating payment transaction for expense:', expense._id, 'category:', expense.category);
            
            // Get expense account using the category mapping
            const expenseAccountCode = CATEGORY_TO_ACCOUNT_CODE[expense.category] || '5099';
            const expenseAccount = await Account.findOne({ code: expenseAccountCode, type: 'Expense' });
            
            if (!expenseAccount) {
                console.error('[Admin Approve] Expense account not found for category:', expense.category);
                throw new Error('Expense account not found for category: ' + expense.category);
            }
            
            // Get general Accounts Payable account for AP reduction
            const apAccount = await Account.findOne({ code: '2000', type: 'Liability' });
            if (!apAccount) {
                console.error('[Admin Approve] General Accounts Payable account not found');
                throw new Error('General Accounts Payable account not found');
            }
            
            // Determine source account based on payment method
            let sourceAccount;
            if (paymentMethod === 'Petty Cash') {
                // Get role-specific petty cash account based on user role
                sourceAccount = await getPettyCashAccountByRole(req.user.role);
            } else {
                // Use the mapping for other payment methods
                const sourceAccountCode = PAYMENT_METHOD_TO_ACCOUNT_CODE[paymentMethod] || '1011';
                sourceAccount = await Account.findOne({ code: sourceAccountCode });
            }
            
            if (!sourceAccount) {
                console.error('[Admin Approve] Source account not found for payment method:', paymentMethod);
                throw new Error('Source account not found for payment method: ' + paymentMethod);
            }
            
            // Create transaction for payment (reduces AP liability)
            const txn = await Transaction.create({
                date: expense.paidDate || new Date(),
                description: `Admin Expense Payment: ${expense.description}`,
                reference: expense.expenseId,
                residence: expense.residence,
                residenceName: undefined
            });
            
            // Create double-entry transaction entries for AP reduction
            const entries = await TransactionEntry.insertMany([
                { 
                    transaction: txn._id, 
                    account: apAccount._id, 
                    debit: expense.amount, 
                    credit: 0, 
                    type: 'liability' 
                },
                { 
                    transaction: txn._id, 
                    account: sourceAccount._id, 
                    debit: 0, 
                    credit: expense.amount, 
                    type: sourceAccount.type.toLowerCase() 
                }
            ]);
            
            // Link entries to transaction
            await Transaction.findByIdAndUpdate(txn._id, { 
                $push: { entries: { $each: entries.map(e => e._id) } } 
            });
            
            // Create audit log for the transaction
            await AuditLog.create({
                user: req.user._id,
                action: `admin_expense_approved_paid_${paymentMethod.replace(/\s+/g, '_').toLowerCase()}`,
                collection: 'Transaction',
                recordId: txn._id,
                before: null,
                after: txn.toObject(),
                timestamp: new Date(),
                details: {
                    source: 'Admin Expense',
                    sourceId: expense._id,
                    expenseCategory: expense.category,
                    expenseAmount: expense.amount,
                    paymentMethod: paymentMethod,
                    sourceAccount: sourceAccount.code,
                    apAccount: apAccount.code,
                    description: `Admin expense approved and paid via ${paymentMethod} - ${expense.description}`
                }
            });
            
            console.log('[Admin Approve] AP reduction transaction created for expense:', expense._id, 'txn:', txn._id);
            
        } catch (paymentError) {
            console.error('[Admin Approve] Failed to create payment transaction for expense:', expense._id, paymentError);
            return res.status(500).json({ 
                success: false,
                error: 'Failed to create payment transaction for approved expense', 
                details: paymentError.message 
            });
        }
        // --- End Payment Transaction ---

        // If this is a maintenance expense, update the maintenance request
        if (expense.category === 'Maintenance' && expense.maintenanceRequest) {
            const maintenance = await Maintenance.findById(expense.maintenanceRequest);
            if (maintenance) {
                // Update the maintenance request with approved status
                maintenance.financeStatus = 'approved';
                maintenance.actualCost = expense.amount;
                maintenance.updates.push({
                    message: `Expense approved and paid via ${paymentMethod}`,
                    author: req.user._id,
                    date: new Date()
                });
                await maintenance.save();
            }
        }

        // Create audit log for expense update
        await AuditLog.create({
            user: req.user._id,
            action: 'approve',
            collection: 'Expense',
            recordId: expense._id,
            before,
            after: expense.toObject(),
            timestamp: new Date(),
            details: {
                paymentMethod: expense.paymentMethod,
                paidDate: expense.paidDate,
                description: `Admin expense approved and paid - ${expense.description}`
            }
        });

        // Send response
        res.json({
            success: true,
            message: 'Expense approved successfully',
            data: expense
        });
    } catch (error) {
        console.error('Error in approveExpense:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message
        });
    }
};

// Update expense
const updateExpense = async (req, res) => {
    try {
        const { expenseId } = req.params;
        const updateData = req.body;

        // Validate expense ID
        if (!mongoose.Types.ObjectId.isValid(expenseId)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid expense ID format' 
            });
        }

        // Find expense
        const expense = await Expense.findById(expenseId);
        if (!expense) {
            return res.status(404).json({ 
                success: false,
                error: 'Expense not found' 
            });
        }

        // Validate residence ID if provided
        if (updateData.residence && !mongoose.Types.ObjectId.isValid(updateData.residence)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid residence ID format' 
            });
        }

        // Validate amount if provided
        if (updateData.amount && (isNaN(updateData.amount) || updateData.amount <= 0)) {
            return res.status(400).json({ 
                success: false,
                error: 'Amount must be a positive number' 
            });
        }

        // Format dates if provided
        if (updateData.expenseDate) updateData.expenseDate = new Date(updateData.expenseDate);
        if (updateData.paidDate) updateData.paidDate = new Date(updateData.paidDate);

        // Add updatedBy field
        updateData.updatedBy = req.user._id;
        updateData.updatedAt = new Date();

        // Update expense
        const updatedExpense = await Expense.findByIdAndUpdate(
            expenseId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('residence', 'name')
         .populate('createdBy', 'firstName lastName email')
         .populate('updatedBy', 'firstName lastName email')
         .populate('paidBy', 'firstName lastName email');

        res.status(200).json({
            success: true,
            message: 'Expense updated successfully',
            expense: updatedExpense
        });
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update expense',
            message: error.message 
        });
    }
};

/**
 * Get expense summary for all residences
 */
const getExpenseSummary = async (req, res) => {
    try {
        console.log('💸 Fetching expense summary...');

        // Get all transactions and residences
        const transactions = await Transaction.find({});
        const residences = await Residence.find({});

        // Calculate expenses by residence
        let expenseByResidence = {};
        let totalExpenses = 0;
        let totalTransactions = 0;

        residences.forEach(residence => {
            expenseByResidence[residence._id.toString()] = {
                id: residence._id,
                name: residence.name,
                address: residence.address,
                totalExpenses: 0,
                utilityExpenses: 0,
                maintenanceExpenses: 0,
                staffExpenses: 0,
                otherExpenses: 0,
                transactionCount: 0,
                utilityCount: 0,
                maintenanceCount: 0,
                staffCount: 0,
                otherCount: 0,
                monthlyBreakdown: {},
                roomCount: residence.rooms ? residence.rooms.length : 0,
                averageRoomPrice: 0
            };

            // Calculate average room price
            if (residence.rooms && residence.rooms.length > 0) {
                const totalRoomPrice = residence.rooms.reduce((sum, room) => sum + (room.price || 0), 0);
                expenseByResidence[residence._id.toString()].averageRoomPrice = totalRoomPrice / residence.rooms.length;
            }
        });

        // Process transactions (focus on expense types)
        transactions.forEach(transaction => {
            const amount = transaction.amount || 0;
            const type = transaction.type || 'unknown';
            const residenceId = transaction.residence?.toString();
            const date = transaction.date || transaction.createdAt;
            const month = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'unknown';
            const description = transaction.description || '';

            if (residenceId && expenseByResidence[residenceId]) {
                const residence = expenseByResidence[residenceId];
                
                // Only count transactions that represent ACTUAL expenses
                // Exclude income transactions (positive amounts from payments)
                if (isActualExpense(amount, type, description)) {
                    const expenseAmount = Math.abs(amount);
                    residence.totalExpenses += expenseAmount;
                    residence.transactionCount++;

                    // Categorize expenses
                    if (isUtilityExpense(description)) {
                        residence.utilityExpenses += expenseAmount;
                        residence.utilityCount++;
                    } else if (isMaintenanceExpense(description)) {
                        residence.maintenanceExpenses += expenseAmount;
                        residence.maintenanceCount++;
                    } else if (isStaffExpense(description)) {
                        residence.staffExpenses += expenseAmount;
                        residence.staffCount++;
                    } else {
                        residence.otherExpenses += expenseAmount;
                        residence.otherCount++;
                    }

                    // Track by month
                    if (!residence.monthlyBreakdown[month]) {
                        residence.monthlyBreakdown[month] = {
                            total: 0,
                            utilities: 0,
                            maintenance: 0,
                            staff: 0,
                            other: 0,
                            count: 0
                        };
                    }
                    residence.monthlyBreakdown[month].total += expenseAmount;
                    residence.monthlyBreakdown[month].count++;

                    if (isUtilityExpense(description)) {
                        residence.monthlyBreakdown[month].utilities += expenseAmount;
                    } else if (isMaintenanceExpense(description)) {
                        residence.monthlyBreakdown[month].maintenance += expenseAmount;
                    } else if (isStaffExpense(description)) {
                        residence.monthlyBreakdown[month].staff += expenseAmount;
                    } else {
                        residence.monthlyBreakdown[month].other += expenseAmount;
                    }

                    totalExpenses += expenseAmount;
                    totalTransactions++;
                }
            }
        });

        // Convert monthly breakdown to array and sort
        Object.keys(expenseByResidence).forEach(residenceId => {
            const residence = expenseByResidence[residenceId];
            residence.monthlyBreakdown = Object.entries(residence.monthlyBreakdown)
                .map(([month, data]) => ({
                    month,
                    ...data
                }))
                .sort((a, b) => a.month.localeCompare(b.month));
        });

        // Convert to array and sort by total expenses
        const expenseArray = Object.values(expenseByResidence)
            .sort((a, b) => b.totalExpenses - a.totalExpenses);

        const response = {
            success: true,
            data: {
                summary: {
                    totalExpenses,
                    totalTransactions,
                    residenceCount: residences.length,
                    averageExpensesPerResidence: residences.length > 0 ? totalExpenses / residences.length : 0
                },
                residences: expenseArray
            }
        };

        console.log(`✅ Expense summary fetched: $${totalExpenses.toLocaleString()} from ${totalTransactions} transactions`);
        res.json(response);

    } catch (error) {
        console.error('❌ Error fetching expense summary:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expense summary',
            error: error.message
        });
    }
};

/**
 * Get expenses for a specific residence
 */
const getResidenceExpenses = async (req, res) => {
    try {
        const { residenceId } = req.params;
        console.log(`💸 Fetching expenses for residence: ${residenceId}`);

        // Validate residence exists
        const residence = await Residence.findById(residenceId);
        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        // Get transactions for this residence
        const transactions = await Transaction.find({ residence: residenceId })
            .sort({ date: -1 });

        // Calculate expense breakdown
        let totalExpenses = 0;
        let utilityExpenses = 0;
        let maintenanceExpenses = 0;
        let staffExpenses = 0;
        let otherExpenses = 0;
        let monthlyBreakdown = {};
        let expenseCategories = {};

        transactions.forEach(transaction => {
            const amount = transaction.amount || 0;
            const type = transaction.type || 'unknown';
            const date = transaction.date || transaction.createdAt;
            const month = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'unknown';
            const description = transaction.description || '';

            // Only count transactions that represent ACTUAL expenses
            if (isActualExpense(amount, type, description)) {
                const expenseAmount = Math.abs(amount);
                totalExpenses += expenseAmount;

                // Categorize expenses
                let category = 'other';
                if (isUtilityExpense(description)) {
                    utilityExpenses += expenseAmount;
                    category = 'utility';
                } else if (isMaintenanceExpense(description)) {
                    maintenanceExpenses += expenseAmount;
                    category = 'maintenance';
                } else if (isStaffExpense(description)) {
                    staffExpenses += expenseAmount;
                    category = 'staff';
                } else {
                    otherExpenses += expenseAmount;
                }

                // Track by category
                if (!expenseCategories[category]) {
                    expenseCategories[category] = { total: 0, count: 0 };
                }
                expenseCategories[category].total += expenseAmount;
                expenseCategories[category].count++;

                // Track by month
                if (!monthlyBreakdown[month]) {
                    monthlyBreakdown[month] = {
                        total: 0,
                        utilities: 0,
                        maintenance: 0,
                        staff: 0,
                        other: 0,
                        count: 0,
                        transactions: []
                    };
                }
                monthlyBreakdown[month].total += expenseAmount;
                monthlyBreakdown[month].count++;

                if (category === 'utility') {
                    monthlyBreakdown[month].utilities += expenseAmount;
                } else if (category === 'maintenance') {
                    monthlyBreakdown[month].maintenance += expenseAmount;
                } else if (category === 'staff') {
                    monthlyBreakdown[month].staff += expenseAmount;
                } else {
                    monthlyBreakdown[month].other += expenseAmount;
                }

                // Add transaction to monthly breakdown
                monthlyBreakdown[month].transactions.push({
                    id: transaction._id,
                    transactionId: transaction.transactionId,
                    type: transaction.type,
                    amount: transaction.amount,
                    date: transaction.date,
                    description: transaction.description,
                    reference: transaction.reference,
                    category: category
                });
            }
        });

        // Convert monthly breakdown to array and sort
        const monthlyArray = Object.entries(monthlyBreakdown)
            .map(([month, data]) => ({
                month,
                ...data
            }))
            .sort((a, b) => a.month.localeCompare(b.month));

        const response = {
            success: true,
            data: {
                residence: {
                    id: residence._id,
                    name: residence.name,
                    address: residence.address,
                    roomCount: residence.rooms ? residence.rooms.length : 0,
                    averageRoomPrice: residence.rooms && residence.rooms.length > 0 
                        ? residence.rooms.reduce((sum, room) => sum + (room.price || 0), 0) / residence.rooms.length 
                        : 0
                },
                expenses: {
                    total: totalExpenses,
                    utilities: utilityExpenses,
                    maintenance: maintenanceExpenses,
                    staff: staffExpenses,
                    other: otherExpenses,
                    transactionCount: Object.values(monthlyBreakdown).reduce((sum, month) => sum + month.count, 0)
                },
                breakdown: {
                    byCategory: expenseCategories,
                    byMonth: monthlyArray
                },
                transactions: Object.values(monthlyBreakdown)
                    .flatMap(month => month.transactions)
                    .slice(0, 50) // Limit to last 50 transactions
            }
        };

        console.log(`✅ Residence expenses fetched: $${totalExpenses.toLocaleString()} from ${Object.values(monthlyBreakdown).reduce((sum, month) => sum + month.count, 0)} transactions`);
        res.json(response);

    } catch (error) {
        console.error('❌ Error fetching residence expenses:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch residence expenses',
            error: error.message
        });
    }
};

/**
 * Get expenses by date range
 */
const getExpensesByDateRange = async (req, res) => {
    try {
        const { startDate, endDate, residenceId } = req.query;
        console.log(`💸 Fetching expenses from ${startDate} to ${endDate}${residenceId ? ` for residence ${residenceId}` : ''}`);

        // Build query
        let query = {};
        
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        if (residenceId) {
            query.residence = residenceId;
        }

        // Get transactions
        const transactions = await Transaction.find(query)
            .sort({ date: -1 });

        // Calculate expenses
        let totalExpenses = 0;
        let expenseByResidence = {};
        let expenseByMonth = {};
        let expenseByCategory = {};

        transactions.forEach(transaction => {
            const amount = transaction.amount || 0;
            const type = transaction.type || 'unknown';
            const residenceId = transaction.residence?.toString();
            const date = transaction.date || transaction.createdAt;
            const month = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'unknown';
            const description = transaction.description || '';

            // Only count transactions that represent ACTUAL expenses
            if (isActualExpense(amount, type, description)) {
                const expenseAmount = Math.abs(amount);
                totalExpenses += expenseAmount;

                // Track by residence
                if (residenceId) {
                    if (!expenseByResidence[residenceId]) {
                        expenseByResidence[residenceId] = { total: 0, count: 0 };
                    }
                    expenseByResidence[residenceId].total += expenseAmount;
                    expenseByResidence[residenceId].count++;
                }

                // Track by month
                if (!expenseByMonth[month]) {
                    expenseByMonth[month] = { total: 0, count: 0 };
                }
                expenseByMonth[month].total += expenseAmount;
                expenseByMonth[month].count++;

                // Track by category
                let category = 'other';
                if (isUtilityExpense(description)) {
                    category = 'utility';
                } else if (isMaintenanceExpense(description)) {
                    category = 'maintenance';
                } else if (isStaffExpense(description)) {
                    category = 'staff';
                }

                if (!expenseByCategory[category]) {
                    expenseByCategory[category] = { total: 0, count: 0 };
                }
                expenseByCategory[category].total += expenseAmount;
                expenseByCategory[category].count++;
            }
        });

        const response = {
            success: true,
            data: {
                dateRange: { startDate, endDate },
                summary: {
                    totalExpenses,
                    totalTransactions: Object.values(expenseByResidence).reduce((sum, res) => sum + res.count, 0),
                    averageTransactionAmount: Object.values(expenseByResidence).reduce((sum, res) => sum + res.count, 0) > 0 ? totalExpenses / Object.values(expenseByResidence).reduce((sum, res) => sum + res.count, 0) : 0
                },
                breakdown: {
                    byResidence: expenseByResidence,
                    byMonth: expenseByMonth,
                    byCategory: expenseByCategory
                },
                transactions: transactions.filter(t => isActualExpense(t.amount, t.type, t.description)).slice(0, 100)
            }
        };

        console.log(`✅ Date range expenses fetched: $${totalExpenses.toLocaleString()} from ${Object.values(expenseByResidence).reduce((sum, res) => sum + res.count, 0)} transactions`);
        res.json(response);

    } catch (error) {
        console.error('❌ Error fetching expenses by date range:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expenses by date range',
            error: error.message
        });
    }
};

/**
 * Helper functions to categorize expenses
 */
function isActualExpense(amount, type, description) {
    // Exclude income transactions (positive amounts from payments)
    if (amount > 0 && type.toLowerCase() === 'payment') {
        return false;
    }
    
    // Only count actual expenses: negative amounts or specific expense types
    if (amount < 0) {
        return true; // Negative amounts are always expenses
    }
    
    // For zero amounts, check if it's a real expense type
    if (amount === 0) {
        const realExpenseTypes = ['expense', 'utility', 'maintenance', 'staff', 'repair', 'service'];
        const realExpenseKeywords = ['expense', 'bill', 'fee', 'cost', 'charge', 'repair', 'maintenance', 'utility', 'staff', 'salary', 'wage'];
        
        return realExpenseTypes.includes(type.toLowerCase()) || 
               realExpenseKeywords.some(keyword => description.toLowerCase().includes(keyword));
    }
    
    return false;
}

function isExpenseType(type, description) {
    const expenseTypes = ['expense', 'utility', 'maintenance', 'staff', 'repair', 'service'];
    const expenseKeywords = ['expense', 'bill', 'fee', 'cost', 'charge', 'repair', 'maintenance', 'utility', 'staff', 'salary', 'wage'];
    
    return expenseTypes.includes(type.toLowerCase()) || 
           expenseKeywords.some(keyword => description.toLowerCase().includes(keyword));
}

function isUtilityExpense(description) {
    const utilityKeywords = ['electricity', 'water', 'gas', 'internet', 'wifi', 'sewage', 'garbage', 'trash', 'utility', 'utilities'];
    return utilityKeywords.some(keyword => description.toLowerCase().includes(keyword));
}

function isMaintenanceExpense(description) {
    const maintenanceKeywords = ['repair', 'maintenance', 'fix', 'install', 'replace', 'upgrade', 'renovation', 'cleaning', 'housekeeping', 'security'];
    return maintenanceKeywords.some(keyword => description.toLowerCase().includes(keyword));
}

function isStaffExpense(description) {
    const staffKeywords = ['salary', 'wage', 'staff', 'employee', 'worker', 'labor', 'payroll', 'bonus', 'commission', 'overtime'];
    return staffKeywords.some(keyword => description.toLowerCase().includes(keyword));
}

module.exports = {
    getExpenses,
    addExpense,
    sendToFinance,
    updateExpenseStatus,
    getExpenseTotals,
    approveExpense,
    updateExpense,
    getExpenseSummary,
    getResidenceExpenses,
    getExpensesByDateRange
};