const BalanceSheet = require('../../models/finance/BalanceSheet');
const { validateMongoId } = require('../../utils/validators');
const { createAuditLog } = require('../../utils/auditLogger');
const Asset = require('../../models/finance/Asset');
const Liability = require('../../models/finance/Liability');
const Equity = require('../../models/finance/Equity');
const AuditLog = require('../../models/AuditLog');
const FinancialReportingService = require('../../services/financialReportingService');
const TransactionEntry = require('../../models/TransactionEntry');

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

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'create',
            collection: 'BalanceSheet',
            recordId: newBalanceSheet._id,
            before: null,
            after: newBalanceSheet.toObject()
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

        const before = balanceSheet.toObject();

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

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'update',
            collection: 'BalanceSheet',
            recordId: updatedBalanceSheet._id,
            before,
            after: updatedBalanceSheet.toObject()
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

        const before = balanceSheet.toObject();

        // Delete balance sheet
        await BalanceSheet.findByIdAndDelete(id);

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'delete',
            collection: 'BalanceSheet',
            recordId: id,
            before,
            after: null
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

        const before = balanceSheet.toObject();

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

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'approve',
            collection: 'BalanceSheet',
            recordId: updatedBalanceSheet._id,
            before,
            after: updatedBalanceSheet.toObject()
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

        const before = balanceSheet.toObject();

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

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'add_entry',
            collection: 'BalanceSheet',
            recordId: balanceSheet._id,
            before,
            after: balanceSheet.toObject()
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

        const before = balanceSheet.toObject();

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

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'update_entry',
            collection: 'BalanceSheet',
            recordId: balanceSheet._id,
            before,
            after: balanceSheet.toObject()
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

        const before = balanceSheet.toObject();

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

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'delete_entry',
            collection: 'BalanceSheet',
            recordId: balanceSheet._id,
            before,
            after: balanceSheet.toObject()
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

/**
 * Helper function to get account display name for balance sheet drill-down
 */
const getAccountDisplayName = (accountCode) => {
    const accountNames = {
        // Asset Accounts (1000s)
        '1000': 'Cash',
        '1001': 'Bank Account',
        '1100': 'Accounts Receivable',
        '1200': 'Prepaid Expenses',
        '1300': 'Fixed Assets',
        '1400': 'Accumulated Depreciation',
        
        // Liability Accounts (2000s)
        '2000': 'Accounts Payable',
        '2020': 'Tenant Security Deposits',
        '2200': 'Advance Payment Liability',
        '2300': 'Accrued Expenses',
        '2400': 'Deferred Income',
        
        // Equity Accounts (3000s)
        '3000': 'Owner\'s Capital',
        '3100': 'Retained Earnings',
        '3200': 'Current Year Earnings'
    };
    
    return accountNames[accountCode] || `Account ${accountCode}`;
};

/**
 * Get detailed transactions for a specific account and month for balance sheet drill-down
 * GET /api/finance/balance-sheet/account-details?period=2025&month=july&accountCode=1000
 */
exports.getAccountTransactionDetails = async (req, res) => {
    try {
        const { period, month, accountCode, residenceId, sourceType } = req.query;
        
        console.log(`📋 Balance Sheet Drill-down Query parameters:`, { period, month, accountCode, residenceId, sourceType });
        
        if (!period || !month || !accountCode) {
            return res.status(400).json({
                success: false,
                message: 'Period, month, and accountCode parameters are required'
            });
        }

        // Check if this is an income account (4000 series) - for these, we should show cash flow data instead of balance sheet data
        const Account = require('../../models/Account');
        const account = await Account.findOne({ code: accountCode });
        
        if (account && account.type === 'Income' && accountCode.startsWith('400')) {
            console.log(`💰 Income account detected (${accountCode}), redirecting to cash flow data...`);
            
            // For income accounts, we want to show cash payments, not balance sheet data
            // Call our cash flow account details logic
            const FinancialReportsController = require('../financialReportsController');
            return await FinancialReportsController.getCashFlowAccountDetails(req, res);
        }
        
        // Convert month name to month number
        const monthNames = {
            'january': 0, 'february': 1, 'march': 2, 'april': 3,
            'may': 4, 'june': 5, 'july': 6, 'august': 7,
            'september': 8, 'october': 9, 'november': 10, 'december': 11
        };
        
        const monthNumber = monthNames[month.toLowerCase()];
        if (monthNumber === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Invalid month name. Use full month names like "january", "february", etc.'
            });
        }
        
        // For balance sheet, we need cumulative data up to the end of the selected month
        // This shows the balance as of that month-end date
        const asOfDate = new Date(parseInt(period), monthNumber + 1, 0, 23, 59, 59, 999); // Last day of the month
        
        console.log(`🔍 Searching for transactions for account ${accountCode} as of ${asOfDate.toLocaleDateString()}`);
        
        // Check if this is a parent account that should include child accounts
        const mainAccount = await Account.findOne({ code: accountCode });
        let childAccounts = [];
        let allAccountCodes = [accountCode];
        let useRegexForAR = false; // when true, include all 1100 and 1100-* even if child accounts are missing
        
        if (mainAccount && accountCode === '1100') {
            console.log(`🔗 Found parent account ${accountCode}, looking for child accounts...`);
            
            // For account 1100, we specifically want student-specific AR accounts
            // Find accounts with codes that start with 1100- (student-specific AR accounts)
            childAccounts = await Account.find({
                code: { $regex: `^1100-` },
                isActive: true,
                type: 'Asset'
            }).select('code name type category');
            
            // Add child account codes to the search
            allAccountCodes = [accountCode, ...childAccounts.map(child => child.code)];
            // Also enable regex fallback to capture child AR entries even if account records are missing
            useRegexForAR = true;
            
            console.log(`📊 Found ${childAccounts.length} student-specific AR accounts for ${accountCode}:`, 
                childAccounts.map(c => `${c.code} - ${c.name}`));
        } else if (mainAccount && accountCode === '2000') {
            console.log(`🔗 Found parent account ${accountCode}, looking for child accounts...`);
            
            // For account 2000, we want its direct child accounts
            childAccounts = await Account.find({
                parentAccount: mainAccount._id,
                isActive: true,
                type: 'Liability'
            }).select('code name type category');
            
            // Add child account codes to the search
            allAccountCodes = [accountCode, ...childAccounts.map(child => child.code)];
            
            console.log(`📊 Found ${childAccounts.length} child AP accounts for ${accountCode}:`, 
                childAccounts.map(c => `${c.code} - ${c.name}`));
        }
        
        // Build query for cumulative transactions up to the selected month
        const query = {
            date: { $lte: asOfDate },
            status: 'posted'
        };
        // If this is AR parent 1100, include all child entries using regex to avoid missing credits
        if (useRegexForAR && accountCode === '1100') {
            query['entries.accountCode'] = { $regex: '^1100(-|$)' };
        } else {
            query['entries.accountCode'] = { $in: allAccountCodes };
        }
        
        if (residenceId) {
            // Include transactions tied to the residence either via top-level residence
            // or via metadata (some manual/adjustment entries may only record residence in metadata)
            query.$or = [
                { residence: residenceId },
                { 'metadata.residenceId': residenceId },
                { 'metadata.residence': residenceId }
            ];
        }
        
        console.log(`📊 Balance Sheet Query:`, JSON.stringify(query, null, 2));
        
        // Find all relevant transactions
        const transactions = await TransactionEntry.find(query)
            .populate('residence')
            .sort({ date: 1 });
        
        console.log(`📈 Found ${transactions.length} transactions for account ${accountCode} and ${childAccounts.length} child accounts`);
        
        // Extract account-specific transactions (including child accounts)
        const accountTransactions = [];
        let totalDebits = 0;
        let totalCredits = 0;
        const uniqueStudents = new Set();
        const accountBreakdown = {}; // Track transactions by account code
        
        transactions.forEach(transaction => {
            // Filter entries for all relevant account codes (parent + children)
            const relevantEntries = transaction.entries.filter(entry => {
                if (useRegexForAR && accountCode === '1100') {
                    return typeof entry.accountCode === 'string' && entry.accountCode.startsWith('1100');
                }
                return allAccountCodes.includes(entry.accountCode);
            });
            
            relevantEntries.forEach(entry => {
                const debitAmount = entry.debit || 0;
                const creditAmount = entry.credit || 0;
                
                // Apply sourceType filtering if specified
                if (sourceType) {
                    const description = transaction.description?.toLowerCase() || '';
                    const sourceTypeLower = sourceType.toLowerCase();
                    
                    let shouldInclude = false;
                    
                    if (sourceTypeLower === 'deposits' || sourceTypeLower === 'security deposits') {
                        shouldInclude = description.includes('deposit') || description.includes('security');
                    } else if (sourceTypeLower === 'payables' || sourceTypeLower === 'accounts payable') {
                        shouldInclude = description.includes('payable') || description.includes('vendor') || 
                                      description.includes('supplier') || description.includes('bill') ||
                                      description.includes('expense');
                    } else if (sourceTypeLower === 'receivables' || sourceTypeLower === 'accounts receivable') {
                        shouldInclude = description.includes('receivable') || description.includes('rent') ||
                                      description.includes('rental') || description.includes('outstanding');
                    } else if (sourceTypeLower === 'cash') {
                        shouldInclude = description.includes('payment') || description.includes('receipt') ||
                                      description.includes('cash') || description.includes('bank');
                    }
                    
                    if (!shouldInclude) {
                        return; // Skip this transaction if it doesn't match the sourceType filter
                    }
                }
                
                totalDebits += debitAmount;
                totalCredits += creditAmount;
                
                // Track breakdown by account code
                if (!accountBreakdown[entry.accountCode]) {
                    accountBreakdown[entry.accountCode] = {
                        totalDebits: 0,
                        totalCredits: 0,
                        transactionCount: 0
                    };
                }
                accountBreakdown[entry.accountCode].totalDebits += debitAmount;
                accountBreakdown[entry.accountCode].totalCredits += creditAmount;
                accountBreakdown[entry.accountCode].transactionCount += 1;
                
                // Get student information if available
                let studentName = 'N/A';
                let debtorName = 'N/A';
                
                if (transaction.metadata?.studentName) {
                    studentName = transaction.metadata.studentName;
                    uniqueStudents.add(studentName);
                } else if (transaction.metadata?.debtorName) {
                    debtorName = transaction.metadata.debtorName;
                    uniqueStudents.add(debtorName);
                }
                
                // Determine if this is a child account transaction
                const isChildAccount = entry.accountCode !== accountCode;
                const childAccountInfo = childAccounts.find(child => child.code === entry.accountCode);
                
                accountTransactions.push({
                    transactionId: transaction.transactionId || transaction._id,
                    date: transaction.date,
                    amount: debitAmount || creditAmount,
                    type: debitAmount > 0 ? 'debit' : 'credit',
                    description: transaction.description,
                    accountCode: entry.accountCode,
                    accountName: entry.accountName,
                    debtorName,
                    studentName,
                    reference: transaction.reference,
                    source: transaction.source,
                    // Additional balance sheet specific fields
                    balance: debitAmount - creditAmount, // Net effect on account
                    debit: debitAmount,
                    credit: creditAmount,
                    // Child account information
                    isChildAccount,
                    childAccountName: isChildAccount ? (childAccountInfo?.name || 'Unknown Child Account') : null,
                    parentAccountCode: isChildAccount ? accountCode : null
                });
            });
        });
        
        // Sort transactions by date (newest first for balance sheet view)
        accountTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Calculate running balance for balance sheet accounts
        let runningBalance = 0;
        const isAssetOrExpense = accountCode.startsWith('1') || accountCode.startsWith('5');
        
        // For balance sheet, calculate the final balance based on account type
        accountTransactions.reverse(); // Reverse to calculate from oldest to newest
        accountTransactions.forEach(transaction => {
            if (isAssetOrExpense) {
                // Assets and Expenses: Debit increases, Credit decreases
                runningBalance += (transaction.debit || 0) - (transaction.credit || 0);
            } else {
                // Liabilities, Equity, Revenue: Credit increases, Debit decreases
                runningBalance += (transaction.credit || 0) - (transaction.debit || 0);
            }
            transaction.runningBalance = runningBalance;
        });
        accountTransactions.reverse(); // Reverse back to newest first for display
        
        // Calculate child account summary
        const childAccountSummary = childAccounts.map(child => {
            const breakdown = accountBreakdown[child.code] || { totalDebits: 0, totalCredits: 0, transactionCount: 0 };
            return {
                accountCode: child.code,
                accountName: child.name,
                totalDebits: breakdown.totalDebits,
                totalCredits: breakdown.totalCredits,
                transactionCount: breakdown.transactionCount,
                netBalance: breakdown.totalDebits - breakdown.totalCredits
            };
        });
        
        const summary = {
            totalTransactions: accountTransactions.length,
            totalAmount: Math.abs(totalDebits - totalCredits),
            totalDebits,
            totalCredits,
            finalBalance: runningBalance,
            uniqueStudents: uniqueStudents.size,
            dateRange: {
                start: period + '-01-01',
                end: asOfDate.toISOString().split('T')[0]
            },
            // Child account information
            hasChildAccounts: childAccounts.length > 0,
            childAccountCount: childAccounts.length,
            childAccountSummary,
            accountBreakdown
        };
        
        console.log(`📊 Balance Sheet Summary for ${accountCode}:`, summary);
        
        res.json({
            success: true,
            data: {
                accountCode,
                accountName: getAccountDisplayName(accountCode),
                month,
                period,
                asOfDate: asOfDate.toISOString().split('T')[0],
                sourceType: sourceType || null,
                summary,
                transactions: accountTransactions,
                // Additional child account information with balances
                childAccounts: childAccounts.map(child => {
                    // Calculate balance for this child account
                    let childBalance = 0;
                    let childDebits = 0;
                    let childCredits = 0;
                    
                    transactions.forEach(transaction => {
                        transaction.entries.forEach(entry => {
                            if (entry.accountCode === child.code) {
                                // Compute debits/credits regardless of type
                                const debit = entry.debit || 0;
                                const credit = entry.credit || 0;
                                childDebits += debit;
                                childCredits += credit;
                                
                                // Balance based on account type: Asset/Expense (debit - credit), others (credit - debit)
                                const isAssetOrExpense = (entry.accountType === 'Asset') || (entry.accountType === 'Expense') || child.code.startsWith('1100');
                                if (isAssetOrExpense) {
                                    childBalance += debit - credit;
                                } else {
                                    childBalance += credit - debit;
                                }
                            }
                        });
                    });
                    
                    return {
                        code: child.code,
                        name: child.name,
                        type: child.type,
                        category: child.category,
                        balance: childBalance,
                        debits: childDebits,
                        credits: childCredits
                    };
                }),
                isParentAccount: childAccounts.length > 0,
                parentAccountInfo: childAccounts.length > 0 ? {
                    code: accountCode,
                    name: getAccountDisplayName(accountCode),
                    totalChildAccounts: childAccounts.length,
                    aggregatedBalance: runningBalance
                } : null
            }
        });
        
    } catch (error) {
        console.error('Error getting balance sheet account transaction details:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving account transaction details',
            error: error.message
        });
    }
};

/**
 * Get balance sheet with drill-down links
 * GET /api/finance/balance-sheet/with-drilldown?period=2025&basis=cash
 */
exports.getBalanceSheetWithDrillDown = async (req, res) => {
    try {
        const { period, basis, residenceId, asOf } = req.query;
        
        let balanceSheetData;
        
        if (period) {
            // Generate comprehensive monthly balance sheet
            balanceSheetData = await FinancialReportingService.generateComprehensiveMonthlyBalanceSheet(
                period || new Date().getFullYear().toString(),
                basis || 'cash',
                residenceId
            );
            
            // Add drill-down URLs to each account in monthly breakdown
            const addDrillDownLinks = (accounts, month) => {
                Object.keys(accounts).forEach(accountKey => {
                    const account = accounts[accountKey];
                    if (account.code && (account.balance !== 0 || account.amount !== 0)) {
                        const monthName = typeof month === 'string' ? month.toLowerCase() : 
                                        ['january', 'february', 'march', 'april', 'may', 'june',
                                         'july', 'august', 'september', 'october', 'november', 'december'][month];
                        
                        account.drillDownUrl = `/api/finance/balance-sheet/account-details?period=${period}&month=${monthName}&accountCode=${account.code}${residenceId ? `&residenceId=${residenceId}` : ''}`;
                    }
                });
            };
            
            // Add drill-down links to monthly breakdowns
            if (balanceSheetData.monthly_breakdown) {
                Object.keys(balanceSheetData.monthly_breakdown).forEach(monthIndex => {
                    const monthData = balanceSheetData.monthly_breakdown[monthIndex];
                    addDrillDownLinks(monthData.assets, monthData.month);
                    addDrillDownLinks(monthData.liabilities, monthData.month);
                    addDrillDownLinks(monthData.equity, monthData.month);
                });
            }
            
        } else if (asOf) {
            // Generate single-date balance sheet
            balanceSheetData = await FinancialReportingService.generateBalanceSheet(asOf, basis || 'cash');
            
            // Add drill-down URLs for single-date balance sheet
            const addDrillDownLinksToSection = (section, sectionName) => {
                if (section && typeof section === 'object') {
                    Object.keys(section).forEach(key => {
                        const item = section[key];
                        if (item && typeof item === 'object' && item.amount !== undefined) {
                            // Extract account code from the key or item
                            const accountCode = item.code || key.split(' - ')[0];
                            if (accountCode && item.amount !== 0) {
                                const asOfDate = new Date(asOf);
                                const monthName = asOfDate.toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
                                item.drillDownUrl = `/api/finance/balance-sheet/account-details?period=${asOfDate.getFullYear()}&month=${monthName}&accountCode=${accountCode}${residenceId ? `&residenceId=${residenceId}` : ''}`;
                            }
                        }
                    });
                }
            };
            
            if (balanceSheetData.assets) {
                addDrillDownLinksToSection(balanceSheetData.assets.current, 'current_assets');
                addDrillDownLinksToSection(balanceSheetData.assets.nonCurrent, 'non_current_assets');
            }
            if (balanceSheetData.liabilities) {
                addDrillDownLinksToSection(balanceSheetData.liabilities.current, 'current_liabilities');
                addDrillDownLinksToSection(balanceSheetData.liabilities.nonCurrent, 'non_current_liabilities');
            }
            if (balanceSheetData.equity) {
                addDrillDownLinksToSection(balanceSheetData.equity, 'equity');
            }
        } else {
            return res.status(400).json({
                success: false,
                message: 'Either period or asOf parameter is required'
            });
        }
        
        res.json({
            success: true,
            data: balanceSheetData
        });
        
    } catch (error) {
        console.error('Error getting balance sheet with drill-down:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating balance sheet',
            error: error.message
        });
    }
};

module.exports = exports; 