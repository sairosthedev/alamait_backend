const Maintenance = require('../../models/Maintenance');
const { validationResult } = require('express-validator');
const AuditLog = require('../../models/AuditLog');
const Transaction = require('../../models/Transaction');
const TransactionEntry = require('../../models/TransactionEntry');
const Account = require('../../models/Account');
const { validateMongoId } = require('../../utils/validators');
const { generateUniqueId } = require('../../utils/idGenerator');

// Get all maintenance requests with financial details
exports.getAllMaintenanceRequests = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, financeStatus } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (status) query.status = status;
        if (financeStatus) query.financeStatus = { $regex: new RegExp(`^${financeStatus}$`, 'i') };

        // Get total count for pagination
        const total = await Maintenance.countDocuments(query);

        // Fetch requests with pagination
        const requests = await Maintenance.find(query)
            .sort({ requestDate: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('student', 'firstName lastName')
            .populate('assignedTo', 'firstName lastName')
            .populate('residence', 'name')
            .lean();

        // Format requests to include financial details
        const formattedRequests = requests.map(request => ({
            id: request._id,
            issue: request.issue,
            description: request.description,
            room: request.room,
            category: request.category,
            priority: request.priority,
            status: request.status,
            student: request.student,
            assignedTo: request.assignedTo,
            residence: request.residence ? request.residence.name : 'Unknown',
            requestDate: request.requestDate,
            scheduledDate: request.scheduledDate,
            estimatedCompletion: request.estimatedCompletion,
            completedDate: request.completedDate,
            amount: request.amount,
            financeStatus: request.financeStatus,
            financeNotes: request.financeNotes,
            updates: request.updates
        }));

        res.json({
            requests: formattedRequests,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error in getAllMaintenanceRequests:', error);
        res.status(500).json({ error: 'Error retrieving maintenance requests' });
    }
};

// Get maintenance request by ID
exports.getMaintenanceRequestById = async (req, res) => {
    try {
        const request = await Maintenance.findById(req.params.id)
            .populate('student', 'firstName lastName')
            .populate('assignedTo', 'firstName lastName')
            .populate('residence', 'name')
            .lean();

        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Add residence name to the response
        const response = {
            ...request,
            residenceName: request.residence ? request.residence.name : 'Unknown'
        };

        res.json(response);
    } catch (error) {
        console.error('Error in getMaintenanceRequestById:', error);
        res.status(500).json({ error: 'Error retrieving maintenance request' });
    }
};

// Update maintenance request financial details
exports.updateMaintenanceRequestFinance = async (req, res) => {
    try {
        const { amount, financeStatus, financeNotes } = req.body;

        const request = await Maintenance.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Update financial details
        if (amount !== undefined) request.amount = parseFloat(amount) || 0;
        if (financeStatus) request.financeStatus = financeStatus.toLowerCase();
        if (financeNotes) request.financeNotes = financeNotes;

        // Add update to history
        request.updates.push({
            date: new Date(),
            message: 'Financial details updated',
            author: req.user._id
        });

        await request.save();

        res.json({
            success: true,
            message: 'Maintenance request financial details updated successfully',
            request: {
                ...request.toObject(),
                amount: request.amount !== null && request.amount !== undefined ? request.amount : 0,
            }
        });
    } catch (error) {
        console.error('Error in updateMaintenanceRequestFinance:', error);
        res.status(500).json({ error: 'Error updating maintenance request financial details' });
    }
};

// Get maintenance requests by finance status
exports.getMaintenanceRequestsByFinanceStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const query = { financeStatus: { $regex: new RegExp(`^${status}$`, 'i') } };
        const total = await Maintenance.countDocuments(query);

        const requests = await Maintenance.find(query)
            .sort({ requestDate: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('student', 'firstName lastName')
            .populate('assignedTo', 'firstName lastName')
            .populate('residence', 'name')
            .lean();

        // Add residence name to each request
        const formattedRequests = requests.map(request => ({
            ...request,
            residence: request.residence ? request.residence.name : 'Unknown'
        }));

        res.json({
            requests: formattedRequests,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error in getMaintenanceRequestsByFinanceStatus:', error);
        res.status(500).json({ error: 'Error retrieving maintenance requests' });
    }
};

// Get maintenance financial statistics
exports.getMaintenanceFinancialStats = async (req, res) => {
    try {
        const stats = await Maintenance.aggregate([
            {
                $group: {
                    _id: '$financeStatus',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        const totalStats = {
            totalRequests: await Maintenance.countDocuments(),
            pendingRequests: await Maintenance.countDocuments({ financeStatus: { $regex: /^pending$/i } }),
            approvedRequests: await Maintenance.countDocuments({ financeStatus: { $regex: /^approved$/i } }),
            rejectedRequests: await Maintenance.countDocuments({ financeStatus: { $regex: /^rejected$/i } }),
            totalAmount: stats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0)
        };

        res.json(totalStats);
    } catch (error) {
        console.error('Error in getMaintenanceFinancialStats:', error);
        res.status(500).json({ error: 'Error retrieving maintenance financial statistics' });
    }
};

// Approve maintenance request
exports.approveMaintenance = async (req, res) => {
    try {
        console.log('[MAINTENANCE] Approve maintenance request called with:', {
            id: req.params.id,
            body: req.body,
            user: req.user?._id || 'No user'
        });
        
        const { id } = req.params;
        const { notes, amount, maintenanceAccount, apAccount } = req.body;

        if (!validateMongoId(id)) {
            return res.status(400).json({ error: 'Invalid maintenance request ID format' });
        }

        // Find maintenance request
        const maintenance = await Maintenance.findById(id);
        if (!maintenance) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        if (maintenance.financeStatus === 'approved') {
            return res.status(400).json({ error: 'Maintenance request is already approved' });
        }

        // Use provided amount or fall back to maintenance request amount
        const approvalAmount = amount || maintenance.amount;
        if (!approvalAmount || approvalAmount <= 0) {
            return res.status(400).json({ error: 'Maintenance request must have a valid amount to approve' });
        }

        const before = maintenance.toObject();

        // Update maintenance status to approved
        const updatedMaintenance = await Maintenance.findByIdAndUpdate(
            id,
            {
                $set: {
                    financeStatus: 'approved',
                    financeNotes: notes || maintenance.financeNotes,
                    amount: approvalAmount, // Update amount if provided
                    updatedBy: req.user?._id || null
                }
            },
            { new: true, runValidators: true }
        ).populate('residence', 'name')
         .populate('requestedBy', 'firstName lastName email')
         .populate('updatedBy', 'firstName lastName email');

        // --- Create Accounts Payable Entry for Approved Maintenance ---
        try {
            console.log('[AP] Creating accounts payable entry for approved maintenance:', updatedMaintenance._id);
            console.log('[AP] Using accounts - maintenanceAccount:', maintenanceAccount, 'apAccount:', apAccount);

                        // Get maintenance expense account (use provided account or default to 5099)
            let expenseAccount;
            if (maintenanceAccount) {
                expenseAccount = await Account.findById(maintenanceAccount);
            } else {
                expenseAccount = await Account.findOne({ code: '5099', type: 'Expense' });
            }
            
            if (!expenseAccount) {
                console.error('[AP] Maintenance expense account not found');
                throw new Error('Maintenance expense account not found');
            }
            
            // Get or create general Accounts Payable account (use provided account or default to 2000)
            let payableAccount;
            if (apAccount) {
                payableAccount = await Account.findById(apAccount);
            } else {
                payableAccount = await Account.findOne({ code: '2000', type: 'Liability' });
            }
            
            if (!payableAccount) {
                console.error('[AP] General Accounts Payable account not found');
                throw new Error('General Accounts Payable account not found');
            }

            // Generate unique transaction ID
            const transactionId = await generateUniqueId('TXN');

            // Create transaction for approval (creates AP liability)
            const txn = await Transaction.create({
                transactionId: transactionId,
                date: new Date(),
                description: `Maintenance Approval: ${updatedMaintenance.issue} - ${updatedMaintenance.description}`,
                reference: `MAINT-${updatedMaintenance._id}`,
                residence: updatedMaintenance.residence?._id || updatedMaintenance.residence,
                residenceName: updatedMaintenance.residence?.name || undefined,
                type: 'approval',
                createdBy: req.user?._id || null
            });

            // Create double-entry transaction entry with nested entries
            const transactionEntry = await TransactionEntry.create({
                transactionId: transactionId,
                date: new Date(),
                description: `Maintenance Approval: ${updatedMaintenance.issue}`,
                reference: `MAINT-${updatedMaintenance._id}`,
                entries: [
                    {
                        accountCode: expenseAccount.code,
                        accountName: expenseAccount.name,
                        accountType: expenseAccount.type,
                        debit: approvalAmount,
                        credit: 0,
                        description: `Maintenance expense: ${updatedMaintenance.issue}`
                    },
                    {
                        accountCode: payableAccount.code,
                        accountName: payableAccount.name,
                        accountType: payableAccount.type,
                        debit: 0,
                        credit: approvalAmount,
                        description: `Accounts payable for maintenance: ${updatedMaintenance.issue}`
                    }
                ],
                totalDebit: approvalAmount,
                totalCredit: approvalAmount,
                source: 'manual',
                sourceId: updatedMaintenance._id,
                sourceModel: 'Expense',
                createdBy: req.user?.email || req.user?.firstName + ' ' + req.user?.lastName || 'Finance User',
                status: 'posted'
            });

            // Link transaction entry to transaction
            await Transaction.findByIdAndUpdate(txn._id, {
                $push: { entries: transactionEntry._id }
            });

            // Create audit log for the AP creation
            await AuditLog.create({
                user: req.user?._id || null,
                action: 'maintenance_approved_ap_created',
                collection: 'Transaction',
                recordId: txn._id,
                before: null,
                after: txn.toObject(),
                timestamp: new Date(),
                details: {
                    source: 'Expense',
                    sourceId: updatedMaintenance._id,
                    maintenanceIssue: updatedMaintenance.issue,
                    maintenanceAmount: approvalAmount,
                    apAccount: payableAccount.code,
                    maintenanceAccount: expenseAccount.code,
                    description: `Maintenance approved - AP liability created for ${updatedMaintenance.issue}`
                }
            });

            console.log('[AP] Accounts payable entry created for maintenance:', updatedMaintenance._id, 'txn:', txn._id, 'entry:', transactionEntry._id);

        } catch (apError) {
            console.error('[AP] Failed to create accounts payable entry for maintenance:', updatedMaintenance._id, apError);
            return res.status(500).json({
                error: 'Failed to create accounts payable entry for approved maintenance',
                details: apError.message
            });
        }
        // --- End AP Creation ---

        // Audit log for maintenance approval
        await AuditLog.create({
            user: req.user?._id || null,
            action: 'approve',
            collection: 'Maintenance',
            recordId: updatedMaintenance._id,
            before,
            after: updatedMaintenance.toObject(),
            timestamp: new Date(),
            details: {
                description: `Maintenance approved - ${updatedMaintenance.issue}`,
                amount: updatedMaintenance.amount
            }
        });

        // Add update to maintenance history
        updatedMaintenance.updates.push({
            date: new Date(),
            message: `Maintenance request approved by finance - Amount: $${updatedMaintenance.amount}`,
            author: req.user?._id || null
        });
        await updatedMaintenance.save();

        res.status(200).json({
            message: 'Maintenance request approved successfully',
            maintenance: updatedMaintenance
        });
    } catch (error) {
        console.error('Error approving maintenance request:', error);
        res.status(500).json({ error: 'Failed to approve maintenance request' });
    }
}; 