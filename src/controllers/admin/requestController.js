const Request = require('../../models/Request');
const { validationResult } = require('express-validator');
const AuditLog = require('../../models/AuditLog');

// Get all requests (for CEO to view)
exports.getAllRequests = async (req, res) => {
    try {
        const { status, type, priority, page = 1, limit = 10 } = req.query;
        const query = {};

        if (status && status !== 'all') {
            query.status = status;
        }
        if (type && type !== 'all') {
            query.type = type;
        }
        if (priority && priority !== 'all') {
            query.priority = priority;
        }

        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
            Request.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('submittedBy', 'firstName lastName email')
                .populate('residence', 'name')
                .populate('approval.admin.approvedBy', 'firstName lastName')
                .populate('approval.finance.approvedBy', 'firstName lastName')
                .populate('approval.ceo.approvedBy', 'firstName lastName')
                .lean(),
            Request.countDocuments(query)
        ]);

        res.json({
            requests,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / limit),
                totalItems: total
            }
        });
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: 'Error fetching requests' });
    }
};

// Get request by ID
exports.getRequestById = async (req, res) => {
    try {
        const request = await Request.findById(req.params.id)
            .populate('submittedBy', 'firstName lastName email')
            .populate('residence', 'name')
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('quotations.approvedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
            .populate('approval.admin.approvedBy', 'firstName lastName')
            .populate('approval.finance.approvedBy', 'firstName lastName')
            .populate('approval.ceo.approvedBy', 'firstName lastName')
            .populate('assignedTo._id', 'firstName lastName')
            .populate('updates.author', 'firstName lastName')
            .populate('requestHistory.user', 'firstName lastName');

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        res.json(request);
    } catch (error) {
        console.error('Error fetching request:', error);
        res.status(500).json({ error: 'Error fetching request' });
    }
};

// CEO approve request
exports.approveRequest = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { notes } = req.body;

        const request = await Request.findById(id);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Check if CEO approval is already given
        if (request.approval.ceo.approved) {
            return res.status(400).json({ error: 'CEO approval already given for this request' });
        }

        // Check if admin and finance approval are already given
        if (!request.approval.admin.approved) {
            return res.status(400).json({ error: 'Admin approval required before CEO approval' });
        }

        if (!request.approval.finance.approved) {
            return res.status(400).json({ error: 'Finance approval required before CEO approval' });
        }

        const before = request.toObject();

        // Update CEO approval
        request.approval.ceo = {
            approved: true,
            approvedBy: req.user._id,
            approvedAt: new Date(),
            notes: notes || ''
        };

        // Update request status to approved if all approvals are complete
        if (request.approval.admin.approved && 
            request.approval.finance.approved && 
            request.approval.ceo.approved) {
            request.status = 'approved';
        }

        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'CEO Approval',
            user: req.user._id,
            changes: ['CEO approval granted']
        });

        await request.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'approve',
            collection: 'Request',
            recordId: request._id,
            before,
            after: request.toObject()
        });

        res.json({
            message: 'Request approved by CEO successfully',
            request: {
                id: request._id,
                title: request.title,
                status: request.status,
                approval: request.approval
            }
        });
    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ error: 'Error approving request' });
    }
};

// CEO reject request
exports.rejectRequest = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { notes } = req.body;

        if (!notes) {
            return res.status(400).json({ error: 'Rejection notes are required' });
        }

        const request = await Request.findById(id);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Check if CEO approval is already given
        if (request.approval.ceo.approved) {
            return res.status(400).json({ error: 'CEO approval already given for this request' });
        }

        const before = request.toObject();

        // Update CEO approval (rejection)
        request.approval.ceo = {
            approved: false,
            approvedBy: req.user._id,
            approvedAt: new Date(),
            notes: notes
        };

        // Update request status to rejected
        request.status = 'rejected';

        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'CEO Rejection',
            user: req.user._id,
            changes: [`CEO rejection: ${notes}`]
        });

        await request.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'reject',
            collection: 'Request',
            recordId: request._id,
            before,
            after: request.toObject()
        });

        res.json({
            message: 'Request rejected by CEO',
            request: {
                id: request._id,
                title: request.title,
                status: request.status,
                approval: request.approval
            }
        });
    } catch (error) {
        console.error('Error rejecting request:', error);
        res.status(500).json({ error: 'Error rejecting request' });
    }
};

// Get request statistics for CEO dashboard
exports.getRequestStats = async (req, res) => {
    try {
        const stats = await Request.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const approvalStats = await Request.aggregate([
            {
                $group: {
                    _id: {
                        adminApproved: '$approval.admin.approved',
                        financeApproved: '$approval.finance.approved',
                        ceoApproved: '$approval.ceo.approved'
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        const typeStats = await Request.aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            statusStats: stats,
            approvalStats: approvalStats,
            typeStats: typeStats
        });
    } catch (error) {
        console.error('Error fetching request stats:', error);
        res.status(500).json({ error: 'Error fetching request statistics' });
    }
}; 