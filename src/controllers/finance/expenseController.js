const Expense = require('../../models/finance/Expense');
const Vendor = require('../../models/Vendor');
const { generateUniqueId } = require('../../utils/idGenerator');
const { validateMongoId } = require('../../utils/validators');
const { createAuditLog } = require('../../utils/auditLogger');
const AuditLog = require('../../models/AuditLog');
const Transaction = require('../../models/Transaction');
const TransactionEntry = require('../../models/TransactionEntry');
const Account = require('../../models/Account');
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
  'Cash': '1000', // Cash (corrected from 1002)
  'Bank Transfer': '1001', // Bank Account
  'Ecocash': '1003', // Ecocash Wallet
  'Innbucks': '1004', // Innbucks Wallet
  'Petty Cash': '1000', // Cash (corrected from 1002)
  'Online Payment': '1001', // Bank Account
  'MasterCard': '1001', // Bank Account
  'Visa': '1001', // Bank Account
  'PayPal': '1001' // Bank Account
};

// Get all expenses
exports.getAllExpenses = async (req, res) => {
    try {
        const { 
            residence, 
            category, 
            startDate, 
            endDate, 
            paymentStatus,
            page = 1, 
            limit = 10, 
            sortBy = 'expenseDate', 
            sortOrder = 'desc' 
        } = req.query;

        console.log('Expense Query Parameters:', {
            residence,
            category,
            startDate,
            endDate,
            paymentStatus,
            page,
            limit,
            sortBy,
            sortOrder
        });

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
            filter.expenseDate = {};
            if (startDate) filter.expenseDate.$gte = new Date(startDate);
            if (endDate) filter.expenseDate.$lte = new Date(endDate);
        }

        console.log('Applied Filters:', filter);

        // Sorting
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get expenses with pagination
        const expenses = await Expense.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('residence', 'name')
            .populate('createdBy', 'firstName lastName email')
            .populate('paidBy', 'firstName lastName email');

        // Get total count for pagination
        const totalExpenses = await Expense.countDocuments(filter);
        const totalPages = Math.ceil(totalExpenses / parseInt(limit));

        console.log('Query Results:', {
            expensesFound: expenses.length,
            totalExpenses,
            totalPages,
            currentPage: parseInt(page),
            limit: parseInt(limit)
        });

        res.status(200).json({
            expenses,
            pagination: {
                totalExpenses,
                totalPages,
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Failed to retrieve expenses' });
    }
};

// Get expense by ID
exports.getExpenseById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid expense ID format' });
        }

        const expense = await Expense.findById(id)
            .populate('residence', 'name')
            .populate('createdBy', 'firstName lastName email')
            .populate('updatedBy', 'firstName lastName email')
            .populate('paidBy', 'firstName lastName email');

        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        res.status(200).json({ expense });
    } catch (error) {
        console.error('Error fetching expense:', error);
        res.status(500).json({ error: 'Failed to retrieve expense' });
    }
};

// Create new expense
exports.createExpense = async (req, res) => {
    try {
        const {
            residence,
            category,
            amount,
            description,
            expenseDate,
            paymentStatus,
            paymentMethod,
            paymentIcon,
            paidBy,
            paidDate,
            receiptImage,
            period
        } = req.body;

        // Validate required fields
        const requiredFields = ['residence', 'category', 'amount', 'description', 'expenseDate', 'period'];
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
        const validCategories = ['Maintenance', 'Utilities', 'Taxes', 'Insurance', 'Salaries', 'Supplies', 'Other'];
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

        // Validate expense date
        const date = new Date(expenseDate);
        if (isNaN(date.getTime())) {
            return res.status(400).json({ 
                error: 'Invalid date format',
                field: 'expenseDate',
                message: 'Please provide a valid date'
            });
        }

        // Validate period
        const validPeriods = ['weekly', 'monthly'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({ 
                error: 'Invalid period',
                field: 'period',
                message: `Period must be one of: ${validPeriods.join(', ')}`
            });
        }

        // Generate unique expense ID
        const expenseId = await generateUniqueId('EXP');

        // Create new expense
        const newExpense = new Expense({
            expenseId,
            residence,
            category,
            amount,
            description,
            expenseDate: date,
            paymentStatus: paymentStatus || 'Pending',
            createdBy: req.user._id,
            period,
            notes: req.body.provider ? `Provider: ${req.body.provider}` : undefined
        });

        // Add optional fields if provided
        if (paymentMethod) {
            const validPaymentMethods = ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal'];
            if (!validPaymentMethods.includes(paymentMethod)) {
                return res.status(400).json({ 
                    error: 'Invalid payment method',
                    field: 'paymentMethod',
                    message: `Payment method must be one of: ${validPaymentMethods.join(', ')}`
                });
            }
            newExpense.paymentMethod = paymentMethod;
        }

        if (paymentIcon) {
            newExpense.paymentIcon = paymentIcon;
        }

        if (paidBy && validateMongoId(paidBy)) {
            newExpense.paidBy = paidBy;
        } else if (paidBy) {
            return res.status(400).json({ 
                error: 'Invalid paid by ID',
                field: 'paidBy',
                message: 'Please provide a valid user ID'
            });
        }

        if (paidDate) {
            const paidDateObj = new Date(paidDate);
            if (isNaN(paidDateObj.getTime())) {
                return res.status(400).json({ 
                    error: 'Invalid paid date format',
                    field: 'paidDate',
                    message: 'Please provide a valid date'
                });
            }
            newExpense.paidDate = paidDateObj;
        }

        if (receiptImage) {
            newExpense.receiptImage = receiptImage;
        }

        // Add maintenance request ID if provided
        if (req.body.maintenanceRequestId && validateMongoId(req.body.maintenanceRequestId)) {
            newExpense.maintenanceRequestId = req.body.maintenanceRequestId;
        }

        // Save expense
        await newExpense.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'create',
            collection: 'Expense',
            recordId: newExpense._id,
            before: null,
            after: newExpense.toObject()
        });

        res.status(201).json({
            message: 'Expense created successfully',
            expense: newExpense
        });
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ 
            error: 'Failed to create expense',
            message: error.message
        });
    }
};

// Update expense
exports.updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid expense ID format', id });
        }

        // Find expense
        const expense = await Expense.findById(id);
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found', id });
        }

        const before = expense.toObject();

        // Validate residence ID if provided
        if (updateData.residence && !validateMongoId(updateData.residence)) {
            return res.status(400).json({ error: 'Invalid residence ID format', id });
        }

        // Validate amount if provided
        if (updateData.amount && (isNaN(updateData.amount) || updateData.amount <= 0)) {
            return res.status(400).json({ error: 'Amount must be a positive number', id });
        }

        // Format dates if provided
        if (updateData.expenseDate) updateData.expenseDate = new Date(updateData.expenseDate);
        if (updateData.paidDate) updateData.paidDate = new Date(updateData.paidDate);

        // Add updatedBy field
        updateData.updatedBy = req.user._id;

        // Update expense
        const updatedExpense = await Expense.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('residence', 'name')
         .populate('createdBy', 'firstName lastName email')
         .populate('updatedBy', 'firstName lastName email')
         .populate('paidBy', 'firstName lastName email');

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'update',
            collection: 'Expense',
            recordId: updatedExpense._id,
            before,
            after: updatedExpense.toObject()
        });

        res.status(200).json({
            message: 'Expense updated successfully',
            expense: updatedExpense,
            id: updatedExpense._id
        });
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ error: 'Failed to update expense', id: req.params.id });
    }
};

// Delete expense
exports.deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid expense ID format' });
        }

        // Find expense
        const expense = await Expense.findById(id);
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        const before = expense.toObject();

        // Delete expense
        await Expense.findByIdAndDelete(id);

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'delete',
            collection: 'Expense',
            recordId: id,
            before,
            after: null
        });

        res.status(200).json({
            message: 'Expense deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ error: 'Failed to delete expense' });
    }
};

// Get expense summary statistics
exports.getExpenseSummary = async (req, res) => {
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
            filter.expenseDate = {};
            if (startDate) filter.expenseDate.$gte = new Date(startDate);
            if (endDate) filter.expenseDate.$lte = new Date(endDate);
        }

        // Get total expenses amount
        const totalExpensesAmount = await Expense.aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Get expenses by category
        const expensesByCategory = await Expense.aggregate([
            { $match: filter },
            { $group: { _id: '$category', total: { $sum: '$amount' } } },
            { $sort: { total: -1 } }
        ]);

        // Get expenses by payment status
        const expensesByStatus = await Expense.aggregate([
            { $match: filter },
            { $group: { _id: '$paymentStatus', total: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { total: -1 } }
        ]);

        // Format response
        const summary = {
            totalAmount: totalExpensesAmount.length > 0 ? totalExpensesAmount[0].total : 0,
            byCategory: expensesByCategory.map(item => ({
                category: item._id,
                amount: item.total,
                percentage: totalExpensesAmount.length > 0 
                    ? Math.round((item.total / totalExpensesAmount[0].total) * 100) 
                    : 0
            })),
            byStatus: expensesByStatus.map(item => ({
                status: item._id,
                amount: item.total,
                count: item.count,
                percentage: totalExpensesAmount.length > 0 
                    ? Math.round((item.total / totalExpensesAmount[0].total) * 100) 
                    : 0
            }))
        };

        res.status(200).json({ summary });
    } catch (error) {
        console.error('Error generating expense summary:', error);
        res.status(500).json({ error: 'Failed to generate expense summary' });
    }
};

// Approve expense
exports.approveExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid expense ID format' });
        }

        // Find expense
        const expense = await Expense.findById(id);
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        if (expense.paymentStatus === 'Paid') {
            return res.status(400).json({ error: 'Expense is already paid' });
        }

        const before = expense.toObject();

        // Update expense status to Approved (not Paid yet)
        const updatedExpense = await Expense.findByIdAndUpdate(
            id,
            { 
                $set: { 
                    paymentStatus: 'Approved', // Changed from 'Paid' to 'Approved'
                    updatedBy: req.user._id,
                    notes: notes || expense.notes
                }
            },
            { new: true, runValidators: true }
        ).populate('residence', 'name')
         .populate('createdBy', 'firstName lastName email')
         .populate('updatedBy', 'firstName lastName email');

        // --- Create Accounts Payable Entry for Approved Expense ---
        try {
            console.log('[AP] Creating accounts payable entry for approved expense:', updatedExpense._id);
            
            // Get expense account using dynamic resolver
            let expenseAccount = await DynamicAccountResolver.getExpenseAccount(updatedExpense.category);
            
            // Fallback to legacy mapping if dynamic resolver fails
            if (!expenseAccount) {
                console.log(`⚠️  Dynamic resolver failed for category ${updatedExpense.category}, trying legacy mapping...`);
                const expenseAccountCode = CATEGORY_TO_ACCOUNT_CODE[updatedExpense.category] || '5099';
                expenseAccount = await Account.findOne({ code: expenseAccountCode, type: 'Expense' });
            }
            
            if (!expenseAccount) {
                console.error('[AP] Expense account not found for category:', updatedExpense.category);
                throw new Error(`Expense account not found for category: ${updatedExpense.category}. Please ensure you have a suitable expense account in your chart of accounts.`);
            }
            
            // Get or create vendor-specific Accounts Payable account
            let apAccount;
            if (updatedExpense.vendorId) {
                const vendor = await Vendor.findById(updatedExpense.vendorId);
                if (vendor) {
                    // Use the FinancialService to get or create vendor-specific account
                    const FinancialService = require('../../services/financialService');
                    apAccount = await FinancialService.getOrCreateVendorAccount(updatedExpense.vendorId);
                    console.log(`[AP] Using vendor-specific account: ${apAccount.code} for ${vendor.businessName}`);
                } else {
                    console.warn(`[AP] Vendor not found: ${updatedExpense.vendorId}, using general accounts payable`);
                    apAccount = await Account.findOne({ code: '2000', type: 'Liability' });
                }
            } else {
                // No vendor specified, use general accounts payable
                apAccount = await Account.findOne({ code: '2000', type: 'Liability' });
            }
            
            if (!apAccount) {
                console.error('[AP] Accounts Payable account not found');
                throw new Error('Accounts Payable account not found');
            }
            
            // Create transaction for approval (creates AP liability)
            const txn = await Transaction.create({
                date: new Date(),
                description: `Expense Approval: ${updatedExpense.description}`,
                reference: updatedExpense.expenseId,
                residence: updatedExpense.residence?._id || updatedExpense.residence,
                residenceName: updatedExpense.residence?.name || undefined
            });
            
            // Create double-entry transaction entries for AP creation
            const entries = await TransactionEntry.insertMany([
                { 
                    transaction: txn._id, 
                    account: expenseAccount._id, 
                    debit: updatedExpense.amount, 
                    credit: 0, 
                    type: 'expense' 
                },
                { 
                    transaction: txn._id, 
                    account: apAccount._id, 
                    debit: 0, 
                    credit: updatedExpense.amount, 
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
                action: 'expense_approved_ap_created',
                collection: 'Transaction',
                recordId: txn._id,
                before: null,
                after: txn.toObject(),
                timestamp: new Date(),
                details: {
                    source: 'Expense',
                    sourceId: updatedExpense._id,
                    expenseCategory: updatedExpense.category,
                    expenseAmount: updatedExpense.amount,
                    apAccount: apAccount.code,
                    expenseAccount: expenseAccount.code,
                    description: `Expense approved - AP liability created for ${updatedExpense.description}`
                }
            });
            
            console.log('[AP] Accounts payable entry created for expense:', updatedExpense._id, 'txn:', txn._id);
            
        } catch (apError) {
            console.error('[AP] Failed to create accounts payable entry for expense:', updatedExpense._id, apError);
            return res.status(500).json({ 
                error: 'Failed to create accounts payable entry for approved expense', 
                details: apError.message 
            });
        }
        // --- End AP Creation ---

        // Audit log for expense update
        await AuditLog.create({
            user: req.user._id,
            action: 'approve',
            collection: 'Expense',
            recordId: updatedExpense._id,
            before,
            after: updatedExpense.toObject(),
            timestamp: new Date(),
            details: {
                description: `Expense approved - ${updatedExpense.description}`
            }
        });

        res.status(200).json({
            message: 'Expense approved successfully',
            expense: updatedExpense
        });
    } catch (error) {
        console.error('Error approving expense:', error);
        res.status(500).json({ error: 'Failed to approve expense' });
    }
};

// Mark expense as paid
exports.markExpenseAsPaid = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            paymentMethod, 
            notes, 
            paidDate,
            amount, // From PaymentModal
            reference, // From PaymentModal
            recordedBy, // From PaymentModal
            recordedAt, // From PaymentModal
            itemId, // From PaymentModal
            itemType, // From PaymentModal
            userRole, // From PaymentModal
            transactionData // From PaymentModal
        } = req.body;

        console.log('=== MARK EXPENSE AS PAID DEBUG ===');
        console.log('Expense ID:', id);
        console.log('Request body:', req.body);

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid expense ID format' });
        }

        // Validate payment method if provided
        if (paymentMethod && !['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal', 'Petty Cash'].includes(paymentMethod)) {
            return res.status(400).json({ error: 'Invalid payment method' });
        }

        // Find expense
        const expense = await Expense.findById(id);
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        if (expense.paymentStatus === 'Paid') {
            return res.status(400).json({ error: 'Expense is already marked as paid' });
        }

        // Check if expense has vendorId but no vendorSpecificAccount
        if (expense.vendorId && !expense.vendorSpecificAccount) {
            console.log(`[Payment] Expense has vendorId but no vendorSpecificAccount, looking up vendor...`);
            const vendor = await Vendor.findById(expense.vendorId);
            if (vendor) {
                console.log(`[Payment] Found vendor: ${vendor.businessName} (${vendor.chartOfAccountsCode})`);
                // Update the expense with vendor-specific account
                expense.vendorSpecificAccount = vendor.chartOfAccountsCode;
                await expense.save();
                console.log(`[Payment] Updated expense with vendor-specific account: ${vendor.chartOfAccountsCode}`);
            }
        }

        const before = expense.toObject();

        // Update expense status to Paid
        const updateData = {
            paymentStatus: 'Paid',
            updatedBy: req.user._id,
            paidDate: paidDate ? new Date(paidDate) : new Date(),
            notes: notes || expense.notes
        };

        // Add payment method if provided
        if (paymentMethod) {
            updateData.paymentMethod = paymentMethod;
        }

        const updatedExpense = await Expense.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('residence', 'name')
         .populate('createdBy', 'firstName lastName email')
         .populate('updatedBy', 'firstName lastName email')
         .populate('paidBy', 'firstName lastName email');

        // Ensure we have a valid residence
        if (!updatedExpense.residence) {
            console.error('[Payment] Expense has no residence:', updatedExpense._id);
            return res.status(400).json({ error: 'Expense must have a valid residence' });
        }

        // --- Payment Transaction for Paid Expense ---
        console.log('[Payment] Attempting to create payment transaction for expense:', updatedExpense._id, 'category:', updatedExpense.category);
        
        // Determine source account based on payment method
        const finalPaymentMethod = updatedExpense.paymentMethod || 'Bank Transfer';
        let sourceAccount;
        
        if (finalPaymentMethod === 'Petty Cash') {
            // Get role-specific petty cash account based on user role
            sourceAccount = await getPettyCashAccountByRole(req.user.role);
        } else {
            // Use the mapping for other payment methods
            const sourceAccountCode = PAYMENT_METHOD_TO_ACCOUNT_CODE[finalPaymentMethod] || '1011'; // Default to Admin Petty Cash
            sourceAccount = await Account.findOne({ code: sourceAccountCode });
        }
        
        if (!sourceAccount) {
            console.error('[Payment] Source account not found for payment method:', finalPaymentMethod);
            throw new Error('Source account not found for payment method: ' + finalPaymentMethod);
        }
        
        // Get expense account using dynamic resolver
        let expenseAccount = await DynamicAccountResolver.getExpenseAccount(updatedExpense.category);
        
        // Fallback to legacy mapping if dynamic resolver fails
        if (!expenseAccount) {
            console.log(`⚠️  Dynamic resolver failed for category ${updatedExpense.category}, trying legacy mapping...`);
            const expenseAccountCode = CATEGORY_TO_ACCOUNT_CODE[updatedExpense.category] || '5099'; // Default to Other Operating Expenses
            expenseAccount = await Account.findOne({ code: expenseAccountCode, type: 'Expense' });
        }
        
        if (!expenseAccount) {
            console.error('[Payment] Expense account not found for category:', updatedExpense.category);
            throw new Error(`Expense account not found for category: ${updatedExpense.category}. Please ensure you have a suitable expense account in your chart of accounts.`);
        }
        
        // Generate transaction ID
        const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        // Create transaction
        console.log('[Payment] Creating transaction with data:', {
            transactionId,
            date: updatedExpense.paidDate || new Date(),
            description: `Expense Payment: ${updatedExpense.description}`,
            reference: updatedExpense.expenseId,
            residence: updatedExpense.residence._id || updatedExpense.residence,
            residenceName: updatedExpense.residence.name,
            type: 'payment',
            amount: updatedExpense.amount,
            expenseId: updatedExpense._id,
            createdBy: req.user._id
        });

        const txn = await Transaction.create({
            transactionId: transactionId,
            date: updatedExpense.paidDate || new Date(),
            description: `Expense Payment: ${updatedExpense.description}`,
            reference: updatedExpense.expenseId,
            residence: updatedExpense.residence._id || updatedExpense.residence,
            residenceName: updatedExpense.residence.name,
            type: 'payment',
            amount: updatedExpense.amount,
            expenseId: updatedExpense._id,
            createdBy: req.user._id
        });
        console.log('[Payment] Transaction created successfully:', txn._id);
        
        // Generate transaction entry ID
        const entryTransactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        // Check if expense was previously accrued (has transactionId)
        const wasAccrued = updatedExpense.transactionId;
        
        // Get the appropriate accounts for payment
        let debitAccount, creditAccount;
        
        if (wasAccrued) {
            // If expense was previously accrued, we're paying off the liability
            // Debit: Accounts Payable (reduce liability) - use vendor-specific account if available
            // Credit: Source Account (reduce asset)
            
            let apAccount;
            
            // Check if expense has vendor-specific account
            if (updatedExpense.vendorSpecificAccount) {
                console.log(`[Payment] Using vendor-specific account: ${updatedExpense.vendorSpecificAccount}`);
                apAccount = await Account.findOne({ code: updatedExpense.vendorSpecificAccount, type: 'Liability' });
                if (!apAccount) {
                    console.log(`⚠️ Vendor-specific account ${updatedExpense.vendorSpecificAccount} not found, falling back to general AP`);
                }
            }
            
            // Fallback to general AP if vendor-specific account not found
            if (!apAccount) {
                apAccount = await Account.findOne({ code: '2000', type: 'Liability' });
                if (!apAccount) {
                    throw new Error('Accounts Payable account not found');
                }
            }
            
            debitAccount = apAccount;
            creditAccount = sourceAccount;
        } else {
            // If expense was not previously accrued, this is a direct payment
            // Debit: Expense Account (increase expense)
            // Credit: Source Account (reduce asset)
            debitAccount = expenseAccount;
            creditAccount = sourceAccount;
        }
        
        // Create double-entry transaction entry
        const transactionEntry = await TransactionEntry.create({
            transactionId: entryTransactionId,
            date: updatedExpense.paidDate || new Date(),
            description: `Payment for Expense ${updatedExpense.expenseId} - ${updatedExpense.description}`,
            reference: updatedExpense.expenseId,
            entries: [
                {
                    accountCode: debitAccount.code,
                    accountName: debitAccount.name,
                    accountType: debitAccount.type,
                    debit: updatedExpense.amount,
                    credit: 0,
                    description: wasAccrued ? 
                        `Payment for ${updatedExpense.description} (reducing liability)` :
                        `Payment for ${updatedExpense.description}`
                },
                {
                    accountCode: creditAccount.code,
                    accountName: creditAccount.name,
                    accountType: creditAccount.type,
                    debit: 0,
                    credit: updatedExpense.amount,
                    description: `Payment via ${finalPaymentMethod}`
                }
            ],
            totalDebit: updatedExpense.amount,
            totalCredit: updatedExpense.amount,
            source: 'expense_payment',
            sourceId: updatedExpense._id,
            sourceModel: 'Expense',
            createdBy: req.user.email || req.user.email || 'finance@alamait.com',
            status: 'posted',
            metadata: {
                paymentMethod: finalPaymentMethod,
                expenseId: updatedExpense._id,
                originalAmount: updatedExpense.amount,
                wasAccrued: wasAccrued
            }
        });
        
        // Link entry to transaction
        await Transaction.findByIdAndUpdate(txn._id, { 
            $push: { entries: transactionEntry._id },
            $set: { amount: updatedExpense.amount }
        });
        
        // Link transaction to expense
        await Expense.findByIdAndUpdate(updatedExpense._id, {
            $set: { transactionId: txn._id }
        });
        
        // Create audit log for the transaction
        await AuditLog.create({
            user: req.user._id,
            action: `expense_payment_${finalPaymentMethod.replace(/\s+/g, '_').toLowerCase()}`,
            collection: 'Transaction',
            recordId: txn._id,
            before: null,
            after: txn.toObject(),
            timestamp: new Date(),
            details: JSON.stringify({
                source: 'Expense',
                sourceId: updatedExpense._id,
                expenseCategory: updatedExpense.category,
                expenseAmount: updatedExpense.amount,
                paymentMethod: finalPaymentMethod,
                wasAccrued: wasAccrued,
                debitAccount: debitAccount.code,
                creditAccount: creditAccount.code,
                description: `Expense payment processed via ${finalPaymentMethod} - ${updatedExpense.description}${wasAccrued ? ' (reducing liability)' : ' (direct payment)'}`
            })
        });
        
        console.log('[Payment] Double-entry transaction created for expense:', updatedExpense._id, 'txn:', txn._id);
        console.log('[Payment] Transaction details:', {
            expenseId: updatedExpense.expenseId,
            amount: updatedExpense.amount,
            category: updatedExpense.category,
            paymentMethod: finalPaymentMethod,
            wasAccrued: wasAccrued,
            debitAccount: debitAccount.code,
            creditAccount: creditAccount.code
        });
        // --- End Payment Transaction ---

        // Audit log for expense update
        await AuditLog.create({
            user: req.user._id,
            action: 'mark_paid',
            collection: 'Expense',
            recordId: updatedExpense._id,
            before,
            after: updatedExpense.toObject(),
            timestamp: new Date(),
            details: JSON.stringify({
                paymentMethod: updatedExpense.paymentMethod,
                paidDate: updatedExpense.paidDate,
                description: `Expense marked as paid - ${updatedExpense.description}`
            })
        });

        res.status(200).json({
            message: 'Expense marked as paid successfully',
            expense: updatedExpense,
            transactions: [txn] // Return the created transaction for frontend
        });
    } catch (error) {
        console.error('Error marking expense as paid:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', error.message);
        res.status(500).json({ 
            error: 'Failed to mark expense as paid',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}; 

// Record payment for expense and create transaction entries
exports.recordExpensePayment = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params; // Changed from expenseId to id to match route parameter
        const {
            amount,
            paymentMethod,
            reference,
            notes,
            payingAccount,
            receivingAccount,
            doubleEntry
        } = req.body;

        // Validate expense exists
        const expense = await Expense.findById(id);
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        // Use maintenanceRequestId as requestId if requestId is missing
        if (!expense.requestId && expense.maintenanceRequestId) {
            expense.requestId = expense.maintenanceRequestId;
        }

        // Check if expense has vendor information
        let vendorSpecificAccount = null;
        let expenseAccountCode = null;
        
        // First check if vendorSpecificAccount is already stored on the expense
        if (expense.vendorSpecificAccount) {
            vendorSpecificAccount = expense.vendorSpecificAccount;
            console.log(`Using stored vendor-specific account: ${vendorSpecificAccount} from expense`);
        } else if (expense.vendorId) {
            const Vendor = require('../../models/Vendor');
            const vendor = await Vendor.findById(expense.vendorId);
            if (vendor && vendor.chartOfAccountsCode) {
                vendorSpecificAccount = vendor.chartOfAccountsCode;
                console.log(`Found vendor-specific account: ${vendorSpecificAccount} for vendor: ${vendor.businessName}`);
            }
        } else if (expense.expenseAccountCode) {
            // For items without quotations, use the expense account code
            expenseAccountCode = expense.expenseAccountCode;
            console.log(`Found expense account code: ${expenseAccountCode} for item without vendor`);
        }

        // Validate payment amount
        if (amount <= 0) {
            return res.status(400).json({ message: 'Payment amount must be greater than 0' });
        }

        if (amount > expense.amount) {
            return res.status(400).json({ message: 'Payment amount cannot exceed expense amount' });
        }

        // Determine the correct receiving account
        let finalReceivingAccount = receivingAccount;
        if (vendorSpecificAccount) {
            // Use vendor-specific accounts payable if available
            const vendorAccount = await Account.findOne({ code: vendorSpecificAccount });
            if (vendorAccount) {
                finalReceivingAccount = vendorSpecificAccount;
                console.log(`Using vendor-specific account: ${vendorSpecificAccount} instead of generic: ${receivingAccount}`);
            } else {
                console.log(`Vendor account ${vendorSpecificAccount} not found, using generic: ${receivingAccount}`);
            }
        } else if (expenseAccountCode) {
            // For items without quotations, use the expense account code
            const expenseAccount = await Account.findOne({ code: expenseAccountCode });
            if (expenseAccount) {
                finalReceivingAccount = expenseAccountCode;
                console.log(`Using expense account: ${expenseAccountCode} for item without vendor`);
            } else {
                console.log(`Expense account ${expenseAccountCode} not found, using generic: ${receivingAccount}`);
            }
        }

        // Validate accounts exist
        const payingAcc = await Account.findOne({ code: payingAccount });
        const receivingAcc = await Account.findOne({ code: finalReceivingAccount });
        
        if (!payingAcc || !receivingAcc) {
            return res.status(400).json({ 
                message: 'Invalid account codes',
                details: {
                    payingAccount: payingAccount,
                    receivingAccount: finalReceivingAccount,
                    vendorSpecificAccount: vendorSpecificAccount,
                    vendorId: expense.vendorId
                }
            });
        }

        // Generate payment ID
        const paymentId = `EXP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // Create payment record
        const payment = {
            paymentId,
            amount: parseFloat(amount),
            paymentMethod,
            reference,
            notes,
            paymentDate: new Date(),
            status: 'confirmed',
            processedBy: user._id,
            recordedBy: user.email,
            recordedAt: new Date()
        };

        // Add payment to expense
        expense.payments = expense.payments || [];
        expense.payments.push(payment);

        // Update expense payment status
        const totalPaid = expense.payments.reduce((sum, p) => sum + p.amount, 0);
        expense.amountPaid = totalPaid;
        expense.balanceDue = expense.amount - totalPaid;
        
        if (expense.balanceDue <= 0) {
            expense.paymentStatus = 'Paid'; // Changed from 'paid' to 'Paid'
        } else {
            expense.paymentStatus = 'Pending'; // Changed from 'partial' to 'Pending'
        }

        await expense.save();

        // Create double-entry transaction
        const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        const transactionEntry = new TransactionEntry({
            transactionId,
            date: new Date(),
            description: `Payment for Expense ${expense.expenseId} - ${expense.description}`,
            reference: reference || paymentId,
            entries: [
                {
                    accountCode: finalReceivingAccount,
                    accountName: receivingAcc.name,
                    accountType: receivingAcc.type,
                    debit: parseFloat(amount),
                    credit: 0,
                    description: `Payment received for expense ${expense.expenseId}`
                },
                {
                    accountCode: payingAccount,
                    accountName: payingAcc.name,
                    accountType: payingAcc.type,
                    debit: parseFloat(amount), // ✅ FIXED: DEBIT when paying expense (money going OUT)
                    credit: 0,
                    description: `Payment made for expense ${expense.expenseId}`
                }
            ],
            totalDebit: parseFloat(amount),
            totalCredit: parseFloat(amount),
            source: 'expense_payment',
            sourceId: expense._id,
            sourceModel: 'Expense',
            createdBy: user.email,
            createdAt: new Date(),
            metadata: {
                expenseId: expense.expenseId,
                expenseDescription: expense.description,
                paymentMethod,
                reference
            }
        });

        await transactionEntry.save();

        // Populate expense details for response
        await expense.populate('residence', 'name address');
        await expense.populate('createdBy', 'firstName lastName email');

        res.status(201).json({
            message: 'Expense payment recorded successfully with transaction entry',
            payment,
            transactionEntry: {
                transactionId: transactionEntry.transactionId,
                totalDebit: transactionEntry.totalDebit,
                totalCredit: transactionEntry.totalCredit,
                date: transactionEntry.date
            },
            expense: {
                _id: expense._id,
                expenseId: expense.expenseId,
                description: expense.description,
                amount: expense.amount,
                amountPaid: expense.amountPaid,
                balanceDue: expense.balanceDue,
                paymentStatus: expense.paymentStatus,
                residence: expense.residence
            }
        });

    } catch (error) {
        console.error('Error recording expense payment:', error);
        res.status(500).json({
            message: 'Error recording expense payment',
            error: error.message
        });
    }
}; 