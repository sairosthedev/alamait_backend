const MonthlyRequest = require('../models/MonthlyRequest');
const Residence = require('../models/Residence');
const { uploadToS3 } = require('../utils/fileStorage');

// Get all monthly requests (filtered by user role and residence)
exports.getAllMonthlyRequests = async (req, res) => {
    try {
        const user = req.user;
        const { 
            residence, 
            month, 
            year, 
            status, 
            isTemplate,
            page = 1, 
            limit = 10,
            search 
        } = req.query;

        let query = {};

        // Filter by residence
        if (residence) {
            query.residence = residence;
        }

        // Filter by month/year
        if (month && year) {
            query.month = parseInt(month);
            query.year = parseInt(year);
        }

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Filter by template
        if (isTemplate !== undefined) {
            query.isTemplate = isTemplate === 'true';
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
            // Students can only see requests from their assigned residence
            const studentResidence = user.residence;
            if (studentResidence) {
                query.residence = studentResidence;
            } else {
                return res.status(403).json({ message: 'No residence assigned' });
            }
        } else if (user.role === 'finance' || user.role === 'finance_admin' || user.role === 'finance_user') {
            // Finance users can see all approved requests
            query.status = { $in: ['approved', 'completed'] };
        }

        const skip = (page - 1) * limit;
        
        const monthlyRequests = await MonthlyRequest.find(query)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await MonthlyRequest.countDocuments(query);

        res.status(200).json({
            monthlyRequests,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error getting monthly requests:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get monthly request by ID
exports.getMonthlyRequestById = async (req, res) => {
    try {
        const user = req.user;
        const monthlyRequest = await MonthlyRequest.findById(req.params.id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email');

        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        // Check access permissions
        if (user.role === 'student' && monthlyRequest.residence._id.toString() !== user.residence?.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.status(200).json(monthlyRequest);
    } catch (error) {
        console.error('Error getting monthly request:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create new monthly request
exports.createMonthlyRequest = async (req, res) => {
    try {
        const user = req.user;
        const {
            title,
            description,
            residence,
            month,
            year,
            items,
            priority,
            notes,
            isTemplate,
            templateName,
            templateDescription,
            tags
        } = req.body;

        // Validate required fields
        if (!title || !description || !residence || !month || !year) {
            return res.status(400).json({ message: 'Title, description, residence, month, and year are required' });
        }

        // Validate month and year
        if (month < 1 || month > 12) {
            return res.status(400).json({ message: 'Month must be between 1 and 12' });
        }

        if (year < 2020) {
            return res.status(400).json({ message: 'Year must be 2020 or later' });
        }

        // Check if residence exists
        const residenceExists = await Residence.findById(residence);
        if (!residenceExists) {
            return res.status(400).json({ message: 'Residence not found' });
        }

        // For students, ensure they can only create for their assigned residence
        if (user.role === 'student' && residence !== user.residence?.toString()) {
            return res.status(403).json({ message: 'Students can only create requests for their assigned residence' });
        }

        // Check for duplicate monthly request (same residence, month, year, title)
        const existingRequest = await MonthlyRequest.findOne({
            residence,
            month: parseInt(month),
            year: parseInt(year),
            title,
            isTemplate: false
        });

        if (existingRequest) {
            return res.status(400).json({ message: 'A monthly request with this title already exists for this residence and month' });
        }

        const monthlyRequest = new MonthlyRequest({
            title,
            description,
            residence,
            month: parseInt(month),
            year: parseInt(year),
            items: items || [],
            priority: priority || 'medium',
            notes,
            isTemplate: isTemplate || false,
            templateName: isTemplate ? templateName : undefined,
            templateDescription: isTemplate ? templateDescription : undefined,
            submittedBy: user._id,
            status: 'draft',
            tags: tags || []
        });

        // Add to request history
        monthlyRequest.requestHistory.push({
            date: new Date(),
            action: 'Monthly request created',
            user: user._id,
            changes: ['Request created']
        });

        await monthlyRequest.save();

        const populatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email');

        res.status(201).json(populatedRequest);
    } catch (error) {
        console.error('Error creating monthly request:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update monthly request
exports.updateMonthlyRequest = async (req, res) => {
    try {
        const user = req.user;
        const monthlyRequest = await MonthlyRequest.findById(req.params.id);

        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        // Check permissions - only admin or the submitter can update
        if (user.role !== 'admin' && monthlyRequest.submittedBy.toString() !== user._id.toString()) {
            return res.status(403).json({ message: 'Only admins or the submitter can update monthly requests' });
        }

        // Only allow updates if status is draft or pending
        if (!['draft', 'pending'].includes(monthlyRequest.status)) {
            return res.status(400).json({ message: 'Cannot update monthly request that has been approved or completed' });
        }

        const {
            title,
            description,
            items,
            priority,
            notes,
            tags
        } = req.body;

        const changes = [];

        if (title && title !== monthlyRequest.title) {
            monthlyRequest.title = title;
            changes.push('Title updated');
        }

        if (description && description !== monthlyRequest.description) {
            monthlyRequest.description = description;
            changes.push('Description updated');
        }

        if (items) {
            monthlyRequest.items = items;
            changes.push('Items updated');
        }

        if (priority && priority !== monthlyRequest.priority) {
            monthlyRequest.priority = priority;
            changes.push('Priority updated');
        }

        if (notes !== undefined && notes !== monthlyRequest.notes) {
            monthlyRequest.notes = notes;
            changes.push('Notes updated');
        }

        if (tags) {
            monthlyRequest.tags = tags;
            changes.push('Tags updated');
        }

        if (changes.length > 0) {
            monthlyRequest.requestHistory.push({
                date: new Date(),
                action: 'Monthly request updated',
                user: user._id,
                changes
            });
        }

        await monthlyRequest.save();

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        res.status(200).json(updatedRequest);
    } catch (error) {
        console.error('Error updating monthly request:', error);
        res.status(500).json({ message: error.message });
    }
};

// Submit monthly request for approval
exports.submitMonthlyRequest = async (req, res) => {
    try {
        const user = req.user;
        const monthlyRequest = await MonthlyRequest.findById(req.params.id);

        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        // Check permissions
        if (user.role !== 'admin' && monthlyRequest.submittedBy.toString() !== user._id.toString()) {
            return res.status(403).json({ message: 'Only admins or the submitter can submit monthly requests' });
        }

        if (monthlyRequest.status !== 'draft') {
            return res.status(400).json({ message: 'Only draft requests can be submitted' });
        }

        if (!monthlyRequest.items || monthlyRequest.items.length === 0) {
            return res.status(400).json({ message: 'Cannot submit monthly request without items' });
        }

        monthlyRequest.status = 'pending';
        monthlyRequest.requestHistory.push({
            date: new Date(),
            action: 'Monthly request submitted for approval',
            user: user._id,
            changes: ['Status changed to pending']
        });

        await monthlyRequest.save();

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email');

        res.status(200).json(updatedRequest);
    } catch (error) {
        console.error('Error submitting monthly request:', error);
        res.status(500).json({ message: error.message });
    }
};

// Approve monthly request (Finance only)
exports.approveMonthlyRequest = async (req, res) => {
    try {
        const user = req.user;
        const { approved, notes } = req.body;

        // Check permissions - only finance users can approve
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can approve monthly requests' });
        }

        const monthlyRequest = await MonthlyRequest.findById(req.params.id);

        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        if (monthlyRequest.status !== 'pending') {
            return res.status(400).json({ message: 'Only pending requests can be approved' });
        }

        monthlyRequest.status = approved ? 'approved' : 'rejected';
        monthlyRequest.approvedBy = user._id;
        monthlyRequest.approvedAt = new Date();
        monthlyRequest.approvedByEmail = user.email;
        monthlyRequest.notes = notes || monthlyRequest.notes;

        monthlyRequest.requestHistory.push({
            date: new Date(),
            action: `Monthly request ${approved ? 'approved' : 'rejected'}`,
            user: user._id,
            changes: [`Status changed to ${approved ? 'approved' : 'rejected'}`]
        });

        await monthlyRequest.save();

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        res.status(200).json(updatedRequest);
    } catch (error) {
        console.error('Error approving monthly request:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get templates for a residence
exports.getTemplates = async (req, res) => {
    try {
        const { residence } = req.params;
        const templates = await MonthlyRequest.getTemplates(residence);

        res.status(200).json(templates);
    } catch (error) {
        console.error('Error getting templates:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create monthly request from template
exports.createFromTemplate = async (req, res) => {
    try {
        const user = req.user;
        const { templateId } = req.params;
        const { month, year } = req.body;

        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year are required' });
        }

        const monthlyRequest = await MonthlyRequest.createFromTemplate(templateId, parseInt(month), parseInt(year), user._id);

        const populatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email');

        res.status(201).json(populatedRequest);
    } catch (error) {
        console.error('Error creating from template:', error);
        res.status(500).json({ message: error.message });
    }
};

// Add quotation to item
exports.addItemQuotation = async (req, res) => {
    try {
        const user = req.user;
        const { itemIndex } = req.params;
        const { provider, amount, description } = req.body;

        // Check permissions - only admins can add quotations
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can add quotations' });
        }

        const monthlyRequest = await MonthlyRequest.findById(req.params.id);
        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        if (!monthlyRequest.items[itemIndex]) {
            return res.status(400).json({ message: 'Invalid item index' });
        }

        // Handle file upload
        let fileUrl = '';
        let fileName = '';
        
        if (req.file) {
            const uploadResult = await uploadToS3(req.file, 'monthly-request-quotations');
            fileUrl = uploadResult.url;
            fileName = uploadResult.fileName;
        }

        const quotation = {
            provider,
            amount: parseFloat(amount),
            description: description || '',
            fileUrl,
            fileName,
            uploadedBy: user._id,
            uploadedAt: new Date(),
            isApproved: false
        };

        await monthlyRequest.addItemQuotation(parseInt(itemIndex), quotation);

        monthlyRequest.requestHistory.push({
            date: new Date(),
            action: 'Item quotation added',
            user: user._id,
            changes: [`Quotation added for item: ${monthlyRequest.items[itemIndex].description}`]
        });

        await monthlyRequest.save();

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email');

        res.status(201).json(updatedRequest);
    } catch (error) {
        console.error('Error adding item quotation:', error);
        res.status(500).json({ message: error.message });
    }
};

// Approve item quotation
exports.approveItemQuotation = async (req, res) => {
    try {
        const user = req.user;
        const { itemIndex, quotationIndex } = req.params;

        // Check permissions - only admins and finance users can approve quotations
        if (!['admin', 'finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only admins and finance users can approve quotations' });
        }

        const monthlyRequest = await MonthlyRequest.findById(req.params.id);
        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        await monthlyRequest.approveItemQuotation(parseInt(itemIndex), parseInt(quotationIndex), user._id);

        monthlyRequest.requestHistory.push({
            date: new Date(),
            action: 'Item quotation approved',
            user: user._id,
            changes: [`Quotation approved for item: ${monthlyRequest.items[itemIndex].description}`]
        });

        await monthlyRequest.save();

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email');

        res.status(200).json(updatedRequest);
    } catch (error) {
        console.error('Error approving item quotation:', error);
        res.status(500).json({ message: error.message });
    }
};

// Delete monthly request
exports.deleteMonthlyRequest = async (req, res) => {
    try {
        const user = req.user;
        const monthlyRequest = await MonthlyRequest.findById(req.params.id);

        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        // Check permissions - only admin or submitter can delete
        if (user.role !== 'admin' && monthlyRequest.submittedBy.toString() !== user._id.toString()) {
            return res.status(403).json({ message: 'Only admins or the submitter can delete monthly requests' });
        }

        // Only allow deletion if status is draft
        if (monthlyRequest.status !== 'draft') {
            return res.status(400).json({ message: 'Only draft requests can be deleted' });
        }

        await MonthlyRequest.findByIdAndDelete(req.params.id);

        res.status(200).json({ message: 'Monthly request deleted successfully' });
    } catch (error) {
        console.error('Error deleting monthly request:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get monthly requests for a specific residence and month/year
exports.getMonthlyRequestsByResidence = async (req, res) => {
    try {
        const { residenceId, month, year } = req.params;
        const monthlyRequests = await MonthlyRequest.getMonthlyRequests(residenceId, parseInt(month), parseInt(year));

        res.status(200).json(monthlyRequests);
    } catch (error) {
        console.error('Error getting monthly requests by residence:', error);
        res.status(500).json({ message: error.message });
    }
}; 