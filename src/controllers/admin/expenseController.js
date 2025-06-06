const Expense = require('../../models/finance/Expense');
const mongoose = require('mongoose');
const { generateUniqueId } = require('../../utils/idGenerator');
const Residence = require('../../models/Residence');

// Get expenses with filters
const getExpenses = async (req, res) => {
    try {
        console.log('Fetching expenses with filters:', req.query);
        
        const { date, category, description, amount, residence, period } = req.query;

        // Build a query object based on the provided filters
        const query = {};

        if (date) {
            query.expenseDate = date; // Use expenseDate instead of date
        }

        if (category) {
            query.category = { $regex: category, $options: 'i' }; // Case-insensitive match
        }

        if (description) {
            query.description = { $regex: description, $options: 'i' }; // Case-insensitive match
        }

        if (amount) {
            query.amount = amount; // Exact amount match
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
            query.expenseDate = { $gte: oneWeekAgo }; // Expenses from the last 7 days
        } else if (period === 'monthly') {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            query.expenseDate = { $gte: oneMonthAgo }; // Expenses from the last 30 days
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

        res.status(200).json({
            expenses,
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
        console.log('Adding new expense:', req.body);

        // Validate required fields
        const requiredFields = ['residence', 'category', 'amount', 'description', 'date'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                message: 'Missing required fields',
                fields: missingFields
            });
        }

        // Find residence by ID
        const residence = await Residence.findById(req.body.residence);
        if (!residence) {
            return res.status(400).json({
                message: 'Invalid residence ID',
                field: 'residence'
            });
        }

        // Capitalize first letter of category
        const category = req.body.category.charAt(0).toUpperCase() + req.body.category.slice(1);

        // Generate unique expense ID
        const expenseId = await generateUniqueId('EXP');

        // Create new expense
        const expense = new Expense({
            expenseId,
            residence: residence._id,
            category,
            amount: parseFloat(req.body.amount),
            description: req.body.description,
            expenseDate: req.body.date,
            paymentStatus: req.body.paymentStatus || 'Pending',
            paymentMethod: req.body.paymentMethod,
            paidBy: req.body.paidBy,
            paidDate: req.body.paidDate,
            receiptImage: req.body.receiptImage,
            createdBy: req.user._id // Assuming req.user is set by auth middleware
        });

        const savedExpense = await expense.save();
        console.log('Successfully saved expense:', savedExpense);

        // Populate the saved expense with related data
        const populatedExpense = await Expense.findById(savedExpense._id)
            .populate('residence', 'name')
            .populate('paidBy', 'firstName lastName')
            .populate('createdBy', 'firstName lastName');

        res.status(201).json(populatedExpense);
    } catch (error) {
        console.error('Error adding expense:', error);
        res.status(400).json({ message: error.message });
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
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                message: 'Status is required'
            });
        }

        // Validate status value
        const validStatuses = ['Pending', 'Approved', 'Rejected', 'Sent to Finance'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Invalid status value',
                validStatuses
            });
        }

        const expense = await Expense.findById(expenseId);
        if (!expense) {
            return res.status(404).json({
                message: 'Expense not found'
            });
        }

        expense.paymentStatus = status;
        expense.updatedBy = req.user._id;
        await expense.save();

        const updatedExpense = await Expense.findById(expenseId)
            .populate('residence', 'name')
            .populate('paidBy', 'firstName lastName')
            .populate('createdBy', 'firstName lastName');

        res.status(200).json(updatedExpense);
    } catch (error) {
        console.error('Error updating expense status:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getExpenses,
    addExpense,
    sendToFinance,
    updateExpenseStatus
};