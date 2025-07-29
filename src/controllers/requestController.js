const Request = require('../models/Request');
const Expense = require('../models/finance/Expense');
const User = require('../models/User');
const { generateUniqueId } = require('../utils/idGenerator');
const { uploadToS3 } = require('../utils/fileStorage');

// Get all requests (filtered by user role)
exports.getAllRequests = async (req, res) => {
    try {
        const { type, status, residence } = req.query;
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
            query.type = { $in: ['financial', 'operational'] };
            query['approval.admin.approved'] = true;
        } else if (user.role === 'ceo') {
            // CEO can see admin requests that have been approved by finance
            query.type = { $in: ['financial', 'operational'] };
            query['approval.admin.approved'] = true;
            query['approval.finance.approved'] = true;
        }
        
        const requests = await Request.find(query)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('assignedTo._id', 'firstName lastName email role')
            .populate('residence', 'name')
            .sort({ createdAt: -1 });
        
        res.status(200).json(requests);
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
            .populate('quotations.approvedBy', 'firstName lastName email');
        
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
        const { title, description, type, residence, room, category, priority, images } = req.body;
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
            status: { $in: ['pending', 'assigned', 'in_progress'] }
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
            residence,
            room,
            category,
            priority: priority || 'medium',
            status: 'pending'
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

// Update request status (for maintenance requests)
exports.updateRequestStatus = async (req, res) => {
    try {
        const { status, assignedTo, notes } = req.body;
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Only admins can update request status
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Validate status transition
        const validTransitions = {
            'pending': ['assigned', 'rejected'],
            'assigned': ['in_progress', 'rejected'],
            'in_progress': ['completed', 'rejected'],
            'completed': [],
            'rejected': []
        };
        
        if (!validTransitions[request.status].includes(status)) {
            return res.status(400).json({ 
                message: `Invalid status transition from ${request.status} to ${status}` 
            });
        }
        
        // Update request
        request.status = status;
        
        if (assignedTo) {
            const assignedUser = await User.findById(assignedTo);
            if (assignedUser) {
                request.assignedTo = {
                    _id: assignedUser._id,
                    name: assignedUser.firstName,
                    surname: assignedUser.lastName,
                    role: assignedUser.role
                };
            }
        }
        
        // Add update message if provided
        if (notes) {
            request.updates.push({
                date: new Date(),
                message: notes,
                author: user._id
            });
        }
        
        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'Status updated',
            user: user._id,
            changes: [`Status changed to ${status}`]
        });
        
        await request.save();
        
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('assignedTo._id', 'firstName lastName email role')
            .populate('residence', 'name');
        
        res.status(200).json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin approval for admin requests
exports.adminApproval = async (req, res) => {
    try {
        const { approved, notes } = req.body;
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Only admins can approve admin requests
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Only financial/operational requests need admin approval
        if (request.type === 'maintenance') {
            return res.status(400).json({ message: 'Maintenance requests do not require admin approval' });
        }
        
        request.approval.admin = {
            approved,
            approvedBy: user._id,
            approvedAt: new Date(),
            notes
        };
        
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
            .populate('residence', 'name');
        
        res.status(200).json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Finance approval for admin requests
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
        
        request.approval.finance = {
            approved,
            approvedBy: user._id,
            approvedAt: new Date(),
            notes
        };
        
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
            .populate('residence', 'name');
        
        res.status(200).json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// CEO approval for admin requests
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
        
        request.approval.ceo = {
            approved,
            approvedBy: user._id,
            approvedAt: new Date(),
            notes
        };
        
        // If approved, convert to expense
        if (approved) {
            const expense = new Expense({
                expenseId: generateUniqueId('EXP'),
                residence: request.residence,
                category: 'Other',
                amount: request.amount || 0,
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
            .populate('expenseId');
        
        res.status(200).json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Upload quotation (admin only)
exports.uploadQuotation = async (req, res) => {
    try {
        const { provider, amount, description } = req.body;
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
            uploadedAt: new Date()
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
        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Cannot delete request that is not pending' });
        }
        
        await Request.findByIdAndDelete(req.params.id);
        
        res.status(200).json({ message: 'Request deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};