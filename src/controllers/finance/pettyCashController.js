const { validationResult } = require('express-validator');
const PettyCash = require('../../models/PettyCash');
const PettyCashUsage = require('../../models/PettyCashUsage');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const Transaction = require('../../models/Transaction');
const TransactionEntry = require('../../models/TransactionEntry');
const Account = require('../../models/Account');
const mongoose = require('mongoose');

// Get all petty cash allocations
const getAllPettyCash = async (req, res) => {
    try {
        const { status, user } = req.query;
        
        const query = {};
        if (status) query.status = status;
        if (user) query.user = user;

        const pettyCashList = await PettyCash.find(query)
            .populate('user', 'firstName lastName email role')
            .populate('allocatedBy', 'firstName lastName')
            .sort({ createdAt: -1 });

        res.status(200).json(pettyCashList);
    } catch (error) {
        console.error('Error fetching petty cash:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get petty cash by ID
const getPettyCashById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid petty cash ID format' });
        }

        const pettyCash = await PettyCash.findById(id)
            .populate('user', 'firstName lastName email role')
            .populate('allocatedBy', 'firstName lastName');

        if (!pettyCash) {
            return res.status(404).json({ message: 'Petty cash allocation not found' });
        }

        res.status(200).json(pettyCash);
    } catch (error) {
        console.error('Error fetching petty cash:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get users eligible for petty cash (non-student, non-tenant)
const getEligibleUsers = async (req, res) => {
    try {
        const eligibleUsers = await User.find({
            role: { $nin: ['student', 'tenant'] }
        }).select('firstName lastName email role');

        res.status(200).json(eligibleUsers);
    } catch (error) {
        console.error('Error fetching eligible users:', error);
        res.status(500).json({ message: error.message });
    }
};

// Allocate petty cash to a user
const allocatePettyCash = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { userId, amount, notes } = req.body;

        if (!userId || !amount) {
            return res.status(400).json({
                message: 'User ID and amount are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        // Check if user exists and is eligible
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (['student', 'tenant'].includes(user.role)) {
            return res.status(400).json({ 
                message: 'Students and tenants are not eligible for petty cash' 
            });
        }

        // Check if user already has active petty cash
        const existingPettyCash = await PettyCash.findOne({
            user: userId,
            status: 'active'
        });

        if (existingPettyCash) {
            return res.status(400).json({ 
                message: 'User already has an active petty cash allocation' 
            });
        }

        // Create petty cash allocation
        const pettyCash = new PettyCash({
            user: userId,
            userName: `${user.firstName} ${user.lastName}`,
            allocatedAmount: amount,
            allocatedBy: req.user._id,
            notes
        });

        await pettyCash.save();

        // Create transaction entry for petty cash allocation
        const pettyCashAccount = await Account.findOne({ code: '1010' }); // Petty Cash account
        const bankAccount = await Account.findOne({ code: '1000' }); // Bank account

        if (pettyCashAccount && bankAccount) {
            const txn = await Transaction.create({
                date: new Date(),
                description: `Petty Cash Allocation: ${user.firstName} ${user.lastName}`,
                reference: `PC-${pettyCash._id}`,
                residence: null
            });

            const entries = [
                {
                    transaction: txn._id,
                    account: pettyCashAccount._id,
                    debit: amount,
                    credit: 0,
                    type: pettyCashAccount.type || 'asset',
                    description: `Petty cash allocated to ${user.firstName} ${user.lastName}`
                },
                {
                    transaction: txn._id,
                    account: bankAccount._id,
                    debit: 0,
                    credit: amount,
                    type: bankAccount.type || 'asset',
                    description: `Bank transfer for petty cash to ${user.firstName} ${user.lastName}`
                }
            ];

            const createdEntries = await TransactionEntry.insertMany(entries);
            
            await Transaction.findByIdAndUpdate(
                txn._id,
                { $push: { entries: { $each: createdEntries.map(e => e._id) } } }
            );

            // Audit log
            await AuditLog.create({
                user: req.user._id,
                action: 'allocate_petty_cash',
                collection: 'PettyCash',
                recordId: pettyCash._id,
                before: null,
                after: pettyCash.toObject(),
                details: {
                    amount,
                    userName: `${user.firstName} ${user.lastName}`,
                    transactionId: txn._id
                }
            });
        }

        const populatedPettyCash = await PettyCash.findById(pettyCash._id)
            .populate('user', 'firstName lastName email role')
            .populate('allocatedBy', 'firstName lastName');

        res.status(201).json(populatedPettyCash);
    } catch (error) {
        console.error('Error allocating petty cash:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update petty cash allocation
const updatePettyCash = async (req, res) => {
    try {
        const { id } = req.params;
        const { allocatedAmount, status, notes } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid petty cash ID format' });
        }

        const pettyCash = await PettyCash.findById(id);
        if (!pettyCash) {
            return res.status(404).json({ message: 'Petty cash allocation not found' });
        }

        const before = pettyCash.toObject();
        
        if (allocatedAmount !== undefined) pettyCash.allocatedAmount = allocatedAmount;
        if (status) pettyCash.status = status;
        if (notes !== undefined) pettyCash.notes = notes;

        await pettyCash.save();

        const updatedPettyCash = await PettyCash.findById(id)
            .populate('user', 'firstName lastName email role')
            .populate('allocatedBy', 'firstName lastName');

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'update_petty_cash',
            collection: 'PettyCash',
            recordId: pettyCash._id,
            before,
            after: updatedPettyCash.toObject()
        });

        res.status(200).json(updatedPettyCash);
    } catch (error) {
        console.error('Error updating petty cash:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get petty cash usage for a specific allocation
const getPettyCashUsage = async (req, res) => {
    try {
        const { pettyCashId } = req.params;
        const { status } = req.query;

        if (!mongoose.Types.ObjectId.isValid(pettyCashId)) {
            return res.status(400).json({ message: 'Invalid petty cash ID format' });
        }

        const query = { pettyCash: pettyCashId };
        if (status) query.status = status;

        const usage = await PettyCashUsage.find(query)
            .populate('user', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName')
            .sort({ date: -1 });

        res.status(200).json(usage);
    } catch (error) {
        console.error('Error fetching petty cash usage:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create petty cash usage entry
const createPettyCashUsage = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { pettyCashId, amount, description, category, date, notes } = req.body;

        if (!pettyCashId || !amount || !description || !category) {
            return res.status(400).json({
                message: 'Petty cash ID, amount, description, and category are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(pettyCashId)) {
            return res.status(400).json({ message: 'Invalid petty cash ID format' });
        }

        // Check if petty cash allocation exists and is active
        const pettyCash = await PettyCash.findById(pettyCashId);
        if (!pettyCash) {
            return res.status(404).json({ message: 'Petty cash allocation not found' });
        }

        if (pettyCash.status !== 'active') {
            return res.status(400).json({ message: 'Petty cash allocation is not active' });
        }

        // Check if there's enough remaining amount
        if (pettyCash.remainingAmount < amount) {
            return res.status(400).json({ 
                message: `Insufficient petty cash. Available: ${pettyCash.remainingAmount}` 
            });
        }

        // Create usage entry
        const usage = new PettyCashUsage({
            pettyCash: pettyCashId,
            user: pettyCash.user,
            userName: pettyCash.userName,
            amount,
            description,
            category,
            date: date || new Date(),
            notes
        });

        await usage.save();

        // Update petty cash used amount
        pettyCash.usedAmount += amount;
        await pettyCash.save();

        const populatedUsage = await PettyCashUsage.findById(usage._id)
            .populate('user', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName');

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'create_petty_cash_usage',
            collection: 'PettyCashUsage',
            recordId: usage._id,
            before: null,
            after: populatedUsage.toObject(),
            details: {
                pettyCashId,
                amount,
                category,
                remainingAmount: pettyCash.remainingAmount
            }
        });

        res.status(201).json(populatedUsage);
    } catch (error) {
        console.error('Error creating petty cash usage:', error);
        res.status(500).json({ message: error.message });
    }
};

// Approve/reject petty cash usage
const updatePettyCashUsageStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid usage ID format' });
        }

        const usage = await PettyCashUsage.findById(id);
        if (!usage) {
            return res.status(404).json({ message: 'Petty cash usage not found' });
        }

        const before = usage.toObject();
        
        usage.status = status;
        if (status === 'approved') {
            usage.approvedBy = req.user._id;
            usage.approvedDate = new Date();
        }
        if (notes) usage.notes = notes;

        await usage.save();

        const updatedUsage = await PettyCashUsage.findById(id)
            .populate('user', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName');

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: `update_petty_cash_usage_${status}`,
            collection: 'PettyCashUsage',
            recordId: usage._id,
            before,
            after: updatedUsage.toObject()
        });

        res.status(200).json(updatedUsage);
    } catch (error) {
        console.error('Error updating petty cash usage status:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllPettyCash,
    getPettyCashById,
    getEligibleUsers,
    allocatePettyCash,
    updatePettyCash,
    getPettyCashUsage,
    createPettyCashUsage,
    updatePettyCashUsageStatus
}; 