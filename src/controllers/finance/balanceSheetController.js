const BalanceSheet = require('../../models/finance/BalanceSheet');
const { validateMongoId } = require('../../utils/validators');
const { createAuditLog } = require('../../utils/auditLogger');

// Get all balance sheets
exports.getAllBalanceSheets = async (req, res) => {
    try {
        const {
            residence,
            status,
            startDate,
            endDate,
            page = 1,
            limit = 10,
            sortBy = 'asOf',
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
        
        if (status) filter.status = status;
        
        // Date filtering
        if (startDate || endDate) {
            filter.asOf = {};
            if (startDate) filter.asOf.$gte = new Date(startDate);
            if (endDate) filter.asOf.$lte = new Date(endDate);
        }

        // Sorting
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get balance sheets with pagination
        const balanceSheets = await BalanceSheet.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('residence', 'name')
            .populate('generatedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        // Get total count for pagination
        const totalBalanceSheets = await BalanceSheet.countDocuments(filter);
        const totalPages = Math.ceil(totalBalanceSheets / parseInt(limit));

        res.status(200).json({
            balanceSheets,
            pagination: {
                totalBalanceSheets,
                totalPages,
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching balance sheets:', error);
        res.status(500).json({ error: 'Failed to retrieve balance sheets' });
    }
};

// Get balance sheet by ID
exports.getBalanceSheetById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid balance sheet ID format' });
        }

        const balanceSheet = await BalanceSheet.findById(id)
            .populate('residence', 'name')
            .populate('generatedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        if (!balanceSheet) {
            return res.status(404).json({ error: 'Balance sheet not found' });
        }

        res.status(200).json({ balanceSheet });
    } catch (error) {
        console.error('Error fetching balance sheet:', error);
        res.status(500).json({ error: 'Failed to retrieve balance sheet' });
    }
};

// Create new balance sheet
exports.createBalanceSheet = async (req, res) => {
    try {
        const {
            residence,
            asOf,
            assets,
            liabilities,
            totalAssets,
            totalLiabilities,
            netWorth,
            status,
            notes
        } = req.body;

        // Validate required fields
        if (!residence || !asOf || !assets || !liabilities) {
            return res.status(400).json({
                error: 'Missing required fields',
                requiredFields: ['residence', 'asOf', 'assets', 'liabilities']
            });
        }

        // Validate residence ID
        if (!validateMongoId(residence)) {
            return res.status(400).json({ error: 'Invalid residence ID format' });
        }

        // Calculate totals if not provided
        const calculatedTotalAssets = totalAssets || assets.reduce((sum, asset) => sum + asset.value, 0);
        const calculatedTotalLiabilities = totalLiabilities || liabilities.reduce((sum, liability) => sum + liability.value, 0);
        const calculatedNetWorth = netWorth || (calculatedTotalAssets - calculatedTotalLiabilities);

        // Create new balance sheet
        const newBalanceSheet = new BalanceSheet({
            residence,
            asOf: new Date(asOf),
            assets,
            liabilities,
            totalAssets: calculatedTotalAssets,
            totalLiabilities: calculatedTotalLiabilities,
            netWorth: calculatedNetWorth,
            status: status || 'Draft',
            generatedBy: req.user._id,
            notes
        });

        // Save balance sheet
        await newBalanceSheet.save();

        // Create audit log
        await createAuditLog({
            action: 'CREATE',
            resourceType: 'BalanceSheet',
            resourceId: newBalanceSheet._id,
            userId: req.user._id,
            details: `Created balance sheet for residence: ${residence} as of ${asOf}`
        });

        res.status(201).json({
            message: 'Balance sheet created successfully',
            balanceSheet: newBalanceSheet
        });
    } catch (error) {
        console.error('Error creating balance sheet:', error);
        res.status(500).json({ error: 'Failed to create balance sheet' });
    }
};

// Update balance sheet
exports.updateBalanceSheet = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid balance sheet ID format' });
        }

        // Find balance sheet
        const balanceSheet = await BalanceSheet.findById(id);
        if (!balanceSheet) {
            return res.status(404).json({ error: 'Balance sheet not found' });
        }

        // Validate residence ID if provided
        if (updateData.residence && !validateMongoId(updateData.residence)) {
            return res.status(400).json({ error: 'Invalid residence ID format' });
        }

        // Format dates if provided
        if (updateData.asOf) updateData.asOf = new Date(updateData.asOf);
        if (updateData.approvedDate) updateData.approvedDate = new Date(updateData.approvedDate);

        // Recalculate totals if assets or liabilities are updated
        if (updateData.assets) {
            updateData.totalAssets = updateData.assets.reduce((sum, asset) => sum + asset.value, 0);
        }
        
        if (updateData.liabilities) {
            updateData.totalLiabilities = updateData.liabilities.reduce((sum, liability) => sum + liability.value, 0);
        }
        
        if ((updateData.assets || updateData.liabilities) && !updateData.netWorth) {
            const totalAssets = updateData.totalAssets || balanceSheet.totalAssets;
            const totalLiabilities = updateData.totalLiabilities || balanceSheet.totalLiabilities;
            updateData.netWorth = totalAssets - totalLiabilities;
        }

        // Update balance sheet
        const updatedBalanceSheet = await BalanceSheet.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('residence', 'name')
         .populate('generatedBy', 'firstName lastName email')
         .populate('approvedBy', 'firstName lastName email');

        // Create audit log
        await createAuditLog({
            action: 'UPDATE',
            resourceType: 'BalanceSheet',
            resourceId: updatedBalanceSheet._id,
            userId: req.user._id,
            details: `Updated balance sheet for residence: ${updatedBalanceSheet.residence._id}`
        });

        res.status(200).json({
            message: 'Balance sheet updated successfully',
            balanceSheet: updatedBalanceSheet
        });
    } catch (error) {
        console.error('Error updating balance sheet:', error);
        res.status(500).json({ error: 'Failed to update balance sheet' });
    }
};

// Delete balance sheet
exports.deleteBalanceSheet = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid balance sheet ID format' });
        }

        // Find balance sheet
        const balanceSheet = await BalanceSheet.findById(id);
        if (!balanceSheet) {
            return res.status(404).json({ error: 'Balance sheet not found' });
        }

        // Delete balance sheet
        await BalanceSheet.findByIdAndDelete(id);

        // Create audit log
        await createAuditLog({
            action: 'DELETE',
            resourceType: 'BalanceSheet',
            resourceId: id,
            userId: req.user._id,
            details: `Deleted balance sheet for residence: ${balanceSheet.residence}`
        });

        res.status(200).json({
            message: 'Balance sheet deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting balance sheet:', error);
        res.status(500).json({ error: 'Failed to delete balance sheet' });
    }
};

// Approve balance sheet
exports.approveBalanceSheet = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid balance sheet ID format' });
        }

        // Find balance sheet
        const balanceSheet = await BalanceSheet.findById(id);
        if (!balanceSheet) {
            return res.status(404).json({ error: 'Balance sheet not found' });
        }

        if (balanceSheet.status === 'Published') {
            return res.status(400).json({ error: 'Balance sheet is already published' });
        }

        // Update balance sheet status to Published
        const updatedBalanceSheet = await BalanceSheet.findByIdAndUpdate(
            id,
            { 
                $set: { 
                    status: 'Published',
                    approvedBy: req.user._id,
                    approvedDate: new Date(),
                    notes: notes || balanceSheet.notes
                } 
            },
            { new: true, runValidators: true }
        ).populate('residence', 'name')
         .populate('generatedBy', 'firstName lastName email')
         .populate('approvedBy', 'firstName lastName email');

        // Create audit log
        await createAuditLog({
            action: 'APPROVE',
            resourceType: 'BalanceSheet',
            resourceId: updatedBalanceSheet._id,
            userId: req.user._id,
            details: `Approved balance sheet for residence: ${updatedBalanceSheet.residence._id}`
        });

        res.status(200).json({
            message: 'Balance sheet approved and published successfully',
            balanceSheet: updatedBalanceSheet
        });
    } catch (error) {
        console.error('Error approving balance sheet:', error);
        res.status(500).json({ error: 'Failed to approve balance sheet' });
    }
}; 