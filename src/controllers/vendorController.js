const Vendor = require('../models/Vendor');
const Account = require('../models/Account');
const TransactionEntry = require('../models/TransactionEntry');
const mongoose = require('mongoose');
const { logVendorOperation, logAccountOperation } = require('../utils/auditLogger');

// Helper function to calculate vendor totals from transactions
async function calculateVendorTotals(vendorId, chartOfAccountsCode) {
    try {
        const transactions = await TransactionEntry.find({
            'entries.accountCode': chartOfAccountsCode
        }).sort({ date: 1 });

        let totalSpent = 0;
        let totalPaid = 0;

        transactions.forEach(transaction => {
            const vendorEntry = transaction.entries.find(entry => 
                entry.accountCode === chartOfAccountsCode
            );

            if (vendorEntry) {
                const amount = vendorEntry.debit || vendorEntry.credit || 0;
                const isDebit = vendorEntry.debit > 0;
                
                if (isDebit) {
                    // Debit to vendor account = payment made to vendor (reducing payable)
                    totalPaid += amount;
                } else {
                    // Credit to vendor account = expense/purchase from vendor (increasing payable)
                    totalSpent += amount;
                }
            }
        });

        const outstandingAmount = totalSpent - totalPaid;

        return {
            totalSpent,
            totalPaid,
            outstandingAmount,
            currentBalance: outstandingAmount
        };
    } catch (error) {
        console.error('Error calculating vendor totals:', error);
        return {
            totalSpent: 0,
            totalPaid: 0,
            outstandingAmount: 0,
            currentBalance: 0
        };
    }
}

// Create new vendor
exports.createVendor = async (req, res) => {
    try {
        const user = req.user;
        
        // Validate required fields
        const requiredFields = [
            'businessName', 
            'contactPerson.firstName', 
            'contactPerson.lastName', 
            'contactPerson.email', 
            'contactPerson.phone',
            'businessAddress.street',
            'businessAddress.city',
            'category'
        ];
        
        const missingFields = requiredFields.filter(field => {
            const value = field.split('.').reduce((obj, key) => obj && obj[key], req.body);
            return !value;
        });
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                message: 'Missing required fields',
                fields: missingFields
            });
        }

        // Check if email already exists
        const existingVendor = await Vendor.findOne({ 
            'contactPerson.email': req.body.contactPerson.email.toLowerCase() 
        });
        
        if (existingVendor) {
            return res.status(400).json({
                message: 'Vendor with this email already exists',
                field: 'contactPerson.email'
            });
        }

        // Auto-generate chart of accounts codes if not provided
        let chartOfAccountsCode = req.body.chartOfAccountsCode;
        let expenseAccountCode = req.body.expenseAccountCode;
        
        if (!chartOfAccountsCode) {
            // Generate vendor account code (2000 series for accounts payable)
            const vendorCount = await Vendor.countDocuments();
            chartOfAccountsCode = `200${(vendorCount + 1).toString().padStart(3, '0')}`;
        }
        
        if (!expenseAccountCode) {
            // Map category to expense account
            const categoryExpenseMap = {
                'maintenance': '5000',
                'utilities': '5001',
                'supplies': '5000',
                'equipment': '5000',
                'services': '5000',
                'cleaning': '5010',
                'security': '5011',
                'landscaping': '5000',
                'electrical': '5000',
                'plumbing': '5000',
                'carpentry': '5000',
                'painting': '5000',
                'other': '5013'
            };
            expenseAccountCode = categoryExpenseMap[req.body.category] || '5013';
        }

        // Generate vendor code manually to ensure it's created
        let vendorCode = req.body.vendorCode;
        if (!vendorCode) {
            // Use timestamp + random to ensure uniqueness
            const timestamp = Date.now().toString().substr(-8);
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            const year = new Date().getFullYear().toString().substr(-2);
            vendorCode = `V${year}${timestamp}${random}`;
        }

        // Create new vendor
        const vendor = new Vendor({
            ...req.body,
            vendorCode,
            chartOfAccountsCode,
            expenseAccountCode,
            createdBy: user._id,
            history: [{
                action: 'Vendor created',
                description: 'New vendor account created',
                user: user._id,
                changes: []
            }]
        });

        const savedVendor = await vendor.save();

        // Create chart of accounts entries if they don't exist
        await ensureChartOfAccountsEntries(chartOfAccountsCode, expenseAccountCode, savedVendor);

        // Log vendor creation
        await logVendorOperation('create', savedVendor, user._id, {
            source: 'Manual Creation',
            businessName: savedVendor.businessName,
            chartOfAccountsCode: savedVendor.chartOfAccountsCode,
            category: savedVendor.category,
            vendorType: savedVendor.vendorType
        });

        res.status(201).json({
            message: 'Vendor created successfully',
            vendor: savedVendor
        });

    } catch (error) {
        console.error('Error creating vendor:', error);
        res.status(500).json({ 
            message: 'Error creating vendor',
            error: error.message 
        });
    }
};

// Get all vendors
exports.getAllVendors = async (req, res) => {
    try {
        const { 
            category, 
            status, 
            search, 
            page = 1, 
            limit = 10,
            sortBy = 'businessName',
            sortOrder = 'asc'
        } = req.query;

        // Build query
        const query = {};
        
        if (category) query.category = category;
        if (status) query.status = status;
        
        if (search) {
            query.$or = [
                { businessName: { $regex: search, $options: 'i' } },
                { tradingName: { $regex: search, $options: 'i' } },
                { 'contactPerson.firstName': { $regex: search, $options: 'i' } },
                { 'contactPerson.lastName': { $regex: search, $options: 'i' } },
                { 'contactPerson.email': { $regex: search, $options: 'i' } },
                { vendorCode: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute query with pagination
        const vendors = await Vendor.find(query)
            .populate('createdBy', 'firstName lastName email')
            .populate('updatedBy', 'firstName lastName email')
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        // Calculate totals for each vendor
        const vendorsWithTotals = await Promise.all(
            vendors.map(async (vendor) => {
                const totals = await calculateVendorTotals(vendor._id, vendor.chartOfAccountsCode);
                return {
                    ...vendor.toObject(),
                    totalSpent: totals.totalSpent,
                    outstandingAmount: totals.outstandingAmount,
                    currentBalance: totals.currentBalance
                };
            })
        );

        // Get total count
        const total = await Vendor.countDocuments(query);

        res.status(200).json({
            vendors: vendorsWithTotals,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            totalVendors: total
        });

    } catch (error) {
        console.error('Error getting vendors:', error);
        res.status(500).json({ 
            message: 'Error retrieving vendors',
            error: error.message 
        });
    }
};

// Get vendor by ID
exports.getVendorById = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id)
            .populate('createdBy', 'firstName lastName email')
            .populate('updatedBy', 'firstName lastName email')
            .populate('history.user', 'firstName lastName email');

        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        // Calculate totals for this vendor
        const totals = await calculateVendorTotals(vendor._id, vendor.chartOfAccountsCode);
        
        const vendorWithTotals = {
            ...vendor.toObject(),
            totalSpent: totals.totalSpent,
            outstandingAmount: totals.outstandingAmount,
            currentBalance: totals.currentBalance
        };

        res.status(200).json(vendorWithTotals);

    } catch (error) {
        console.error('Error getting vendor:', error);
        res.status(500).json({ 
            message: 'Error retrieving vendor',
            error: error.message 
        });
    }
};

// Update vendor
exports.updateVendor = async (req, res) => {
    try {
        const user = req.user;
        const vendor = await Vendor.findById(req.params.id);

        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        // Track changes
        const changes = [];
        const oldValues = vendor.toObject();

        // Update fields
        Object.keys(req.body).forEach(key => {
            if (req.body[key] !== undefined && req.body[key] !== oldValues[key]) {
                changes.push({
                    field: key,
                    oldValue: oldValues[key],
                    newValue: req.body[key]
                });
            }
        });

        // Update vendor
        Object.assign(vendor, req.body);
        vendor.updatedBy = user._id;

        // Add to history if there are changes
        if (changes.length > 0) {
            vendor.history.push({
                action: 'Vendor updated',
                description: 'Vendor information modified',
                user: user._id,
                changes
            });
        }

        await vendor.save();

        res.status(200).json({
            message: 'Vendor updated successfully',
            vendor
        });

    } catch (error) {
        console.error('Error updating vendor:', error);
        res.status(500).json({ 
            message: 'Error updating vendor',
            error: error.message 
        });
    }
};

// Delete vendor
exports.deleteVendor = async (req, res) => {
    try {
        const user = req.user;
        const vendor = await Vendor.findById(req.params.id);

        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        // Check if vendor has any active relationships
        // TODO: Add checks for active quotations, payments, etc.

        // Soft delete - change status to inactive
        vendor.status = 'inactive';
        vendor.updatedBy = user._id;
        vendor.history.push({
            action: 'Vendor deactivated',
            description: 'Vendor account deactivated',
            user: user._id,
            changes: []
        });

        await vendor.save();

        res.status(200).json({
            message: 'Vendor deactivated successfully'
        });

    } catch (error) {
        console.error('Error deleting vendor:', error);
        res.status(500).json({ 
            message: 'Error deleting vendor',
            error: error.message 
        });
    }
};

// Get vendors for quotation system (simplified list)
exports.getVendorsForQuotations = async (req, res) => {
    try {
        const { category, search } = req.query;

        const query = { status: 'active' };
        
        if (category) {
            query.category = category;
        }
        
        if (search) {
            query.$or = [
                { businessName: { $regex: search, $options: 'i' } },
                { tradingName: { $regex: search, $options: 'i' } },
                { 'contactPerson.firstName': { $regex: search, $options: 'i' } },
                { 'contactPerson.lastName': { $regex: search, $options: 'i' } },
                { vendorCode: { $regex: search, $options: 'i' } }
            ];
        }

        const vendors = await Vendor.find(query)
            .select('vendorCode businessName tradingName contactPerson category vendorType expenseCategory defaultPaymentMethod hasBankDetails')
            .sort({ businessName: 1 })
            .limit(50);

        res.status(200).json({
            vendors,
            total: vendors.length
        });

    } catch (error) {
        console.error('Error getting vendors for quotations:', error);
        res.status(500).json({ 
            message: 'Error retrieving vendors for quotations',
            error: error.message 
        });
    }
};

// Search vendors by name or email (for quotation system)
exports.searchVendors = async (req, res) => {
    try {
        const { query, category, limit = 10 } = req.query;

        if (!query) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        const searchQuery = {
            status: 'active',
            $or: [
                { businessName: { $regex: query, $options: 'i' } },
                { tradingName: { $regex: query, $options: 'i' } },
                { 'contactPerson.firstName': { $regex: query, $options: 'i' } },
                { 'contactPerson.lastName': { $regex: query, $options: 'i' } },
                { 'contactPerson.email': { $regex: query, $options: 'i' } },
                { vendorCode: { $regex: query, $options: 'i' } }
            ]
        };

        if (category) {
            searchQuery.category = category;
        }

        const vendors = await Vendor.find(searchQuery)
            .select('vendorCode businessName tradingName contactPerson category chartOfAccountsCode expenseAccountCode')
            .limit(parseInt(limit))
            .sort({ businessName: 1 });

        res.status(200).json({
            vendors,
            total: vendors.length
        });

    } catch (error) {
        console.error('Error searching vendors:', error);
        res.status(500).json({ 
            message: 'Error searching vendors',
            error: error.message 
        });
    }
};

// Get vendors by category
exports.getVendorsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const { status = 'active' } = req.query;

        const query = { category, status };
        
        const vendors = await Vendor.find(query)
            .select('vendorCode businessName tradingName contactPerson category specializations serviceAreas')
            .sort({ businessName: 1 });

        res.status(200).json({
            category,
            vendors,
            total: vendors.length
        });

    } catch (error) {
        console.error('Error getting vendors by category:', error);
        res.status(500).json({ 
            message: 'Error retrieving vendors by category',
            error: error.message 
        });
    }
};

// Update vendor performance
exports.updateVendorPerformance = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { responseTime, onTime, qualityRating, completed } = req.body;

        const vendor = await Vendor.findById(id);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        // Update performance metrics
        vendor.updatePerformance({
            responseTime,
            onTime,
            qualityRating,
            completed
        });

        vendor.history.push({
            action: 'Performance updated',
            description: 'Vendor performance metrics updated',
            user: user._id,
            changes: []
        });

        await vendor.save();

        res.status(200).json({
            message: 'Vendor performance updated successfully',
            vendor
        });

    } catch (error) {
        console.error('Error updating vendor performance:', error);
        res.status(500).json({ 
            message: 'Error updating vendor performance',
            error: error.message 
        });
    }
};

// Get all creditors (vendors)
exports.getCreditors = async (req, res) => {
    try {
        const { 
            status = 'active', 
            search, 
            page = 1, 
            limit = 10,
            sortBy = 'businessName',
            sortOrder = 'asc'
        } = req.query;

        // Build query for creditors (vendors)
        const query = { status };
        
        if (search) {
            query.$or = [
                { businessName: { $regex: search, $options: 'i' } },
                { tradingName: { $regex: search, $options: 'i' } },
                { 'contactPerson.firstName': { $regex: search, $options: 'i' } },
                { 'contactPerson.lastName': { $regex: search, $options: 'i' } },
                { vendorCode: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute query with pagination
        const creditors = await Vendor.find(query)
            .select('vendorCode businessName tradingName contactPerson category chartOfAccountsCode currentBalance paymentTerms')
            .populate('createdBy', 'firstName lastName email')
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        // Get total count
        const total = await Vendor.countDocuments(query);

        // Calculate total outstanding balance
        const totalOutstanding = await Vendor.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$currentBalance' } } }
        ]);

        res.status(200).json({
            creditors,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            totalCreditors: total,
            totalOutstanding: totalOutstanding[0]?.total || 0
        });

    } catch (error) {
        console.error('Error getting creditors:', error);
        res.status(500).json({ 
            message: 'Error retrieving creditors',
            error: error.message 
        });
    }
};

// Get all debtors (students/tenants)
exports.getDebtors = async (req, res) => {
    try {
        const User = require('../models/User');
        const { 
            search, 
            page = 1, 
            limit = 10,
            sortBy = 'firstName',
            sortOrder = 'asc'
        } = req.query;

        // Build query for debtors (students/tenants)
        const query = { 
            role: { $in: ['student', 'tenant'] },
            isVerified: true
        };
        
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute query with pagination
        const debtors = await User.find(query)
            .select('firstName lastName email phone role residence currentRoom lastPayment')
            .populate('residence', 'name')
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        // Get total count
        const total = await User.countDocuments(query);

        // Calculate total outstanding balance (you may need to adjust this based on your payment system)
        const totalOutstanding = await User.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$lastPayment.amount', 0] } } } }
        ]);

        res.status(200).json({
            debtors,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            totalDebtors: total,
            totalOutstanding: totalOutstanding[0]?.total || 0
        });

    } catch (error) {
        console.error('Error getting debtors:', error);
        res.status(500).json({ 
            message: 'Error retrieving debtors',
            error: error.message 
        });
    }
};

// Get creditor summary (vendor financial summary)
exports.getCreditorSummary = async (req, res) => {
    try {
        const { vendorId } = req.params;

        const vendor = await Vendor.findById(vendorId)
            .select('vendorCode businessName tradingName contactPerson category chartOfAccountsCode currentBalance paymentTerms creditLimit performance');

        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        // Get recent transactions for this vendor
        const recentTransactions = await TransactionEntry.find({ 
            'entries.accountCode': vendor.chartOfAccountsCode 
        }).sort({ date: -1 }).limit(10);

        res.status(200).json({
            vendor,
            recentTransactions,
            summary: {
                currentBalance: vendor.currentBalance,
                creditLimit: vendor.creditLimit,
                availableCredit: vendor.creditLimit - vendor.currentBalance,
                paymentTerms: vendor.paymentTerms,
                performance: vendor.performance
            }
        });

    } catch (error) {
        console.error('Error getting creditor summary:', error);
        res.status(500).json({ 
            message: 'Error retrieving creditor summary',
            error: error.message 
        });
    }
};

// Get vendor transactions (ledger)
exports.getVendorTransactions = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20, startDate, endDate } = req.query;

        const vendor = await Vendor.findById(id)
            .select('vendorCode businessName tradingName chartOfAccountsCode');

        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        // Build query for transactions involving this vendor
        const query = {
            'entries.accountCode': vendor.chartOfAccountsCode
        };

        // Add date range filter if provided
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        // Get transactions with pagination
        const transactions = await TransactionEntry.find(query)
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        // Get total count for pagination
        const total = await TransactionEntry.countDocuments(query);

        // Transform transactions for frontend
        const transformedTransactions = transactions.map(transaction => {
            // Find the vendor-specific entry
            const vendorEntry = transaction.entries.find(entry => 
                entry.accountCode === vendor.chartOfAccountsCode
            );

            return {
                _id: transaction._id,
                date: transaction.date,
                description: transaction.description,
                reference: transaction.reference,
                amount: vendorEntry ? (vendorEntry.debit || vendorEntry.credit) : 0,
                type: vendorEntry ? (vendorEntry.debit > 0 ? 'debit' : 'credit') : 'unknown',
                accountCode: vendorEntry ? vendorEntry.accountCode : '',
                accountName: vendorEntry ? vendorEntry.accountName : '',
                source: transaction.source,
                sourceId: transaction.sourceId,
                status: transaction.status,
                createdBy: transaction.createdBy,
                createdAt: transaction.createdAt
            };
        });

        res.status(200).json({
            success: true,
            vendor: {
                _id: vendor._id,
                vendorCode: vendor.vendorCode,
                businessName: vendor.businessName,
                tradingName: vendor.tradingName
            },
            transactions: transformedTransactions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalTransactions: total,
                hasNextPage: parseInt(page) < Math.ceil(total / limit),
                hasPrevPage: parseInt(page) > 1
            }
        });

    } catch (error) {
        console.error('Error getting vendor transactions:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error retrieving vendor transactions',
            error: error.message 
        });
    }
};

// Helper function to ensure chart of accounts entries exist
async function ensureChartOfAccountsEntries(vendorCode, expenseCode, vendor) {
    try {
        // Get the main Accounts Payable account (2000) to link vendor accounts
        const mainAPAccount = await Account.findOne({ code: '2000', type: 'Liability' });
        
        // Check if vendor account exists
        let vendorAccount = await Account.findOne({ code: vendorCode });
        if (!vendorAccount) {
            vendorAccount = new Account({
                code: vendorCode,
                name: `Accounts Payable - ${vendor.businessName}`,
                type: 'Liability',
                category: 'Current Liabilities',
                subcategory: 'Accounts Payable',
                description: `Payable account for ${vendor.businessName}`,
                isActive: true,
                level: 2, // Set as level 2 (child of main AP account)
                parentAccount: mainAPAccount ? mainAPAccount._id : null, // Link to main AP account
                metadata: {
                    vendorId: vendor._id,
                    vendorCode: vendor.vendorCode,
                    vendorType: vendor.category,
                    linkedToMainAP: true,
                    linkedDate: new Date(),
                    mainAPAccountCode: '2000'
                }
            });
            await vendorAccount.save();
            
            // Update main AP account metadata if it exists
            if (mainAPAccount) {
                await Account.findByIdAndUpdate(mainAPAccount._id, {
                    $set: {
                        'metadata.hasChildren': true,
                        'metadata.lastUpdated': new Date()
                    },
                    $inc: { 'metadata.childrenCount': 1 }
                });
            }
            
            console.log(`✅ Created vendor payable account: ${vendorCode} - ${vendor.businessName} (linked to 2000)`);
        } else {
            // If account exists but isn't linked, link it now
            if (!vendorAccount.parentAccount && mainAPAccount) {
                vendorAccount.parentAccount = mainAPAccount._id;
                vendorAccount.level = 2;
                vendorAccount.metadata = {
                    ...vendorAccount.metadata,
                    linkedToMainAP: true,
                    linkedDate: new Date(),
                    mainAPAccountCode: '2000'
                };
                await vendorAccount.save();
                
                // Update main AP account metadata
                await Account.findByIdAndUpdate(mainAPAccount._id, {
                    $set: {
                        'metadata.hasChildren': true,
                        'metadata.lastUpdated': new Date()
                    },
                    $inc: { 'metadata.childrenCount': 1 }
                });
                
                console.log(`✅ Linked existing vendor account: ${vendorCode} - ${vendor.businessName} to 2000`);
            }
        }

        // Check if expense account exists
        let expenseAccount = await Account.findOne({ code: expenseCode });
        if (!expenseAccount) {
            expenseAccount = new Account({
                code: expenseCode,
                name: `${vendor.category.charAt(0).toUpperCase() + vendor.category.slice(1)} Expenses`,
                type: 'Expense',
                category: 'Operating Expenses',
                subcategory: 'Vendor Expenses',
                description: `Expense account for ${vendor.businessName} ${vendor.category} services`,
                isActive: true,
                level: 1
            });
            await expenseAccount.save();
            console.log(`✅ Created vendor expense account: ${expenseCode} - ${expenseAccount.name}`);
        }

    } catch (error) {
        console.error('Error ensuring chart of accounts entries:', error);
        // Don't throw error as this is not critical for vendor creation
    }
}

/**
 * 🆕 NEW: Get vendors collection report with AP data linkage
 * Provides paginated vendor reports with AP transaction data
 */
exports.getVendorsCollectionReport = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, category, search } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (status) query.status = status;
        if (category) query.category = category;
        if (search) {
            query.$or = [
                { businessName: { $regex: search, $options: 'i' } },
                { vendorCode: { $regex: search, $options: 'i' } },
                { 'contactPerson.email': { $regex: search, $options: 'i' } }
            ];
        }

        // Get vendors with pagination
        const vendors = await Vendor.find(query)
            .sort({ businessName: 1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Get total count
        const totalVendors = await Vendor.countDocuments(query);

        // Get AP data for each vendor
        const vendorService = require('../services/vendorService');
        const vendorsWithAPData = [];

        for (const vendor of vendors) {
            if (vendor.chartOfAccountsCode) {
                // Get AP transactions for this vendor
                const apTransactions = await TransactionEntry.find({
                    'entries.accountCode': vendor.chartOfAccountsCode
                }).sort({ date: 1 }).lean();

                let totalOwed = 0;
                let totalPaid = 0;

                apTransactions.forEach(transaction => {
                    transaction.entries.forEach(entry => {
                        if (entry.accountCode === vendor.chartOfAccountsCode) {
                            if (transaction.source === 'expense_payment' || transaction.source === 'vendor_payment' || transaction.source === 'maintenance_expense') {
                                totalOwed += entry.credit || 0;
                            } else if (transaction.source === 'payment' || transaction.source === 'vendor_payment_settlement') {
                                totalPaid += entry.debit || 0;
                            }
                        }
                    });
                });

                const currentBalance = totalOwed - totalPaid;

                vendorsWithAPData.push({
                    ...vendor,
                    totalOwed,
                    totalPaid,
                    currentBalance,
                    paymentRate: totalOwed > 0 ? (totalPaid / totalOwed) * 100 : 0,
                    apTransactionCount: apTransactions.length
                });
            } else {
                vendorsWithAPData.push({
                    ...vendor,
                    totalOwed: 0,
                    totalPaid: 0,
                    currentBalance: 0,
                    paymentRate: 0,
                    apTransactionCount: 0
                });
            }
        }

        res.status(200).json({
            success: true,
            data: {
                vendors: vendorsWithAPData,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalVendors / limit),
                    totalVendors,
                    hasNextPage: page * limit < totalVendors,
                    hasPrevPage: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Error getting vendors collection report:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving vendors collection report',
            error: error.message
        });
    }
};

/**
 * 🆕 NEW: Sync vendor with AP data
 * Manually trigger synchronization of vendor totals with AP transaction data
 */
exports.syncVendorWithAP = async (req, res) => {
    try {
        const { id } = req.params;
        const { syncAll } = req.query;

        const vendorService = require('../services/vendorService');

        if (syncAll === 'true') {
            // Sync all vendors
            const result = await vendorService.syncVendorTotalsWithAP();
            res.status(200).json({
                success: true,
                message: 'All vendors synced with AP data',
                data: result
            });
        } else {
            // Sync specific vendor
            const result = await vendorService.syncVendorTotalsWithAP(id);
            res.status(200).json({
                success: true,
                message: 'Vendor synced with AP data',
                data: result
            });
        }

    } catch (error) {
        console.error('Error syncing vendor with AP:', error);
        res.status(500).json({
            success: false,
            message: 'Error syncing vendor with AP data',
            error: error.message
        });
    }
};

/**
 * 🆕 NEW: Get vendor collection summary
 * Provides overall vendor collection statistics
 */
exports.getVendorCollectionSummary = async (req, res) => {
    try {
        const vendorService = require('../services/vendorService');
        const summary = await vendorService.getVendorCollectionSummary();

        res.status(200).json({
            success: true,
            data: summary
        });

    } catch (error) {
        console.error('Error getting vendor collection summary:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving vendor collection summary',
            error: error.message
        });
    }
};

module.exports = exports; 