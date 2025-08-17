const { validationResult } = require('express-validator');
const Maintenance = require('../../models/Maintenance');
const Transaction = require('../../models/Transaction');
const TransactionEntry = require('../../models/TransactionEntry');
const Account = require('../../models/Account');
const AuditLog = require('../../models/AuditLog');
const Residence = require('../../models/Residence');
const EmailNotificationService = require('../../services/emailNotificationService');

// Helper function to generate unique transaction ID
const generateUniqueId = async (prefix) => {
    const count = await Transaction.countDocuments();
    return `${prefix}${String(count + 1).padStart(6, '0')}`;
};

// Get maintenance requests for managed residences
exports.getMaintenanceRequests = async (req, res) => {
    try {
        // Get all residences managed by the property manager
        const managedResidences = await Residence.find({ manager: req.user._id });
        const residenceIds = managedResidences.map(residence => residence._id);

        const { status, priority, category } = req.query;
        let query = { residence: { $in: residenceIds } };

        if (status) query.status = status;
        if (priority) query.priority = priority;
        if (category) query.category = category;

        const maintenanceRequests = await Maintenance.find(query)
            .populate('residence', 'name address')
            .populate('student', 'firstName lastName email phone')
            .populate('assignedTo', 'firstName lastName')
            .sort('-createdAt');

        res.json(maintenanceRequests);
    } catch (error) {
        console.error('Get maintenance requests error:', error);
        res.status(500).json({ error: 'Error fetching maintenance requests' });
    }
};

// Get single maintenance request
exports.getMaintenanceRequest = async (req, res) => {
    try {
        const maintenance = await Maintenance.findById(req.params.id)
            .populate('residence', 'name address manager')
            .populate('student', 'firstName lastName email phone')
            .populate('assignedTo', 'firstName lastName')
            .populate('comments.user', 'firstName lastName role');

        if (!maintenance) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Check if user manages this residence
        if (maintenance.residence.manager.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.json(maintenance);
    } catch (error) {
        console.error('Get maintenance request error:', error);
        res.status(500).json({ error: 'Error fetching maintenance request' });
    }
};

// Update maintenance request
exports.updateMaintenanceRequest = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const maintenance = await Maintenance.findById(req.params.id)
            .populate('residence', 'manager name')
            .populate('student', 'firstName lastName email');

        if (!maintenance) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Check if user manages this residence
        if (maintenance.residence.manager.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const before = maintenance.toObject();

        // Store the previous status to check if it's being completed
        const previousStatus = maintenance.status;
        const isBeingCompleted = previousStatus !== 'completed' && req.body.status === 'completed';

        const allowedUpdates = [
            'status',
            'assignedTo',
            'scheduledDate',
            'estimatedCompletion',
            'description',
            'amount'
        ];

        allowedUpdates.forEach(update => {
            if (req.body[update] !== undefined) {
                maintenance[update] = req.body[update];
            }
        });

        // If status is being updated to completed, set completedDate
        if (req.body.status === 'completed') {
            maintenance.completedDate = new Date();
        }

        await maintenance.save();

        // Send email notification for status changes (non-blocking)
        if (previousStatus !== maintenance.status) {
            try {
                await EmailNotificationService.sendMaintenanceStatusUpdate(
                    maintenance, 
                    previousStatus, 
                    req.user
                );
            } catch (emailError) {
                console.error('Failed to send maintenance status update email notification:', emailError);
                // Don't fail the request if email fails
            }
        }

        // Create transaction when maintenance is completed
        if (isBeingCompleted && maintenance.amount > 0) {
            try {
                console.log('[COMPLETION] Creating completion transaction for maintenance:', maintenance._id);
                
                // Get maintenance expense account (default to 5099)
                const expenseAccount = await Account.findOne({ code: '5099', type: 'Expense' });
                if (!expenseAccount) {
                    console.error('[COMPLETION] Maintenance expense account not found');
                    throw new Error('Maintenance expense account not found');
                }

                // Get cash/bank account for payment (default to 1000)
                const cashAccount = await Account.findOne({ code: '1000', type: 'Asset' });
                if (!cashAccount) {
                    console.error('[COMPLETION] Cash account not found');
                    throw new Error('Cash account not found');
                }

                // Generate unique transaction ID
                const transactionId = await generateUniqueId('TXN');

                // Create completion transaction
                const completionTxn = await Transaction.create({
                    transactionId: transactionId,
                    date: new Date(),
                    description: `Maintenance Completion: ${maintenance.issue} - ${maintenance.description}`,
                    reference: `MAINT-COMPLETE-${maintenance._id}`,
                    residence: maintenance.residence._id,
                    residenceName: maintenance.residence.name,
                    type: 'completion',
                    createdBy: req.user._id
                });

                // Create double-entry transaction entry
                const completionEntry = await TransactionEntry.create({
                    transactionId: transactionId,
                    date: new Date(),
                    description: `Maintenance Completion: ${maintenance.issue}`,
                    reference: `MAINT-COMPLETE-${maintenance._id}`,
                    entries: [
                        {
                            // DEBIT: Maintenance Expense Account
                            accountCode: expenseAccount.code,
                            accountName: expenseAccount.name,
                            accountType: expenseAccount.type,
                            debit: maintenance.amount,
                            credit: 0,
                            description: `Maintenance completion: ${maintenance.issue}`
                        },
                        {
                            // CREDIT: Cash/Bank Account (payment made)
                            accountCode: cashAccount.code,
                            accountName: cashAccount.name,
                            accountType: cashAccount.type,
                            debit: 0,
                            credit: maintenance.amount,
                            description: `Payment for maintenance: ${maintenance.issue}`
                        }
                    ],
                    totalDebit: maintenance.amount,
                    totalCredit: maintenance.amount,
                    source: 'maintenance_completion',
                    sourceId: maintenance._id,
                    sourceModel: 'Maintenance',
                    createdBy: req.user.email || `${req.user.firstName} ${req.user.lastName}`,
                    status: 'posted'
                });

                // Link transaction entry to transaction
                await Transaction.findByIdAndUpdate(completionTxn._id, {
                    $push: { entries: completionEntry._id }
                });

                // Create audit log for completion transaction
                await AuditLog.create({
                    user: req.user._id,
                    action: 'maintenance_completed_transaction_created',
                    collection: 'Transaction',
                    recordId: completionTxn._id,
                    before: null,
                    after: completionTxn.toObject(),
                    timestamp: new Date(),
                    details: {
                        source: 'Maintenance',
                        sourceId: maintenance._id,
                        maintenanceIssue: maintenance.issue,
                        maintenanceAmount: maintenance.amount,
                        expenseAccount: expenseAccount.code,
                        cashAccount: cashAccount.code,
                        description: `Maintenance completed - Expense recorded for ${maintenance.issue}`
                    }
                });

                console.log('[COMPLETION] Completion transaction created:', completionTxn._id);

            } catch (completionError) {
                console.error('[COMPLETION] Failed to create completion transaction:', completionError);
                // Don't fail the maintenance update, just log the error
            }
        }

        const updatedMaintenance = await Maintenance.findById(req.params.id)
            .populate('residence', 'name address')
            .populate('student', 'firstName lastName email')
            .populate('assignedTo', 'firstName lastName');

        res.json({
            ...updatedMaintenance.toObject(),
            amount: updatedMaintenance.amount !== null && updatedMaintenance.amount !== undefined ? updatedMaintenance.amount : 0,
        });
    } catch (error) {
        console.error('Update maintenance request error:', error);
        res.status(500).json({ error: 'Error updating maintenance request' });
    }
};

// Add comment to maintenance request
exports.addComment = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const maintenance = await Maintenance.findById(req.params.id)
            .populate('residence', 'manager');

        if (!maintenance) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Check if user manages this residence
        if (maintenance.residence.manager.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        maintenance.comments.push({
            user: req.user._id,
            text: req.body.text
        });

        await maintenance.save();

        const updatedMaintenance = await Maintenance.findById(req.params.id)
            .populate('comments.user', 'firstName lastName role');

        res.json(updatedMaintenance);
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Error adding comment' });
    }
};

// Get maintenance statistics
exports.getMaintenanceStats = async (req, res) => {
    try {
        // Get all residences managed by the property manager
        const managedResidences = await Residence.find({ manager: req.user._id });
        const residenceIds = managedResidences.map(residence => residence._id);

        const stats = await Maintenance.aggregate([
            {
                $match: {
                    residence: { $in: residenceIds }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    avgResolutionTime: {
                        $avg: {
                            $cond: [
                                { $eq: ['$status', 'completed'] },
                                {
                                    $divide: [
                                        { $subtract: ['$completedDate', '$createdAt'] },
                                        1000 * 60 * 60 * 24 // Convert to days
                                    ]
                                },
                                null
                            ]
                        }
                    }
                }
            }
        ]);

        const categoryStats = await Maintenance.aggregate([
            {
                $match: {
                    residence: { $in: residenceIds }
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            statusStats: stats,
            categoryStats
        });
    } catch (error) {
        console.error('Get maintenance stats error:', error);
        res.status(500).json({ error: 'Error fetching maintenance statistics' });
    }
}; 