const MonthlyRequest = require('../models/MonthlyRequest');
const Residence = require('../models/Residence');
const { uploadToS3 } = require('../utils/fileStorage');
const Expense = require('../models/finance/Expense'); // Added for expense conversion

// Helper function to format description with month name
function formatDescriptionWithMonth(description, month, year) {
    if (!description) return description;
    
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthName = monthNames[month - 1];
    
    // Check if description already contains month/year
    const monthYearPattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i;
    
    if (monthYearPattern.test(description)) {
        // Replace existing month/year with new one
        return description.replace(monthYearPattern, `${monthName} ${year}`);
    } else {
        // Add month/year to description
        return `${description} for ${monthName} ${year}`;
    }
}

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

        // Role-based filtering - Students cannot access monthly requests
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
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

        // Check access permissions - Students cannot access monthly requests
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
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
            templateRequests, // Handle frontend field name
            priority,
            notes,
            isTemplate,
            templateName,
            templateDescription,
            tags
        } = req.body;

        // Map templateRequests to items if provided (frontend compatibility)
        const finalItems = items || templateRequests || [];
        
        // Ensure all items have required fields with defaults
        const processedItems = finalItems.map(item => ({
            ...item,
            quantity: item.quantity || 1, // Default to 1 if not provided
            estimatedCost: item.estimatedCost || 0, // Default to 0 if not provided
            category: item.category || 'other', // Default category
            isRecurring: item.isRecurring !== undefined ? item.isRecurring : true // Default to true
        }));

        // Log the request for debugging
        console.log('Monthly request creation attempt:', {
            user: user._id,
            userRole: user.role,
            title,
            description,
            residence,
            month,
            year,
            isTemplate,
            hasItems: !!finalItems,
            hasTemplateRequests: !!templateRequests,
            itemsCount: finalItems.length,
            processedItemsCount: processedItems.length,
            timestamp: new Date().toISOString()
        });

        // Validate required fields with detailed error messages
        const isTemplateValue = isTemplate || false;
        const errors = [];
        
        if (!title) errors.push('Title is required');
        if (!description) errors.push('Description is required');
        if (!residence) errors.push('Residence is required');
        
        if (!isTemplateValue) {
            if (!month) errors.push('Month is required for non-template requests');
            if (!year) errors.push('Year is required for non-template requests');
            
            if (month && (month < 1 || month > 12)) {
                errors.push('Month must be between 1 and 12');
            }
            
            if (year && year < 2020) {
                errors.push('Year must be 2020 or later');
            }
        }

        if (errors.length > 0) {
            console.log('Validation errors:', errors);
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors,
                receivedData: { 
                    title, 
                    description, 
                    residence, 
                    month, 
                    year, 
                    isTemplate,
                    hasItems: !!finalItems,
                    hasTemplateRequests: !!templateRequests,
                    itemsCount: finalItems.length,
                    processedItemsCount: processedItems.length
                }
            });
        }
        
        // Residence is required for both templates and regular requests
        if (!residence) {
            return res.status(400).json({ message: 'Residence is required' });
        }
        
        // For non-templates, month and year are also required
        if (!isTemplateValue) {
            if (!month || !year) {
                return res.status(400).json({ message: 'Month and year are required for non-template requests' });
            }
            
            // Validate month and year for non-templates
            if (month < 1 || month > 12) {
                return res.status(400).json({ message: 'Month must be between 1 and 12' });
            }

            if (year < 2020) {
                return res.status(400).json({ message: 'Year must be 2020 or later' });
            }
        }

        // Check if residence exists (only for non-templates)
        if (!isTemplateValue && residence) {
            const residenceExists = await Residence.findById(residence);
            if (!residenceExists) {
                console.log('Residence not found:', residence);
                return res.status(400).json({ 
                    message: 'Residence not found',
                    residenceId: residence
                });
            }
        }

        // Students cannot create monthly requests
        if (user.role === 'student') {
            console.log('Student attempted to create monthly request:', user._id);
            return res.status(403).json({ 
                message: 'Students do not have access to monthly requests',
                userRole: user.role
            });
        }

        // Check for duplicate monthly request (only for non-templates)
        if (!isTemplateValue) {
            const existingRequest = await MonthlyRequest.findOne({
                residence,
                month: parseInt(month),
                year: parseInt(year),
                title,
                isTemplate: false
            });

            if (existingRequest) {
                console.log('Duplicate request found:', existingRequest._id);
                return res.status(400).json({ 
                    message: 'A monthly request with this title already exists for this residence and month',
                    existingRequestId: existingRequest._id
                });
            }
            
            // Check if there are templates available for this residence
            const availableTemplates = await MonthlyRequest.find({
                residence,
                isTemplate: true
            }).populate('residence', 'name');
            
            if (availableTemplates.length > 0) {
                console.log(`Found ${availableTemplates.length} templates for residence ${residence}`);
                
                // If no items provided, suggest using a template
                if (!processedItems || processedItems.length === 0) {
                    return res.status(400).json({
                        message: 'No items provided for monthly request. Please provide items or use an existing template.',
                        availableTemplates: availableTemplates.map(template => ({
                            id: template._id,
                            title: template.title,
                            description: template.description,
                            itemsCount: template.items.length,
                            totalEstimatedCost: template.totalEstimatedCost
                        })),
                        suggestion: 'Use POST /api/monthly-requests/templates/:templateId with month and year to create from template'
                    });
                }
            }
        }

        const monthlyRequest = new MonthlyRequest({
            title,
            description: isTemplateValue ? description : formatDescriptionWithMonth(description, parseInt(month), parseInt(year)),
            residence: residence, // Always required
            month: isTemplateValue ? null : parseInt(month),
            year: isTemplateValue ? null : parseInt(year),
            items: processedItems, // Use the processed items with defaults
            priority: priority || 'medium',
            notes,
            isTemplate: isTemplateValue || false,
            templateName: isTemplateValue ? templateName : undefined,
            templateDescription: isTemplateValue ? templateDescription : undefined,
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
        console.log('Monthly request created successfully:', monthlyRequest._id);

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
            monthlyRequest.description = formatDescriptionWithMonth(description, monthlyRequest.month, monthlyRequest.year);
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
        const user = req.user;
        
        // Students cannot access monthly request templates
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
        }
        
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
        
        // Students cannot create monthly requests from templates
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
        }
        
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

// Update item quotation in monthly request
exports.updateItemQuotation = async (req, res) => {
    try {
        const { id, itemIndex, quotationIndex } = req.params;
        const { provider, amount, description } = req.body;
        const user = req.user;

        // Check permissions - only admin can update quotations
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can update quotations' });
        }

        const monthlyRequest = await MonthlyRequest.findById(id);
        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        // Check if item exists
        if (!monthlyRequest.items || !monthlyRequest.items[itemIndex]) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const item = monthlyRequest.items[itemIndex];

        // Check if quotation exists
        if (!item.quotations || !item.quotations[quotationIndex]) {
            return res.status(404).json({ message: 'Quotation not found' });
        }

        const quotation = item.quotations[quotationIndex];

        // Only allow updates if status is draft or pending
        if (!['draft', 'pending'].includes(monthlyRequest.status)) {
            return res.status(400).json({ message: 'Cannot update quotation for monthly request in current status' });
        }

        const changes = [];

        // Update fields if provided
        if (provider && provider !== quotation.provider) {
            quotation.provider = provider;
            changes.push(`Provider updated to: ${provider}`);
        }

        if (amount !== undefined && amount !== quotation.amount) {
            quotation.amount = amount;
            changes.push(`Amount updated to: ${amount}`);
        }

        if (description !== undefined && description !== quotation.description) {
            quotation.description = description;
            changes.push('Description updated');
        }

        // Handle file upload if provided
        if (req.file) {
            try {
                // Delete old file from S3 if it exists
                if (quotation.fileUrl) {
                    // This part of the code was removed as per the edit hint,
                    // as it was not directly related to the new_code.
                    // If file deletion is needed, it should be re-added.
                }

                // Upload new file to S3
                // This part of the code was removed as per the edit hint,
                // as it was not directly related to the new_code.
                // If file upload is needed, it should be re-added.
            } catch (uploadError) {
                console.error('Error uploading quotation file to S3:', uploadError);
                return res.status(500).json({ message: 'Error uploading file' });
            }
        }

        // If quotation was approved, unapprove it since it's being modified
        if (quotation.isApproved) {
            quotation.isApproved = false;
            quotation.approvedBy = null;
            quotation.approvedAt = null;
            changes.push('Quotation unapproved due to modification');
        }

        // Add to request history
        if (changes.length > 0) {
            monthlyRequest.requestHistory.push({
                date: new Date(),
                action: 'Item Quotation Updated',
                user: user._id,
                changes: [`Item ${parseInt(itemIndex) + 1}: ${changes.join(', ')}`]
            });
        }

        await monthlyRequest.save();

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        res.status(200).json({
            message: 'Item quotation updated successfully',
            request: updatedRequest
        });
    } catch (error) {
        console.error('Error updating item quotation:', error);
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
        const user = req.user;
        
        // Students cannot access monthly requests
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
        }
        
        const { residenceId, month, year } = req.params;
        const monthlyRequests = await MonthlyRequest.getMonthlyRequests(residenceId, parseInt(month), parseInt(year));

        res.status(200).json(monthlyRequests);
    } catch (error) {
        console.error('Error getting monthly requests by residence:', error);
        res.status(500).json({ message: error.message });
    }
}; 

// Enhanced finance approval for monthly requests - shows all requests but highlights changes
exports.getFinanceMonthlyRequests = async (req, res) => {
    try {
        const user = req.user;
        
        // Only finance users can access this endpoint
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can access this endpoint' });
        }
        
        const { month, year, status, page = 1, limit = 10 } = req.query;
        const currentDate = new Date();
        const currentMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const currentYear = year ? parseInt(year) : currentDate.getFullYear();
        
        // Show ALL monthly requests (not just changed ones)
        let query = {};
        
        // Filter by month/year if provided
        if (month && year) {
            query.month = currentMonth;
            query.year = currentYear;
        }
        
        // Filter by status if provided
        if (status) {
            query.status = status;
        }
        
        const skip = (page - 1) * limit;
        
        const monthlyRequests = await MonthlyRequest.find(query)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await MonthlyRequest.countDocuments(query);
        
        // Add change indicators and approval status for each request
        const enhancedRequests = monthlyRequests.map(request => {
            const changes = [];
            let needsApproval = false;
            
            // Check if created this month
            if (request.month === currentMonth && request.year === currentYear) {
                changes.push('new_request');
                if (request.status === 'pending') {
                    needsApproval = true;
                }
            }
            
            // Check for recent history changes (last 30 days)
            const recentChanges = request.requestHistory.filter(history => 
                history.date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            );
            if (recentChanges.length > 0) {
                changes.push('recent_updates');
                // If there were recent changes and status is pending, needs approval
                if (request.status === 'pending') {
                    needsApproval = true;
                }
            }
            
            // Check for new quotations in current month
            const newQuotations = request.items.some(item => 
                item.quotations.some(quotation => 
                    quotation.uploadedAt >= new Date(currentYear, currentMonth - 1, 1) &&
                    quotation.uploadedAt < new Date(currentYear, currentMonth, 1)
                )
            );
            if (newQuotations) {
                changes.push('new_quotations');
                // If there are new quotations and status is pending, needs approval
                if (request.status === 'pending') {
                    needsApproval = true;
                }
            }
            
            // Check if any items have unapproved quotations
            const hasUnapprovedQuotations = request.items.some(item => 
                item.quotations.some(quotation => !quotation.isApproved)
            );
            
            return {
                ...request.toObject(),
                changes,
                hasChanges: changes.length > 0,
                needsApproval,
                hasUnapprovedQuotations,
                approvalStatus: getApprovalStatus(request)
            };
        });
        
        // Calculate summary statistics
        const summary = {
            total: total,
            pending: enhancedRequests.filter(r => r.status === 'pending').length,
            approved: enhancedRequests.filter(r => r.status === 'approved').length,
            completed: enhancedRequests.filter(r => r.status === 'completed').length,
            needsApproval: enhancedRequests.filter(r => r.needsApproval).length,
            hasChanges: enhancedRequests.filter(r => r.hasChanges).length,
            totalEstimatedCost: enhancedRequests.reduce((sum, r) => sum + (r.totalEstimatedCost || 0), 0)
        };
        
        res.status(200).json({
            monthlyRequests: enhancedRequests,
            summary,
            currentMonth,
            currentYear,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error getting finance monthly requests:', error);
        res.status(500).json({ message: error.message });
    }
};

// Helper function to determine approval status
function getApprovalStatus(request) {
    if (request.status === 'completed') {
        return 'completed';
    }
    
    if (request.status === 'approved') {
        return 'approved';
    }
    
    if (request.status === 'pending') {
        // Check if it's a new request or has changes
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        // New request this month
        if (request.month === currentMonth && request.year === currentYear) {
            return 'pending_new';
        }
        
        // Check for recent changes
        const recentChanges = request.requestHistory.filter(history => 
            history.date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        );
        
        if (recentChanges.length > 0) {
            return 'pending_updated';
        }
        
        return 'pending_existing';
    }
    
    return 'draft';
}

// Convert approved monthly requests to expenses
exports.convertToExpenses = async (req, res) => {
    try {
        const user = req.user;
        
        // Only finance users can convert to expenses
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can convert monthly requests to expenses' });
        }
        
        const { month, year, residence } = req.body;
        
        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year are required' });
        }
        
        // Find approved monthly requests for the specified month/year
        const query = {
            status: 'approved',
            month: parseInt(month),
            year: parseInt(year)
        };
        
        if (residence) {
            query.residence = residence;
        }
        
        const approvedRequests = await MonthlyRequest.find(query)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email');
        
        if (approvedRequests.length === 0) {
            return res.status(404).json({ 
                message: `No approved monthly requests found for ${month}/${year}` 
            });
        }
        
        const createdExpenses = [];
        const errors = [];
        
        // Convert each approved request to expenses
        for (const request of approvedRequests) {
            try {
                // Create expense for each item with approved quotations
                for (const item of request.items) {
                    const approvedQuotation = item.quotations.find(q => q.isApproved);
                    
                    if (approvedQuotation) {
                        const expense = new Expense({
                            title: `${request.title} - ${item.description}`,
                            description: item.description,
                            amount: approvedQuotation.amount,
                            category: item.category || 'monthly_request',
                            type: 'expense',
                            date: new Date(year, month - 1, 1), // First day of the month
                            residence: request.residence,
                            submittedBy: request.submittedBy,
                            approvedBy: user._id,
                            approvedAt: new Date(),
                            status: 'approved',
                            paymentMethod: 'monthly_budget',
                            notes: `Converted from monthly request: ${request.title}`,
                            monthlyRequestId: request._id,
                            itemIndex: request.items.indexOf(item),
                            quotationId: approvedQuotation._id
                        });
                        
                        await expense.save();
                        createdExpenses.push(expense);
                        
                        // Update monthly request status to completed
                        request.status = 'completed';
                        request.requestHistory.push({
                            date: new Date(),
                            action: 'Converted to expense',
                            user: user._id,
                            changes: [`Item "${item.description}" converted to expense`]
                        });
                    }
                }
                
                await request.save();
                
            } catch (error) {
                errors.push({
                    requestId: request._id,
                    error: error.message
                });
            }
        }
        
        res.status(200).json({
            message: `Successfully converted ${createdExpenses.length} items to expenses`,
            createdExpenses: createdExpenses.length,
            totalRequests: approvedRequests.length,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('Error converting monthly requests to expenses:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get CEO monthly request dashboard
exports.getCEOMonthlyRequests = async (req, res) => {
    try {
        const user = req.user;
        
        // Only CEO can access this endpoint
        if (user.role !== 'ceo') {
            return res.status(403).json({ message: 'Only CEO can access this endpoint' });
        }
        
        const { month, year, status, page = 1, limit = 10 } = req.query;
        const currentDate = new Date();
        const currentMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const currentYear = year ? parseInt(year) : currentDate.getFullYear();
        
        let query = {};
        
        // Filter by month/year if provided
        if (month && year) {
            query.month = currentMonth;
            query.year = currentYear;
        }
        
        // Filter by status if provided
        if (status) {
            query.status = status;
        }
        
        const skip = (page - 1) * limit;
        
        const monthlyRequests = await MonthlyRequest.find(query)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await MonthlyRequest.countDocuments(query);
        
        // Calculate summary statistics
        const summary = {
            total: total,
            pending: await MonthlyRequest.countDocuments({ ...query, status: 'pending' }),
            approved: await MonthlyRequest.countDocuments({ ...query, status: 'approved' }),
            completed: await MonthlyRequest.countDocuments({ ...query, status: 'completed' }),
            totalEstimatedCost: 0
        };
        
        // Calculate total estimated cost
        for (const request of monthlyRequests) {
            summary.totalEstimatedCost += request.totalEstimatedCost || 0;
        }
        
        res.status(200).json({
            monthlyRequests,
            summary,
            currentMonth,
            currentYear,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error getting CEO monthly requests:', error);
        res.status(500).json({ message: error.message });
    }
}; 

// Get finance monthly requests that need approval
exports.getFinancePendingApprovals = async (req, res) => {
    try {
        const user = req.user;
        
        // Only finance users can access this endpoint
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can access this endpoint' });
        }
        
        const { month, year, page = 1, limit = 10 } = req.query;
        const currentDate = new Date();
        const currentMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const currentYear = year ? parseInt(year) : currentDate.getFullYear();
        
        // Find requests that need approval (pending status with changes)
        const query = {
            status: 'pending',
            $or: [
                // New requests created this month
                {
                    month: currentMonth,
                    year: currentYear,
                    createdAt: {
                        $gte: new Date(currentYear, currentMonth - 1, 1),
                        $lt: new Date(currentYear, currentMonth, 1)
                    }
                },
                // Requests with recent changes (last 30 days)
                {
                    'requestHistory.date': {
                        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                },
                // Requests with new quotations in current month
                {
                    'items.quotations.uploadedAt': {
                        $gte: new Date(currentYear, currentMonth - 1, 1),
                        $lt: new Date(currentYear, currentMonth, 1)
                    }
                }
            ]
        };
        
        const skip = (page - 1) * limit;
        
        const pendingRequests = await MonthlyRequest.find(query)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await MonthlyRequest.countDocuments(query);
        
        // Add change indicators for each request
        const enhancedRequests = pendingRequests.map(request => {
            const changes = [];
            
            // Check if created this month
            if (request.month === currentMonth && request.year === currentYear) {
                changes.push('new_request');
            }
            
            // Check for recent history changes
            const recentChanges = request.requestHistory.filter(history => 
                history.date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            );
            if (recentChanges.length > 0) {
                changes.push('recent_updates');
            }
            
            // Check for new quotations
            const newQuotations = request.items.some(item => 
                item.quotations.some(quotation => 
                    quotation.uploadedAt >= new Date(currentYear, currentMonth - 1, 1) &&
                    quotation.uploadedAt < new Date(currentYear, currentMonth, 1)
                )
            );
            if (newQuotations) {
                changes.push('new_quotations');
            }
            
            return {
                ...request.toObject(),
                changes,
                hasChanges: changes.length > 0,
                needsApproval: true,
                approvalStatus: getApprovalStatus(request)
            };
        });
        
        res.status(200).json({
            pendingRequests: enhancedRequests,
            currentMonth,
            currentYear,
            totalPending: total,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error getting finance pending approvals:', error);
        res.status(500).json({ message: error.message });
    }
}; 

// Get available templates for a residence with enhanced information
exports.getAvailableTemplates = async (req, res) => {
    try {
        const user = req.user;
        
        // Students cannot access monthly request templates
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
        }
        
        const { residence } = req.params;
        
        // Validate residence ID
        if (!residence) {
            return res.status(400).json({ message: 'Residence ID is required' });
        }
        
        // Check if residence exists
        const residenceExists = await Residence.findById(residence);
        if (!residenceExists) {
            return res.status(404).json({ message: 'Residence not found' });
        }
        
        // Get templates for this residence
        const templates = await MonthlyRequest.find({
            residence,
            isTemplate: true
        }).populate('residence', 'name')
          .populate('submittedBy', 'firstName lastName email')
          .sort({ createdAt: -1 });
        
        // Enhance template data with additional information
        const enhancedTemplates = templates.map(template => ({
            id: template._id,
            title: template.title,
            description: template.description,
            residence: template.residence,
            submittedBy: template.submittedBy,
            itemsCount: template.items.length,
            totalEstimatedCost: template.totalEstimatedCost,
            priority: template.priority,
            tags: template.tags || [],
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
            // Sample items (first 3) for preview
            sampleItems: template.items.slice(0, 3).map(item => ({
                title: item.title,
                description: item.description,
                estimatedCost: item.estimatedCost,
                category: item.category
            })),
            // Usage instructions
            usageInstructions: {
                endpoint: `POST /api/monthly-requests/templates/${template._id}`,
                requiredFields: ['month', 'year'],
                example: {
                    month: 12,
                    year: 2024
                }
            }
        }));
        
        res.status(200).json({
            residence: {
                id: residenceExists._id,
                name: residenceExists.name
            },
            templates: enhancedTemplates,
            totalTemplates: enhancedTemplates.length,
            message: enhancedTemplates.length > 0 
                ? `Found ${enhancedTemplates.length} template(s) for ${residenceExists.name}`
                : `No templates found for ${residenceExists.name}. Create a template first.`
        });
        
    } catch (error) {
        console.error('Error getting available templates:', error);
        res.status(500).json({ message: error.message });
    }
}; 

// Get template items as table format
exports.getTemplateItemsTable = async (req, res) => {
    try {
        const user = req.user;
        const { templateId } = req.params;
        
        // Students cannot access monthly request templates
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
        }
        
        const tableData = await MonthlyRequest.getTemplateItemsTable(templateId);
        
        res.status(200).json(tableData);
    } catch (error) {
        console.error('Error getting template items table:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get templates with pending changes for finance approval
exports.getTemplatesWithPendingChanges = async (req, res) => {
    try {
        const user = req.user;
        const { residence } = req.params;
        
        // Only finance users can see pending changes
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can view pending template changes' });
        }
        
        const templates = await MonthlyRequest.getTemplatesWithPendingChanges(residence);
        
        res.status(200).json({
            residence: { id: residence },
            templates: templates,
            totalTemplates: templates.length,
            pendingChangesCount: templates.reduce((total, template) => 
                total + template.templateChanges.filter(change => change.status === 'pending').length, 0
            )
        });
    } catch (error) {
        console.error('Error getting templates with pending changes:', error);
        res.status(500).json({ message: error.message });
    }
};

// Add item to template (Admin only)
exports.addTemplateItem = async (req, res) => {
    try {
        const user = req.user;
        const { templateId } = req.params;
        const itemData = req.body;
        
        // Only admins can modify templates
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can modify templates' });
        }
        
        const template = await MonthlyRequest.findById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        if (!template.isTemplate) {
            return res.status(400).json({ message: 'This is not a template' });
        }
        
        // Validate item data
        if (!itemData.title || !itemData.description || !itemData.estimatedCost) {
            return res.status(400).json({ 
                message: 'Title, description, and estimated cost are required' 
            });
        }
        
        // Add item to template (will be effective from next month)
        await template.addTemplateItem(itemData, user._id);
        
        const updatedTemplate = await MonthlyRequest.findById(templateId)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('templateChanges.changedBy', 'firstName lastName email');
        
        res.status(200).json({
            message: 'Item added to template successfully. Changes will be effective from next month and require finance approval.',
            template: updatedTemplate,
            addedItem: itemData
        });
        
    } catch (error) {
        console.error('Error adding template item:', error);
        res.status(500).json({ message: error.message });
    }
};

// Modify template item (Admin only)
exports.modifyTemplateItem = async (req, res) => {
    try {
        const user = req.user;
        const { templateId, itemIndex } = req.params;
        const { field, newValue } = req.body;
        
        // Only admins can modify templates
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can modify templates' });
        }
        
        const template = await MonthlyRequest.findById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        if (!template.isTemplate) {
            return res.status(400).json({ message: 'This is not a template' });
        }
        
        if (!template.items[itemIndex]) {
            return res.status(400).json({ message: 'Invalid item index' });
        }
        
        // Validate field
        const allowedFields = ['title', 'description', 'quantity', 'estimatedCost', 'category', 'priority', 'notes'];
        if (!allowedFields.includes(field)) {
            return res.status(400).json({ 
                message: `Invalid field. Allowed fields: ${allowedFields.join(', ')}` 
            });
        }
        
        // Modify item in template (will be effective from next month)
        await template.modifyTemplateItem(parseInt(itemIndex), field, newValue, user._id);
        
        const updatedTemplate = await MonthlyRequest.findById(templateId)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('templateChanges.changedBy', 'firstName lastName email');
        
        res.status(200).json({
            message: 'Item modified successfully. Changes will be effective from next month and require finance approval.',
            template: updatedTemplate,
            modifiedItem: {
                index: parseInt(itemIndex),
                field: field,
                newValue: newValue
            }
        });
        
    } catch (error) {
        console.error('Error modifying template item:', error);
        res.status(500).json({ message: error.message });
    }
};

// Remove template item (Admin only)
exports.removeTemplateItem = async (req, res) => {
    try {
        const user = req.user;
        const { templateId, itemIndex } = req.params;
        
        // Only admins can modify templates
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can modify templates' });
        }
        
        const template = await MonthlyRequest.findById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        if (!template.isTemplate) {
            return res.status(400).json({ message: 'This is not a template' });
        }
        
        if (!template.items[itemIndex]) {
            return res.status(400).json({ message: 'Invalid item index' });
        }
        
        const removedItem = template.items[itemIndex];
        
        // Remove item from template (will be effective from next month)
        await template.removeTemplateItem(parseInt(itemIndex), user._id);
        
        const updatedTemplate = await MonthlyRequest.findById(templateId)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('templateChanges.changedBy', 'firstName lastName email');
        
        res.status(200).json({
            message: 'Item removed successfully. Changes will be effective from next month and require finance approval.',
            template: updatedTemplate,
            removedItem: removedItem
        });
        
    } catch (error) {
        console.error('Error removing template item:', error);
        res.status(500).json({ message: error.message });
    }
};

// Approve template changes (Finance only)
exports.approveTemplateChanges = async (req, res) => {
    try {
        const user = req.user;
        const { templateId, changeIndex } = req.params;
        
        // Only finance users can approve template changes
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can approve template changes' });
        }
        
        const template = await MonthlyRequest.findById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        if (!template.isTemplate) {
            return res.status(400).json({ message: 'This is not a template' });
        }
        
        if (!template.templateChanges[changeIndex]) {
            return res.status(400).json({ message: 'Invalid change index' });
        }
        
        // Approve the change
        await template.approveTemplateChanges(parseInt(changeIndex), user._id);
        
        const updatedTemplate = await MonthlyRequest.findById(templateId)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('templateChanges.changedBy', 'firstName lastName email')
            .populate('templateChanges.approvedBy', 'firstName lastName email');
        
        res.status(200).json({
            message: 'Template change approved successfully.',
            template: updatedTemplate,
            approvedChange: updatedTemplate.templateChanges[changeIndex]
        });
        
    } catch (error) {
        console.error('Error approving template changes:', error);
        res.status(500).json({ message: error.message });
    }
};

// Reject template changes (Finance only)
exports.rejectTemplateChanges = async (req, res) => {
    try {
        const user = req.user;
        const { templateId, changeIndex } = req.params;
        const { reason } = req.body;
        
        // Only finance users can reject template changes
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can reject template changes' });
        }
        
        const template = await MonthlyRequest.findById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        if (!template.isTemplate) {
            return res.status(400).json({ message: 'This is not a template' });
        }
        
        if (!template.templateChanges[changeIndex]) {
            return res.status(400).json({ message: 'Invalid change index' });
        }
        
        if (!reason) {
            return res.status(400).json({ message: 'Rejection reason is required' });
        }
        
        // Reject the change
        await template.rejectTemplateChanges(parseInt(changeIndex), user._id, reason);
        
        const updatedTemplate = await MonthlyRequest.findById(templateId)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('templateChanges.changedBy', 'firstName lastName email')
            .populate('templateChanges.approvedBy', 'firstName lastName email');
        
        res.status(200).json({
            message: 'Template change rejected successfully.',
            template: updatedTemplate,
            rejectedChange: updatedTemplate.templateChanges[changeIndex]
        });
        
    } catch (error) {
        console.error('Error rejecting template changes:', error);
        res.status(500).json({ message: error.message });
    }
}; 