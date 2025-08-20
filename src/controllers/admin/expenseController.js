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

// Import dynamic account resolver
const DynamicAccountResolver = require('../../utils/dynamicAccountResolver');

// Legacy category mapping for backward compatibility (will be deprecated)
const CATEGORY_TO_ACCOUNT_CODE = {
  'Maintenance': '5007', // Property Maintenance (corrected)
  'Utilities': '5003', // Utilities - Electricity (corrected)
  'Water': '5004', // Utilities - Water (corrected)
  'WiFi': '5006', // WiFi & Internet (corrected)
  'Internet': '5006', // WiFi & Internet (corrected)
  'Taxes': '5099', // Other Operating Expenses
  'Insurance': '5099', // Other Operating Expenses
  'Salaries': '5099', // Other Operating Expenses
  'Supplies': '5099', // Other Operating Expenses
  'Other': '5099' // Other Operating Expenses
};

// Payment method to Account Code mapping (updated to match chart of accounts)
const PAYMENT_METHOD_TO_ACCOUNT_CODE = {
  'Cash': '1002', // Cash on Hand
  'Bank Transfer': '1001', // Bank Account
  'Ecocash': '1003', // Ecocash Wallet
  'Innbucks': '1004', // Innbucks Wallet
  'Petty Cash': '1002', // Cash on Hand
  'Online Payment': '1001', // Bank Account
  'MasterCard': '1001', // Bank Account
  'Visa': '1001', // Bank Account
  'PayPal': '1001' // Bank Account
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
            
            // Get expense account using dynamic resolver
            let expenseAccount = await DynamicAccountResolver.getExpenseAccount(expense.category);
            
            // Fallback to legacy mapping if dynamic resolver fails
            if (!expenseAccount) {
                console.log(`⚠️  Dynamic resolver failed for category ${expense.category}, trying legacy mapping...`);
                const expenseAccountCode = CATEGORY_TO_ACCOUNT_CODE[expense.category] || '5099';
                expenseAccount = await Account.findOne({ code: expenseAccountCode, type: 'Expense' });
            }
            
            if (!expenseAccount) {
                console.error('[Admin Expense] Expense account not found for category:', expense.category);
                throw new Error(`Expense account not found for category: ${expense.category}. Please ensure you have a suitable expense account in your chart of accounts.`);
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
            
            // Get expense account using dynamic resolver
            let expenseAccount = await DynamicAccountResolver.getExpenseAccount(expense.category);
            
            // Fallback to legacy mapping if dynamic resolver fails
            if (!expenseAccount) {
                console.log(`⚠️  Dynamic resolver failed for category ${expense.category}, trying legacy mapping...`);
                const expenseAccountCode = CATEGORY_TO_ACCOUNT_CODE[expense.category] || '5099';
                expenseAccount = await Account.findOne({ code: expenseAccountCode, type: 'Expense' });
            }
            
            if (!expenseAccount) {
                console.error('[Admin Approve] Expense account not found for category:', expense.category);
                throw new Error(`Expense account not found for category: ${expense.category}. Please ensure you have a suitable expense account in your chart of accounts.`);
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
        
        // Get the database connection to access transactionentries collection
        const db = req.app.locals.db || mongoose.connection.db;
        const transactionEntriesCollection = db.collection('transactionentries');
        
        // Get transactions and transaction entries
        const transactions = await Transaction.find({});
        const residences = await Residence.find({});
        
        // Get transaction entries for real expense amounts
        let transactionEntries = [];
        try {
            transactionEntries = await transactionEntriesCollection.find({}).toArray();
        } catch (error) {
            console.log('⚠️ Could not access transactionentries collection:', error.message);
        }

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
            if (residence.rooms && residence.rooms.length > 0) {
                const totalRoomPrice = residence.rooms.reduce((sum, room) => sum + (room.price || 0), 0);
                expenseByResidence[residence._id.toString()].averageRoomPrice = totalRoomPrice / residence.rooms.length;
            }
        });

        // Process transaction entries for real expense amounts
        transactionEntries.forEach(entry => {
            if (entry.entries && Array.isArray(entry.entries)) {
                entry.entries.forEach(accountEntry => {
                    // Only process debit entries (expenses)
                    if (accountEntry.debit > 0) {
                        const amount = accountEntry.debit;
                        const description = accountEntry.description || '';
                        const accountName = accountEntry.accountName || '';
                        const accountType = accountEntry.accountType || '';
                        const residenceId = entry.residence?.toString();
                        const date = entry.date ? new Date(entry.date) : new Date();
                        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                        if (residenceId && expenseByResidence[residenceId]) {
                            const residence = expenseByResidence[residenceId];
                            
                            // Only count actual expenses (exclude income transactions)
                            if (isActualExpenseFromEntry(amount, accountType, description, accountName)) {
                                residence.totalExpenses += amount;
                                residence.transactionCount++;

                                // Categorize expenses based on account name and description
                                if (isUtilityExpense(description, accountName)) {
                                    residence.utilityExpenses += amount;
                                    residence.utilityCount++;
                                } else if (isMaintenanceExpense(description, accountName)) {
                                    residence.maintenanceExpenses += amount;
                                    residence.maintenanceCount++;
                                } else if (isStaffExpense(description, accountName)) {
                                    residence.staffExpenses += amount;
                                    residence.staffCount++;
                                } else {
                                    residence.otherExpenses += amount;
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
                                residence.monthlyBreakdown[month].total += amount;
                                residence.monthlyBreakdown[month].count++;
                                
                                if (isUtilityExpense(description, accountName)) {
                                    residence.monthlyBreakdown[month].utilities += amount;
                                } else if (isMaintenanceExpense(description, accountName)) {
                                    residence.monthlyBreakdown[month].maintenance += amount;
                                } else if (isStaffExpense(description, accountName)) {
                                    residence.monthlyBreakdown[month].staff += amount;
                                } else {
                                    residence.monthlyBreakdown[month].other += amount;
                                }

                                totalExpenses += amount;
                                totalTransactions++;
                            }
                        }
                    }
                });
            }
        });

        // Also process regular transactions for any additional expense data
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

        Object.keys(expenseByResidence).forEach(residenceId => {
            const residence = expenseByResidence[residenceId];
            residence.monthlyBreakdown = Object.entries(residence.monthlyBreakdown)
                .map(([month, data]) => ({ month, ...data }))
                .sort((a, b) => a.month.localeCompare(b.month));
        });

        const expenseArray = Object.values(expenseByResidence).sort((a, b) => b.totalExpenses - a.totalExpenses);

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
        res.status(500).json({ success: false, message: 'Failed to fetch expense summary', error: error.message });
    }
};

/**
 * Get expenses for a specific residence
 */
const getResidenceExpenses = async (req, res) => {
    try {
        const { residenceId } = req.params;
        console.log(`💸 Fetching expenses for residence: ${residenceId}`);

        // Get the database connection to access transactionentries collection
        const db = req.app.locals.db || mongoose.connection.db;
        const transactionEntriesCollection = db.collection('transactionentries');
        
        const residence = await Residence.findById(residenceId);
        if (!residence) {
            return res.status(404).json({ success: false, message: 'Residence not found' });
        }

        // Get transaction entries for this residence
        let transactionEntries = [];
        try {
            transactionEntries = await transactionEntriesCollection.find({ 
                residence: residenceId 
            }).toArray();
        } catch (error) {
            console.log('⚠️ Could not access transactionentries collection:', error.message);
        }

        // Get regular transactions for this residence
        const transactions = await Transaction.find({ residence: residenceId });

        let totalExpenses = 0;
        let utilityExpenses = 0;
        let maintenanceExpenses = 0;
        let staffExpenses = 0;
        let otherExpenses = 0;
        let monthlyBreakdown = {};
        let recentTransactions = [];

        // Process transaction entries for real expense amounts
        transactionEntries.forEach(entry => {
            if (entry.entries && Array.isArray(entry.entries)) {
                entry.entries.forEach(accountEntry => {
                    // Only process debit entries (expenses)
                    if (accountEntry.debit > 0) {
                        const amount = accountEntry.debit;
                        const description = accountEntry.description || '';
                        const accountName = accountEntry.accountName || '';
                        const accountType = accountEntry.accountType || '';
                        const date = entry.date ? new Date(entry.date) : new Date();
                        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                        // Only count actual expenses
                        if (isActualExpenseFromEntry(amount, accountType, description, accountName)) {
                            totalExpenses += amount;

                            // Categorize expenses
                            if (isUtilityExpense(description, accountName)) {
                                utilityExpenses += amount;
                            } else if (isMaintenanceExpense(description, accountName)) {
                                maintenanceExpenses += amount;
                            } else if (isStaffExpense(description, accountName)) {
                                staffExpenses += amount;
                            } else {
                                otherExpenses += amount;
                            }

                            // Track by month
                            if (!monthlyBreakdown[month]) {
                                monthlyBreakdown[month] = {
                                    total: 0,
                                    utilities: 0,
                                    maintenance: 0,
                                    staff: 0,
                                    other: 0,
                                    count: 0
                                };
                            }
                            monthlyBreakdown[month].total += amount;
                            monthlyBreakdown[month].count++;
                            
                            if (isUtilityExpense(description, accountName)) {
                                monthlyBreakdown[month].utilities += amount;
                            } else if (isMaintenanceExpense(description, accountName)) {
                                monthlyBreakdown[month].maintenance += amount;
                            } else if (isStaffExpense(description, accountName)) {
                                monthlyBreakdown[month].staff += amount;
                            } else {
                                monthlyBreakdown[month].other += amount;
                            }

                            // Add to recent transactions
                            recentTransactions.push({
                                id: entry._id,
                                date: date,
                                description: description,
                                amount: amount,
                                account: accountName,
                                type: 'transaction_entry',
                                reference: entry.reference
                            });
                        }
                    }
                });
            }
        });

        // Also process regular transactions
        transactions.forEach(transaction => {
            const amount = transaction.amount || 0;
            const type = transaction.type || 'unknown';
            const description = transaction.description || '';
            const date = transaction.date || transaction.createdAt;
            const month = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'unknown';

            if (isActualExpense(amount, type, description)) {
                const expenseAmount = Math.abs(amount);
                totalExpenses += expenseAmount;

                if (isUtilityExpense(description)) {
                    utilityExpenses += expenseAmount;
                } else if (isMaintenanceExpense(description)) {
                    maintenanceExpenses += expenseAmount;
                } else if (isStaffExpense(description)) {
                    staffExpenses += expenseAmount;
                } else {
                    otherExpenses += expenseAmount;
                }

                if (!monthlyBreakdown[month]) {
                    monthlyBreakdown[month] = {
                        total: 0,
                        utilities: 0,
                        maintenance: 0,
                        staff: 0,
                        other: 0,
                        count: 0
                    };
                }
                monthlyBreakdown[month].total += expenseAmount;
                monthlyBreakdown[month].count++;
                
                if (isUtilityExpense(description)) {
                    monthlyBreakdown[month].utilities += expenseAmount;
                } else if (isMaintenanceExpense(description)) {
                    monthlyBreakdown[month].maintenance += expenseAmount;
                } else if (isStaffExpense(description)) {
                    monthlyBreakdown[month].staff += expenseAmount;
                } else {
                    monthlyBreakdown[month].other += expenseAmount;
                }

                recentTransactions.push({
                    id: transaction._id,
                    date: date,
                    description: description,
                    amount: expenseAmount,
                    type: 'transaction',
                    reference: transaction.reference
                });
            }
        });

        // Sort recent transactions by date
        recentTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Convert monthly breakdown to array
        const monthlyBreakdownArray = Object.entries(monthlyBreakdown)
            .map(([month, data]) => ({ month, ...data }))
            .sort((a, b) => a.month.localeCompare(b.month));

        const response = {
            success: true,
            data: {
                residence: {
                    id: residence._id,
                    name: residence.name,
                    address: residence.address
                },
                summary: {
                    totalExpenses,
                    utilityExpenses,
                    maintenanceExpenses,
                    staffExpenses,
                    otherExpenses
                },
                monthlyBreakdown: monthlyBreakdownArray,
                recentTransactions: recentTransactions.slice(0, 10) // Show last 10
            }
        };

        console.log(`✅ Residence expenses fetched: $${totalExpenses.toLocaleString()}`);
        res.json(response);
    } catch (error) {
        console.error('❌ Error fetching residence expenses:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch residence expenses', error: error.message });
    }
};

/**
 * Get expenses by date range
 */
const getExpensesByDateRange = async (req, res) => {
    try {
        const { startDate, endDate, residenceId } = req.query;
        console.log(`💸 Fetching expenses from ${startDate} to ${endDate}${residenceId ? ` for residence: ${residenceId}` : ''}`);

        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Start date and end date are required' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        // Get the database connection to access transactionentries collection
        const db = req.app.locals.db || mongoose.connection.db;
        const transactionEntriesCollection = db.collection('transactionentries');
        
        let residences = [];
        if (residenceId) {
            const residence = await Residence.findById(residenceId);
            if (!residence) {
                return res.status(404).json({ success: false, message: 'Residence not found' });
            }
            residences = [residence];
        } else {
            residences = await Residence.find({});
        }

        let expenseByResidence = {};
        let totalExpenses = 0;

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
                monthlyBreakdown: {}
            };
        });

        // Process transaction entries for real expense amounts
        let transactionEntries = [];
        try {
            const query = { 
                date: { $gte: start, $lte: end }
            };
            if (residenceId) {
                query.residence = residenceId;
            }
            transactionEntries = await transactionEntriesCollection.find(query).toArray();
        } catch (error) {
            console.log('⚠️ Could not access transactionentries collection:', error.message);
        }

        transactionEntries.forEach(entry => {
            if (entry.entries && Array.isArray(entry.entries)) {
                entry.entries.forEach(accountEntry => {
                    // Only process debit entries (expenses)
                    if (accountEntry.debit > 0) {
                        const amount = accountEntry.debit;
                        const description = accountEntry.description || '';
                        const accountName = accountEntry.accountName || '';
                        const accountType = accountEntry.accountType || '';
                        const residenceId = entry.residence?.toString();
                        const date = entry.date ? new Date(entry.date) : new Date();
                        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                        if (residenceId && expenseByResidence[residenceId]) {
                            const residence = expenseByResidence[residenceId];
                            
                            // Only count actual expenses
                            if (isActualExpenseFromEntry(amount, accountType, description, accountName)) {
                                residence.totalExpenses += amount;
                                totalExpenses += amount;

                                if (isUtilityExpense(description, accountName)) {
                                    residence.utilityExpenses += amount;
                                } else if (isMaintenanceExpense(description, accountName)) {
                                    residence.maintenanceExpenses += amount;
                                } else if (isStaffExpense(description, accountName)) {
                                    residence.staffExpenses += amount;
                                } else {
                                    residence.otherExpenses += amount;
                                }

                                if (!residence.monthlyBreakdown[month]) {
                                    residence.monthlyBreakdown[month] = {
                                        total: 0,
                                        utilities: 0,
                                        maintenance: 0,
                                        staff: 0,
                                        other: 0
                                    };
                                }
                                residence.monthlyBreakdown[month].total += amount;
                                
                                if (isUtilityExpense(description, accountName)) {
                                    residence.monthlyBreakdown[month].utilities += amount;
                                } else if (isMaintenanceExpense(description, accountName)) {
                                    residence.monthlyBreakdown[month].maintenance += amount;
                                } else if (isStaffExpense(description, accountName)) {
                                    residence.monthlyBreakdown[month].staff += amount;
                                } else {
                                    residence.monthlyBreakdown[month].other += amount;
                                }
                            }
                        }
                    }
                });
            }
        });

        // Also process regular transactions
        const query = { 
            date: { $gte: start, $lte: end }
        };
        if (residenceId) {
            query.residence = residenceId;
        }
        const transactions = await Transaction.find(query);

        transactions.forEach(transaction => {
            const amount = transaction.amount || 0;
            const type = transaction.type || 'unknown';
            const description = transaction.description || '';
            const residenceId = transaction.residence?.toString();
            const date = transaction.date || transaction.createdAt;
            const month = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'unknown';

            if (residenceId && expenseByResidence[residenceId]) {
                const residence = expenseByResidence[residenceId];
                
                if (isActualExpense(amount, type, description)) {
                    const expenseAmount = Math.abs(amount);
                    residence.totalExpenses += expenseAmount;
                    totalExpenses += expenseAmount;

                    if (isUtilityExpense(description)) {
                        residence.utilityExpenses += expenseAmount;
                    } else if (isMaintenanceExpense(description)) {
                        residence.maintenanceExpenses += expenseAmount;
                    } else if (isStaffExpense(description)) {
                        residence.staffExpenses += expenseAmount;
                    } else {
                        residence.otherExpenses += expenseAmount;
                    }

                    if (!residence.monthlyBreakdown[month]) {
                        residence.monthlyBreakdown[month] = {
                            total: 0,
                            utilities: 0,
                            maintenance: 0,
                            staff: 0,
                            other: 0
                        };
                    }
                    residence.monthlyBreakdown[month].total += expenseAmount;
                    
                    if (isUtilityExpense(description)) {
                        residence.monthlyBreakdown[month].utilities += expenseAmount;
                    } else if (isMaintenanceExpense(description)) {
                        residence.monthlyBreakdown[month].maintenance += expenseAmount;
                    } else if (isStaffExpense(description)) {
                        residence.monthlyBreakdown[month].staff += expenseAmount;
                    } else {
                        residence.monthlyBreakdown[month].other += expenseAmount;
                    }
                }
            }
        });

        // Convert monthly breakdowns to arrays
        Object.keys(expenseByResidence).forEach(residenceId => {
            const residence = expenseByResidence[residenceId];
            residence.monthlyBreakdown = Object.entries(residence.monthlyBreakdown)
                .map(([month, data]) => ({ month, ...data }))
                .sort((a, b) => a.month.localeCompare(b.month));
        });

        const expenseArray = Object.values(expenseByResidence).sort((a, b) => b.totalExpenses - a.totalExpenses);

        const response = {
            success: true,
            data: {
                dateRange: { startDate, endDate },
                summary: {
                    totalExpenses,
                    residenceCount: residences.length
                },
                residences: expenseArray
            }
        };

        console.log(`✅ Date range expenses fetched: $${totalExpenses.toLocaleString()}`);
        res.json(response);
    } catch (error) {
        console.error('❌ Error fetching date range expenses:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch date range expenses', error: error.message });
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

function isActualExpenseFromEntry(amount, accountType, description, accountName) {
    // Only process debit entries (expenses)
    if (amount <= 0) {
        return false;
    }
    
    // Exclude income accounts
    const incomeAccountTypes = ['income', 'revenue', 'asset'];
    if (incomeAccountTypes.includes(accountType.toLowerCase())) {
        return false;
    }
    
    // Include expense accounts
    const expenseAccountTypes = ['expense', 'liability'];
    if (expenseAccountTypes.includes(accountType.toLowerCase())) {
        return true;
    }
    
    // Check account name for expense indicators
    const expenseKeywords = ['expense', 'cost', 'bill', 'fee', 'charge', 'maintenance', 'utility', 'staff', 'salary', 'wage'];
    if (expenseKeywords.some(keyword => accountName.toLowerCase().includes(keyword))) {
        return true;
    }
    
    // Check description for expense indicators
    if (expenseKeywords.some(keyword => description.toLowerCase().includes(keyword))) {
        return true;
    }
    
    return false;
}

function isUtilityExpense(description, accountName = '') {
    const utilityKeywords = ['electricity', 'water', 'internet', 'wifi', 'gas', 'utility', 'bill'];
    const descriptionLower = description.toLowerCase();
    const accountNameLower = accountName.toLowerCase();
    
    return utilityKeywords.some(keyword => 
        descriptionLower.includes(keyword) || accountNameLower.includes(keyword)
    );
}

function isMaintenanceExpense(description, accountName = '') {
    const maintenanceKeywords = ['maintenance', 'repair', 'service', 'cleaning', 'pool', 'security'];
    const descriptionLower = description.toLowerCase();
    const accountNameLower = accountName.toLowerCase();
    
    return maintenanceKeywords.some(keyword => 
        descriptionLower.includes(keyword) || accountNameLower.includes(keyword)
    );
}

function isStaffExpense(description, accountName = '') {
    const staffKeywords = ['staff', 'salary', 'wage', 'employee', 'worker', 'labor'];
    const descriptionLower = description.toLowerCase();
    const accountNameLower = accountName.toLowerCase();
    
    return staffKeywords.some(keyword => 
        descriptionLower.includes(keyword) || accountNameLower.includes(keyword)
    );
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