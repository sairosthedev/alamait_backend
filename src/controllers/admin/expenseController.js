const Expense = require('../../models/finance/Expense');
const mongoose = require('mongoose');
const { generateUniqueId } = require('../../utils/idGenerator');
const Residence = require('../../models/Residence');
const Maintenance = require('../../models/Maintenance');

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
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const expenseId = `EXP-${timestamp}-${randomNum}`;

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
            createdBy: req.user._id
        });

        await expense.save();

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

        // Update the expense
        expense.paymentStatus = 'Paid';
        expense.paymentMethod = paymentMethod;
        expense.paidDate = new Date();
        expense.paidBy = req.user._id;
        await expense.save();

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

module.exports = {
    getExpenses,
    addExpense,
    sendToFinance,
    updateExpenseStatus,
    getExpenseTotals,
    approveExpense,
    updateExpense
};