const BalanceSheet = require('../../models/finance/BalanceSheet');
const { validateMongoId } = require('../../utils/validators');
const { createAuditLog } = require('../../utils/auditLogger');
const Asset = require('../../models/finance/Asset');
const Liability = require('../../models/finance/Liability');
const Equity = require('../../models/finance/Equity');

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

// Add entry to balance sheet
exports.addBalanceSheetEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, category, name, value, description } = req.body;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid balance sheet ID format' });
        }

        // Find balance sheet
        const balanceSheet = await BalanceSheet.findById(id);
        if (!balanceSheet) {
            return res.status(404).json({ error: 'Balance sheet not found' });
        }

        // Validate entry type
        if (!['asset', 'liability', 'equity'].includes(type)) {
            return res.status(400).json({ error: 'Invalid entry type' });
        }

        // Create new entry
        const newEntry = {
            category,
            name,
            value: parseFloat(value),
            description
        };

        // Add entry to appropriate array
        if (type === 'asset') {
            balanceSheet.assets.push(newEntry);
            balanceSheet.totalAssets = balanceSheet.assets.reduce((sum, asset) => sum + asset.value, 0);
        } else if (type === 'liability') {
            balanceSheet.liabilities.push(newEntry);
            balanceSheet.totalLiabilities = balanceSheet.liabilities.reduce((sum, liability) => sum + liability.value, 0);
        } else {
            balanceSheet.equity.push(newEntry);
            balanceSheet.totalEquity = balanceSheet.equity.reduce((sum, equity) => sum + equity.value, 0);
        }

        // Recalculate net worth
        balanceSheet.netWorth = balanceSheet.totalAssets - balanceSheet.totalLiabilities;

        // Save balance sheet
        await balanceSheet.save();

        // Create audit log
        await createAuditLog({
            action: 'ADD_ENTRY',
            resourceType: 'BalanceSheet',
            resourceId: balanceSheet._id,
            userId: req.user._id,
            details: `Added ${type} entry to balance sheet: ${name}`
        });

        res.status(200).json({
            message: 'Entry added successfully',
            balanceSheet
        });
    } catch (error) {
        console.error('Error adding balance sheet entry:', error);
        res.status(500).json({ error: 'Failed to add entry' });
    }
};

// Update balance sheet entry
exports.updateBalanceSheetEntry = async (req, res) => {
    try {
        const { id, entryId } = req.params;
        const { type, category, name, value, description } = req.body;

        if (!validateMongoId(id) || !validateMongoId(entryId)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        // Find balance sheet
        const balanceSheet = await BalanceSheet.findById(id);
        if (!balanceSheet) {
            return res.status(404).json({ error: 'Balance sheet not found' });
        }

        // Find entry in appropriate array
        const entryArray = type === 'asset' ? balanceSheet.assets : 
                          type === 'liability' ? balanceSheet.liabilities : 
                          balanceSheet.equity;
        const entryIndex = entryArray.findIndex(entry => entry._id.toString() === entryId);

        if (entryIndex === -1) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        // Update entry
        entryArray[entryIndex] = {
            ...entryArray[entryIndex],
            category,
            name,
            value: parseFloat(value),
            description
        };

        // Recalculate totals
        balanceSheet.totalAssets = balanceSheet.assets.reduce((sum, asset) => sum + asset.value, 0);
        balanceSheet.totalLiabilities = balanceSheet.liabilities.reduce((sum, liability) => sum + liability.value, 0);
        balanceSheet.totalEquity = balanceSheet.equity.reduce((sum, equity) => sum + equity.value, 0);
        balanceSheet.netWorth = balanceSheet.totalAssets - balanceSheet.totalLiabilities;

        // Save balance sheet
        await balanceSheet.save();

        // Create audit log
        await createAuditLog({
            action: 'UPDATE_ENTRY',
            resourceType: 'BalanceSheet',
            resourceId: balanceSheet._id,
            userId: req.user._id,
            details: `Updated ${type} entry in balance sheet: ${name}`
        });

        res.status(200).json({
            message: 'Entry updated successfully',
            balanceSheet
        });
    } catch (error) {
        console.error('Error updating balance sheet entry:', error);
        res.status(500).json({ error: 'Failed to update entry' });
    }
};

// Delete balance sheet entry
exports.deleteBalanceSheetEntry = async (req, res) => {
    try {
        const { id, entryId } = req.params;
        const { type } = req.query;

        if (!validateMongoId(id) || !validateMongoId(entryId)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        // Find balance sheet
        const balanceSheet = await BalanceSheet.findById(id);
        if (!balanceSheet) {
            return res.status(404).json({ error: 'Balance sheet not found' });
        }

        // Find and remove entry from appropriate array
        const entryArray = type === 'asset' ? balanceSheet.assets : 
                          type === 'liability' ? balanceSheet.liabilities : 
                          balanceSheet.equity;
        const entryIndex = entryArray.findIndex(entry => entry._id.toString() === entryId);

        if (entryIndex === -1) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        const deletedEntry = entryArray[entryIndex];
        entryArray.splice(entryIndex, 1);

        // Recalculate totals
        balanceSheet.totalAssets = balanceSheet.assets.reduce((sum, asset) => sum + asset.value, 0);
        balanceSheet.totalLiabilities = balanceSheet.liabilities.reduce((sum, liability) => sum + liability.value, 0);
        balanceSheet.totalEquity = balanceSheet.equity.reduce((sum, equity) => sum + equity.value, 0);
        balanceSheet.netWorth = balanceSheet.totalAssets - balanceSheet.totalLiabilities;

        // Save balance sheet
        await balanceSheet.save();

        // Create audit log
        await createAuditLog({
            action: 'DELETE_ENTRY',
            resourceType: 'BalanceSheet',
            resourceId: balanceSheet._id,
            userId: req.user._id,
            details: `Deleted ${type} entry from balance sheet: ${deletedEntry.name}`
        });

        res.status(200).json({
            message: 'Entry deleted successfully',
            balanceSheet
        });
    } catch (error) {
        console.error('Error deleting balance sheet entry:', error);
        res.status(500).json({ error: 'Failed to delete entry' });
    }
};

// Get latest balance sheet
exports.getLatestBalanceSheet = async (req, res) => {
    try {
        const balanceSheet = await BalanceSheet.findOne()
            .sort({ asOf: -1 })
            .populate('residence', 'name')
            .populate('generatedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        if (!balanceSheet) {
            return res.status(404).json({ error: 'No balance sheet found' });
        }

        res.status(200).json({ balanceSheet });
    } catch (error) {
        console.error('Error fetching latest balance sheet:', error);
        res.status(500).json({ error: 'Failed to retrieve balance sheet' });
    }
};

// Get all balance sheet entries
exports.getAllBalanceSheetEntries = async (req, res) => {
    try {
        const {
            residence,
            startDate,
            endDate,
            page = 1,
            limit = 10,
            sort = 'asOf',
            order = 'desc'
        } = req.query;

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
            filter.asOf = {};
            if (startDate) filter.asOf.$gte = new Date(startDate);
            if (endDate) filter.asOf.$lte = new Date(endDate);
        }

        // Get all balance sheets with populated data
        const balanceSheets = await BalanceSheet.find(filter)
            .sort({ asOf: -1 })
            .populate('residence', 'name')
            .populate('generatedBy', 'firstName lastName email');

        // Initialize arrays for each type
        const assets = [];
        const liabilities = [];
        const equity = [];

        // Process each balance sheet
        balanceSheets.forEach(sheet => {
            // Process assets
            if (sheet.assets && Array.isArray(sheet.assets)) {
                sheet.assets.forEach(asset => {
                    assets.push({
                        ...asset.toObject(),
                        balanceSheetId: sheet._id,
                        date: sheet.asOf,
                        residence: sheet.residence,
                        generatedBy: sheet.generatedBy
                    });
                });
            }

            // Process liabilities
            if (sheet.liabilities && Array.isArray(sheet.liabilities)) {
                sheet.liabilities.forEach(liability => {
                    liabilities.push({
                        ...liability.toObject(),
                        balanceSheetId: sheet._id,
                        date: sheet.asOf,
                        residence: sheet.residence,
                        generatedBy: sheet.generatedBy
                    });
                });
            }

            // Process equity
            if (sheet.equity && Array.isArray(sheet.equity)) {
                sheet.equity.forEach(equityItem => {
                    equity.push({
                        ...equityItem.toObject(),
                        balanceSheetId: sheet._id,
                        date: sheet.asOf,
                        residence: sheet.residence,
                        generatedBy: sheet.generatedBy
                    });
                });
            }
        });

        // Calculate totals
        const totals = {
            assets: balanceSheets.reduce((sum, sheet) => sum + (sheet.totalAssets || 0), 0),
            liabilities: balanceSheets.reduce((sum, sheet) => sum + (sheet.totalLiabilities || 0), 0),
            equity: balanceSheets.reduce((sum, sheet) => sum + (sheet.totalEquity || 0), 0)
        };

        res.status(200).json({
            assets,
            liabilities,
            equity,
            totals,
            pagination: {
                totalEntries: assets.length + liabilities.length + equity.length,
                totalPages: 1,
                currentPage: 1,
                limit: assets.length + liabilities.length + equity.length
            }
        });
    } catch (error) {
        console.error('Error fetching balance sheet entries:', error);
        res.status(500).json({ error: 'Failed to retrieve balance sheet entries' });
    }
};

// Get all assets
exports.getAllAssets = async (req, res) => {
    try {
        const assets = await Asset.find();
        const mappedAssets = assets.map(asset => ({
            ...asset.toObject(),
            amount: asset.value,
            value: undefined
        }));
        res.status(200).json({ assets: mappedAssets });
    } catch (error) {
        console.error('Error fetching assets:', error);
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
};

// Get all liabilities from all balance sheets
exports.getAllLiabilities = async (req, res) => {
    try {
        const liabilities = await Liability.find();
        const mappedLiabilities = liabilities.map(liability => ({
            ...liability.toObject(),
            amount: liability.value,
            value: undefined
        }));
        res.status(200).json({ liabilities: mappedLiabilities });
    } catch (error) {
        console.error('Error fetching liabilities:', error);
        res.status(500).json({ error: 'Failed to fetch liabilities' });
    }
};

// Get all equity
exports.getAllEquity = async (req, res) => {
    try {
        const equity = await Equity.find();
        const mappedEquity = equity.map(item => ({
            ...item.toObject(),
            amount: item.value,
            value: undefined
        }));
        res.status(200).json({ equity: mappedEquity });
    } catch (error) {
        console.error('Error fetching equity:', error);
        res.status(500).json({ error: 'Failed to fetch equity' });
    }
};

// Create asset
exports.createAsset = async (req, res) => {
    try {
        const { value, amount, category, description, entity, type } = req.body;
        const assetValue = amount ? parseFloat(amount) : parseFloat(value);
        
        const assetData = {
            value: assetValue,
            category,
            description,
            entity,
            type,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const asset = new Asset(assetData);
        await asset.save();
        
        const responseData = {
            ...asset.toObject(),
            amount: asset.value,
            value: undefined
        };
        
        res.status(201).json({ asset: responseData });
    } catch (error) {
        console.error('Error creating asset:', error);
        res.status(500).json({ error: 'Failed to create asset' });
    }
};

// Create new liability
exports.createLiability = async (req, res) => {
    try {
        const { value, amount, category, description, entity, type } = req.body;
        const liabilityValue = amount ? parseFloat(amount) : parseFloat(value);
        
        const liabilityData = {
            value: liabilityValue,
            category,
            description,
            entity,
            type,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const liability = new Liability(liabilityData);
        await liability.save();
        
        const responseData = {
            ...liability.toObject(),
            amount: liability.value,
            value: undefined
        };
        
        res.status(201).json({ liability: responseData });
    } catch (error) {
        console.error('Error creating liability:', error);
        res.status(500).json({ error: 'Failed to create liability' });
    }
};

// Create equity
exports.createEquity = async (req, res) => {
    try {
        const { value, amount, category, description, entity, type } = req.body;
        const equityValue = amount ? parseFloat(amount) : parseFloat(value);
        
        const equityData = {
            value: equityValue,
            category,
            description,
            entity,
            type,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const equity = new Equity(equityData);
        await equity.save();
        
        const responseData = {
            ...equity.toObject(),
            amount: equity.value,
            value: undefined
        };
        
        res.status(201).json({ equity: responseData });
    } catch (error) {
        console.error('Error creating equity:', error);
        res.status(500).json({ error: 'Failed to create equity' });
    }
};

// Update asset
exports.updateAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const { value, amount, category, description, entity, type } = req.body;
        
        const assetValue = amount ? parseFloat(amount) : parseFloat(value);
        
        const updateData = {
            value: assetValue,
            category,
            description,
            entity,
            type,
            updatedAt: new Date()
        };
        
        console.log('Updating asset with data:', updateData);
        
        const asset = await Asset.findByIdAndUpdate(
            id, 
            updateData, 
            { 
                new: true,
                runValidators: true
            }
        );
        
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        
        const responseData = {
            ...asset.toObject(),
            amount: asset.value,
            value: undefined
        };
        
        console.log('Updated asset response:', responseData);
        res.status(200).json({ asset: responseData });
    } catch (error) {
        console.error('Error updating asset:', error);
        res.status(500).json({ error: 'Failed to update asset' });
    }
};

// Delete asset
exports.deleteAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const asset = await Asset.findByIdAndDelete(id);
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        res.status(200).json({ message: 'Asset deleted successfully' });
    } catch (error) {
        console.error('Error deleting asset:', error);
        res.status(500).json({ error: 'Failed to delete asset' });
    }
};

// Update liability
exports.updateLiability = async (req, res) => {
    try {
        const { id } = req.params;
        const { value, amount, category, description, entity, type } = req.body;
        
        // Use amount if provided, otherwise use value
        const liabilityValue = amount ? parseFloat(amount) : parseFloat(value);
        
        const updateData = {
            value: liabilityValue,
            category,
            description,
            entity,
            type,
            updatedAt: new Date()
        };
        
        console.log('Updating liability with data:', updateData);
        
        const liability = await Liability.findByIdAndUpdate(
            id, 
            updateData, 
            { 
                new: true,
                runValidators: true
            }
        );
        
        if (!liability) {
            return res.status(404).json({ error: 'Liability not found' });
        }
        
        // Map the response to use amount instead of value
        const responseData = {
            ...liability.toObject(),
            amount: liability.value,
            value: undefined
        };
        
        console.log('Updated liability response:', responseData);
        res.status(200).json({ liability: responseData });
    } catch (error) {
        console.error('Error updating liability:', error);
        res.status(500).json({ error: 'Failed to update liability' });
    }
};

// Delete liability
exports.deleteLiability = async (req, res) => {
    try {
        const { id } = req.params;
        const liability = await Liability.findByIdAndDelete(id);
        if (!liability) {
            return res.status(404).json({ error: 'Liability not found' });
        }
        res.status(200).json({ message: 'Liability deleted successfully' });
    } catch (error) {
        console.error('Error deleting liability:', error);
        res.status(500).json({ error: 'Failed to delete liability' });
    }
};

// Update equity
exports.updateEquity = async (req, res) => {
    try {
        const { id } = req.params;
        const { value, amount, category, description, entity, type } = req.body;
        
        const equityValue = amount ? parseFloat(amount) : parseFloat(value);
        
        const updateData = {
            value: equityValue,
            category,
            description,
            entity,
            type,
            updatedAt: new Date()
        };
        
        console.log('Updating equity with data:', updateData);
        
        const equity = await Equity.findByIdAndUpdate(
            id, 
            updateData, 
            { 
                new: true,
                runValidators: true
            }
        );
        
        if (!equity) {
            return res.status(404).json({ error: 'Equity not found' });
        }
        
        const responseData = {
            ...equity.toObject(),
            amount: equity.value,
            value: undefined
        };
        
        console.log('Updated equity response:', responseData);
        res.status(200).json({ equity: responseData });
    } catch (error) {
        console.error('Error updating equity:', error);
        res.status(500).json({ error: 'Failed to update equity' });
    }
};

// Delete equity
exports.deleteEquity = async (req, res) => {
    try {
        const { id } = req.params;
        const equity = await Equity.findByIdAndDelete(id);
        if (!equity) {
            return res.status(404).json({ error: 'Equity not found' });
        }
        res.status(200).json({ message: 'Equity deleted successfully' });
    } catch (error) {
        console.error('Error deleting equity:', error);
        res.status(500).json({ error: 'Failed to delete equity' });
    }
};

module.exports = exports; 