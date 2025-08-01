const Request = require('../models/Request');
const Expense = require('../models/finance/Expense');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Account = require('../models/Account');
const { generateUniqueId } = require('../utils/idGenerator');
const { uploadToS3 } = require('../utils/fileStorage');
const { s3, s3Configs } = require('../config/s3');
const { findSimilarRequests, generateSimilarityQuery } = require('../utils/requestSimilarity');

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
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('quotations.approvedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
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
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
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
        const { 
            title, 
            description, 
            type, 
            residence, 
            room, 
            category, 
            priority, 
            amount, 
            dueDate, 
            tags, 
            images,
            // Non-student specific fields
            department,
            requestedBy,
            items,
            proposedVendor,
            deliveryLocation
        } = req.body;
        
        const user = req.user;
        
        // Parse items if it's a string (from FormData)
        let parsedItems = items;
        if (typeof items === 'string') {
            try {
                parsedItems = JSON.parse(items);
            } catch (error) {
                console.error('Error parsing items:', error);
                return res.status(400).json({ message: 'Invalid items format' });
            }
        }
        
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
        
        // Validate non-student specific fields
        if (user.role !== 'student' && type !== 'maintenance') {
            if (!department) {
                return res.status(400).json({ message: 'Department is required for non-student requests' });
            }
            if (!requestedBy) {
                return res.status(400).json({ message: 'Requested by is required for non-student requests' });
            }
            if (!deliveryLocation) {
                return res.status(400).json({ message: 'Delivery location is required for non-student requests' });
            }
            if (!parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) {
                return res.status(400).json({ message: 'At least one item/service is required for non-student requests' });
            }
            
            // Validate each item and handle file uploads for quotations
            for (let i = 0; i < parsedItems.length; i++) {
                const item = parsedItems[i];
                if (!item.description) {
                    return res.status(400).json({ message: `Item ${i + 1}: Description is required` });
                }
                if (!item.quantity || item.quantity < 1) {
                    return res.status(400).json({ message: `Item ${i + 1}: Quantity must be at least 1` });
                }
                // Unit cost validation removed - allowing any value including negative
                
                // Handle unitCost if it's undefined/null
                if (item.unitCost === undefined || item.unitCost === null) {
                    item.unitCost = 0;
                }
                
                // Calculate total cost for this item
                item.totalCost = (item.unitCost || 0) * item.quantity;
                
                // Handle quotations with file uploads
                if (item.quotations && Array.isArray(item.quotations)) {
                    for (let j = 0; j < item.quotations.length; j++) {
                        const quotation = item.quotations[j];
                        
                        // Find uploaded file for this quotation
                        const uploadedFile = req.files ? req.files.find(file => 
                            file.fieldname === `items[${i}].quotations[${j}].file` ||
                            file.fieldname === `quotation_${i}_${j}`
                        ) : null;
                        
                        // If quotation has a file, upload it to S3
                        if (uploadedFile) {
                            try {
                                const s3Key = `request_quotations/${user._id}_${Date.now()}_${uploadedFile.originalname}`;
                                const s3UploadParams = {
                                    Bucket: s3Configs.requestQuotations.bucket,
                                    Key: s3Key,
                                    Body: uploadedFile.buffer,
                                    ContentType: uploadedFile.mimetype,
                                    ACL: s3Configs.requestQuotations.acl,
                                    Metadata: {
                                        fieldName: 'quotation',
                                        uploadedBy: user._id.toString(),
                                        uploadDate: new Date().toISOString()
                                    }
                                };
                                
                                const s3Result = await s3.upload(s3UploadParams).promise();
                                
                                // Update quotation with S3 URL
                                quotation.fileUrl = s3Result.Location;
                                quotation.fileName = uploadedFile.originalname;
                                quotation.uploadedBy = user._id;
                                quotation.uploadedAt = new Date();
                            } catch (uploadError) {
                                console.error('Error uploading quotation file to S3:', uploadError);
                                return res.status(500).json({ 
                                    message: `Error uploading file for item ${i + 1}, quotation ${j + 1}` 
                                });
                            }
                        }

                        // Auto-create vendor if provider name is provided and no vendorId exists
                        if (quotation.provider && !quotation.vendorId) {
                            try {
                                // Determine category from request type or item description
                                let vendorCategory = 'other';
                                if (type === 'maintenance') {
                                    vendorCategory = 'maintenance';
                                } else if (item.description) {
                                    const description = item.description.toLowerCase();
                                    if (description.includes('plumbing') || description.includes('pipe') || description.includes('drain')) {
                                        vendorCategory = 'plumbing';
                                    } else if (description.includes('electrical') || description.includes('wiring') || description.includes('power')) {
                                        vendorCategory = 'electrical';
                                    } else if (description.includes('cleaning') || description.includes('clean')) {
                                        vendorCategory = 'cleaning';
                                    } else if (description.includes('security') || description.includes('guard')) {
                                        vendorCategory = 'security';
                                    } else if (description.includes('landscaping') || description.includes('garden')) {
                                        vendorCategory = 'landscaping';
                                    }
                                }

                                // Auto-create vendor
                                const vendor = await autoCreateVendor(quotation.provider, user, vendorCategory);
                                
                                // Update quotation with vendor information
                                quotation.vendorId = vendor._id;
                                quotation.vendorCode = vendor.chartOfAccountsCode;
                                quotation.vendorName = vendor.businessName;
                                quotation.vendorType = vendor.vendorType;
                                quotation.vendorContact = {
                                    firstName: vendor.contactPerson.firstName,
                                    lastName: vendor.contactPerson.lastName,
                                    email: vendor.contactPerson.email,
                                    phone: vendor.contactPerson.phone
                                };
                                quotation.expenseCategory = vendor.expenseCategory;
                                // Add payment method information
                                quotation.paymentMethod = determinePaymentMethod(vendor);
                                quotation.hasBankDetails = !!(vendor.bankDetails && vendor.bankDetails.bankName);
                                
                                console.log(`Auto-linked quotation to vendor: ${vendor.businessName} (${vendor._id})`);
                            } catch (vendorError) {
                                console.error('Error auto-creating vendor:', vendorError);
                                // Continue without vendor creation - don't fail the request
                            }
                        }
                    }
                }
            }
        }
        
        // Enhanced duplicate request detection
        let duplicateCheckQuery = {};
        
        if (user.role === 'student') {
            // For students: Check for similar requests by ANY student in the same residence
            // This prevents students from creating duplicate requests
            duplicateCheckQuery = {
                title: { $regex: new RegExp(title, 'i') }, // Case-insensitive title match
                description: { $regex: new RegExp(description, 'i') }, // Case-insensitive description match
                type: type,
                residence: residence,
                submittedBy: { $ne: user._id }, // Exclude current user's own requests
                status: { $in: ['pending', 'assigned', 'in-progress'] },
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
            };
            
            const existingRequest = await Request.findOne(duplicateCheckQuery);
            
            if (existingRequest) {
                return res.status(400).json({ 
                    message: 'A similar request already exists in your residence. Please check existing requests before submitting a new one.',
                    existingRequestId: existingRequest._id
                });
            }
        }
        // For non-students: No duplicate checking - allow multiple requests by same user
        
        // Build request data
        const requestData = {
            title,
            description,
            type,
            submittedBy: user._id,
            residence,
            priority: priority || 'medium',
            status: 'pending',
            amount: amount || 0,
            dueDate: dueDate ? new Date(dueDate) : null,
            tags: tags || []
        };
        
        // Add role-specific fields
        if (user.role === 'student') {
            // Student maintenance request
            requestData.room = room;
            requestData.category = category;
        } else {
            // Non-student request
            requestData.department = department;
            requestData.requestedBy = requestedBy;
            requestData.items = parsedItems;
            requestData.proposedVendor = proposedVendor;
            requestData.deliveryLocation = deliveryLocation;
            
            // Calculate total estimated cost
            if (parsedItems && parsedItems.length > 0) {
                requestData.totalEstimatedCost = parsedItems.reduce((total, item) => {
                    return total + (item.estimatedCost * item.quantity);
                }, 0);
            }
        }
        
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
                    approvedByEmail: user.email,
                    approvedAt: new Date()
                },
                finance: {
                    approved: false
                },
                ceo: {
                    approved: false
                }
            };
            requestData.status = 'pending';
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
        console.error('Error creating request:', error);
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
        if (request.status !== 'pending') {
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
        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request is not pending approval' });
        }
        
        request.approval.admin = {
            approved,
            approvedBy: user._id,
            approvedByEmail: user.email,
            approvedAt: new Date(),
            notes
        };
        
        // Update status based on approval
        if (approved) {
            request.status = 'pending';
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
        const { 
            approved, 
            notes, 
            rejected, 
            waitlisted, 
            quotationUpdates,
            selectedQuotationId 
        } = req.body;
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
        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request is not pending approval' });
        }
        
        // Build approval object based on action type
        const approvalData = {
            approved: approved || false,
            approvedBy: user._id,
            approvedByEmail: user.email,
            approvedAt: new Date(),
            notes
        };
        
        // Add rejection data if rejected
        if (rejected) {
            approvalData.rejected = true;
            approvalData.rejectedBy = user._id;
            approvalData.rejectedAt = new Date();
            approvalData.rejectedByEmail = user.email;
        }
        
        // Add waitlist data if waitlisted
        if (waitlisted) {
            approvalData.waitlisted = true;
            approvalData.waitlistedBy = user._id;
            approvalData.waitlistedAt = new Date();
            approvalData.waitlistedByEmail = user.email;
        }
        
        request.approval.finance = approvalData;
        
        // Update financeStatus field
        if (approved) {
            request.financeStatus = 'approved';
            request.status = 'pending-ceo-approval';
        } else if (rejected) {
            request.financeStatus = 'rejected';
            request.status = 'rejected';
        } else if (waitlisted) {
            request.financeStatus = 'waitlisted';
            request.status = 'waitlisted';
        }
        
        // Handle quotation updates if provided
        if (quotationUpdates && Array.isArray(quotationUpdates)) {
            for (const update of quotationUpdates) {
                const { quotationId, isApproved, approvedBy, approvedAt } = update;
                
                // Find and update request-level quotations
                const requestQuotation = request.quotations.id(quotationId);
                if (requestQuotation) {
                    requestQuotation.isApproved = isApproved;
                    requestQuotation.approvedBy = approvedBy || user._id;
                    requestQuotation.approvedAt = approvedAt ? new Date(approvedAt) : new Date();
                    
                    // Update request amount if quotation is approved
                    if (isApproved) {
                        request.amount = requestQuotation.amount;
                    }
                }
                
                // Find and update item-level quotations
                if (request.items && request.items.length > 0) {
                    for (const item of request.items) {
                        if (item.quotations && item.quotations.length > 0) {
                            const itemQuotation = item.quotations.id(quotationId);
                            if (itemQuotation) {
                                itemQuotation.isApproved = isApproved;
                                itemQuotation.approvedBy = approvedBy || user._id;
                                itemQuotation.approvedAt = approvedAt ? new Date(approvedAt) : new Date();
                                
                                // Update item's estimated cost if quotation is approved
                                if (isApproved) {
                                    item.estimatedCost = itemQuotation.amount;
                                }
                            }
                        }
                    }
                    
                    // Recalculate total estimated cost
                    request.totalEstimatedCost = request.items.reduce((total, item) => {
                        return total + (item.estimatedCost * item.quantity);
                    }, 0);
                }
            }
        }
        
        // Handle selected quotation if provided (for backward compatibility)
        if (selectedQuotationId && approved) {
            // Unapprove all quotations first
            if (request.quotations && request.quotations.length > 0) {
                request.quotations.forEach(quotation => {
                    quotation.isApproved = false;
                    quotation.approvedBy = null;
                    quotation.approvedAt = null;
                });
            }
            
            if (request.items && request.items.length > 0) {
                request.items.forEach(item => {
                    if (item.quotations && item.quotations.length > 0) {
                        item.quotations.forEach(quotation => {
                            quotation.isApproved = false;
                            quotation.approvedBy = null;
                            quotation.approvedAt = null;
                        });
                    }
                });
            }
            
            // Approve the selected quotation
            const selectedQuotation = request.quotations.id(selectedQuotationId);
            if (selectedQuotation) {
                selectedQuotation.isApproved = true;
                selectedQuotation.approvedBy = user._id;
                selectedQuotation.approvedAt = new Date();
                request.amount = selectedQuotation.amount;
            }
        }
        
        // Add to request history
        let actionDescription = 'Finance approval';
        if (rejected) actionDescription = 'Finance rejection';
        if (waitlisted) actionDescription = 'Finance waitlist';
        
        request.requestHistory.push({
            date: new Date(),
            action: actionDescription,
            user: user._id,
            changes: [`Finance ${approved ? 'approved' : rejected ? 'rejected' : waitlisted ? 'waitlisted' : 'updated'} the request`]
        });
        
        await request.save();
        
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('quotations.approvedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
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
        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request is not pending approval' });
        }
        
        request.approval.ceo = {
            approved,
            approvedBy: user._id,
            approvedByEmail: user.email,
            approvedAt: new Date(),
            notes
        };
        
        // Update status based on approval
        if (approved) {
            request.status = 'completed';
            
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
        console.log('=== Upload Quotation Debug ===');
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);
        console.log('Request headers:', req.headers);
        
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
        
        // Check if file was uploaded or if file URL is provided
        let fileUrl = '';
        let fileName = '';
        
        if (req.file) {
            // File was uploaded via FormData - upload to S3
            console.log('File uploaded via FormData');
            try {
                const s3Key = `request_quotations/${user._id}_${Date.now()}_${req.file.originalname}`;
                const s3UploadParams = {
                    Bucket: s3Configs.requestQuotations.bucket,
                    Key: s3Key,
                    Body: req.file.buffer,
                    ContentType: req.file.mimetype,
                    ACL: s3Configs.requestQuotations.acl,
                    Metadata: {
                        fieldName: 'quotation',
                        uploadedBy: user._id.toString(),
                        uploadDate: new Date().toISOString()
                    }
                };
                
                const s3Result = await s3.upload(s3UploadParams).promise();
                fileUrl = s3Result.Location;
                fileName = req.file.originalname;
                console.log('File uploaded to S3:', fileUrl);
            } catch (uploadError) {
                console.error('Error uploading file to S3:', uploadError);
                return res.status(500).json({ message: 'Error uploading file to S3' });
            }
        } else if (req.body.fileUrl) {
            // File URL was provided via JSON
            console.log('File URL provided via JSON');
            fileUrl = req.body.fileUrl;
            fileName = req.body.fileName || 'uploaded-file';
        } else if (req.body.file && typeof req.body.file === 'object' && Object.keys(req.body.file).length === 0) {
            // Frontend sent empty file object - this is a common pattern when no file is selected
            console.log('Empty file object received - treating as no file');
            return res.status(400).json({ 
                message: 'Please select a file to upload or provide a file URL',
                debug: {
                    contentType: req.headers['content-type'],
                    bodyKeys: Object.keys(req.body),
                    hasFile: !!req.file,
                    hasFileUrl: !!req.body.fileUrl,
                    fileObject: req.body.file
                }
            });
        } else {
            console.log('No file found in request');
            console.log('Content-Type header:', req.headers['content-type']);
            console.log('Request body keys:', Object.keys(req.body));
            console.log('File object:', req.body.file);
            return res.status(400).json({ 
                message: 'No file uploaded or file URL provided',
                debug: {
                    contentType: req.headers['content-type'],
                    bodyKeys: Object.keys(req.body),
                    hasFile: !!req.file,
                    hasFileUrl: !!req.body.fileUrl,
                    fileObject: req.body.file
                }
            });
        }
        
        // Check quotation limit (max 3)
        if (request.quotations.length >= 3) {
            return res.status(400).json({ message: 'Maximum of 3 quotations allowed' });
        }
        
        // Auto-create vendor if provider name is provided and no vendorId exists
        let vendor = null;
        if (provider && !req.body.vendorId) {
            try {
                // Determine category from request type or description
                let vendorCategory = 'other';
                if (request.type === 'maintenance') {
                    vendorCategory = 'maintenance';
                } else if (request.description) {
                    const description = request.description.toLowerCase();
                    if (description.includes('plumbing') || description.includes('pipe') || description.includes('drain')) {
                        vendorCategory = 'plumbing';
                    } else if (description.includes('electrical') || description.includes('wiring') || description.includes('power')) {
                        vendorCategory = 'electrical';
                    } else if (description.includes('cleaning') || description.includes('clean')) {
                        vendorCategory = 'cleaning';
                    } else if (description.includes('security') || description.includes('guard')) {
                        vendorCategory = 'security';
                    } else if (description.includes('landscaping') || description.includes('garden')) {
                        vendorCategory = 'landscaping';
                    }
                }

                // Auto-create vendor
                vendor = await autoCreateVendor(provider, user, vendorCategory);
                console.log(`Auto-created vendor for quotation: ${provider} (${vendor._id})`);
            } catch (vendorError) {
                console.error('Error auto-creating vendor:', vendorError);
                // Continue without vendor creation - don't fail the quotation upload
            }
        }

        const quotation = {
            provider,
            amount: parseFloat(amount),
            description,
            fileUrl: fileUrl,
            fileName: fileName,
            uploadedBy: user._id,
            uploadedAt: new Date(),
            validUntil: validUntil ? new Date(validUntil) : null,
            terms,
            // Add vendor information if vendor was created
            ...(vendor && {
                vendorId: vendor._id,
                vendorCode: vendor.chartOfAccountsCode,
                vendorName: vendor.businessName,
                vendorType: vendor.vendorType,
                vendorContact: {
                    firstName: vendor.contactPerson.firstName,
                    lastName: vendor.contactPerson.lastName,
                    email: vendor.contactPerson.email,
                    phone: vendor.contactPerson.phone
                },
                expenseCategory: vendor.expenseCategory,
                paymentMethod: determinePaymentMethod(vendor),
                hasBankDetails: !!(vendor.bankDetails && vendor.bankDetails.bankName)
            })
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

// Get quotations for a request (CEO and Finance can view)
exports.getRequestQuotations = async (req, res) => {
    try {
        const user = req.user;
        
        const request = await Request.findById(req.params.id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('quotations.approvedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email');
        
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Check permissions - CEO and Finance can view quotations
        if (user.role !== 'admin' && user.role !== 'finance' && user.role !== 'finance_admin' && user.role !== 'finance_user' && user.role !== 'ceo') {
            return res.status(403).json({ message: 'Access denied. Only admin, finance, and CEO users can view quotations.' });
        }
        
        // Prepare quotation data
        const quotationData = {
            requestId: request._id,
            requestTitle: request.title,
            requestType: request.type,
            submittedBy: request.submittedBy,
            residence: request.residence,
            status: request.status,
            totalEstimatedCost: request.totalEstimatedCost,
            requestLevelQuotations: request.quotations || [],
            itemLevelQuotations: []
        };
        
        // Add item-level quotations
        if (request.items && request.items.length > 0) {
            request.items.forEach((item, itemIndex) => {
                if (item.quotations && item.quotations.length > 0) {
                    quotationData.itemLevelQuotations.push({
                        itemIndex: itemIndex,
                        itemDescription: item.description,
                        itemQuantity: item.quantity,
                        itemEstimatedCost: item.estimatedCost,
                        quotations: item.quotations
                    });
                }
            });
        }
        
        res.status(200).json(quotationData);
    } catch (error) {
        console.error('Error getting request quotations:', error);
        res.status(500).json({ message: error.message });
    }
};

// Add quotation to specific item in request
exports.addItemQuotation = async (req, res) => {
    try {
        console.log('=== Add Item Quotation Debug ===');
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);
        console.log('Request headers:', req.headers);
        
        const { provider, amount, description } = req.body;
        const { itemIndex } = req.params;
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Check permissions - only admins can add quotations
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can add quotations' });
        }
        
        // Validate item index
        if (!request.items || itemIndex < 0 || itemIndex >= request.items.length) {
            return res.status(400).json({ message: 'Invalid item index' });
        }
        
        // Validate required fields
        if (!provider || !amount) {
            return res.status(400).json({ message: 'Provider and amount are required' });
        }
        
        // Handle file upload or file URL
        let fileUrl = '';
        let fileName = '';
        
        if (req.file) {
            // File was uploaded via FormData - upload to S3
            console.log('File uploaded via FormData');
            try {
                const s3Key = `request_quotations/${user._id}_${Date.now()}_${req.file.originalname}`;
                const s3UploadParams = {
                    Bucket: s3Configs.requestQuotations.bucket,
                    Key: s3Key,
                    Body: req.file.buffer,
                    ContentType: req.file.mimetype,
                    ACL: s3Configs.requestQuotations.acl,
                    Metadata: {
                        fieldName: 'quotation',
                        uploadedBy: user._id.toString(),
                        uploadDate: new Date().toISOString()
                    }
                };
                
                const s3Result = await s3.upload(s3UploadParams).promise();
                fileUrl = s3Result.Location;
                fileName = req.file.originalname;
                console.log('File uploaded to S3:', fileUrl);
            } catch (uploadError) {
                console.error('Error uploading file to S3:', uploadError);
                return res.status(500).json({ message: 'Error uploading file to S3' });
            }
        } else if (req.body.fileUrl) {
            // File URL was provided via JSON
            console.log('File URL provided via JSON');
            fileUrl = req.body.fileUrl;
            fileName = req.body.fileName || 'uploaded-file';
        } else if (req.body.file && typeof req.body.file === 'object' && Object.keys(req.body.file).length === 0) {
            // Frontend sent empty file object - this is a common pattern when no file is selected
            console.log('Empty file object received - treating as no file');
            return res.status(400).json({ 
                message: 'Please select a file to upload or provide a file URL',
                debug: {
                    contentType: req.headers['content-type'],
                    bodyKeys: Object.keys(req.body),
                    hasFile: !!req.file,
                    hasFileUrl: !!req.body.fileUrl,
                    fileObject: req.body.file
                }
            });
        } else {
            console.log('No file found in request');
            console.log('Content-Type header:', req.headers['content-type']);
            console.log('Request body keys:', Object.keys(req.body));
            console.log('File object:', req.body.file);
            return res.status(400).json({ 
                message: 'Quotation file is required (either upload file or provide fileUrl)',
                debug: {
                    contentType: req.headers['content-type'],
                    bodyKeys: Object.keys(req.body),
                    hasFile: !!req.file,
                    hasFileUrl: !!req.body.fileUrl,
                    fileObject: req.body.file
                }
            });
        }
        
        // Auto-create vendor if provider name is provided and no vendorId exists
        let vendor = null;
        if (provider && !req.body.vendorId) {
            try {
                // Determine category from request type or item description
                let vendorCategory = 'other';
                if (request.type === 'maintenance') {
                    vendorCategory = 'maintenance';
                } else if (request.items[itemIndex].description) {
                    const description = request.items[itemIndex].description.toLowerCase();
                    if (description.includes('plumbing') || description.includes('pipe') || description.includes('drain')) {
                        vendorCategory = 'plumbing';
                    } else if (description.includes('electrical') || description.includes('wiring') || description.includes('power')) {
                        vendorCategory = 'electrical';
                    } else if (description.includes('cleaning') || description.includes('clean')) {
                        vendorCategory = 'cleaning';
                    } else if (description.includes('security') || description.includes('guard')) {
                        vendorCategory = 'security';
                    } else if (description.includes('landscaping') || description.includes('garden')) {
                        vendorCategory = 'landscaping';
                    }
                }

                // Auto-create vendor
                vendor = await autoCreateVendor(provider, user, vendorCategory);
                console.log(`Auto-created vendor for item quotation: ${provider} (${vendor._id})`);
            } catch (vendorError) {
                console.error('Error auto-creating vendor:', vendorError);
                // Continue without vendor creation - don't fail the quotation upload
            }
        }

        // Add quotation to the specific item
        const quotation = {
            provider,
            amount: parseFloat(amount),
            description: description || '',
            fileUrl,
            fileName,
            uploadedBy: user._id,
            uploadedAt: new Date(),
            isApproved: false,
            // Add vendor information if vendor was created
            ...(vendor && {
                vendorId: vendor._id,
                vendorCode: vendor.chartOfAccountsCode,
                vendorName: vendor.businessName,
                vendorType: vendor.vendorType,
                vendorContact: {
                    firstName: vendor.contactPerson.firstName,
                    lastName: vendor.contactPerson.lastName,
                    email: vendor.contactPerson.email,
                    phone: vendor.contactPerson.phone
                },
                expenseCategory: vendor.expenseCategory,
                paymentMethod: determinePaymentMethod(vendor),
                hasBankDetails: !!(vendor.bankDetails && vendor.bankDetails.bankName)
            })
        };
        
        request.items[itemIndex].quotations.push(quotation);
        
        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'Item quotation added',
            user: user._id,
            changes: [`Quotation added for item: ${request.items[itemIndex].description}`]
        });
        
        await request.save();
        
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
            .populate('residence', 'name');
        
        res.status(201).json(updatedRequest);
    } catch (error) {
        console.error('Error adding item quotation:', error);
        res.status(500).json({ message: error.message });
    }
};

// Approve quotation for specific item
exports.approveItemQuotation = async (req, res) => {
    try {
        const { itemIndex, quotationIndex } = req.params;
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Check permissions - only admins and finance users can approve quotations
        if (user.role !== 'admin' && user.role !== 'finance' && user.role !== 'finance_admin' && user.role !== 'finance_user') {
            return res.status(403).json({ message: 'Only admins and finance users can approve quotations' });
        }
        
        // Validate indices
        if (!request.items || itemIndex < 0 || itemIndex >= request.items.length) {
            return res.status(400).json({ message: 'Invalid item index' });
        }
        
        const item = request.items[itemIndex];
        if (!item.quotations || quotationIndex < 0 || quotationIndex >= item.quotations.length) {
            return res.status(400).json({ message: 'Invalid quotation index' });
        }
        
        // Unapprove all other quotations for this item
        item.quotations.forEach((quotation, index) => {
            quotation.isApproved = false;
            quotation.approvedBy = null;
            quotation.approvedAt = null;
        });
        
        // Approve the selected quotation
        item.quotations[quotationIndex].isApproved = true;
        item.quotations[quotationIndex].approvedBy = user._id;
        item.quotations[quotationIndex].approvedAt = new Date();
        
        // Update item's estimated cost to the approved quotation amount
        item.estimatedCost = item.quotations[quotationIndex].amount;
        
        // Recalculate total estimated cost
        if (request.items && request.items.length > 0) {
            request.totalEstimatedCost = request.items.reduce((total, item) => {
                return total + (item.estimatedCost * item.quantity);
            }, 0);
        }
        
        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'Item quotation approved',
            user: user._id,
            changes: [`Quotation approved for item: ${item.description}`]
        });
        
        await request.save();
        
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
            .populate('residence', 'name');
        
        res.status(200).json(updatedRequest);
    } catch (error) {
        console.error('Error approving item quotation:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update request-level quotation
exports.updateRequestQuotation = async (req, res) => {
    try {
        const { id, quotationId } = req.params;
        const { provider, amount, description } = req.body;
        const user = req.user;

        // Check permissions - only admin can update quotations
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can update quotations' });
        }

        const request = await Request.findById(id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Find the quotation
        const quotation = request.quotations.id(quotationId);
        if (!quotation) {
            return res.status(404).json({ message: 'Quotation not found' });
        }

        // Only allow updates if request is still pending or approved by admin
        if (!['pending', 'admin-approved'].includes(request.status)) {
            return res.status(400).json({ message: 'Cannot update quotation for request in current status' });
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
                    const oldKey = quotation.fileUrl.split(`${s3Configs.requestQuotations.bucket}.s3.amazonaws.com/`)[1];
                    if (oldKey) {
                        await s3.deleteObject({
                            Bucket: s3Configs.requestQuotations.bucket,
                            Key: oldKey
                        }).promise();
                    }
                }

                // Upload new file to S3
                const s3Key = `request_quotations/${user._id}_${Date.now()}_${req.file.originalname}`;
                const s3UploadParams = {
                    Bucket: s3Configs.requestQuotations.bucket,
                    Key: s3Key,
                    Body: req.file.buffer,
                    ContentType: req.file.mimetype,
                    ACL: s3Configs.requestQuotations.acl,
                    Metadata: {
                        fieldName: 'quotation',
                        uploadedBy: user._id.toString(),
                        uploadDate: new Date().toISOString(),
                        action: 'updated'
                    }
                };

                const s3Result = await s3.upload(s3UploadParams).promise();

                // Update quotation with new file info
                quotation.fileUrl = s3Result.Location;
                quotation.fileName = req.file.originalname;
                quotation.uploadedBy = user._id;
                quotation.uploadedAt = new Date();
                changes.push(`File updated to: ${req.file.originalname}`);
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
            request.requestHistory.push({
                date: new Date(),
                action: 'Quotation Updated',
                user: user._id,
                changes
            });
        }

        await request.save();

        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('quotations.approvedBy', 'firstName lastName email');

        res.status(200).json({
            message: 'Quotation updated successfully',
            request: updatedRequest
        });
    } catch (error) {
        console.error('Error updating quotation:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update item-level quotation
exports.updateItemQuotation = async (req, res) => {
    try {
        const { id, itemIndex, quotationIndex } = req.params;
        const { provider, amount, description } = req.body;
        const user = req.user;

        // Check permissions - only admin can update quotations
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can update quotations' });
        }

        const request = await Request.findById(id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Check if item exists
        if (!request.items || !request.items[itemIndex]) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const item = request.items[itemIndex];

        // Check if quotation exists
        if (!item.quotations || !item.quotations[quotationIndex]) {
            return res.status(404).json({ message: 'Quotation not found' });
        }

        const quotation = item.quotations[quotationIndex];

        // Only allow updates if request is still pending or approved by admin
        if (!['pending', 'admin-approved'].includes(request.status)) {
            return res.status(400).json({ message: 'Cannot update quotation for request in current status' });
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
                    const oldKey = quotation.fileUrl.split(`${s3Configs.requestQuotations.bucket}.s3.amazonaws.com/`)[1];
                    if (oldKey) {
                        await s3.deleteObject({
                            Bucket: s3Configs.requestQuotations.bucket,
                            Key: oldKey
                        }).promise();
                    }
                }

                // Upload new file to S3
                const s3Key = `request_quotations/${user._id}_${Date.now()}_${req.file.originalname}`;
                const s3UploadParams = {
                    Bucket: s3Configs.requestQuotations.bucket,
                    Key: s3Key,
                    Body: req.file.buffer,
                    ContentType: req.file.mimetype,
                    ACL: s3Configs.requestQuotations.acl,
                    Metadata: {
                        fieldName: 'quotation',
                        uploadedBy: user._id.toString(),
                        uploadDate: new Date().toISOString(),
                        action: 'updated',
                        itemIndex: itemIndex
                    }
                };

                const s3Result = await s3.upload(s3UploadParams).promise();

                // Update quotation with new file info
                quotation.fileUrl = s3Result.Location;
                quotation.fileName = req.file.originalname;
                quotation.uploadedBy = user._id;
                quotation.uploadedAt = new Date();
                changes.push(`File updated to: ${req.file.originalname}`);
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
            request.requestHistory.push({
                date: new Date(),
                action: 'Item Quotation Updated',
                user: user._id,
                changes: [`Item ${parseInt(itemIndex) + 1}: ${changes.join(', ')}`]
            });
        }

        await request.save();

        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('quotations.approvedBy', 'firstName lastName email');

        res.status(200).json({
            message: 'Item quotation updated successfully',
            request: updatedRequest
        });
    } catch (error) {
        console.error('Error updating item quotation:', error);
        res.status(500).json({ message: error.message });
    }
};

// Check for similar requests before submission
exports.checkSimilarRequests = async (req, res) => {
    try {
        const { title, description, type, residence } = req.body;
        const user = req.user;
        
        if (!title || !description || !type) {
            return res.status(400).json({ 
                message: 'Missing required fields: title, description, type' 
            });
        }
        
        // Validate residence for students
        if (user.role === 'student') {
            if (!residence) {
                return res.status(400).json({ 
                    message: 'Residence is required for student requests' 
                });
            }
            if (!user.residence || residence.toString() !== user.residence.toString()) {
                return res.status(400).json({ 
                    message: 'Students can only check requests for their assigned residence' 
                });
            }
        }
        
        // Generate query to find potentially similar requests
        const requestData = { title, description, type, residence };
        const query = generateSimilarityQuery(requestData, user);
        
        // Find existing requests that might be similar
        const existingRequests = await Request.find(query)
            .populate('submittedBy', 'firstName lastName email')
            .populate('residence', 'name')
            .sort({ createdAt: -1 })
            .limit(20); // Limit to recent requests for performance
        
        // Find similar requests using the utility function
        const similarRequests = findSimilarRequests(requestData, existingRequests, {
            threshold: 0.6, // Lower threshold for checking
            maxResults: 5,
            includeOwnRequests: user.role !== 'student' // Include own requests for non-students
        });
        
        // Check if any requests are too similar (blocking threshold)
        const blockingSimilarRequests = similarRequests.filter(
            result => result.similarity >= 0.8
        );
        
        const response = {
            hasSimilarRequests: similarRequests.length > 0,
            hasBlockingSimilarRequests: blockingSimilarRequests.length > 0,
            similarRequests: similarRequests.map(result => ({
                id: result.request._id,
                title: result.request.title,
                description: result.request.description,
                status: result.request.status,
                submittedBy: result.request.submittedBy,
                residence: result.request.residence,
                createdAt: result.request.createdAt,
                similarity: result.similarity,
                titleSimilarity: result.titleSimilarity,
                descriptionSimilarity: result.descriptionSimilarity
            })),
            blockingSimilarRequests: blockingSimilarRequests.map(result => ({
                id: result.request._id,
                title: result.request.title,
                description: result.request.description,
                status: result.request.status,
                submittedBy: result.request.submittedBy,
                residence: result.request.residence,
                createdAt: result.request.createdAt,
                similarity: result.similarity
            })),
            message: blockingSimilarRequests.length > 0 
                ? 'Similar requests found that may prevent submission'
                : similarRequests.length > 0 
                ? 'Similar requests found - please review before submitting'
                : 'No similar requests found'
        };
        
        res.status(200).json(response);
        
    } catch (error) {
        console.error('Error checking similar requests:', error);
        res.status(500).json({ message: error.message });
    }
};

// Helper function to determine payment method based on vendor bank details
function determinePaymentMethod(vendor) {
    // Check if vendor has bank details
    if (vendor.bankDetails && vendor.bankDetails.bankName && vendor.bankDetails.accountNumber) {
        return 'Bank Transfer';
    }
    
    // Check if vendor has specific payment method preference
    if (vendor.defaultPaymentMethod) {
        return vendor.defaultPaymentMethod;
    }
    
    // Default to cash for auto-generated vendors without bank details
    return 'Cash';
}

// Helper function to auto-create vendor from quotation provider
async function autoCreateVendor(providerName, user, category = 'other') {
    try {
        // Check if vendor already exists by business name
        const existingVendor = await Vendor.findOne({ 
            businessName: { $regex: new RegExp(providerName, 'i') } 
        });
        
        if (existingVendor) {
            return existingVendor;
        }

        // Auto-generate unique chart of accounts code for vendor
        const vendorCount = await Vendor.countDocuments();
        const chartOfAccountsCode = `200${(vendorCount + 1).toString().padStart(3, '0')}`;
        
        // Map category to expense category
        const categoryExpenseMap = {
            'maintenance': 'maintenance_expenses',
            'utilities': 'utilities_expenses',
            'supplies': 'supplies_expenses',
            'equipment': 'equipment_expenses',
            'services': 'services_expenses',
            'cleaning': 'cleaning_expenses',
            'security': 'security_expenses',
            'landscaping': 'landscaping_expenses',
            'electrical': 'electrical_expenses',
            'plumbing': 'plumbing_expenses',
            'carpentry': 'carpentry_expenses',
            'painting': 'painting_expenses',
            'other': 'other_expenses'
        };
        const expenseCategory = categoryExpenseMap[category] || 'other_expenses';
        
        // Determine vendor type based on category and description
        let vendorType = 'other';
        if (category === 'supplies' || category === 'equipment') {
            vendorType = 'shop';
        } else if (['maintenance', 'cleaning', 'security', 'landscaping', 'electrical', 'plumbing', 'carpentry', 'painting'].includes(category)) {
            vendorType = 'contractor';
        } else if (category === 'services') {
            vendorType = 'service_provider';
        }

        // Create basic vendor data
        const vendorData = {
            businessName: providerName,
            tradingName: providerName,
            contactPerson: {
                firstName: 'Auto',
                lastName: 'Generated',
                email: `auto-${Date.now()}@vendor.local`,
                phone: '+27 00 000 0000'
            },
            businessAddress: {
                street: 'Auto-generated address',
                city: 'Johannesburg',
                province: 'Gauteng',
                postalCode: '0000',
                country: 'South Africa'
            },
            category: category,
            vendorType: vendorType,
            businessScope: `${vendorType} specializing in ${category} services/products`,
            chartOfAccountsCode: chartOfAccountsCode,
            expenseCategory: expenseCategory,
            // Bank details - empty for auto-generated vendors (will be paid in cash)
            bankDetails: {
                bankName: null,
                accountNumber: null,
                accountType: null,
                branchCode: null,
                swiftCode: null
            },
            // Payment method defaults to cash for auto-generated vendors (no bank details)
            defaultPaymentMethod: 'Cash',
            createdBy: user._id,
            isAutoGenerated: true, // Flag to indicate this was auto-created
            history: [{
                action: 'Vendor auto-created',
                description: `Vendor auto-created from request quotation: ${providerName}`,
                user: user._id,
                changes: ['Auto-generated from quotation', 'Payment method: Cash (no bank details)']
            }]
        };

        // Create new vendor
        const vendor = new Vendor(vendorData);
        const savedVendor = await vendor.save();

        // Create chart of accounts entries
        await ensureChartOfAccountsEntries(chartOfAccountsCode, savedVendor);

        console.log(`Auto-created vendor: ${providerName} with ID: ${savedVendor._id}`);
        return savedVendor;

    } catch (error) {
        console.error('Error auto-creating vendor:', error);
        throw error;
    }
}

// Helper function to ensure chart of accounts entries exist
async function ensureChartOfAccountsEntries(vendorCode, vendor) {
    try {
        // Check if vendor-specific AP account exists
        let vendorAccount = await Account.findOne({ code: vendorCode });
        if (!vendorAccount) {
            vendorAccount = new Account({
                code: vendorCode,
                name: `Accounts Payable - ${vendor.businessName}`,
                type: 'Liability'
            });
            await vendorAccount.save();
            console.log(`Created vendor AP account: ${vendorCode} - ${vendor.businessName}`);
        }

        // Note: We don't create separate expense accounts for each vendor
        // Instead, we use the existing chart of accounts structure
        // The expenseCategory field helps identify which expense account to use

    } catch (error) {
        console.error('Error ensuring chart of accounts entries:', error);
        // Don't throw error as this is not critical for vendor creation
    }
}