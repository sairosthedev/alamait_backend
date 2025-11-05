const mongoose = require('mongoose');
const BalanceSheet = require('../../models/finance/BalanceSheet');
const { validateMongoId } = require('../../utils/validators');
const { createAuditLog } = require('../../utils/auditLogger');
const Asset = require('../../models/finance/Asset');
const Liability = require('../../models/finance/Liability');
const Equity = require('../../models/finance/Equity');
const AuditLog = require('../../models/AuditLog');
const FinancialReportingService = require('../../services/financialReportingService');
const TransactionEntry = require('../../models/TransactionEntry');
const Vendor = require('../../models/Vendor');
const Expense = require('../../models/finance/Expense');
const Debtor = require('../../models/Debtor');
const Payment = require('../../models/Payment');
const User = require('../../models/User');

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
        // Regex should match: "1100" or "1100-anything" (student-specific AR accounts)
        if (useRegexForAR && accountCode === '1100') {
            query['entries.accountCode'] = { $regex: '^1100(-.*)?$' };
        } else {
            query['entries.accountCode'] = { $in: allAccountCodes };
        }
        
        if (residenceId) {
            // Include transactions tied to the residence either via top-level residence
            // or via metadata (some manual/adjustment entries may only record residence in metadata)
            // Ensure residenceId is converted to ObjectId for comparison
            const residenceObjectId = mongoose.Types.ObjectId.isValid(residenceId) 
                ? new mongoose.Types.ObjectId(residenceId) 
                : residenceId;
            
            query.$or = [
                { residence: residenceObjectId },
                { residence: residenceId }, // Also try as string in case it's stored as string
                { 'metadata.residenceId': residenceId },
                { 'metadata.residence': residenceId },
                { 'metadata.residence': residenceObjectId }
            ];
        }
        
        console.log(`📊 Balance Sheet Query:`, JSON.stringify(query, null, 2));
        
        // Use aggregation with $lookup to efficiently join related collections
        const transactions = await TransactionEntry.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'residences',
                    localField: 'residence',
                    foreignField: '_id',
                    as: 'residenceData'
                }
            },
            { $unwind: { path: '$residenceData', preserveNullAndEmptyArrays: true } },
            // Lookup sourceId based on sourceModel (refPath)
            {
                $lookup: {
                    from: 'vendors',
                    let: { sourceId: '$sourceId', sourceModel: '$sourceModel' },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ['$_id', '$$sourceId'] }, { $eq: ['$$sourceModel', 'Vendor'] }] } } },
                        { $project: { businessName: 1, name: 1, vendorName: 1 } }
                    ],
                    as: 'vendorSource'
                }
            },
            {
                $lookup: {
                    from: 'expenses',
                    let: { sourceId: '$sourceId', sourceModel: '$sourceModel' },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ['$_id', '$$sourceId'] }, { $eq: ['$$sourceModel', 'Expense'] }] } } },
                        { $project: { expenseName: 1, name: 1, description: 1, vendor: 1 } }
                    ],
                    as: 'expenseSource'
                }
            },
            {
                $lookup: {
                    from: 'debtors',
                    let: { sourceId: '$sourceId', sourceModel: '$sourceModel' },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ['$_id', '$$sourceId'] }, { $eq: ['$$sourceModel', 'Debtor'] }] } } },
                        { $project: { debtorCode: 1, name: 1, user: 1 } }
                    ],
                    as: 'debtorSource'
                }
            },
            {
                $lookup: {
                    from: 'payments',
                    let: { sourceId: '$sourceId', sourceModel: '$sourceModel' },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ['$_id', '$$sourceId'] }, { $eq: ['$$sourceModel', 'Payment'] }] } } },
                        { $project: { student: 1, user: 1, debtor: 1 } }
                    ],
                    as: 'paymentSource'
                }
            },
            {
                $lookup: {
                    from: 'advancepayments',
                    let: { sourceId: '$sourceId', sourceModel: '$sourceModel' },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ['$_id', '$$sourceId'] }, { $eq: ['$$sourceModel', 'AdvancePayment'] }] } } },
                        { $project: { studentId: 1, _id: 1 } }
                    ],
                    as: 'advancePaymentSource'
                }
            },
            // Lookup users for debtor.user, payment.student, payment.user, and advancePayment.userId
            {
                $lookup: {
                    from: 'users',
                    localField: 'debtorSource.user',
                    foreignField: '_id',
                    as: 'debtorUser'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'paymentSource.student',
                    foreignField: '_id',
                    as: 'paymentStudent'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'paymentSource.user',
                    foreignField: '_id',
                    as: 'paymentUser'
                }
            },
            // Lookup user from AdvancePayment.studentId (which is stored as String matching User._id)
            {
                $lookup: {
                    from: 'users',
                    let: { studentId: { $toString: { $arrayElemAt: ['$advancePaymentSource.studentId', 0] } } },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $or: [
                                        { $eq: [{ $toString: '$_id' }, '$$studentId'] },
                                        { $eq: [{ $toString: '$studentId' }, '$$studentId'] }
                                    ]
                                }
                            }
                        },
                        { $project: { firstName: 1, lastName: 1, email: 1 } }
                    ],
                    as: 'advancePaymentUser'
                }
            },
            // Also try direct lookup using studentId as ObjectId
            {
                $lookup: {
                    from: 'users',
                    let: { studentId: { $arrayElemAt: ['$advancePaymentSource.studentId', 0] } },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $or: [
                                        { $eq: ['$_id', { $toObjectId: '$$studentId' }] },
                                        { $eq: ['$_id', '$$studentId'] }
                                    ]
                                }
                            }
                        },
                        { $project: { firstName: 1, lastName: 1, email: 1 } }
                    ],
                    as: 'advancePaymentUserAlt'
                }
            },
            // Lookup debtor from payment.debtor (if exists)
            {
                $lookup: {
                    from: 'debtors',
                    let: { paymentDebtor: { $arrayElemAt: ['$paymentSource.debtor', 0] } },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$paymentDebtor'] } } },
                        { $project: { debtorCode: 1, user: 1 } }
                    ],
                    as: 'paymentDebtorSource'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'paymentDebtorSource.user',
                    foreignField: '_id',
                    as: 'paymentDebtorUser'
                }
            },
            // Also lookup debtor by payment.user (since payment.user might reference a debtor's user)
            {
                $lookup: {
                    from: 'debtors',
                    let: { paymentUserId: { $arrayElemAt: ['$paymentSource.user', 0] } },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$user', '$$paymentUserId'] } } },
                        { $project: { debtorCode: 1, user: 1 } }
                    ],
                    as: 'paymentUserDebtor'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'paymentUserDebtor.user',
                    foreignField: '_id',
                    as: 'paymentUserDebtorUser'
                }
            },
            // For manual transactions, lookup debtor/student from metadata
            {
                $lookup: {
                    from: 'debtors',
                    let: { debtorId: '$metadata.debtorId' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$debtorId'] } } },
                        { $project: { debtorCode: 1, user: 1 } }
                    ],
                    as: 'metadataDebtor'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'metadataDebtor.user',
                    foreignField: '_id',
                    as: 'metadataDebtorUser'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    let: { studentId: '$metadata.studentId' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$studentId'] } } },
                        { $project: { firstName: 1, lastName: 1, email: 1 } }
                    ],
                    as: 'metadataStudent'
                }
            },
            // Lookup vendor for expense.vendor
            {
                $lookup: {
                    from: 'vendors',
                    let: { expenseVendor: { $arrayElemAt: ['$expenseSource.vendor', 0] } },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$expenseVendor'] } } },
                        { $project: { businessName: 1, name: 1, vendorName: 1 } }
                    ],
                    as: 'expenseVendor'
                }
            },
            // For advance_payment transactions, lookup Payment by reference field (since sourceId is null)
            // Note: reference can be Payment._id (ObjectId) or paymentId (string), but can also be journal entry IDs
            // We match by paymentId first (string match), then by _id if reference is valid ObjectId format
            {
                $lookup: {
                    from: 'payments',
                    let: { 
                        reference: '$reference', 
                        source: '$source',
                        refStr: { $toString: '$reference' },
                        refLen: { $strLenCP: { $toString: '$reference' } }
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$$source', 'advance_payment'] },
                                        {
                                            $or: [
                                                // Match paymentId field (string match - safest)
                                                { $eq: ['$paymentId', '$$reference'] },
                                                // Match _id by string comparison (works for ObjectId string representations)
                                                { $eq: [{ $toString: '$_id' }, '$$refStr'] },
                                                // Match _id as ObjectId only if reference is exactly 24 characters (valid ObjectId length)
                                                {
                                                    $and: [
                                                        { $eq: ['$$refLen', 24] },
                                                        {
                                                            $regexMatch: {
                                                                input: '$$refStr',
                                                                regex: '^[0-9a-fA-F]{24}$'
                                                            }
                                                        },
                                                        { $eq: ['$_id', { $convert: { input: '$$reference', to: 'objectId', onError: null, onNull: null } }] }
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        { $project: { student: 1, user: 1, debtor: 1, paymentId: 1 } }
                    ],
                    as: 'referencePaymentSource'
                }
            },
            // Lookup users for referencePaymentSource.student and referencePaymentSource.user
            {
                $lookup: {
                    from: 'users',
                    localField: 'referencePaymentSource.student',
                    foreignField: '_id',
                    as: 'referencePaymentStudent'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'referencePaymentSource.user',
                    foreignField: '_id',
                    as: 'referencePaymentUser'
                }
            },
            // Lookup debtor from referencePaymentSource.debtor
            {
                $lookup: {
                    from: 'debtors',
                    let: { refPaymentDebtor: { $arrayElemAt: ['$referencePaymentSource.debtor', 0] } },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$refPaymentDebtor'] } } },
                        { $project: { debtorCode: 1, user: 1 } }
                    ],
                    as: 'referencePaymentDebtorSource'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'referencePaymentDebtorSource.user',
                    foreignField: '_id',
                    as: 'referencePaymentDebtorUser'
                }
            },
            // Lookup debtor by referencePaymentSource.user (payment.user → debtor.user)
            {
                $lookup: {
                    from: 'debtors',
                    let: { refPaymentUserId: { $arrayElemAt: ['$referencePaymentSource.user', 0] } },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$user', '$$refPaymentUserId'] } } },
                        { $project: { debtorCode: 1, user: 1 } }
                    ],
                    as: 'referencePaymentUserDebtor'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'referencePaymentUserDebtor.user',
                    foreignField: '_id',
                    as: 'referencePaymentUserDebtorUser'
                }
            },
            { $sort: { date: 1 } }
        ]);
        
        console.log(`📈 Found ${transactions.length} transactions for account ${accountCode} and ${childAccounts.length} child accounts`);
        
        // Extract account-specific transactions (including child accounts)
        const accountTransactions = [];
        let totalDebits = 0;
        let totalCredits = 0;
        const uniqueStudents = new Set();
        const accountBreakdown = {}; // Track transactions by account code
        
        // Process transactions with proper async handling
        for (const transaction of transactions) {
            // Convert aggregation result to Mongoose document-like structure for compatibility
            if (!transaction.entries || !Array.isArray(transaction.entries)) {
                continue;
            }
            
            // Filter entries for all relevant account codes (parent + children)
            const relevantEntries = transaction.entries.filter(entry => {
                if (useRegexForAR && accountCode === '1100') {
                    return typeof entry.accountCode === 'string' && entry.accountCode.startsWith('1100');
                }
                return allAccountCodes.includes(entry.accountCode);
            });
            
            for (const entry of relevantEntries) {
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
                
                // Get student/debtor/vendor/expense information from aggregated lookup results
                let studentName = 'N/A';
                let debtorName = 'N/A';
                let vendorName = 'N/A';
                let expenseName = 'N/A';
                
                // Debug: Log transaction details
                if (transaction.source === 'advance_payment' || transaction.source === 'payment' || transaction.sourceModel === 'Payment') {
                    console.log(`🔍 Transaction ${transaction.transactionId}:`, {
                        source: transaction.source,
                        sourceModel: transaction.sourceModel,
                        sourceId: transaction.sourceId,
                        hasMetadata: !!transaction.metadata,
                        metadataStudentId: transaction.metadata?.studentId,
                        metadataDebtorId: transaction.metadata?.debtorId,
                        hasPaymentSource: !!(transaction.paymentSource && transaction.paymentSource.length > 0),
                        hasAdvancePaymentSource: !!(transaction.advancePaymentSource && transaction.advancePaymentSource.length > 0),
                        hasMetadataStudent: !!(transaction.metadataStudent && transaction.metadataStudent.length > 0),
                        hasMetadataDebtor: !!(transaction.metadataDebtor && transaction.metadataDebtor.length > 0)
                    });
                }
                
                // Extract from aggregated lookup results
                // Vendor source
                if (transaction.vendorSource && transaction.vendorSource.length > 0) {
                    const vendor = transaction.vendorSource[0];
                    vendorName = vendor.businessName || vendor.name || vendor.vendorName || 'N/A';
                }
                
                // Expense source
                if (transaction.expenseSource && transaction.expenseSource.length > 0) {
                    const expense = transaction.expenseSource[0];
                    expenseName = expense.expenseName || expense.name || expense.description || 'N/A';
                    // Check for expense vendor
                    if (transaction.expenseVendor && transaction.expenseVendor.length > 0) {
                        const vendor = transaction.expenseVendor[0];
                        vendorName = vendor.businessName || vendor.name || vendor.vendorName || 'N/A';
                    }
                }
                
                // Debtor source
                if (transaction.debtorSource && transaction.debtorSource.length > 0) {
                    const debtor = transaction.debtorSource[0];
                    if (transaction.debtorUser && transaction.debtorUser.length > 0) {
                        const user = transaction.debtorUser[0];
                        debtorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || debtor.debtorCode || 'N/A';
                    } else {
                        debtorName = debtor.debtorCode || debtor.name || 'N/A';
                    }
                    if (debtorName !== 'N/A') {
                        uniqueStudents.add(debtorName);
                    }
                }
                
                // Reference Payment source (for advance_payment where sourceId is null but reference points to Payment)
                // This should be checked BEFORE paymentSource since it's more specific
                if ((studentName === 'N/A' && debtorName === 'N/A') && transaction.source === 'advance_payment' && transaction.reference && transaction.referencePaymentSource && transaction.referencePaymentSource.length > 0) {
                    const refPayment = transaction.referencePaymentSource[0];
                    console.log(`💳 Reference Payment source found for ${transaction.transactionId}:`, {
                        paymentId: refPayment._id,
                        hasStudent: !!refPayment.student,
                        hasUser: !!refPayment.user,
                        hasDebtor: !!refPayment.debtor,
                        student: refPayment.student,
                        user: refPayment.user,
                        hasReferencePaymentStudent: !!(transaction.referencePaymentStudent && transaction.referencePaymentStudent.length > 0),
                        hasReferencePaymentUser: !!(transaction.referencePaymentUser && transaction.referencePaymentUser.length > 0),
                        hasReferencePaymentDebtorSource: !!(transaction.referencePaymentDebtorSource && transaction.referencePaymentDebtorSource.length > 0)
                    });
                    
                    // Reference payment student
                    if (transaction.referencePaymentStudent && transaction.referencePaymentStudent.length > 0) {
                        const student = transaction.referencePaymentStudent[0];
                        studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email || 'N/A';
                        console.log(`   ✅ Found student from referencePayment.student: ${studentName}`);
                        if (studentName !== 'N/A') {
                            uniqueStudents.add(studentName);
                        }
                    }
                    
                    // Reference payment user (might be linked to debtor)
                    if (transaction.referencePaymentUser && transaction.referencePaymentUser.length > 0 && studentName === 'N/A') {
                        const user = transaction.referencePaymentUser[0];
                        const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'N/A';
                        console.log(`   ✅ Found user from referencePayment.user: ${userName}`);
                        
                        // Check if this user is linked to a debtor
                        if (transaction.referencePaymentUserDebtor && transaction.referencePaymentUserDebtor.length > 0) {
                            const debtor = transaction.referencePaymentUserDebtor[0];
                            if (transaction.referencePaymentUserDebtorUser && transaction.referencePaymentUserDebtorUser.length > 0) {
                                const debtorUser = transaction.referencePaymentUserDebtorUser[0];
                                debtorName = `${debtorUser.firstName || ''} ${debtorUser.lastName || ''}`.trim() || debtorUser.email || debtor.debtorCode || 'N/A';
                                console.log(`   ✅ Found debtor via referencePayment.user → debtor: ${debtorName}`);
                            } else {
                                debtorName = debtor.debtorCode || 'N/A';
                            }
                        } else {
                            // If no debtor found, use the referencePayment.user as student
                            studentName = userName;
                            console.log(`   ✅ Using referencePayment.user as student: ${studentName}`);
                        }
                        
                        if (debtorName !== 'N/A') {
                            uniqueStudents.add(debtorName);
                        } else if (studentName !== 'N/A') {
                            uniqueStudents.add(studentName);
                        }
                    }
                    
                    // Reference payment debtor (direct reference)
                    if (transaction.referencePaymentDebtorSource && transaction.referencePaymentDebtorSource.length > 0 && debtorName === 'N/A') {
                        const debtor = transaction.referencePaymentDebtorSource[0];
                        if (transaction.referencePaymentDebtorUser && transaction.referencePaymentDebtorUser.length > 0) {
                            const user = transaction.referencePaymentDebtorUser[0];
                            debtorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || debtor.debtorCode || 'N/A';
                            console.log(`   ✅ Found debtor from referencePayment.debtor: ${debtorName}`);
                        } else {
                            debtorName = debtor.debtorCode || 'N/A';
                        }
                        if (debtorName !== 'N/A') {
                            uniqueStudents.add(debtorName);
                        }
                    }
                    
                    // If aggregation didn't populate user/student fields, try direct lookup
                    if ((studentName === 'N/A' && debtorName === 'N/A') && (refPayment.student || refPayment.user)) {
                        try {
                            if (refPayment.student) {
                                const studentId = typeof refPayment.student === 'object' ? refPayment.student.toString() : refPayment.student;
                                const student = await User.findById(studentId).select('firstName lastName email').lean();
                                if (student) {
                                    studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email || 'N/A';
                                    console.log(`   ✅ Found student via direct lookup from payment.student: ${studentName}`);
                                    if (studentName !== 'N/A') {
                                        uniqueStudents.add(studentName);
                                    }
                                }
                            }
                            
                            if ((studentName === 'N/A' && debtorName === 'N/A') && refPayment.user) {
                                const userId = typeof refPayment.user === 'object' ? refPayment.user.toString() : refPayment.user;
                                // Try to find debtor by user first
                                const debtor = await Debtor.findOne({ user: userId }).populate('user', 'firstName lastName email').lean();
                                if (debtor && debtor.user) {
                                    const user = debtor.user;
                                    debtorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || debtor.debtorCode || 'N/A';
                                    console.log(`   ✅ Found debtor via direct lookup from payment.user: ${debtorName}`);
                                    if (debtorName !== 'N/A') {
                                        uniqueStudents.add(debtorName);
                                    }
                                } else {
                                    // If no debtor found, use payment.user as student
                                    const user = await User.findById(userId).select('firstName lastName email').lean();
                                    if (user) {
                                        studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'N/A';
                                        console.log(`   ✅ Found student via direct lookup from payment.user: ${studentName}`);
                                        if (studentName !== 'N/A') {
                                            uniqueStudents.add(studentName);
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            console.log(`   ⚠️ Error in direct lookup from referencePayment: ${err.message}`);
                        }
                    }
                }
                
                // Payment source
                if (transaction.paymentSource && transaction.paymentSource.length > 0) {
                    const payment = transaction.paymentSource[0];
                    console.log(`💳 Payment source found for ${transaction.transactionId}:`, {
                        paymentId: payment._id,
                        hasStudent: !!payment.student,
                        hasUser: !!payment.user,
                        hasDebtor: !!payment.debtor,
                        student: payment.student,
                        user: payment.user,
                        debtor: payment.debtor,
                        hasPaymentStudent: !!(transaction.paymentStudent && transaction.paymentStudent.length > 0),
                        hasPaymentUser: !!(transaction.paymentUser && transaction.paymentUser.length > 0),
                        hasPaymentDebtorSource: !!(transaction.paymentDebtorSource && transaction.paymentDebtorSource.length > 0),
                        hasPaymentDebtorUser: !!(transaction.paymentDebtorUser && transaction.paymentDebtorUser.length > 0),
                        hasPaymentUserDebtor: !!(transaction.paymentUserDebtor && transaction.paymentUserDebtor.length > 0),
                        hasPaymentUserDebtorUser: !!(transaction.paymentUserDebtorUser && transaction.paymentUserDebtorUser.length > 0)
                    });
                    
                    // Payment student
                    if (transaction.paymentStudent && transaction.paymentStudent.length > 0) {
                        const student = transaction.paymentStudent[0];
                        studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email || 'N/A';
                        console.log(`   ✅ Found student from payment.student: ${studentName}`);
                        if (studentName !== 'N/A') {
                            uniqueStudents.add(studentName);
                        }
                    }
                    
                    // Payment user (which might be a debtor's user)
                    if (transaction.paymentUser && transaction.paymentUser.length > 0) {
                        const user = transaction.paymentUser[0];
                        const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'N/A';
                        console.log(`   ✅ Found user from payment.user: ${userName}`);
                        
                        // Check if this user is linked to a debtor via paymentUserDebtor
                        if (transaction.paymentUserDebtor && transaction.paymentUserDebtor.length > 0) {
                            const debtor = transaction.paymentUserDebtor[0];
                            if (transaction.paymentUserDebtorUser && transaction.paymentUserDebtorUser.length > 0) {
                                const debtorUser = transaction.paymentUserDebtorUser[0];
                                debtorName = `${debtorUser.firstName || ''} ${debtorUser.lastName || ''}`.trim() || debtorUser.email || debtor.debtorCode || 'N/A';
                                console.log(`   ✅ Found debtor via payment.user → debtor: ${debtorName}`);
                            } else {
                                debtorName = debtor.debtorCode || 'N/A';
                            }
                        } else if (studentName === 'N/A') {
                            // If no student found yet and no debtor, use the payment.user as student
                            studentName = userName;
                            console.log(`   ✅ Using payment.user as student: ${studentName}`);
                        }
                        
                        if (debtorName !== 'N/A') {
                            uniqueStudents.add(debtorName);
                        } else if (studentName !== 'N/A') {
                            uniqueStudents.add(studentName);
                        }
                    }
                    
                    // Payment debtor (direct reference)
                    if (transaction.paymentDebtorSource && transaction.paymentDebtorSource.length > 0) {
                        const debtor = transaction.paymentDebtorSource[0];
                        if (transaction.paymentDebtorUser && transaction.paymentDebtorUser.length > 0) {
                            const user = transaction.paymentDebtorUser[0];
                            debtorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || debtor.debtorCode || 'N/A';
                            console.log(`   ✅ Found debtor from payment.debtor: ${debtorName}`);
                        } else {
                            debtorName = debtor.debtorCode || 'N/A';
                        }
                        if (debtorName !== 'N/A') {
                            uniqueStudents.add(debtorName);
                        }
                    }
                    
                    // Fallback: Direct lookups if aggregation didn't work
                    if (studentName === 'N/A' && debtorName === 'N/A') {
                        if (payment.student) {
                            try {
                                const studentId = typeof payment.student === 'object' ? payment.student.toString() : payment.student;
                                const student = await User.findById(studentId).select('firstName lastName email').lean();
                                if (student) {
                                    studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email || 'N/A';
                                    console.log(`   ✅ Found student via direct lookup: ${studentName}`);
                                    if (studentName !== 'N/A') {
                                        uniqueStudents.add(studentName);
                                    }
                                }
                            } catch (err) {
                                console.log(`   ⚠️ Could not lookup payment student: ${payment.student}`);
                            }
                        }
                        
                        if (payment.user && debtorName === 'N/A') {
                            try {
                                const userId = typeof payment.user === 'object' ? payment.user.toString() : payment.user;
                                // First try to find debtor by user
                                const debtor = await Debtor.findOne({ user: userId }).populate('user', 'firstName lastName email').lean();
                                if (debtor && debtor.user) {
                                    const user = debtor.user;
                                    debtorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || debtor.debtorCode || 'N/A';
                                    console.log(`   ✅ Found debtor via payment.user → debtor lookup: ${debtorName}`);
                                    if (debtorName !== 'N/A') {
                                        uniqueStudents.add(debtorName);
                                    }
                                } else if (studentName === 'N/A') {
                                    // If no debtor found, use payment.user as student
                                    const user = await User.findById(userId).select('firstName lastName email').lean();
                                    if (user) {
                                        studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'N/A';
                                        console.log(`   ✅ Found student via payment.user direct lookup: ${studentName}`);
                                        if (studentName !== 'N/A') {
                                            uniqueStudents.add(studentName);
                                        }
                                    }
                                }
                            } catch (err) {
                                console.log(`   ⚠️ Could not lookup payment user: ${payment.user}`);
                            }
                        }
                        
                        if (payment.debtor && debtorName === 'N/A') {
                            try {
                                const debtorId = typeof payment.debtor === 'object' ? payment.debtor.toString() : payment.debtor;
                                const debtor = await Debtor.findById(debtorId).populate('user', 'firstName lastName email').lean();
                                if (debtor) {
                                    if (debtor.user) {
                                        const user = debtor.user;
                                        debtorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || debtor.debtorCode || 'N/A';
                                        console.log(`   ✅ Found debtor via direct lookup: ${debtorName}`);
                                    } else {
                                        debtorName = debtor.debtorCode || 'N/A';
                                    }
                                    if (debtorName !== 'N/A') {
                                        uniqueStudents.add(debtorName);
                                    }
                                }
                            } catch (err) {
                                console.log(`   ⚠️ Could not lookup payment debtor: ${payment.debtor}`);
                            }
                        }
                    }
                }
                
                // AdvancePayment source
                if (transaction.advancePaymentSource && transaction.advancePaymentSource.length > 0) {
                    const advancePayment = transaction.advancePaymentSource[0];
                    // AdvancePayment user - try both lookup results
                    const advanceUser = (transaction.advancePaymentUser && transaction.advancePaymentUser.length > 0) 
                        ? transaction.advancePaymentUser[0] 
                        : (transaction.advancePaymentUserAlt && transaction.advancePaymentUserAlt.length > 0)
                            ? transaction.advancePaymentUserAlt[0]
                            : null;
                    
                    if (advanceUser) {
                        studentName = `${advanceUser.firstName || ''} ${advanceUser.lastName || ''}`.trim() || advanceUser.email || 'N/A';
                        if (studentName !== 'N/A') {
                            uniqueStudents.add(studentName);
                        }
                    }
                    
                    // If still N/A, try to lookup by studentId from metadata or directly
                    if (studentName === 'N/A' && advancePayment.studentId) {
                        try {
                            // Try to find user by converting studentId string to ObjectId
                            const userId = typeof advancePayment.studentId === 'string' 
                                ? advancePayment.studentId 
                                : advancePayment.studentId.toString();
                            const user = await User.findById(userId).select('firstName lastName email').lean();
                            if (user) {
                                studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'N/A';
                                if (studentName !== 'N/A') {
                                    uniqueStudents.add(studentName);
                                }
                            }
                        } catch (err) {
                            // If lookup fails, continue
                            console.log(`⚠️ Could not lookup user for AdvancePayment studentId: ${advancePayment.studentId}`);
                        }
                    }
                }
                
                // Reference Payment source (for advance_payment transactions where sourceId is null but reference points to Payment)
                if ((studentName === 'N/A' && debtorName === 'N/A') && transaction.source === 'advance_payment' && transaction.reference) {
                    // First try aggregation results
                    if (transaction.referencePaymentSource && transaction.referencePaymentSource.length > 0) {
                        const refPayment = transaction.referencePaymentSource[0];
                        console.log(`💳 Reference Payment source found for ${transaction.transactionId}:`, {
                            paymentId: refPayment._id,
                            hasStudent: !!refPayment.student,
                            hasUser: !!refPayment.user,
                            hasDebtor: !!refPayment.debtor,
                            hasReferencePaymentStudent: !!(transaction.referencePaymentStudent && transaction.referencePaymentStudent.length > 0),
                            hasReferencePaymentUser: !!(transaction.referencePaymentUser && transaction.referencePaymentUser.length > 0),
                            hasReferencePaymentDebtorSource: !!(transaction.referencePaymentDebtorSource && transaction.referencePaymentDebtorSource.length > 0)
                        });
                        
                        // Reference payment student
                        if (transaction.referencePaymentStudent && transaction.referencePaymentStudent.length > 0) {
                            const student = transaction.referencePaymentStudent[0];
                            studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email || 'N/A';
                            console.log(`   ✅ Found student from referencePayment.student: ${studentName}`);
                            if (studentName !== 'N/A') {
                                uniqueStudents.add(studentName);
                            }
                        }
                        
                        // Reference payment user (might be linked to debtor)
                        if (transaction.referencePaymentUser && transaction.referencePaymentUser.length > 0 && studentName === 'N/A') {
                            const user = transaction.referencePaymentUser[0];
                            const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'N/A';
                            console.log(`   ✅ Found user from referencePayment.user: ${userName}`);
                            
                            // Check if this user is linked to a debtor
                            if (transaction.referencePaymentUserDebtor && transaction.referencePaymentUserDebtor.length > 0) {
                                const debtor = transaction.referencePaymentUserDebtor[0];
                                if (transaction.referencePaymentUserDebtorUser && transaction.referencePaymentUserDebtorUser.length > 0) {
                                    const debtorUser = transaction.referencePaymentUserDebtorUser[0];
                                    debtorName = `${debtorUser.firstName || ''} ${debtorUser.lastName || ''}`.trim() || debtorUser.email || debtor.debtorCode || 'N/A';
                                    console.log(`   ✅ Found debtor via referencePayment.user → debtor: ${debtorName}`);
                                } else {
                                    debtorName = debtor.debtorCode || 'N/A';
                                }
                            } else {
                                // If no debtor found, use the referencePayment.user as student
                                studentName = userName;
                                console.log(`   ✅ Using referencePayment.user as student: ${studentName}`);
                            }
                            
                            if (debtorName !== 'N/A') {
                                uniqueStudents.add(debtorName);
                            } else if (studentName !== 'N/A') {
                                uniqueStudents.add(studentName);
                            }
                        }
                        
                        // Reference payment debtor (direct reference)
                        if (transaction.referencePaymentDebtorSource && transaction.referencePaymentDebtorSource.length > 0 && debtorName === 'N/A') {
                            const debtor = transaction.referencePaymentDebtorSource[0];
                            if (transaction.referencePaymentDebtorUser && transaction.referencePaymentDebtorUser.length > 0) {
                                const user = transaction.referencePaymentDebtorUser[0];
                                debtorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || debtor.debtorCode || 'N/A';
                                console.log(`   ✅ Found debtor from referencePayment.debtor: ${debtorName}`);
                            } else {
                                debtorName = debtor.debtorCode || 'N/A';
                            }
                            if (debtorName !== 'N/A') {
                                uniqueStudents.add(debtorName);
                            }
                        }
                        
                        // If aggregation didn't populate user/student, try direct lookup from payment record
                        if ((studentName === 'N/A' && debtorName === 'N/A') && refPayment.student) {
                            try {
                                const studentId = typeof refPayment.student === 'object' ? refPayment.student.toString() : refPayment.student;
                                const student = await User.findById(studentId).select('firstName lastName email').lean();
                                if (student) {
                                    studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email || 'N/A';
                                    console.log(`   ✅ Found student via direct lookup from payment.student: ${studentName}`);
                                    if (studentName !== 'N/A') {
                                        uniqueStudents.add(studentName);
                                    }
                                }
                            } catch (err) {
                                console.log(`   ⚠️ Could not lookup payment.student: ${refPayment.student}`);
                            }
                        }
                        
                        if ((studentName === 'N/A' && debtorName === 'N/A') && refPayment.user) {
                            try {
                                const userId = typeof refPayment.user === 'object' ? refPayment.user.toString() : refPayment.user;
                                // Try to find debtor by user first
                                const debtor = await Debtor.findOne({ user: userId }).populate('user', 'firstName lastName email').lean();
                                if (debtor && debtor.user) {
                                    const user = debtor.user;
                                    debtorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || debtor.debtorCode || 'N/A';
                                    console.log(`   ✅ Found debtor via direct lookup from payment.user: ${debtorName}`);
                                    if (debtorName !== 'N/A') {
                                        uniqueStudents.add(debtorName);
                                    }
                                } else {
                                    // If no debtor found, use payment.user as student
                                    const user = await User.findById(userId).select('firstName lastName email').lean();
                                    if (user) {
                                        studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'N/A';
                                        console.log(`   ✅ Found student via direct lookup from payment.user: ${studentName}`);
                                        if (studentName !== 'N/A') {
                                            uniqueStudents.add(studentName);
                                        }
                                    }
                                }
                            } catch (err) {
                                console.log(`   ⚠️ Could not lookup payment.user: ${refPayment.user}`);
                            }
                        }
                    } else {
                        // Aggregation didn't find it, try direct lookup
                        try {
                            console.log(`🔍 Direct lookup payment by reference for advance_payment: ${transaction.reference}`);
                            let payment = null;
                            try {
                                // Try to find payment by _id (if reference is ObjectId)
                                payment = await Payment.findById(transaction.reference).populate('student', 'firstName lastName email').populate('user', 'firstName lastName email').populate('debtor').lean();
                            } catch (e) {
                                // If reference is not a valid ObjectId, try paymentId field
                                payment = await Payment.findOne({ paymentId: transaction.reference }).populate('student', 'firstName lastName email').populate('user', 'firstName lastName email').populate('debtor').lean();
                            }
                            
                            if (payment) {
                                console.log(`   ✅ Found payment record via direct lookup:`, {
                                    paymentId: payment._id,
                                    hasStudent: !!payment.student,
                                    hasUser: !!payment.user,
                                    hasDebtor: !!payment.debtor
                                });
                                
                                // Check payment.student
                                if (payment.student && typeof payment.student === 'object' && payment.student.firstName) {
                                    const student = payment.student;
                                    studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email || 'N/A';
                                    console.log(`   ✅ Found student from payment.student: ${studentName}`);
                                    if (studentName !== 'N/A') {
                                        uniqueStudents.add(studentName);
                                    }
                                }
                                
                                // Check payment.user (might be linked to debtor)
                                if (payment.user && debtorName === 'N/A') {
                                    const user = payment.user;
                                    if (typeof user === 'object' && user.firstName) {
                                        // Try to find debtor by user
                                        const debtor = await Debtor.findOne({ user: user._id || user }).populate('user', 'firstName lastName email').lean();
                                        if (debtor && debtor.user) {
                                            const debtorUser = debtor.user;
                                            debtorName = `${debtorUser.firstName || ''} ${debtorUser.lastName || ''}`.trim() || debtorUser.email || debtor.debtorCode || 'N/A';
                                            console.log(`   ✅ Found debtor via payment.user → debtor: ${debtorName}`);
                                            if (debtorName !== 'N/A') {
                                                uniqueStudents.add(debtorName);
                                            }
                                        } else if (studentName === 'N/A') {
                                            // If no debtor found, use payment.user as student
                                            studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'N/A';
                                            console.log(`   ✅ Using payment.user as student: ${studentName}`);
                                            if (studentName !== 'N/A') {
                                                uniqueStudents.add(studentName);
                                            }
                                        }
                                    }
                                }
                                
                                // Check payment.debtor
                                if (payment.debtor && debtorName === 'N/A') {
                                    const debtor = payment.debtor;
                                    if (typeof debtor === 'object') {
                                        if (debtor.user && typeof debtor.user === 'object' && debtor.user.firstName) {
                                            const debtorUser = debtor.user;
                                            debtorName = `${debtorUser.firstName || ''} ${debtorUser.lastName || ''}`.trim() || debtorUser.email || debtor.debtorCode || 'N/A';
                                            console.log(`   ✅ Found debtor from payment.debtor: ${debtorName}`);
                                        } else {
                                            debtorName = debtor.debtorCode || 'N/A';
                                        }
                                        if (debtorName !== 'N/A') {
                                            uniqueStudents.add(debtorName);
                                        }
                                    } else if (typeof debtor === 'object' && debtor.toString) {
                                        // If debtor is just an ObjectId, look it up
                                        const debtorDoc = await Debtor.findById(debtor).populate('user', 'firstName lastName email').lean();
                                        if (debtorDoc) {
                                            if (debtorDoc.user) {
                                                const user = debtorDoc.user;
                                                debtorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || debtorDoc.debtorCode || 'N/A';
                                                console.log(`   ✅ Found debtor from payment.debtor lookup: ${debtorName}`);
                                            } else {
                                                debtorName = debtorDoc.debtorCode || 'N/A';
                                            }
                                            if (debtorName !== 'N/A') {
                                                uniqueStudents.add(debtorName);
                                            }
                                        }
                                    }
                                }
                            } else {
                                console.log(`   ⚠️ No payment found with reference: ${transaction.reference}`);
                            }
                        } catch (err) {
                            console.log(`⚠️ Error looking up payment by reference for advance_payment: ${err.message}`);
                        }
                    }
                }
                
                // Metadata debtor/student (for manual transactions and advance payments)
                if ((debtorName === 'N/A' && studentName === 'N/A')) {
                    // Check metadataDebtor (already looked up from metadata.debtorId)
                    if (transaction.metadataDebtor && transaction.metadataDebtor.length > 0) {
                        const debtor = transaction.metadataDebtor[0];
                        if (transaction.metadataDebtorUser && transaction.metadataDebtorUser.length > 0) {
                            const user = transaction.metadataDebtorUser[0];
                            debtorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || debtor.debtorCode || 'N/A';
                        } else {
                            debtorName = debtor.debtorCode || 'N/A';
                        }
                        if (debtorName !== 'N/A') {
                            uniqueStudents.add(debtorName);
                        }
                    }
                    
                    // Check metadataStudent (already looked up from metadata.studentId)
                    if (transaction.metadataStudent && transaction.metadataStudent.length > 0) {
                        const student = transaction.metadataStudent[0];
                        studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email || 'N/A';
                        if (studentName !== 'N/A') {
                            uniqueStudents.add(studentName);
                        }
                    }
                    
                    // For advance_payment transactions, map to payment record via reference field (fallback)
                    if ((studentName === 'N/A' && debtorName === 'N/A') && transaction.source === 'advance_payment' && transaction.reference) {
                        try {
                            console.log(`🔍 Looking up payment by reference for advance_payment: ${transaction.reference}`);
                            // Try to find payment by _id (if reference is ObjectId)
                            let payment = null;
                            try {
                                payment = await Payment.findById(transaction.reference).populate('student', 'firstName lastName email').populate('user', 'firstName lastName email').populate('debtor').lean();
                            } catch (e) {
                                // If reference is not a valid ObjectId, try paymentId field
                                payment = await Payment.findOne({ paymentId: transaction.reference }).populate('student', 'firstName lastName email').populate('user', 'firstName lastName email').populate('debtor').lean();
                            }
                            
                            if (payment) {
                                console.log(`   ✅ Found payment record:`, {
                                    paymentId: payment._id,
                                    hasStudent: !!payment.student,
                                    hasUser: !!payment.user,
                                    hasDebtor: !!payment.debtor
                                });
                                
                                // Check payment.student
                                if (payment.student) {
                                    const student = payment.student;
                                    if (typeof student === 'object' && student.firstName) {
                                        studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email || 'N/A';
                                        console.log(`   ✅ Found student from payment.student: ${studentName}`);
                                        if (studentName !== 'N/A') {
                                            uniqueStudents.add(studentName);
                                        }
                                    }
                                }
                                
                                // Check payment.user (might be linked to debtor)
                                if (payment.user && debtorName === 'N/A') {
                                    const user = payment.user;
                                    if (typeof user === 'object' && user.firstName) {
                                        // Try to find debtor by user
                                        const debtor = await Debtor.findOne({ user: user._id || user }).populate('user', 'firstName lastName email').lean();
                                        if (debtor && debtor.user) {
                                            const debtorUser = debtor.user;
                                            debtorName = `${debtorUser.firstName || ''} ${debtorUser.lastName || ''}`.trim() || debtorUser.email || debtor.debtorCode || 'N/A';
                                            console.log(`   ✅ Found debtor via payment.user → debtor: ${debtorName}`);
                                            if (debtorName !== 'N/A') {
                                                uniqueStudents.add(debtorName);
                                            }
                                        } else if (studentName === 'N/A') {
                                            // If no debtor found, use payment.user as student
                                            studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'N/A';
                                            console.log(`   ✅ Using payment.user as student: ${studentName}`);
                                            if (studentName !== 'N/A') {
                                                uniqueStudents.add(studentName);
                                            }
                                        }
                                    }
                                }
                                
                                // Check payment.debtor
                                if (payment.debtor && debtorName === 'N/A') {
                                    const debtor = payment.debtor;
                                    if (typeof debtor === 'object') {
                                        if (debtor.user) {
                                            const debtorUser = typeof debtor.user === 'object' ? debtor.user : await User.findById(debtor.user).select('firstName lastName email').lean();
                                            if (debtorUser) {
                                                debtorName = `${debtorUser.firstName || ''} ${debtorUser.lastName || ''}`.trim() || debtorUser.email || debtor.debtorCode || 'N/A';
                                                console.log(`   ✅ Found debtor from payment.debtor: ${debtorName}`);
                                            }
                                        } else {
                                            debtorName = debtor.debtorCode || 'N/A';
                                        }
                                        if (debtorName !== 'N/A') {
                                            uniqueStudents.add(debtorName);
                                        }
                                    } else {
                                        // If debtor is just an ObjectId, look it up
                                        const debtor = await Debtor.findById(debtor).populate('user', 'firstName lastName email').lean();
                                        if (debtor) {
                                            if (debtor.user) {
                                                const user = debtor.user;
                                                debtorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || debtor.debtorCode || 'N/A';
                                                console.log(`   ✅ Found debtor from payment.debtor lookup: ${debtorName}`);
                                            } else {
                                                debtorName = debtor.debtorCode || 'N/A';
                                            }
                                            if (debtorName !== 'N/A') {
                                                uniqueStudents.add(debtorName);
                                            }
                                        }
                                    }
                                }
                            } else {
                                console.log(`   ⚠️ No payment found with reference: ${transaction.reference}`);
                            }
                        } catch (err) {
                            console.log(`⚠️ Error looking up payment by reference for advance_payment: ${err.message}`);
                        }
                    }
                    
                    // For advance_payment transactions, also check metadata.studentId directly if lookup didn't work
                    if ((studentName === 'N/A' && debtorName === 'N/A') && transaction.source === 'advance_payment' && transaction.metadata?.studentId) {
                        try {
                            const userId = transaction.metadata.studentId;
                            const user = await User.findById(userId).select('firstName lastName email').lean();
                            if (user) {
                                studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'N/A';
                                if (studentName !== 'N/A') {
                                    uniqueStudents.add(studentName);
                                }
                            }
                        } catch (err) {
                            console.log(`⚠️ Could not lookup user for advance_payment metadata.studentId: ${transaction.metadata.studentId}`);
                        }
                    }
                }
                
                // Fallback to metadata strings if lookup didn't provide names
                if (studentName === 'N/A' && transaction.metadata?.studentName) {
                    studentName = transaction.metadata.studentName;
                    uniqueStudents.add(studentName);
                }
                if (debtorName === 'N/A' && transaction.metadata?.debtorName) {
                    debtorName = transaction.metadata.debtorName;
                    uniqueStudents.add(debtorName);
                }
                if (vendorName === 'N/A' && transaction.metadata?.vendorName) {
                    vendorName = transaction.metadata.vendorName;
                }
                if (expenseName === 'N/A' && transaction.metadata?.expenseName) {
                    expenseName = transaction.metadata.expenseName;
                }
                
                // For manual transactions, try to extract name from description if still N/A
                if ((debtorName === 'N/A' && studentName === 'N/A') && transaction.source === 'manual' && transaction.description) {
                    const desc = transaction.description;
                    // Patterns like "Security deposit [Name]" or "deposit [Name]"
                    const depositMatch = desc.match(/deposit\s+(.+?)(?:\s|$|,)/i);
                    if (depositMatch && depositMatch[1]) {
                        const extractedName = depositMatch[1].trim();
                        // Try to find a debtor with matching name or code using aggregation
                        const matchingDebtor = await Debtor.aggregate([
                            {
                                $match: {
                                    $or: [
                                        { debtorCode: { $regex: extractedName, $options: 'i' } }
                                    ]
                                }
                            },
                            {
                                $lookup: {
                                    from: 'users',
                                    localField: 'user',
                                    foreignField: '_id',
                                    as: 'userData'
                                }
                            },
                            {
                                $match: {
                                    $or: [
                                        { 'userData.firstName': { $regex: extractedName, $options: 'i' } },
                                        { 'userData.lastName': { $regex: extractedName, $options: 'i' } }
                                    ]
                                }
                            },
                            { $limit: 1 }
                        ]);
                        
                        if (matchingDebtor && matchingDebtor.length > 0) {
                            const debtor = matchingDebtor[0];
                            if (debtor.userData && debtor.userData.length > 0) {
                                const user = debtor.userData[0];
                                debtorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || debtor.debtorCode || 'N/A';
                            } else {
                                debtorName = debtor.debtorCode || 'N/A';
                            }
                            if (debtorName !== 'N/A') {
                                uniqueStudents.add(debtorName);
                            }
                        } else {
                            // If no debtor found, use the extracted name as-is
                            debtorName = extractedName;
                            uniqueStudents.add(debtorName);
                        }
                    }
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
                    vendorName,
                    expenseName,
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
            }
        }
        
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
            if (residenceId) {
                // Use residence-filtered method when residence is specified
                balanceSheetData = await FinancialReportingService.generateResidenceFilteredMonthlyBalanceSheet(
                    period || new Date().getFullYear().toString(),
                    residenceId,
                    basis || 'cash'
                );
            } else {
                // Use general method when no residence filter
                balanceSheetData = await FinancialReportingService.generateComprehensiveMonthlyBalanceSheet(
                    period || new Date().getFullYear().toString(),
                    basis || 'cash',
                    residenceId
                );
            }
            
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