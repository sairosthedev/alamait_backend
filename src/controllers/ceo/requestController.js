const Request = require('../../models/Request');
const { validationResult } = require('express-validator');
const AuditLog = require('../../models/AuditLog');
const EmailNotificationService = require('../../services/emailNotificationService');

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
                .populate('quotations.uploadedBy', 'firstName lastName')
                .populate('quotations.approvedBy', 'firstName lastName')
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

// Get requests pending CEO approval
exports.getPendingCEOApproval = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build query to find requests that need CEO approval
        // Admin and Finance must have approved, CEO must not have approved
        // Use a simpler query that handles missing fields gracefully
        const query = {
            type: { $in: ['financial', 'operational'] },
            $or: [
                // Status-based query (simpler and more reliable)
                { status: { $in: ['pending_ceo_approval', 'pending-ceo-approval'] } },
                // Approval-based query (if approval structure exists)
                {
                    'approval.admin.approved': true,
                    'approval.finance.approved': true,
                    'approval.ceo.approved': { $ne: true }
                }
            ]
        };

        const [requests, total] = await Promise.all([
            Request.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('submittedBy', 'firstName lastName email')
                .populate('residence', 'name')
                .populate('approval.admin.approvedBy', 'firstName lastName')
                .populate('approval.finance.approvedBy', 'firstName lastName')
                .populate('quotations.uploadedBy', 'firstName lastName email')
                .populate('quotations.approvedBy', 'firstName lastName email')
                .populate('items.quotations.uploadedBy', 'firstName lastName email')
                .populate('items.quotations.approvedBy', 'firstName lastName email')
                .lean(),
            Request.countDocuments(query)
        ]);

        res.json({
            success: true,
            requests,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / parseInt(limit)),
                totalItems: total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching pending CEO approval requests:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error fetching pending CEO approval requests',
            message: error.message 
        });
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

        // Update request status based on approval type
        if (request.approval.admin.approved && 
            request.approval.finance.approved && 
            request.approval.ceo.approved) {
            
            // Check if this is a salary request
            const isSalaryRequest = request.category === 'salary' || 
                                  request.category === 'salaries' ||
                                  (request.title && request.title.toLowerCase().includes('salary')) ||
                                  (request.description && request.description.toLowerCase().includes('salary'));
            
            if (isSalaryRequest) {
                request.status = 'CEO approved';
                console.log('✅ Salary request approved by CEO - no expense created');
            } else {
                request.status = 'approved';
            }
        }

        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'CEO Approval',
            user: req.user._id,
            changes: ['CEO approval granted']
        });

        await request.save();

        // Send email notification to request submitter (non-blocking)
        try {
            await EmailNotificationService.sendCEOApprovalNotification(
                request, 
                true, 
                notes || '', 
                req.user
            );
        } catch (emailError) {
            console.error('Failed to send CEO approval email notification:', emailError);
            // Don't fail the request if email fails
        }

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

        // Send email notification to request submitter (non-blocking)
        try {
            await EmailNotificationService.sendCEOApprovalNotification(
                request, 
                false, 
                notes, 
                req.user
            );
        } catch (emailError) {
            console.error('Failed to send CEO rejection email notification:', emailError);
            // Don't fail the request if email fails
        }

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

// CEO change quotation
exports.changeQuotation = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { quotationId, reason } = req.body;

        if (!quotationId || !reason) {
            return res.status(400).json({ error: 'Quotation ID and reason are required' });
        }

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
            return res.status(400).json({ error: 'Admin approval required before CEO can change quotation' });
        }

        if (!request.approval.finance.approved) {
            return res.status(400).json({ error: 'Finance approval required before CEO can change quotation' });
        }

        // Find the quotation
        const quotation = request.quotations.id(quotationId);
        if (!quotation) {
            return res.status(404).json({ error: 'Quotation not found' });
        }

        const before = request.toObject();

        // Update all quotations to not approved
        request.quotations.forEach(q => {
            q.isApproved = false;
            q.approvedBy = null;
            q.approvedAt = null;
        });

        // Approve the selected quotation
        quotation.isApproved = true;
        quotation.approvedBy = req.user._id;
        quotation.approvedAt = new Date();

        // Update request amount to match the selected quotation
        request.amount = quotation.amount;

        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'CEO Quotation Change',
            user: req.user._id,
            changes: [`CEO changed quotation to ${quotation.provider} (${quotation.amount}). Reason: ${reason}`]
        });

        await request.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'change_quotation',
            collection: 'Request',
            recordId: request._id,
            before,
            after: request.toObject()
        });

        res.json({
            message: 'Quotation changed successfully by CEO',
            request: {
                id: request._id,
                title: request.title,
                amount: request.amount,
                selectedQuotation: {
                    provider: quotation.provider,
                    amount: quotation.amount,
                    reason: reason
                }
            }
        });
    } catch (error) {
        console.error('Error changing quotation:', error);
        res.status(500).json({ error: 'Error changing quotation' });
    }
}; 