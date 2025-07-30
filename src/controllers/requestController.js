const Request = require('../models/Request');
const Expense = require('../models/finance/Expense');
const User = require('../models/User');
const { generateUniqueId } = require('../utils/idGenerator');
const { uploadToS3 } = require('../utils/fileStorage');

// Get all requests (filtered by user role)
exports.getAllRequests = async (req, res) => {
    try {
        const { type, status, residence, priority, category, search, page = 1, limit = 10 } = req.query;
        const user = req.user;
        
        let query = {};
        
        // Filter by type if provided
        if (type) {
            query.type = type;
        }
        
        // Filter by status if provided
        if (status) {
            query.status = status;
        }
        
        // Filter by residence if provided
        if (residence) {
            query.residence = residence;
        }

        // Filter by priority if provided
        if (priority) {
            query.priority = priority;
        }

        // Filter by category if provided
        if (category) {
            query.category = category;
        }

        // Search in title and description
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Role-based filtering
        if (user.role === 'student') {
            // Students can see their own requests AND requests from other students in their residence
            if (user.residence) {
                query.residence = user.residence;
            } else {
                // If student has no residence assigned, only show their own requests
                query.submittedBy = user._id;
            }
        } else if (user.role === 'admin') {
            // Admins can see all requests
            // No additional filtering needed
        } else if (user.role === 'finance' || user.role === 'finance_admin' || user.role === 'finance_user') {
            // Finance can see admin requests that have been forwarded to them
            query.type = { $in: ['financial', 'operational', 'administrative'] };
            query['approval.admin.approved'] = true;
        } else if (user.role === 'ceo') {
            // CEO can see admin requests that have been approved by finance
            query.type = { $in: ['financial', 'operational', 'administrative'] };
            query['approval.admin.approved'] = true;
            query['approval.finance.approved'] = true;
        }
        
        const skip = (page - 1) * limit;
        
        const requests = await Request.find(query)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('assignedTo._id', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('approval.admin.approvedBy', 'firstName lastName email')
            .populate('approval.finance.approvedBy', 'firstName lastName email')
            .populate('approval.ceo.approvedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await Request.countDocuments(query);
        
        res.status(200).json({
            requests,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get request by ID
exports.getRequestById = async (req, res) => {
    try {
        const request = await Request.findById(req.params.id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('assignedTo._id', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('quotations.approvedBy', 'firstName lastName email')
            .populate('approval.admin.approvedBy', 'firstName lastName email')
            .populate('approval.finance.approvedBy', 'firstName lastName email')
            .populate('approval.ceo.approvedBy', 'firstName lastName email')
            .populate('updates.author', 'firstName lastName email');
        
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Check if user has permission to view this request
        const user = req.user;
        if (user.role === 'student') {
            // Students can view their own requests or requests from their residence
            if (request.submittedBy.toString() !== user._id.toString()) {
                // Not their own request, check if it's from their residence
                if (!user.residence || request.residence.toString() !== user.residence.toString()) {
                    return res.status(403).json({ message: 'Access denied' });
                }
            }
        }
        
        res.status(200).json(request);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create new request
exports.createRequest = async (req, res) => {
    try {
        const { title, description, type, residence, room, category, priority, amount, dueDate, tags, images } = req.body;
        const user = req.user;
        
        // Validate required fields
        if (!title || !description || !type) {
            return res.status(400).json({ message: 'Missing required fields: title, description, type' });
        }
        
        // Validate type based on user role
        if (user.role === 'student' && type !== 'maintenance') {
            return res.status(400).json({ message: 'Students can only submit maintenance requests' });
        }
        
        // Validate residence for students
        if (user.role === 'student') {
            if (!residence) {
                return res.status(400).json({ message: 'Residence is required for student requests' });
            }
            if (!user.residence || residence.toString() !== user.residence.toString()) {
                return res.status(400).json({ message: 'Students can only submit requests for their assigned residence' });
            }
        }
        
        // Check for duplicate requests (same title and description by same user)
        const existingRequest = await Request.findOne({
            title: title,
            description: description,
            submittedBy: user._id,
            status: { $in: ['pending_admin_approval', 'pending_finance_approval', 'pending_ceo_approval'] }
        });
        
        if (existingRequest) {
            return res.status(400).json({ message: 'A similar request already exists' });
        }
        
        // Build request data
        const requestData = {
            title,
            description,
            type,
            submittedBy: user._id,
            submittedDate: new Date(),
            residence,
            room,
            category,
            priority: priority || 'medium',
            status: 'pending_admin_approval',
            amount: amount || 0,
            dueDate: dueDate ? new Date(dueDate) : null,
            tags: tags || []
        };
        
        // Add images if provided
        if (images && Array.isArray(images)) {
            requestData.images = images;
        }
        
        // For admin requests, set initial admin approval
        if (user.role === 'admin' && type !== 'maintenance') {
            requestData.approval = {
                admin: {
                    approved: true,
                    approvedBy: user._id,
                    approvedAt: new Date()
                },
                finance: {
                    approved: false
                },
                ceo: {
                    approved: false
                }
            };
            requestData.status = 'pending_finance_approval';
        }
        
        const request = new Request(requestData);
        await request.save();
        
        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'Request created',
            user: user._id,
            changes: ['Request submitted']
        });
        await request.save();
        
        const populatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('residence', 'name');
        
        res.status(201).json(populatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update request (only if pending)
exports.updateRequest = async (req, res) => {
    try {
        const { title, description, room, category, priority, amount, dueDate, tags } = req.body;
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Check permissions
        if (user.role === 'student' && request.submittedBy.toString() !== user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Only allow updates if request is still pending
        if (request.status !== 'pending_admin_approval') {
            return res.status(400).json({ message: 'Cannot update request that is not pending' });
        }
        
        // Update fields
        if (title) request.title = title;
        if (description) request.description = description;
        if (room) request.room = room;
        if (category) request.category = category;
        if (priority) request.priority = priority;
        if (amount !== undefined) request.amount = amount;
        if (dueDate) request.dueDate = new Date(dueDate);
        if (tags) request.tags = tags;
        
        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'Request updated',
            user: user._id,
            changes: ['Request details modified']
        });
        
        await request.save();
        
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('residence', 'name');
        
        res.status(200).json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update request status (admin only - for maintenance requests)
exports.updateRequestStatus = async (req, res) => {
    try {
        const { status, notes } = req.body;
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Only admins can update request status
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Update the status
        request.status = status;
        
        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'Status update',
            user: user._id,
            changes: [`Status changed to: ${status}`, notes ? `Notes: ${notes}` : null].filter(Boolean)
        });
        
        await request.save();
        
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('approval.admin.approvedBy', 'firstName lastName email');
        
        res.status(200).json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin approval for requests
exports.adminApproval = async (req, res) => {
    try {
        const { approved, notes } = req.body;
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Only admins can approve requests
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Check if request is in correct status
        if (request.status !== 'pending_admin_approval') {
            return res.status(400).json({ message: 'Request is not pending admin approval' });
        }
        
        request.approval.admin = {
            approved,
            approvedBy: user._id,
            approvedAt: new Date(),
            notes
        };
        
        // Update status based on approval
        if (approved) {
            request.status = 'pending_finance_approval';
        } else {
            request.status = 'rejected';
        }
        
        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'Admin approval',
            user: user._id,
            changes: [`Admin ${approved ? 'approved' : 'rejected'} the request`]
        });
        
        await request.save();
        
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('approval.admin.approvedBy', 'firstName lastName email');
        
        res.status(200).json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Finance approval for requests
exports.financeApproval = async (req, res) => {
    try {
        const { approved, notes } = req.body;
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Only finance users can approve
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Check if admin has approved first
        if (!request.approval.admin.approved) {
            return res.status(400).json({ message: 'Admin approval required before finance approval' });
        }
        
        // Check if request is in correct status
        if (request.status !== 'pending_finance_approval') {
            return res.status(400).json({ message: 'Request is not pending finance approval' });
        }
        
        request.approval.finance = {
            approved,
            approvedBy: user._id,
            approvedAt: new Date(),
            notes
        };
        
        // Update status based on approval
        if (approved) {
            request.status = 'pending_ceo_approval';
        } else {
            request.status = 'rejected';
        }
        
        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'Finance approval',
            user: user._id,
            changes: [`Finance ${approved ? 'approved' : 'rejected'} the request`]
        });
        
        await request.save();
        
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('approval.finance.approvedBy', 'firstName lastName email');
        
        res.status(200).json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// CEO approval for requests
exports.ceoApproval = async (req, res) => {
    try {
        const { approved, notes } = req.body;
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Only CEO can approve
        if (user.role !== 'ceo') {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Check if admin and finance have approved first
        if (!request.approval.admin.approved || !request.approval.finance.approved) {
            return res.status(400).json({ message: 'Admin and finance approval required before CEO approval' });
        }
        
        // Check if request is in correct status
        if (request.status !== 'pending_ceo_approval') {
            return res.status(400).json({ message: 'Request is not pending CEO approval' });
        }
        
        request.approval.ceo = {
            approved,
            approvedBy: user._id,
            approvedAt: new Date(),
            notes
        };
        
        // Update status based on approval
        if (approved) {
            request.status = 'approved';
            
            // Convert to expense if amount is specified
            if (request.amount > 0) {
                const expense = new Expense({
                    expenseId: generateUniqueId('EXP'),
                    residence: request.residence,
                    category: 'Other',
                    amount: request.amount,
                    description: request.title,
                    expenseDate: new Date(),
                    paymentStatus: 'Pending',
                    period: 'monthly',
                    createdBy: user._id,
                    maintenanceRequestId: request._id
                });
                
                await expense.save();
                
                request.convertedToExpense = true;
                request.expenseId = expense._id;
            }
        } else {
            request.status = 'rejected';
        }
        
        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'CEO approval',
            user: user._id,
            changes: [`CEO ${approved ? 'approved' : 'rejected'} the request`]
        });
        
        await request.save();
        
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('approval.ceo.approvedBy', 'firstName lastName email')
            .populate('expenseId');
        
        res.status(200).json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// CEO change quotation
exports.changeQuotation = async (req, res) => {
    try {
        const { quotationId, reason } = req.body;
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Only CEO can change quotations
        if (user.role !== 'ceo') {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Check if request is approved by CEO
        if (!request.approval.ceo.approved) {
            return res.status(400).json({ message: 'Request must be approved by CEO before changing quotations' });
        }
        
        // Find the quotation
        const quotation = request.quotations.id(quotationId);
        if (!quotation) {
            return res.status(404).json({ message: 'Quotation not found' });
        }
        
        // Find the currently approved quotation
        const approvedQuotation = request.quotations.find(q => q.isApproved);
        if (!approvedQuotation) {
            return res.status(400).json({ message: 'No quotation is currently approved' });
        }
        
        // Unapprove current quotation
        approvedQuotation.isApproved = false;
        approvedQuotation.approvedBy = null;
        approvedQuotation.approvedAt = null;
        
        // Approve new quotation
        quotation.isApproved = true;
        quotation.approvedBy = user._id;
        quotation.approvedAt = new Date();
        
        // Update request amount
        request.amount = quotation.amount;
        request.status = 'approved_with_changes';
        
        // Add quotation change to CEO approval
        request.approval.ceo.quotationChanges.push({
            originalQuotation: approvedQuotation.amount,
            newQuotation: quotation.amount,
            changeReason: reason,
            changedDate: new Date()
        });
        
        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'Quotation changed',
            user: user._id,
            changes: [`Quotation changed from ${approvedQuotation.provider} to ${quotation.provider}`]
        });
        
        await request.save();
        
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('quotations.approvedBy', 'firstName lastName email')
            .populate('residence', 'name')
            .populate('approval.ceo.approvedBy', 'firstName lastName email');
        
        res.status(200).json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Upload quotation (admin only)
exports.uploadQuotation = async (req, res) => {
    try {
        const { provider, amount, description, validUntil, terms } = req.body;
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Only admins can upload quotations
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        // Check quotation limit (max 3)
        if (request.quotations.length >= 3) {
            return res.status(400).json({ message: 'Maximum of 3 quotations allowed' });
        }
        
        // Upload file to S3
        const fileUrl = await uploadToS3(req.file, 'quotations');
        
        const quotation = {
            provider,
            amount: parseFloat(amount),
            description,
            fileUrl,
            fileName: req.file.originalname,
            uploadedBy: user._id,
            uploadedAt: new Date(),
            validUntil: validUntil ? new Date(validUntil) : null,
            terms
        };
        
        request.quotations.push(quotation);
        
        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'Quotation uploaded',
            user: user._id,
            changes: [`Quotation uploaded from ${provider}`]
        });
        
        await request.save();
        
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('residence', 'name');
        
        res.status(200).json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Approve quotation (finance only)
exports.approveQuotation = async (req, res) => {
    try {
        const { quotationIndex } = req.body;
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Only finance users can approve quotations
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Check if quotation exists
        if (!request.quotations[quotationIndex]) {
            return res.status(404).json({ message: 'Quotation not found' });
        }
        
        // Unapprove all other quotations
        request.quotations.forEach((quotation, index) => {
            quotation.isApproved = false;
            quotation.approvedBy = null;
            quotation.approvedAt = null;
        });
        
        // Approve the selected quotation
        request.quotations[quotationIndex].isApproved = true;
        request.quotations[quotationIndex].approvedBy = user._id;
        request.quotations[quotationIndex].approvedAt = new Date();
        
        // Update request amount
        request.amount = request.quotations[quotationIndex].amount;
        
        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'Quotation approved',
            user: user._id,
            changes: [`Quotation from ${request.quotations[quotationIndex].provider} approved`]
        });
        
        await request.save();
        
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('quotations.approvedBy', 'firstName lastName email')
            .populate('residence', 'name');
        
        res.status(200).json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Add update message to request
exports.addUpdate = async (req, res) => {
    try {
        const { message } = req.body;
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Check permissions
        if (user.role === 'student' && request.submittedBy.toString() !== user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        request.updates.push({
            date: new Date(),
            message,
            author: user._id
        });
        
        await request.save();
        
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('updates.author', 'firstName lastName email')
            .populate('residence', 'name');
        
        res.status(200).json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete request (only by submitter or admin)
exports.deleteRequest = async (req, res) => {
    try {
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Check permissions
        if (user.role === 'student' && request.submittedBy.toString() !== user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Only allow deletion if request is still pending
        if (request.status !== 'pending_admin_approval') {
            return res.status(400).json({ message: 'Cannot delete request that is not pending' });
        }
        
        await Request.findByIdAndDelete(req.params.id);
        
        res.status(200).json({ message: 'Request deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};