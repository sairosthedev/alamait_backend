const Expense = require('../../models/finance/Expense');
const { generateUniqueId } = require('../../utils/idGenerator');
const { validateMongoId } = require('../../utils/validators');
const { createAuditLog } = require('../../utils/auditLogger');

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
            period
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

        // Create audit log
        await createAuditLog({
            action: 'CREATE',
            resourceType: 'Expense',
            resourceId: newExpense._id,
            userId: req.user._id,
            details: `Created expense: ${expenseId} - ${category} - $${amount}`
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

        // Create audit log
        await createAuditLog({
            action: 'UPDATE',
            resourceType: 'Expense',
            resourceId: updatedExpense._id,
            userId: req.user._id,
            details: `Updated expense: ${updatedExpense.expenseId} - ${updatedExpense.category}`
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

        // Delete expense
        await Expense.findByIdAndDelete(id);

        // Create audit log
        await createAuditLog({
            action: 'DELETE',
            resourceType: 'Expense',
            resourceId: id,
            userId: req.user._id,
            details: `Deleted expense: ${expense.expenseId} - ${expense.category} - $${expense.amount}`
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

        // Update expense status to Paid
        const updatedExpense = await Expense.findByIdAndUpdate(
            id,
            { 
                $set: { 
                    paymentStatus: 'Paid',
                    updatedBy: req.user._id,
                    paidDate: new Date(),
                    notes: notes || expense.notes
                } 
            },
            { new: true, runValidators: true }
        ).populate('residence', 'name')
         .populate('createdBy', 'firstName lastName email')
         .populate('updatedBy', 'firstName lastName email')
         .populate('paidBy', 'firstName lastName email');

        // Create audit log
        await createAuditLog({
            action: 'APPROVE',
            resourceType: 'Expense',
            resourceId: updatedExpense._id,
            userId: req.user._id,
            details: `Approved expense: ${updatedExpense.expenseId} - ${updatedExpense.category} - $${updatedExpense.amount}`
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