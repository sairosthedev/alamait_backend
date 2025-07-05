const OtherExpense = require('../../models/finance/OtherExpense');
const { generateUniqueId } = require('../../utils/idGenerator');
const { validateMongoId } = require('../../utils/validators');
const { createAuditLog } = require('../../utils/auditLogger');

// Get all other expense entries
exports.getAllOtherExpenses = async (req, res) => {
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
            filter.expenseDate = {};
            if (startDate) filter.expenseDate.$gte = new Date(startDate);
            if (endDate) filter.expenseDate.$lte = new Date(endDate);
        }

        // Sorting
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get other expense entries with pagination
        const otherExpenseEntries = await OtherExpense.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('residence', 'name')
            .populate('createdBy', 'firstName lastName email')
            .populate('updatedBy', 'firstName lastName email')
            .populate('paidBy', 'firstName lastName email');

        // Get total count for pagination
        const totalOtherExpenses = await OtherExpense.countDocuments(filter);
        const totalPages = Math.ceil(totalOtherExpenses / parseInt(limit));

        res.status(200).json({
            otherExpenseEntries,
            pagination: {
                totalOtherExpenses,
                totalPages,
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching other expense entries:', error);
        res.status(500).json({ error: 'Failed to retrieve other expense entries' });
    }
};

// Get other expense by ID
exports.getOtherExpenseById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid other expense ID format' });
        }

        const otherExpense = await OtherExpense.findById(id)
            .populate('residence', 'name')
            .populate('createdBy', 'firstName lastName email')
            .populate('updatedBy', 'firstName lastName email')
            .populate('paidBy', 'firstName lastName email');

        if (!otherExpense) {
            return res.status(404).json({ error: 'Other expense entry not found' });
        }

        res.status(200).json({ otherExpense });
    } catch (error) {
        console.error('Error fetching other expense entry:', error);
        res.status(500).json({ error: 'Failed to retrieve other expense entry' });
    }
};

// Create new other expense entry
exports.createOtherExpense = async (req, res) => {
    try {
        const {
            residence,
            category,
            amount,
            description,
            expenseDate,
            paymentStatus,
            paymentMethod,
            paidBy,
            paidDate,
            receiptImage
        } = req.body;

        // Validate required fields
        const requiredFields = ['residence', 'category', 'amount', 'description', 'expenseDate'];
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
        const validCategories = ['Office Supplies', 'Marketing', 'Legal', 'Consulting', 'Travel', 'Entertainment', 'Miscellaneous', 'Other'];
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
                error: 'Invalid expense date',
                field: 'expenseDate',
                message: 'Please provide a valid date'
            });
        }

        // Validate payment method if status is Paid
        if (paymentStatus === 'Paid') {
            const validPaymentMethods = ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal'];
            if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
                return res.status(400).json({ 
                    error: 'Valid payment method is required when status is Paid',
                    field: 'paymentMethod',
                    message: `Payment method must be one of: ${validPaymentMethods.join(', ')}`
                });
            }
        }

        // Generate unique expense ID
        const expenseId = await generateUniqueId('OE');

        // Create new other expense entry
        const newOtherExpense = new OtherExpense({
            expenseId,
            residence,
            category,
            amount: parseFloat(amount),
            description,
            expenseDate: date,
            paymentStatus: paymentStatus || 'Pending',
            paymentMethod: paymentStatus === 'Paid' ? paymentMethod : undefined,
            paidBy: paymentStatus === 'Paid' ? paidBy : undefined,
            paidDate: paymentStatus === 'Paid' ? (paidDate ? new Date(paidDate) : new Date()) : undefined,
            receiptImage,
            createdBy: req.user._id
        });

        // Save other expense entry
        await newOtherExpense.save();

        // Populate the saved entry
        await newOtherExpense.populate('residence', 'name');
        await newOtherExpense.populate('createdBy', 'firstName lastName email');

        // Create audit log
        await createAuditLog({
            action: 'CREATE',
            resourceType: 'OtherExpense',
            resourceId: newOtherExpense._id,
            userId: req.user._id,
            details: `Created other expense entry: ${newOtherExpense.expenseId} for residence: ${residence}`
        });

        res.status(201).json({
            message: 'Other expense entry created successfully',
            otherExpense: newOtherExpense
        });
    } catch (error) {
        console.error('Error creating other expense entry:', error);
        res.status(500).json({ error: 'Failed to create other expense entry' });
    }
};

// Update other expense entry
exports.updateOtherExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid other expense ID format' });
        }

        // Find other expense entry
        const otherExpense = await OtherExpense.findById(id);
        if (!otherExpense) {
            return res.status(404).json({ error: 'Other expense entry not found' });
        }

        // Validate residence ID if provided
        if (updateData.residence && !validateMongoId(updateData.residence)) {
            return res.status(400).json({ error: 'Invalid residence ID format' });
        }

        // Validate category if provided
        if (updateData.category) {
            const validCategories = ['Office Supplies', 'Marketing', 'Legal', 'Consulting', 'Travel', 'Entertainment', 'Miscellaneous', 'Other'];
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
        if (updateData.expenseDate) updateData.expenseDate = new Date(updateData.expenseDate);
        if (updateData.paidDate) updateData.paidDate = new Date(updateData.paidDate);

        // Handle payment status changes
        if (updateData.paymentStatus === 'Paid') {
            const validPaymentMethods = ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal'];
            if (!updateData.paymentMethod || !validPaymentMethods.includes(updateData.paymentMethod)) {
                return res.status(400).json({ 
                    error: 'Valid payment method is required when status is Paid',
                    message: `Payment method must be one of: ${validPaymentMethods.join(', ')}`
                });
            }
            if (!updateData.paidDate) {
                updateData.paidDate = new Date();
            }
        } else if (updateData.paymentStatus && updateData.paymentStatus !== 'Paid') {
            // Clear payment-related fields if status is not Paid
            updateData.paymentMethod = undefined;
            updateData.paidBy = undefined;
            updateData.paidDate = undefined;
        }

        // Add updatedBy field
        updateData.updatedBy = req.user._id;

        // Update other expense entry
        const updatedOtherExpense = await OtherExpense.findByIdAndUpdate(
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
            resourceType: 'OtherExpense',
            resourceId: updatedOtherExpense._id,
            userId: req.user._id,
            details: `Updated other expense entry: ${updatedOtherExpense.expenseId}`
        });

        res.status(200).json({
            message: 'Other expense entry updated successfully',
            otherExpense: updatedOtherExpense
        });
    } catch (error) {
        console.error('Error updating other expense entry:', error);
        res.status(500).json({ error: 'Failed to update other expense entry' });
    }
};

// Delete other expense entry
exports.deleteOtherExpense = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid other expense ID format' });
        }

        // Find other expense entry
        const otherExpense = await OtherExpense.findById(id);
        if (!otherExpense) {
            return res.status(404).json({ error: 'Other expense entry not found' });
        }

        // Delete other expense entry
        await OtherExpense.findByIdAndDelete(id);

        // Create audit log
        await createAuditLog({
            action: 'DELETE',
            resourceType: 'OtherExpense',
            resourceId: id,
            userId: req.user._id,
            details: `Deleted other expense entry: ${otherExpense.expenseId}`
        });

        res.status(200).json({
            message: 'Other expense entry deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting other expense entry:', error);
        res.status(500).json({ error: 'Failed to delete other expense entry' });
    }
};

// Get other expense summary statistics
exports.getOtherExpenseSummary = async (req, res) => {
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

        // Get total other expense amount
        const totalOtherExpenseAmount = await OtherExpense.aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Get other expenses by category
        const otherExpensesByCategory = await OtherExpense.aggregate([
            { $match: filter },
            { $group: { _id: '$category', total: { $sum: '$amount' } } },
            { $sort: { total: -1 } }
        ]);

        // Get other expenses by payment status
        const otherExpensesByStatus = await OtherExpense.aggregate([
            { $match: filter },
            { $group: { _id: '$paymentStatus', total: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { total: -1 } }
        ]);

        // Get other expenses by month (last 12 months)
        const otherExpensesByMonth = await OtherExpense.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: {
                        year: { $year: '$expenseDate' },
                        month: { $month: '$expenseDate' }
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
                totalAmount: totalOtherExpenseAmount.length > 0 ? totalOtherExpenseAmount[0].total : 0,
                totalEntries: await OtherExpense.countDocuments(filter)
            },
            byCategory: otherExpensesByCategory,
            byStatus: otherExpensesByStatus,
            byMonth: otherExpensesByMonth
        });
    } catch (error) {
        console.error('Error fetching other expense summary:', error);
        res.status(500).json({ error: 'Failed to retrieve other expense summary' });
    }
}; 