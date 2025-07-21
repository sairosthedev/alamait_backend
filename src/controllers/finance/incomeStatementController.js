const IncomeStatement = require('../../models/finance/IncomeStatement');
const { generateUniqueId } = require('../../utils/idGenerator');
const { validateMongoId } = require('../../utils/validators');
const AuditLog = require('../../models/AuditLog');

// Get all income statements
exports.getAllIncomeStatements = async (req, res) => {
    try {
        const {
            residence,
            period,
            status,
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
        
        if (period) filter.period = period;
        if (status) filter.status = status;
        
        // Date filtering
        if (startDate || endDate) {
            filter.startDate = {};
            if (startDate) filter.startDate.$gte = new Date(startDate);
            if (endDate) filter.endDate.$lte = new Date(endDate);
        }

        // Sorting
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get income statements with pagination
        const incomeStatements = await IncomeStatement.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('residence', 'name')
            .populate('generatedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        // Get total count for pagination
        const totalIncomeStatements = await IncomeStatement.countDocuments(filter);
        const totalPages = Math.ceil(totalIncomeStatements / parseInt(limit));

        res.status(200).json({
            incomeStatements,
            pagination: {
                totalIncomeStatements,
                totalPages,
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching income statements:', error);
        res.status(500).json({ error: 'Failed to retrieve income statements' });
    }
};

// Get income statement by ID
exports.getIncomeStatementById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid income statement ID format' });
        }

        const incomeStatement = await IncomeStatement.findById(id)
            .populate('residence', 'name')
            .populate('generatedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        if (!incomeStatement) {
            return res.status(404).json({ error: 'Income statement not found' });
        }

        res.status(200).json({ incomeStatement });
    } catch (error) {
        console.error('Error fetching income statement:', error);
        res.status(500).json({ error: 'Failed to retrieve income statement' });
    }
};

// Create new income statement
exports.createIncomeStatement = async (req, res) => {
    try {
        const {
            residence,
            period,
            startDate,
            endDate,
            revenue,
            expenses,
            totalRevenue,
            totalExpenses,
            netIncome,
            status,
            notes
        } = req.body;

        // Validate required fields
        if (!residence || !period || !startDate || !endDate || !revenue || !expenses) {
            return res.status(400).json({
                error: 'Missing required fields',
                requiredFields: ['residence', 'period', 'startDate', 'endDate', 'revenue', 'expenses']
            });
        }

        // Validate residence ID
        if (!validateMongoId(residence)) {
            return res.status(400).json({ error: 'Invalid residence ID format' });
        }

        // Generate unique report ID
        const reportId = await generateUniqueId('IS');

        // Calculate totals if not provided
        const calculatedTotalRevenue = totalRevenue || revenue.reduce((sum, item) => sum + item.amount, 0);
        const calculatedTotalExpenses = totalExpenses || expenses.reduce((sum, item) => sum + item.amount, 0);
        const calculatedNetIncome = netIncome || (calculatedTotalRevenue - calculatedTotalExpenses);

        // Create new income statement
        const newIncomeStatement = new IncomeStatement({
            residence,
            reportId,
            period,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            revenue,
            expenses,
            totalRevenue: calculatedTotalRevenue,
            totalExpenses: calculatedTotalExpenses,
            netIncome: calculatedNetIncome,
            status: status || 'Draft',
            generatedBy: req.user._id,
            notes
        });

        // Save income statement
        await newIncomeStatement.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'create',
            collection: 'IncomeStatement',
            recordId: newIncomeStatement._id,
            before: null,
            after: newIncomeStatement.toObject()
        });

        res.status(201).json({
            message: 'Income statement created successfully',
            incomeStatement: newIncomeStatement
        });
    } catch (error) {
        console.error('Error creating income statement:', error);
        res.status(500).json({ error: 'Failed to create income statement' });
    }
};

// Update income statement
exports.updateIncomeStatement = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid income statement ID format' });
        }

        // Find income statement
        const incomeStatement = await IncomeStatement.findById(id);
        if (!incomeStatement) {
            return res.status(404).json({ error: 'Income statement not found' });
        }

        const before = incomeStatement.toObject();

        // Validate residence ID if provided
        if (updateData.residence && !validateMongoId(updateData.residence)) {
            return res.status(400).json({ error: 'Invalid residence ID format' });
        }

        // Format dates if provided
        if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
        if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);
        if (updateData.approvedDate) updateData.approvedDate = new Date(updateData.approvedDate);

        // Recalculate totals if revenue or expenses are updated
        if (updateData.revenue) {
            updateData.totalRevenue = updateData.revenue.reduce((sum, item) => sum + item.amount, 0);
        }
        
        if (updateData.expenses) {
            updateData.totalExpenses = updateData.expenses.reduce((sum, item) => sum + item.amount, 0);
        }
        
        if ((updateData.revenue || updateData.expenses) && !updateData.netIncome) {
            const totalRevenue = updateData.totalRevenue || incomeStatement.totalRevenue;
            const totalExpenses = updateData.totalExpenses || incomeStatement.totalExpenses;
            updateData.netIncome = totalRevenue - totalExpenses;
        }

        // Update income statement
        const updatedIncomeStatement = await IncomeStatement.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('residence', 'name')
         .populate('generatedBy', 'firstName lastName email')
         .populate('approvedBy', 'firstName lastName email');

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'update',
            collection: 'IncomeStatement',
            recordId: updatedIncomeStatement._id,
            before,
            after: updatedIncomeStatement.toObject()
        });

        res.status(200).json({
            message: 'Income statement updated successfully',
            incomeStatement: updatedIncomeStatement
        });
    } catch (error) {
        console.error('Error updating income statement:', error);
        res.status(500).json({ error: 'Failed to update income statement' });
    }
};

// Delete income statement
exports.deleteIncomeStatement = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid income statement ID format' });
        }

        // Find income statement
        const incomeStatement = await IncomeStatement.findById(id);
        if (!incomeStatement) {
            return res.status(404).json({ error: 'Income statement not found' });
        }

        const before = incomeStatement.toObject();

        // Delete income statement
        await IncomeStatement.findByIdAndDelete(id);

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'delete',
            collection: 'IncomeStatement',
            recordId: id,
            before,
            after: null
        });

        res.status(200).json({
            message: 'Income statement deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting income statement:', error);
        res.status(500).json({ error: 'Failed to delete income statement' });
    }
};

// Approve income statement
exports.approveIncomeStatement = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid income statement ID format' });
        }

        // Find income statement
        const incomeStatement = await IncomeStatement.findById(id);
        if (!incomeStatement) {
            return res.status(404).json({ error: 'Income statement not found' });
        }

        if (incomeStatement.status === 'Published') {
            return res.status(400).json({ error: 'Income statement is already published' });
        }

        const before = incomeStatement.toObject();

        // Update income statement status to Published
        const updatedIncomeStatement = await IncomeStatement.findByIdAndUpdate(
            id,
            { 
                $set: { 
                    status: 'Published',
                    approvedBy: req.user._id,
                    approvedDate: new Date(),
                    notes: notes || incomeStatement.notes
                } 
            },
            { new: true, runValidators: true }
        ).populate('residence', 'name')
         .populate('generatedBy', 'firstName lastName email')
         .populate('approvedBy', 'firstName lastName email');

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'approve',
            collection: 'IncomeStatement',
            recordId: updatedIncomeStatement._id,
            before,
            after: updatedIncomeStatement.toObject()
        });

        res.status(200).json({
            message: 'Income statement approved and published successfully',
            incomeStatement: updatedIncomeStatement
        });
    } catch (error) {
        console.error('Error approving income statement:', error);
        res.status(500).json({ error: 'Failed to approve income statement' });
    }
};