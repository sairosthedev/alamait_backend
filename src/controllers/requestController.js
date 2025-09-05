const Request = require('../models/Request');
const Expense = require('../models/finance/Expense');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Account = require('../models/Account');
const { generateUniqueId } = require('../utils/idGenerator');
const { uploadToS3 } = require('../utils/fileStorage');
const { s3, s3Configs } = require('../config/s3');
const { findSimilarRequests, generateSimilarityQuery } = require('../utils/requestSimilarity');
const EmailNotificationService = require('../services/emailNotificationService');
const { logVendorOperation, logAccountOperation } = require('../utils/auditLogger');

// Helper function to map status for students
function mapStatusForStudent(originalStatus) {
    switch (originalStatus) {
        case 'pending':
        case 'pending_finance_approval':
        case 'pending_ceo_approval':
        case 'pending_admin_approval':
        case 'pending-finance-approval':
        case 'pending-ceo-approval':
        case 'pending-admin-approval':
            return 'pending';
        case 'in-progress':
        case 'assigned':
            return 'in-progress';
        case 'completed':
            return 'completed';
        case 'rejected':
            return 'rejected';
        case 'waitlisted':
            return 'waitlisted';
        default:
            return originalStatus;
    }
}

// Helper function to map request data for students
function mapRequestForStudent(request) {
    const mappedRequest = request.toObject ? request.toObject() : { ...request };
    
    // Map status for students
    mappedRequest.status = mapStatusForStudent(mappedRequest.status);
    
    // Add student-friendly status description
    switch (mappedRequest.status) {
        case 'pending':
            mappedRequest.statusDescription = 'Your request is being reviewed';
            break;
        case 'in-progress':
            mappedRequest.statusDescription = 'Work is in progress';
            break;
        case 'completed':
            mappedRequest.statusDescription = 'Request completed';
            break;
        case 'rejected':
            mappedRequest.statusDescription = 'Request was rejected';
            break;
        case 'waitlisted':
            mappedRequest.statusDescription = 'Request is on waitlist';
            break;
        default:
            mappedRequest.statusDescription = 'Status unknown';
    }
    
    return mappedRequest;
}

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
            .populate('student', 'firstName lastName email role')
            .populate('assignedTo._id', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('quotations.approvedBy', 'firstName lastName email')
            .populate('quotations.selectedBy', 'firstName lastName email')
            .populate('quotations.deselectedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
            .populate('items.quotations.selectedBy', 'firstName lastName email')
            .populate('items.quotations.deselectedBy', 'firstName lastName email')
            .populate('approval.admin.approvedBy', 'firstName lastName email')
            .populate('approval.finance.approvedBy', 'firstName lastName email')
            .populate('approval.ceo.approvedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await Request.countDocuments(query);
        
        // Map statuses for students
        let mappedRequests = requests;
        if (user.role === 'student') {
            mappedRequests = requests.map(request => mapRequestForStudent(request));
        }
        
        res.status(200).json({
            requests: mappedRequests,
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
        const { id } = req.params;
        const user = req.user;

        const request = await Request.findById(id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('student', 'firstName lastName email role')
            .populate('assignedTo._id', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('quotations.approvedBy', 'firstName lastName email')
            .populate('quotations.selectedBy', 'firstName lastName email')
            .populate('quotations.deselectedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
            .populate('items.quotations.selectedBy', 'firstName lastName email')
            .populate('items.quotations.deselectedBy', 'firstName lastName email')
            .populate('approval.admin.approvedBy', 'firstName lastName email')
            .populate('approval.finance.approvedBy', 'firstName lastName email')
            .populate('approval.ceo.approvedBy', 'firstName lastName email');

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Check permissions
        if (user.role === 'student' && request.submittedBy._id.toString() !== user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Map status for students
        let mappedRequest = request;
        if (user.role === 'student') {
            mappedRequest = mapRequestForStudent(request);
        }

        res.status(200).json({ request: mappedRequest });
    } catch (error) {
        console.error('Error getting request by ID:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create new request
exports.createRequest = async (req, res) => {
    try {
        console.log('🚀 CREATE REQUEST - Starting request creation...');
        console.log('📋 Request body keys:', Object.keys(req.body));
        console.log('📋 Request body content:');
        Object.keys(req.body).forEach(key => {
            try {
                const value = req.body[key];
                console.log(`  ${key}: ${value} (${typeof value})`);
                
                // Check if value is an object that might cause conversion issues
                if (typeof value === 'object' && value !== null) {
                    console.log(`    ⚠️ Complex object detected for ${key}:`, {
                        constructor: value.constructor?.name,
                        keys: Object.keys(value),
                        stringified: JSON.stringify(value)
                    });
                }
            } catch (error) {
                console.error(`  ❌ Error logging field ${key}:`, error.message);
            }
        });
        
        // Debug mode removed - continuing with normal request creation
        
        // TEMPORARILY DISABLE AUTH FOR DEBUGGING
        let user = req.user;
        if (!user) {
            console.log('⚠️ No user found, creating mock user for debugging');
            user = {
                _id: '67c023adae5e27657502e887',
                email: 'debug@test.com',
                role: 'admin'
            };
        }
        
        console.log('=== CREATE REQUEST DEBUG ===');
        console.log('Request headers:', req.headers);
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Request body type:', typeof req.body);
        console.log('Request body keys:', Object.keys(req.body));
        
        // Extract basic fields
        const {
            title,
            description,
            type,
            residence,
            department,
            requestedBy,
            deliveryLocation,
            priority,
            proposedVendor,
            totalEstimatedCost,
            status,
            items,
            amount,
            dueDate,
            tags,
            room,
            category,
            images
        } = req.body;
        
        // Parse items if it's a string (from FormData)
        let parsedItems = items;
        if (typeof items === 'string') {
            try {
                parsedItems = JSON.parse(items);
                console.log('Items parsed from string:', parsedItems.length, 'items');
            } catch (error) {
                console.error('Error parsing items:', error);
                return res.status(400).json({ message: 'Invalid items format' });
            }
        } else if (!items || !Array.isArray(items)) {
            // If items is not provided as JSON, build it from FormData fields
            console.log('Building items from FormData fields...');
            parsedItems = [];
            
            // Find all item fields in the request body
            const itemFields = Object.keys(req.body).filter(key => key.startsWith('items['));
            const itemIndices = new Set();
            
            // Extract item indices
            itemFields.forEach(field => {
                const match = field.match(/items\[(\d+)\]/);
                if (match) {
                    itemIndices.add(parseInt(match[1]));
                }
            });
            
            // Build items array
            Array.from(itemIndices).sort((a, b) => a - b).forEach(itemIndex => {
                try {
                    // Safe parsing functions
                    const safeParseFloat = (value) => {
                        try {
                            if (typeof value === 'object' && value !== null) {
                                console.warn(`Attempting to parse object as float: ${JSON.stringify(value)}`);
                                return 0;
                            }
                            return parseFloat(value) || 0;
                        } catch (error) {
                            console.warn(`Error parsing float for value: ${value}`, error);
                            return 0;
                        }
                    };
                    
                    const safeParseInt = (value) => {
                        try {
                            if (typeof value === 'object' && value !== null) {
                                console.warn(`Attempting to parse object as int: ${JSON.stringify(value)}`);
                                return 0;
                            }
                            return parseInt(value) || 0;
                        } catch (error) {
                            console.warn(`Error parsing int for value: ${value}`, error);
                            return 0;
                        }
                    };
                    
                    const safeString = (value) => {
                        try {
                            if (typeof value === 'object' && value !== null) {
                                console.warn(`Attempting to convert object to string: ${JSON.stringify(value)}`);
                                return JSON.stringify(value);
                            }
                            return String(value || '');
                        } catch (error) {
                            console.warn(`Error converting to string: ${value}`, error);
                            return '';
                        }
                    };
                    
                    const item = {
                        description: safeString(req.body[`items[${itemIndex}][description]`]),
                        quantity: safeParseInt(req.body[`items[${itemIndex}][quantity]`]),
                        unitCost: safeParseFloat(req.body[`items[${itemIndex}][unitCost]`]),
                        totalCost: safeParseFloat(req.body[`items[${itemIndex}][totalCost]`]),
                        purpose: safeString(req.body[`items[${itemIndex}][purpose]`]),
                        quotations: []
                    };
                    
                    // Find quotation fields for this item
                    const quotationFields = Object.keys(req.body).filter(key => 
                        key.startsWith(`items[${itemIndex}][quotations][`)
                    );
                    const quotationIndices = new Set();
                    
                    // Extract quotation indices
                    quotationFields.forEach(field => {
                        const match = field.match(/items\[\d+\]\[quotations\]\[(\d+)\]/);
                        if (match) {
                            quotationIndices.add(parseInt(match[1]));
                        }
                    });
                    
                                    // Build quotations array
                Array.from(quotationIndices).sort((a, b) => a - b).forEach(quotationIndex => {
                    console.log(`\n🔍 Processing quotation ${quotationIndex} for item ${itemIndex}...`);
                    try {
                            const isSelectedField = `items[${itemIndex}][quotations][${quotationIndex}][isSelected]`;
                            const isSelectedValue = req.body[isSelectedField];
                            
                            console.log(`DEBUG: Parsing quotation ${quotationIndex} for item ${itemIndex}:`, {
                                isSelectedField,
                                isSelectedValue,
                                isSelectedType: typeof isSelectedValue,
                                isSelectedParsed: isSelectedValue === 'true'
                            });
                            
                            // Special handling for isSelected field
                            if (typeof isSelectedValue === 'object' && isSelectedValue !== null) {
                                console.error(`❌ CRITICAL: isSelected field is an object!`, {
                                    field: isSelectedField,
                                    value: isSelectedValue,
                                    constructor: isSelectedValue.constructor?.name,
                                    keys: Object.keys(isSelectedValue)
                                });
                            }
                            
                                                    // Debug all FormData fields for this quotation
                        console.log(`DEBUG: All FormData fields for quotation ${quotationIndex}, item ${itemIndex}:`);
                        const quotationFields = Object.keys(req.body).filter(key => 
                            key.includes(`items[${itemIndex}][quotations][${quotationIndex}]`)
                        );
                        
                        if (quotationFields.length === 0) {
                            console.error(`❌ CRITICAL: No fields found for quotation ${quotationIndex}, item ${itemIndex}!`);
                        } else {
                            quotationFields.forEach(key => {
                                const value = req.body[key];
                                console.log(`  ${key}: ${value} (${typeof value})`);
                            });
                        }
                            
                                                    // Safe parsing with error handling
                        const safeParseFloat = (value) => {
                            try {
                                console.log(`safeParseFloat called with: ${value} (${typeof value})`);
                                
                                if (value === undefined || value === null) {
                                    console.warn(`Value is undefined/null, returning 0`);
                                    return 0;
                                }
                                
                                if (typeof value === 'object') {
                                    console.warn(`Attempting to parse object as float: ${JSON.stringify(value)}`);
                                    return 0;
                                }
                                
                                const result = parseFloat(value) || 0;
                                console.log(`safeParseFloat result: ${result}`);
                                return result;
                            } catch (error) {
                                console.warn(`Error parsing float for value: ${value}`, error);
                                return 0;
                            }
                        };
                            
                            const safeParseInt = (value) => {
                                try {
                                    if (typeof value === 'object' && value !== null) {
                                        console.warn(`Attempting to parse object as int: ${JSON.stringify(value)}`);
                                        return 0;
                                    }
                                    return parseInt(value) || 0;
                                } catch (error) {
                                    console.warn(`Error parsing int for value: ${value}`, error);
                                    return 0;
                                }
                            };
                            
                            const safeString = (value) => {
                                try {
                                    if (typeof value === 'object' && value !== null) {
                                        console.warn(`Attempting to convert object to string: ${JSON.stringify(value)}`);
                                        return JSON.stringify(value);
                                    }
                                    return String(value || '');
                                } catch (error) {
                                    console.warn(`Error converting to string: ${value}`, error);
                                    return '';
                                }
                            };
                            
                                                    // Get amount field with better error handling
                        const amountField = `items[${itemIndex}][quotations][${quotationIndex}][amount]`;
                        const amountValue = req.body[amountField];
                        
                        console.log(`DEBUG: Amount field for quotation ${quotationIndex}, item ${itemIndex}:`, {
                            field: amountField,
                            value: amountValue,
                            type: typeof amountValue,
                            exists: amountField in req.body
                        });
                        
                        // Check if amount field exists
                        if (!(amountField in req.body)) {
                            console.error(`❌ CRITICAL: Amount field '${amountField}' not found in req.body!`);
                            console.error('Available fields:', Object.keys(req.body).filter(key => key.includes('amount')));
                            throw new Error(`Amount field '${amountField}' is not defined in the request`);
                        }
                        
                        const quotation = {
                            provider: safeString(req.body[`items[${itemIndex}][quotations][${quotationIndex}][provider]`]),
                            amount: safeParseFloat(amountValue),
                            description: safeString(req.body[`items[${itemIndex}][quotations][${quotationIndex}][description]`]),
                            quotationDate: safeString(req.body[`items[${itemIndex}][quotations][${quotationIndex}][quotationDate]`]),
                            validUntil: safeString(req.body[`items[${itemIndex}][quotations][${quotationIndex}][validUntil]`]),
                            notes: safeString(req.body[`items[${itemIndex}][quotations][${quotationIndex}][notes]`]),
                            isApproved: req.body[`items[${itemIndex}][quotations][${quotationIndex}][isApproved]`] === 'true',
                            isSelected: isSelectedValue === 'true',
                            uploadedBy: safeString(req.body[`items[${itemIndex}][quotations][${quotationIndex}][uploadedBy]`]),
                            itemIndex: safeParseInt(req.body[`items[${itemIndex}][quotations][${quotationIndex}][itemIndex]`]) || itemIndex,
                            fileName: safeString(req.body[`items[${itemIndex}][quotations][${quotationIndex}][fileName]`])
                        };
                            
                            console.log(`DEBUG: Built quotation object:`, {
                                provider: quotation.provider,
                                amount: quotation.amount,
                                isSelected: quotation.isSelected,
                                isSelectedType: typeof quotation.isSelected
                            });
                            
                                                    item.quotations.push(quotation);
                    } catch (error) {
                        console.error(`ERROR: Failed to parse quotation ${quotationIndex} for item ${itemIndex}:`, error);
                        console.error('Error details:', {
                            message: error.message,
                            stack: error.stack
                        });
                        throw new Error(`Failed to parse quotation ${quotationIndex} for item ${itemIndex}: ${error.message}`);
                    }
                });
                
                                parsedItems.push(item);
            } catch (error) {
                console.error(`ERROR: Failed to parse item ${itemIndex}:`, error);
                throw error;
            }
            });
            
            console.log('Items built from FormData fields:', parsedItems.length, 'items');
        } else {
            console.log('Items received as object:', Array.isArray(items) ? items.length : 'not array');
        }
        
        console.log('DEBUG: Items structure after parsing:');
        if (Array.isArray(parsedItems)) {
            parsedItems.forEach((item, index) => {
                console.log(`DEBUG: Item ${index}:`, {
                    description: item.description,
                    quotationsCount: item.quotations ? item.quotations.length : 0
                });
                
                // Debug quotation selection status
                if (item.quotations && item.quotations.length > 0) {
                    item.quotations.forEach((quotation, qIndex) => {
                        console.log(`DEBUG: Item ${index}, Quotation ${qIndex}:`, {
                            provider: quotation.provider,
                            amount: quotation.amount,
                            isSelected: quotation.isSelected,
                            isSelectedType: typeof quotation.isSelected
                        });
                    });
                }
            });
        }
        
        // Validate required fields
        if (!title || !description || !type) {
            return res.status(400).json({ message: 'Missing required fields: title, description, type' });
        }
        
        // Validate type based on user role
        if (user.role === 'student' && type !== 'maintenance' && type !== 'student_maintenance') {
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
        
        // Validate non-student specific fields (only for non-maintenance requests)
        if (user.role !== 'student' && type !== 'maintenance' && type !== 'student_maintenance') {
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
                
                // Parse numeric values from FormData (they come as strings)
                item.quantity = parseInt(item.quantity) || 0;
                item.unitCost = parseFloat(item.unitCost) || 0;
                item.totalCost = parseFloat(item.totalCost) || 0;
                
                if (!item.quantity || item.quantity < 1) {
                    return res.status(400).json({ message: `Item ${i + 1}: Quantity must be at least 1` });
                }
                
                // Calculate total cost for this item if not provided
                if (!item.totalCost) {
                    item.totalCost = item.unitCost * item.quantity;
                }
                
                // Handle quotations with file uploads
                if (item.quotations && Array.isArray(item.quotations)) {
                    for (let j = 0; j < item.quotations.length; j++) {
                        const quotation = item.quotations[j];
                        
                        // Find uploaded file for this quotation
                        console.log(`Looking for file for item ${i}, quotation ${j}`);
                        console.log('Available files:', req.files ? req.files.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, filename: f.filename, size: f.size })) : 'No files');
                        
                        // Find any file for this quotation by checking all files
                        console.log('All available files:', req.files ? req.files.map(f => f.fieldname) : 'No files');
                        
                        let uploadedFile = null;
                        
                        // Look for any file that contains the item and quotation indices
                        if (req.files) {
                            // First try exact match
                            const exactFieldname = `items[${i}][quotations][${j}][quotation]`;
                            uploadedFile = req.files.find(file => file.fieldname === exactFieldname);
                            
                            if (uploadedFile) {
                                console.log(`Found file with exact match: ${exactFieldname}`);
                            } else {
                                // Try pattern match as fallback
                                uploadedFile = req.files.find(file => 
                                    file.fieldname.includes(`items[${i}]`) && 
                                    file.fieldname.includes(`quotations[${j}]`)
                                );
                                
                                if (uploadedFile) {
                                    console.log(`Found file with pattern match: ${uploadedFile.fieldname}`);
                                }
                            }
                            
                            // Debug: Log all files and what we're looking for
                            console.log(`DEBUG: Looking for file with fieldname: ${exactFieldname}`);
                            console.log(`DEBUG: Available files:`, req.files.map(f => f.fieldname));
                            console.log(`DEBUG: Found file:`, uploadedFile ? uploadedFile.fieldname : 'NOT FOUND');
                            
                            // Additional debug for FormData structure
                            console.log(`DEBUG: Item ${i}, Quotation ${j} - fileName from FormData:`, quotation.fileName);
                        }
                        
                        if (uploadedFile) {
                            console.log(`Found file with fieldname: ${uploadedFile.fieldname}`);
                        } else {
                            console.log(`No file found for item ${i}, quotation ${j}`);
                        }
                        
                        console.log(`File found for item ${i}, quotation ${j}:`, uploadedFile ? uploadedFile.fieldname : 'No file found');
                        console.log(`Debug - Looking for item ${i}, quotation ${j}`);
                        console.log(`Debug - Available fieldnames:`, req.files ? req.files.map(f => f.fieldname) : 'No files');
                        console.log(`Debug - Checking pattern: items[${i}] and quotations[${j}]`);
                        console.log(`Debug - Exact fieldname to find: items[${i}][quotations][${j}][quotation]`);
                        
                        // Debug each file
                        if (req.files) {
                            req.files.forEach((file, index) => {
                                console.log(`Debug - File ${index}:`, {
                                    fieldname: file.fieldname,
                                    originalname: file.originalname,
                                    size: file.size,
                                    containsItem: file.fieldname.includes(`items[${i}]`),
                                    containsQuotation: file.fieldname.includes(`quotations[${j}]`),
                                    exactMatch: file.fieldname === `items[${i}][quotations][${j}][quotation]`
                                });
                            });
                        }
                        
                        // If quotation has a file, upload it to S3
                        if (uploadedFile) {
                            console.log(`🔄 Uploading file to S3: ${uploadedFile.originalname}`);
                            console.log(`File details:`, {
                                fieldname: uploadedFile.fieldname,
                                originalname: uploadedFile.originalname,
                                mimetype: uploadedFile.mimetype,
                                size: uploadedFile.size,
                                buffer: uploadedFile.buffer ? 'Buffer present' : 'No buffer'
                            });
                            
                            try {
                                const s3Key = `request_quotations/${user._id}_${Date.now()}_${uploadedFile.originalname}`;
                                console.log(`S3 Key: ${s3Key}`);
                                
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
                                
                                console.log(`S3 Upload params:`, {
                                    Bucket: s3UploadParams.Bucket,
                                    Key: s3UploadParams.Key,
                                    ContentType: s3UploadParams.ContentType,
                                    ACL: s3UploadParams.ACL
                                });
                                
                                const s3Result = await s3.upload(s3UploadParams).promise();
                                console.log(`✅ S3 Upload successful: ${s3Result.Location}`);
                                
                                // Update quotation with S3 URL
                                quotation.fileUrl = s3Result.Location;
                                quotation.fileName = uploadedFile.originalname;
                                quotation.uploadedBy = user._id;
                                quotation.uploadedAt = new Date();
                                
                                console.log(`📄 Quotation updated with fileUrl: ${quotation.fileUrl}`);
                            } catch (uploadError) {
                                console.error('❌ Error uploading quotation file to S3:', uploadError);
                                console.error('Upload error details:', {
                                    message: uploadError.message,
                                    code: uploadError.code,
                                    statusCode: uploadError.statusCode
                                });
                                return res.status(500).json({ 
                                    message: `Error uploading file for item ${i + 1}, quotation ${j + 1}` 
                                });
                            }
                        } else {
                            console.log(`⚠️ No file found for item ${i}, quotation ${j}`);
                        }

                        // Parse quotation numeric values from FormData
                        quotation.amount = parseFloat(quotation.amount) || 0;
                        quotation.isApproved = quotation.isApproved === "true" || quotation.isApproved === true;
                        quotation.itemIndex = parseInt(quotation.itemIndex) || 0;

                        // Find or create vendor for the provider
                        if (quotation.provider) {
                            try {
                                console.log(`🔍 Processing vendor for provider: ${quotation.provider}`);
                                
                                // First, try to find existing vendor
                                const vendor = await Vendor.findOne({ businessName: quotation.provider });
                                
                                if (vendor) {
                                    console.log(`✅ Found existing vendor for request creation: ${quotation.provider} (${vendor._id})`);
                                    
                                    // Create a new quotation object with vendor details
                                    const quotationWithVendor = {
                                        ...quotation,
                                        vendorId: vendor._id,
                                        vendorCode: vendor.chartOfAccountsCode,
                                        vendorName: vendor.businessName,
                                        vendorType: vendor.vendorType,
                                        expenseCategory: vendor.expenseCategory,
                                        paymentMethod: 'Cash',
                                        hasBankDetails: !!(vendor.bankDetails && vendor.bankDetails.bankName)
                                    };
                                    
                                    // Replace the quotation in the array
                                    item.quotations[j] = quotationWithVendor;
                                    
                                    console.log(`✅ Added vendor details to quotation: ${vendor.businessName} (${vendor.chartOfAccountsCode})`);
                                } else {
                                    // Vendor doesn't exist, create new one
                                    console.log(`🆕 Vendor not found, creating new vendor: ${quotation.provider}`);
                                const vendorData = await autoCreateVendor(quotation.provider, user, requestData.type || 'other');
                                if (vendorData) {
                                        // Create a new quotation object with vendor details
                                        const quotationWithVendor = {
                                            ...quotation,
                                            vendorId: vendorData._id,
                                            vendorCode: vendorData.chartOfAccountsCode,
                                            vendorName: vendorData.businessName,
                                            vendorType: vendorData.vendorType,
                                            expenseCategory: vendorData.expenseCategory,
                                            paymentMethod: 'Cash',
                                            hasBankDetails: !!(vendorData.bankDetails && vendorData.bankDetails.bankName)
                                        };
                                        
                                        // Replace the quotation in the array
                                        item.quotations[j] = quotationWithVendor;
                                        
                                        console.log(`✅ Created and added vendor details to quotation: ${vendorData.businessName} (${vendorData.chartOfAccountsCode})`);
                                    }
                                }
                            } catch (vendorError) {
                                console.error('❌ Error finding/creating vendor:', vendorError.message);
                                // Continue with request creation even if vendor creation fails
                                // The vendor can be created manually later
                            }
                        }
                    }
                    
                    // Quotation selection validation: If item has 2 or more quotations, admin must select one
                    console.log(`DEBUG: Item ${i + 1} has ${item.quotations ? item.quotations.length : 0} quotations`);
                    
                    if (item.quotations && item.quotations.length >= 2) {
                        const selectedQuotations = item.quotations.filter(q => q.isSelected === true);
                        
                        console.log(`DEBUG: Item ${i + 1} quotation selection validation:`, {
                            totalQuotations: item.quotations.length,
                            selectedQuotations: selectedQuotations.length,
                            selectedQuotationsDetails: selectedQuotations.map(q => ({
                                provider: q.provider,
                                amount: q.amount,
                                isSelected: q.isSelected
                            })),
                            allQuotations: item.quotations.map(q => ({
                                provider: q.provider,
                                amount: q.amount,
                                isSelected: q.isSelected,
                                isSelectedType: typeof q.isSelected
                            }))
                        });
                        
                        // Only allow manual selection - no auto-selection
                        if (selectedQuotations.length === 0) {
                            console.log(`⚠️ No quotation selected for item ${i + 1} - admin must manually select one`);
                            // Don't auto-select - let admin choose
                        } else if (selectedQuotations.length > 1) {
                            console.log(`⚠️ Multiple quotations selected for item ${i + 1} - only one should be selected`);
                            // Don't auto-select - let admin choose which one
                        } else {
                            // Update item cost to match the selected quotation
                            const selectedQuotation = selectedQuotations[0];
                            item.unitCost = selectedQuotation.amount;
                            item.totalCost = selectedQuotation.amount * (item.quantity || 1);
                            
                            console.log(`✅ Using admin-selected quotation: ${selectedQuotation.provider} - $${selectedQuotation.amount}`);
                            console.log(`💰 Updated item cost: $${item.totalCost} (${item.quantity} × $${item.unitCost})`);
                        }
                    } else if (item.quotations && item.quotations.length === 1) {
                        // If only one quotation, automatically select it (this is acceptable)
                        const quotation = item.quotations[0];
                        quotation.isSelected = true;
                        quotation.selectedBy = user._id;
                        quotation.selectedAt = new Date();
                        quotation.selectedByEmail = user.email;
                        
                        // Update item cost to match the quotation
                        item.unitCost = quotation.amount;
                        item.totalCost = quotation.amount * (item.quantity || 1);
                        
                        console.log(`✅ Auto-selected single quotation: ${quotation.provider} - $${quotation.amount}`);
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
                    // Parse values to ensure they're numbers
                    const quantity = parseInt(item.quantity) || 0;
                    const unitCost = parseFloat(item.unitCost) || 0;
                    const totalCost = parseFloat(item.totalCost) || 0;
                    const estimatedCost = parseFloat(item.estimatedCost) || 0;
                    
                    // Use the most appropriate cost value
                    const itemCost = totalCost || (unitCost * quantity) || estimatedCost || 0;
                    
                    return total + itemCost;
                }, 0);
            } else {
                requestData.totalEstimatedCost = 0;
            }
            
            // Ensure totalEstimatedCost is a valid number
            if (isNaN(requestData.totalEstimatedCost)) {
                requestData.totalEstimatedCost = 0;
            }
        }
        
        // Add images if provided
        if (images && Array.isArray(images)) {
            requestData.images = images;
        }
        
        // For admin requests, set initial admin approval
        if (user.role === 'admin' && type !== 'maintenance' && type !== 'student_maintenance') {
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
        
        // Populate vendor details on the main request if any quotations have vendors
        if (request.items && request.items.length > 0) {
            for (const item of request.items) {
                if (item.quotations && item.quotations.length > 0) {
                    for (const quotation of item.quotations) {
                        if (quotation.vendorId && !request.vendorId) {
                            // Populate vendor details on the main request
                            request.vendorId = quotation.vendorId;
                            request.vendorCode = quotation.vendorCode;
                            request.vendorName = quotation.vendorName;
                            request.vendorType = quotation.vendorType;
                            request.vendorContact = quotation.vendorContact;
                            request.expenseCategory = quotation.expenseCategory;
                            request.paymentMethod = quotation.paymentMethod;
                            request.hasBankDetails = quotation.hasBankDetails;
                            
                            console.log(`✅ Added vendor details to main request from quotation: ${quotation.vendorName} (${quotation.vendorCode})`);
                            break; // Only populate from the first vendor found
                        }
                    }
                    if (request.vendorId) break; // Stop if we've found a vendor
                }
            }
        }
        
        await request.save();
        
        
        const populatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('residence', 'name');
        
        // Send email notifications (non-blocking) - moved after population
        try {
            console.log('🔍 Request creation email debugging:');
            console.log('req.user:', req.user ? 'Present' : 'Missing');
            console.log('req.user.role:', req.user?.role);
            console.log('User ID:', req.user?._id);
            console.log('Request type:', request.type);
            console.log('Request title:', request.title);
            console.log('Populated residence:', populatedRequest.residence?.name);
            
            // Check if user is admin and send appropriate emails
            if (req.user && (req.user.role === 'admin' || req.user.role === 'property_manager')) {
                if (request.type === 'student_maintenance' || request.type === 'operational' || request.type === 'financial') {
                    console.log('📧 Sending admin request email to CEO and Finance Admin');
                    await EmailNotificationService.sendAdminRequestToCEOAndFinance(populatedRequest, req.user);
                }
            } else {
                // For students, send to admins
                if (request.type === 'student_maintenance') {
                    console.log('📧 Sending student maintenance email to admins');
                    await EmailNotificationService.sendMaintenanceRequestSubmitted(populatedRequest, req.user);
                }
            }
            
        } catch (emailError) {
            console.error('Failed to send request email notifications:', emailError);
            // Don't fail the request if email fails
        }
        
        res.status(201).json(populatedRequest);
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update request (only if pending)
exports.updateRequest = async (req, res) => { //n
    try {
        const { id } = req.params;
        const user = req.user;
        const updateData = req.body;

        // Check if request exists
        const request = await Request.findById(id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Validate allowed fields for update
        const allowedFields = [
            'status', 'assignedTo', 'adminResponse', 'priority', 
            'category', 'description', 'title', 'selectedQuotation',
            'estimatedCompletion', 'amount', 'financeStatus'
        ];

        const updates = {};
        const changes = [];

        // Process each field
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                if (key === 'assignedTo' && typeof value === 'string') {
                    // Handle assignedTo specially - fetch user details
                    try {
                        const assignedUser = await User.findById(value);
                        if (!assignedUser) {
                            return res.status(400).json({ message: 'Assigned user not found' });
                        }
                        
                        const assignedToData = {
                            _id: assignedUser._id,
                            name: assignedUser.firstName,
                            surname: assignedUser.lastName,
                            role: assignedUser.role
                        };
                        
                        // Check if the assignment is actually different
                        const currentAssignedTo = request.assignedTo;
                        const isDifferent = !currentAssignedTo || 
                                          !currentAssignedTo._id || 
                                          currentAssignedTo._id.toString() !== assignedUser._id.toString() ||
                                          currentAssignedTo.name !== assignedUser.firstName ||
                                          currentAssignedTo.surname !== assignedUser.lastName;
                        
                        if (isDifferent) {
                            updates[key] = assignedToData;
                            changes.push(`assignedTo updated to: ${assignedUser.firstName} ${assignedUser.lastName}`);
                        }
                    } catch (error) {
                        console.error('Error fetching assigned user:', error);
                        return res.status(400).json({ message: 'Invalid assigned user ID' });
                    }
                } else if (request[key] !== value) {
                    updates[key] = value;
                    changes.push(`${key} updated to: ${value}`);
                }
            }
        }

        // Handle selectedQuotation specially
        if (updateData.selectedQuotation) {
            // Find the quotation and mark it as selected
            let quotationFound = false;
            
            // Check request-level quotations
            if (request.quotations && request.quotations.length > 0) {
                for (const quotation of request.quotations) {
                    if (quotation._id.toString() === updateData.selectedQuotation) {
                        quotation.isSelected = true;
                        quotation.selectedBy = user._id;
                        quotation.selectedAt = new Date();
                        quotation.selectedByEmail = user.email;
                        quotationFound = true;
                        changes.push(`Selected quotation: ${quotation.provider}`);
                        break;
                    }
                }
            }

            // Check item-level quotations
            if (!quotationFound && request.items && request.items.length > 0) {
                for (const item of request.items) {
                    if (item.quotations && item.quotations.length > 0) {
                        for (const quotation of item.quotations) {
                            if (quotation._id.toString() === updateData.selectedQuotation) {
                                quotation.isSelected = true;
                                quotation.selectedBy = user._id;
                                quotation.selectedAt = new Date();
                                quotation.selectedByEmail = user.email;
                                quotationFound = true;
                                changes.push(`Selected quotation: ${quotation.provider}`);
                                break;
                            }
                        }
                        if (quotationFound) break;
                    }
                }
            }

            if (!quotationFound) {
                return res.status(400).json({ message: 'Selected quotation not found' });
            }
        }

        // Update the request
        if (Object.keys(updates).length > 0) {
            console.log('🔧 Applying updates:', updates);
            Object.assign(request, updates);
        }

        // Add to request history
        if (changes.length > 0) {
            request.requestHistory.push({
                date: new Date(),
                action: 'Request Updated',
                user: user._id,
                changes: changes
            });
        }

        console.log('💾 Saving request with assignedTo:', request.assignedTo);
        await request.save();
        console.log('✅ Request saved successfully');

        // Send email notifications for maintenance requests (non-blocking)
        if (request.type === 'maintenance') {
            try {
                // Send notification when request is assigned
                if (updateData.assignedTo && request.assignedTo) {
                    const assignedUser = await User.findById(request.assignedTo._id);
                    await EmailNotificationService.sendMaintenanceRequestAssigned(
                        request, 
                        user, 
                        assignedUser
                    );
                }

                // Send notification when status is updated
                if (updateData.status && updateData.status !== request.status) {
                    const previousStatus = request.status;
                    await EmailNotificationService.sendMaintenanceStatusUpdate(
                        request,
                        previousStatus,
                        user
                    );
                }
            } catch (emailError) {
                console.error('Failed to send maintenance email notifications:', emailError);
                // Don't fail the request if email fails
            }
        }

        // Send email notification when request is sent to CEO for approval
        if (updateData.status === 'pending_ceo_approval') {
            try {
                await EmailNotificationService.sendRequestSentToCEONotification(request, user);
            } catch (emailError) {
                console.error('Failed to send request sent to CEO email notification:', emailError);
                // Don't fail the request if email fails
            }
        }

        // Create expenses if financeStatus is being set to 'approved'
        if (updateData.financeStatus === 'approved' && !request.convertedToExpense) {
            try {
                console.log('💰 Creating expenses for approved request:', request._id);
                
                // Check if request has items to process
                if (request.items && request.items.length > 0) {
                    // Handle complex requests with items and quotations
                    await createItemizedExpensesForRequest(request, user);
                } else {
                    // Handle simple requests without items (legacy maintenance requests)
                    await createSimpleExpenseForRequest(request, user);
                }
                
                // Mark request as converted to expense
                request.convertedToExpense = true;
                await request.save();
                
                console.log('✅ Expenses created successfully for request:', request._id);
            } catch (expenseError) {
                console.error('❌ Error creating expenses for request:', expenseError);
                // Don't fail the update if expense creation fails
            }
        }

        // Populate and return updated request
        const updatedRequest = await Request.findById(id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('assignedTo._id', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('quotations.approvedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
            .populate('approval.admin.approvedBy', 'firstName lastName email')
            .populate('approval.finance.approvedBy', 'firstName lastName email')
            .populate('approval.ceo.approvedBy', 'firstName lastName email');

        res.status(200).json({
            message: 'Request updated successfully',
            request: updatedRequest,
            changes: changes
        });
    } catch (error) {
        console.error('Error updating request:', error);
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
        // Handle both old and new payload formats
        const { 
            approved, 
            rejected, 
            waitlisted, 
            notes, 
            reason,  // Support 'reason' field from frontend
            createDoubleEntryTransactions, // Support this field
            vendorDetails // Support vendor details
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
        
        // Check if request is in correct status
        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request is not pending approval' });
        }
        
        // SIMPLIFIED APPROVAL LOGIC: Any approval action = approved
        let isApproved = false;
        let isRejected = false;
        let isWaitlisted = false;
        
        // SIMPLE RULE: If any approval action is taken, set to approved
        if (approved === true || reason === 'yes' || reason === 'approved') {
            isApproved = true;
            console.log('✅ Approve button clicked - setting financeStatus to approved');
        } else if (rejected === true || reason === 'no' || reason === 'rejected') {
            isRejected = true;
            console.log('❌ Reject action - setting financeStatus to rejected');
        } else if (waitlisted === true || reason === 'waitlist' || reason === 'waitlisted') {
            isWaitlisted = true;
            console.log('⏳ Waitlist action - setting financeStatus to waitlisted');
        } else {
            // DEFAULT: If any approval-related action is taken, assume approved
            // This ensures that clicking any button (except reject/waitlist) results in approval
            isApproved = true;
            console.log('✅ Default action - setting financeStatus to approved');
        }
        
        // FINAL CHECK: If finance user is taking any action, ensure we have a clear status
        if (!isApproved && !isRejected && !isWaitlisted) {
            isApproved = true;
            console.log('✅ Fallback: No clear action, defaulting to approved');
        }
        
        // Update finance approval
        request.approval.finance = {
            approved: isApproved,
            rejected: isRejected,
            waitlisted: isWaitlisted,
            approvedBy: user._id,
            approvedByEmail: user.email,
            approvedAt: new Date(),
            notes: notes || reason || '' // Use notes or reason
        };
        
        // Update finance status ONLY (do not change overall request status)
        if (isApproved) {
            request.financeStatus = 'approved';
            request.status = 'pending-ceo-approval'; // ✅ ADDED: Set status to pending CEO approval
            
            // ✅ ADDED: Map totalEstimatedCost to amount for expense creation
            if (request.totalEstimatedCost && request.totalEstimatedCost > 0) {
                request.amount = request.totalEstimatedCost;
                console.log(`💰 Mapped totalEstimatedCost (${request.totalEstimatedCost}) to amount field`);
            } else {
                // Fallback: calculate from items if totalEstimatedCost is not set
                const calculatedAmount = request.items?.reduce((sum, item) => sum + (item.totalCost || 0), 0) || 0;
                request.amount = calculatedAmount;
                console.log(`💰 Calculated amount from items: ${calculatedAmount}`);
            }
            
            console.log('✅ Setting financeStatus to approved');
            console.log('✅ Setting status to pending-ceo-approval');
            console.log(`💰 Final amount for expense creation: ${request.amount}`);
        } else if (isRejected) {
            request.financeStatus = 'rejected';
            request.status = 'rejected'; // ✅ ADDED: Set status to rejected
            console.log('❌ Setting financeStatus to rejected');
            console.log('❌ Setting status to rejected');
        } else if (isWaitlisted) {
            request.financeStatus = 'waitlisted';
            request.status = 'waitlisted'; // ✅ ADDED: Set status to waitlisted
            console.log('⏳ Setting financeStatus to waitlisted');
            console.log('⏳ Setting status to waitlisted');
        }
        
        // Add to request history
        const actionDescription = isApproved ? 'approved' : isRejected ? 'rejected' : isWaitlisted ? 'waitlisted' : 'updated';
        request.requestHistory.push({
            date: new Date(),
            action: `Finance ${actionDescription}`,
            user: user._id,
            changes: [`Finance ${actionDescription} the request`]
        });
        
        // Save the initial update
        await request.save();
        console.log('✅ Request saved with finance approval');

        // Create double-entry transaction and itemized expense if approved
        let financialResult = null;
        if (isApproved) {
            try {
                console.log('💰 Creating expenses and double-entry transactions for approved request...');
                
                // Check if request has items to process
                if (request.items && request.items.length > 0) {
                    console.log(`📦 Processing ${request.items.length} items for expense creation...`);
                    
                    // Use the proper DoubleEntryAccountingService for maintenance approval
                    const DoubleEntryAccountingService = require('../services/doubleEntryAccountingService');
                    financialResult = await DoubleEntryAccountingService.recordMaintenanceApproval(request, user);
                    
                    // Update request with expense reference
                    request.convertedToExpense = true;
                    request.expenseId = financialResult.expense._id;
                    await request.save();
                    
                    console.log('✅ Itemized expense and double-entry transactions created successfully');
                    console.log(`   - Transaction ID: ${financialResult.transaction.transactionId}`);
                    console.log(`   - Expense ID: ${financialResult.expense.expenseId}`);
                    console.log(`   - Transaction Entries: ${financialResult.entries.length}`);
                } else {
                    // Handle simple requests without items (legacy maintenance requests)
                    console.log('📝 Creating simple expense for request without items...');
                    await createSimpleExpenseForRequest(request, user);
                    request.convertedToExpense = true;
                    await request.save();
                    
                    console.log('✅ Simple expense created for request approval');
                }
                
                console.log('✅ Request convertedToExpense set to true');
                
            } catch (financialError) {
                console.error('❌ Error creating financial transaction:', financialError);
                console.error('Error details:', financialError.message);
                
                // IMPORTANT: Even if financial transaction fails, we should still mark as converted to expense
                // This ensures the request status is properly updated and prevents the request from being stuck
                request.convertedToExpense = true;
                await request.save();
                
                console.log('⚠️ Financial transaction failed, but convertedToExpense set to true');
                console.log('💡 The request status has been updated, but you may need to manually create the expense');
                
                // Log additional details for debugging
                if (financialError.stack) {
                    console.error('Stack trace:', financialError.stack);
                }
            }
        }
        
        // Final save to ensure all changes are persisted
        await request.save();
        console.log('✅ Final save completed - all changes persisted');
        
        // Fetch the updated request with all fields
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('student', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('quotations.approvedBy', 'firstName lastName email')
            .populate('quotations.selectedBy', 'firstName lastName email')
            .populate('quotations.deselectedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
            .populate('items.quotations.selectedBy', 'firstName lastName email')
            .populate('items.quotations.deselectedBy', 'firstName lastName email')
            .populate('approval.finance.approvedBy', 'firstName lastName email');
        
        const response = {
            ...updatedRequest.toObject(),
            financial: financialResult ? {
                transactionId: financialResult.transaction.transactionId,
                expenseId: financialResult.expense.expenseId,
                entriesCount: financialResult.entries.length,
                totalAmount: financialResult.transaction.amount,
                status: 'created',
                message: 'Double-entry transactions and expense created successfully'
            } : {
                status: 'partial',
                message: 'Request approved but expense creation failed. Request status updated.',
                convertedToExpense: true
            }
        };
        
        console.log('✅ Finance approval completed successfully');
        console.log(`📊 Response includes: financeStatus=${response.financeStatus}, convertedToExpense=${response.convertedToExpense}`);
        console.log(`📋 Request status remains: ${response.status} (only financeStatus was updated)`);
        console.log(`💰 Financial result: ${financialResult ? 'SUCCESS - All transactions created' : 'PARTIAL - Status updated but expense creation failed'}`);
        
        res.status(200).json(response);
    } catch (error) {
        console.error('❌ Error in finance approval:', error);
        res.status(500).json({ message: error.message });
    }
};

// Finance override quotation selection
exports.financeOverrideQuotation = async (req, res) => {
    try {
        const { itemIndex, quotationIndex, reason } = req.body;
        const user = req.user;
        
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Only finance users can override quotations
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Check if request is in correct status for finance override
        if (request.status !== 'pending' && request.financeStatus !== 'pending') {
            return res.status(400).json({ message: 'Request is not in correct status for finance override' });
        }
        
        // Validate item and quotation indices
        if (itemIndex === undefined || quotationIndex === undefined) {
            return res.status(400).json({ message: 'Item index and quotation index are required' });
        }
        
        if (!request.items || !request.items[itemIndex]) {
            return res.status(400).json({ message: 'Item not found' });
        }
        
        const item = request.items[itemIndex];
        if (!item.quotations || !item.quotations[quotationIndex]) {
            return res.status(400).json({ message: 'Quotation not found' });
        }
        
        // Find the previously selected quotation
        const previouslySelectedQuotation = item.quotations.find(q => q.isSelected === true);
        
        // Deselect all quotations for this item
        item.quotations.forEach(quotation => {
            quotation.isSelected = false;
            quotation.deselectedBy = user._id;
            quotation.deselectedAt = new Date();
            quotation.deselectedByEmail = user.email;
            
            // Add to selection history
            if (quotation.selectionHistory) {
                quotation.selectionHistory.push({
                    action: 'deselected',
                    user: user._id,
                    userEmail: user.email,
                    timestamp: new Date(),
                    reason: reason || 'Finance override'
                });
            }
        });
        
        // Select the new quotation
        const newSelectedQuotation = item.quotations[quotationIndex];
        newSelectedQuotation.isSelected = true;
        newSelectedQuotation.selectedBy = user._id;
        newSelectedQuotation.selectedAt = new Date();
        newSelectedQuotation.selectedByEmail = user.email;
        
        // Add to selection history
        if (newSelectedQuotation.selectionHistory) {
            newSelectedQuotation.selectionHistory.push({
                action: 'selected',
                user: user._id,
                userEmail: user.email,
                timestamp: new Date(),
                reason: reason || 'Finance override'
            });
        }
        
        // Update item cost to match the new selected quotation
        const oldUnitCost = item.unitCost;
        const oldTotalCost = item.totalCost;
        
        item.unitCost = newSelectedQuotation.amount;
        item.totalCost = newSelectedQuotation.amount * (item.quantity || 1);
        
        // Recalculate total estimated cost for the request
        if (request.items && request.items.length > 0) {
            request.totalEstimatedCost = request.items.reduce((total, reqItem) => {
                return total + (reqItem.totalCost || 0);
            }, 0);
        }
        
        // Add to request history
        const changes = [
            `Finance overrode quotation selection for item ${itemIndex + 1}`,
            `Changed from ${previouslySelectedQuotation ? previouslySelectedQuotation.provider : 'none'} to ${newSelectedQuotation.provider}`,
            `Updated cost from $${oldTotalCost} to $${item.totalCost}`
        ];
        
        if (reason) {
            changes.push(`Reason: ${reason}`);
        }
        
        request.requestHistory.push({
            date: new Date(),
            action: 'Finance quotation override',
            user: user._id,
            changes: changes
        });
        
        await request.save();
        
        const updatedRequest = await Request.findById(request._id)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('residence', 'name')
            .populate('items.quotations.selectedBy', 'firstName lastName email')
            .populate('items.quotations.deselectedBy', 'firstName lastName email')
            .populate('approval.finance.approvedBy', 'firstName lastName email');
        
        res.status(200).json({
            message: 'Quotation selection overridden successfully',
            request: updatedRequest,
            changes: {
                itemIndex,
                quotationIndex,
                newProvider: newSelectedQuotation.provider,
                newAmount: newSelectedQuotation.amount,
                oldAmount: oldTotalCost,
                newTotalCost: item.totalCost
            }
        });
        
    } catch (error) {
        console.error('Error in finance quotation override:', error);
        res.status(500).json({ message: error.message });
    }
};

// Helper function to create simple expense for legacy maintenance requests
async function createSimpleExpenseForRequest(request, user) {
    try {
        const Expense = require('../models/finance/Expense');
        
        // Delete any existing expense for this request
        await Expense.deleteMany({ requestId: request._id });
        
        // Generate unique expense ID
        const expenseId = await generateUniqueId('EXP');
        
        // Calculate total amount from request
        let totalAmount = 0;
        if (request.amount && request.amount > 0) {
            totalAmount = request.amount;
        } else if (request.items && request.items.length > 0) {
            totalAmount = request.items.reduce((sum, item) => sum + (item.totalCost || 0), 0);
        }
        
        // Find vendor information from quotations
        let vendorId = null;
        let vendorSpecificAccount = null;
        
        // Check for regular quotations first
        if (request.quotations && request.quotations.length > 0) {
            const selectedQuotation = request.quotations.find(q => q.isSelected || q.isApproved);
            if (selectedQuotation) {
                // Use vendor information from the quotation if available
                if (selectedQuotation.vendorId && selectedQuotation.vendorCode) {
                    vendorId = selectedQuotation.vendorId;
                    vendorSpecificAccount = selectedQuotation.vendorCode;
                    
                    // Also populate vendor details on the main request
                    if (!request.vendorId) {
                        request.vendorId = selectedQuotation.vendorId;
                        request.vendorCode = selectedQuotation.vendorCode;
                        request.vendorName = selectedQuotation.vendorName;
                        request.vendorType = selectedQuotation.vendorType;
                        request.vendorContact = selectedQuotation.vendorContact;
                        request.expenseCategory = selectedQuotation.expenseCategory;
                        request.paymentMethod = selectedQuotation.paymentMethod;
                        request.hasBankDetails = selectedQuotation.hasBankDetails;
                        
                        console.log(`✅ Added vendor details to main request from selected quotation: ${selectedQuotation.vendorName} (${selectedQuotation.vendorCode})`);
                    }
                    
                    console.log(`Linked vendor from quotation: ${selectedQuotation.vendorName} (${selectedQuotation.vendorCode}) to simple expense`);
                } else if (selectedQuotation.provider) {
                    // Fallback: Find vendor by business name
                    const vendor = await Vendor.findOne({ businessName: selectedQuotation.provider });
                    if (vendor) {
                        vendorId = vendor._id;
                        vendorSpecificAccount = vendor.chartOfAccountsCode;
                        
                        // Also populate vendor details on the main request
                        if (!request.vendorId) {
                            request.vendorId = vendor._id;
                            request.vendorCode = vendor.chartOfAccountsCode;
                            request.vendorName = vendor.businessName;
                            request.vendorType = vendor.vendorType;
                            request.vendorContact = {
                                firstName: vendor.contactPerson?.firstName || '',
                                lastName: vendor.contactPerson?.lastName || '',
                                email: vendor.contactPerson?.email || '',
                                phone: vendor.contactPerson?.phone || ''
                            };
                            request.expenseCategory = vendor.expenseCategory;
                            request.paymentMethod = 'Cash';
                            request.hasBankDetails = !!(vendor.bankDetails && vendor.bankDetails.bankName);
                            
                            console.log(`✅ Added vendor details to main request from found vendor: ${vendor.businessName} (${vendor.chartOfAccountsCode})`);
                        }
                        
                        console.log(`Linked vendor ${vendor.businessName} (${vendor.chartOfAccountsCode}) to simple expense`);
                    }
                }
            }
        }
        
        // If no regular quotations, check itemized quotations
        if (!vendorId && request.items && request.items.length > 0) {
            for (const item of request.items) {
                if (item.quotations && item.quotations.length > 0) {
                    const selectedQuotation = item.quotations.find(q => q.isSelected || q.isApproved);
                    if (selectedQuotation) {
                        // Use vendor information from the quotation if available
                                        if (selectedQuotation.vendorId && selectedQuotation.vendorCode) {
                    vendorId = selectedQuotation.vendorId;
                    vendorSpecificAccount = selectedQuotation.vendorCode;
                    
                    // Also populate vendor details on the main request
                    if (!request.vendorId) {
                        request.vendorId = selectedQuotation.vendorId;
                        request.vendorCode = selectedQuotation.vendorCode;
                        request.vendorName = selectedQuotation.vendorName;
                        request.vendorType = selectedQuotation.vendorType;
                        request.vendorContact = selectedQuotation.vendorContact;
                        request.expenseCategory = selectedQuotation.expenseCategory;
                        request.paymentMethod = selectedQuotation.paymentMethod;
                        request.hasBankDetails = selectedQuotation.hasBankDetails;
                        
                        console.log(`✅ Added vendor details to main request from selected quotation: ${selectedQuotation.vendorName} (${selectedQuotation.vendorCode})`);
                    }
                    
                    console.log(`Linked vendor from quotation: ${selectedQuotation.vendorName} (${selectedQuotation.vendorCode}) to simple expense from itemized request`);
                    break;
                        } else if (selectedQuotation.provider) {
                            // Fallback: Find vendor by business name
                            const vendor = await Vendor.findOne({ businessName: selectedQuotation.provider });
                            if (vendor) {
                                vendorId = vendor._id;
                                vendorSpecificAccount = vendor.chartOfAccountsCode;
                                
                                // Also populate vendor details on the main request
                                if (!request.vendorId) {
                                    request.vendorId = vendor._id;
                                    request.vendorCode = vendor.chartOfAccountsCode;
                                    request.vendorName = vendor.businessName;
                                    request.vendorType = vendor.vendorType;
                                    request.vendorContact = {
                                        firstName: vendor.contactPerson?.firstName || '',
                                        lastName: vendor.contactPerson?.lastName || '',
                                        email: vendor.contactPerson?.email || '',
                                        phone: vendor.contactPerson?.phone || ''
                                    };
                                    request.expenseCategory = vendor.expenseCategory;
                                    request.paymentMethod = 'Cash';
                                    request.hasBankDetails = !!(vendor.bankDetails && vendor.bankDetails.bankName);
                                    
                                    console.log(`✅ Added vendor details to main request from found vendor: ${vendor.businessName} (${vendor.chartOfAccountsCode})`);
                                }
                                
                                console.log(`Linked vendor ${vendor.businessName} (${vendor.chartOfAccountsCode}) to simple expense from itemized request`);
                                break;
                            }
                        }
                    }
                }
            }
        }
        
        // Create expense data
        const expenseData = {
            expenseId,
            requestId: request._id,
            residence: request.residence,
            category: 'Maintenance',
            amount: totalAmount,
            description: request.title || `Request: ${request.issue || 'Maintenance Request'}`,
            expenseDate: new Date(),
            paymentStatus: 'Pending',
            createdBy: user._id,
            period: 'monthly',
            paymentMethod: 'Cash', // Default to cash for simple maintenance requests
            approvedBy: user._id,
            approvedAt: new Date(),
            approvedByEmail: user.email,
            vendorId: vendorId, // Link the vendor
            vendorSpecificAccount: vendorSpecificAccount // Store the vendor account code
        };
        
        // Create the expense
        const newExpense = new Expense(expenseData);
        await newExpense.save();
        
        console.log(`Simple expense created for request ${request._id}: ${expenseId} (Payment: Cash)`);
        return newExpense;
        
    } catch (error) {
        console.error('Error creating simple expense for request:', error);
        throw error;
    }
}

// Helper function to create itemized expenses for requests with items and quotations
async function createItemizedExpensesForRequest(request, user) {
    try {
        const Expense = require('../models/finance/Expense');
        const Vendor = require('../models/Vendor');
        const DoubleEntryAccountingService = require('../services/doubleEntryAccountingService');
        
        // Delete any existing expenses for this request
        await Expense.deleteMany({ requestId: request._id });
        
        const createdExpenses = [];
        
        // Process each item in the request
        for (let i = 0; i < request.items.length; i++) {
            const item = request.items[i];
            
            // Find selected quotation for this item
            const selectedQuotation = item.quotations?.find(q => q.isSelected);
            
            if (selectedQuotation) {
                // Item has selected quotation - create expense with quotation details
                const expenseId = await generateUniqueId('EXP');
                
                // Determine payment method based on vendor bank details
                let paymentMethod = 'Cash'; // Default to cash
                if (selectedQuotation.vendorId) {
                    try {
                        const vendor = await Vendor.findById(selectedQuotation.vendorId);
                        if (vendor && vendor.bankDetails && vendor.bankDetails.accountNumber) {
                            paymentMethod = 'Bank Transfer';
                        }
                    } catch (vendorError) {
                        console.warn('Could not fetch vendor details for payment method determination:', vendorError.message);
                    }
                }
                
                const expenseData = {
                    expenseId,
                    requestId: request._id,
                    residence: request.residence,
                    category: item.category || 'Other',
                    amount: selectedQuotation.amount,
                    description: `${request.title || 'Request'} - ${item.description}`,
                    expenseDate: new Date(),
                    paymentStatus: 'Pending',
                    createdBy: user._id,
                    period: 'monthly',
                    paymentMethod: paymentMethod,
                    approvedBy: user._id,
                    approvedAt: new Date(),
                    approvedByEmail: user.email,
                    itemIndex: i,
                    quotationId: selectedQuotation._id,
                    vendorId: selectedQuotation.vendorId,
                    vendorCode: selectedQuotation.vendorCode,
                    vendorName: selectedQuotation.vendorName,
                    vendorType: selectedQuotation.vendorType,
                    vendorSpecificAccount: selectedQuotation.vendorCode, // Use vendorCode as vendorSpecificAccount
                    notes: `Item: ${item.description} | Provider: ${selectedQuotation.provider} | Amount: $${selectedQuotation.amount} | Payment: ${paymentMethod}`
                };
                
                const newExpense = new Expense(expenseData);
                await newExpense.save();
                
                // ✅ CREATE DOUBLE-ENTRY TRANSACTION FOR ITEM WITH QUOTATION
                try {
                    console.log(`💰 Creating double-entry transaction for item ${i} with quotation`);
                    
                    // Create a temp request object for the accounting service
                    const tempRequest = {
                        _id: request._id,
                        title: request.title,
                        residence: request.residence,
                        items: [item], // Only this item
                        totalEstimatedCost: selectedQuotation.amount,
                        isTemplate: false,
                        itemIndex: i,
                        skipExpenseCreation: true, // Skip expense creation since we already created it
                        disableDuplicateCheck: true
                    };

                    const transactionResult = await DoubleEntryAccountingService.recordMaintenanceApproval(tempRequest, user);

                    // Link expense to transaction
                    if (transactionResult && transactionResult.transaction) {
                        newExpense.transactionId = transactionResult.transaction._id;
                        await newExpense.save();
                        console.log(`✅ Linked expense to transaction: ${transactionResult.transaction._id}`);
                    }
                    
                } catch (transactionError) {
                    console.error(`❌ Error creating double-entry transaction for item ${i}:`, transactionError);
                    // Don't fail the expense creation if transaction fails
                }
                
                createdExpenses.push(newExpense);
                console.log(`✅ Expense created for item ${i} with selected quotation: ${expenseId} (Payment: ${paymentMethod})`);
                
            } else {
                // Item without quotation - create expense with estimated cost (default to cash)
                const expenseId = await generateUniqueId('EXP');
                
                // Enhanced account resolution using DoubleEntryAccountingService
                let expenseAccountCode = '5007'; // Default to Property Maintenance
                try {
                    expenseAccountCode = await DoubleEntryAccountingService.resolveExpenseAccount(item, request);
                } catch (error) {
                    console.warn('Error resolving expense account, using default:', error.message);
                    // Fallback to default mapping
                    const categoryExpenseMap = {
                        'maintenance': '5007', // Property Maintenance
                        'utilities': '5003',   // Utilities - Electricity
                        'supplies': '5011',    // Maintenance Supplies
                        'equipment': '5007',   // Property Maintenance
                        'services': '5062',    // Professional Fees
                        'cleaning': '5009',    // Cleaning Services
                        'security': '5014',    // Security Services
                        'landscaping': '5012', // Garden & Landscaping
                        'electrical': '5007',  // Property Maintenance
                        'plumbing': '5007',    // Property Maintenance
                        'carpentry': '5007',  // Property Maintenance
                        'painting': '5007',   // Property Maintenance
                        'other': '5007'        // Property Maintenance
                    };
                    expenseAccountCode = categoryExpenseMap[item.category] || '5007';
                }
                
                const expenseData = {
                    expenseId,
                    requestId: request._id,
                    residence: request.residence,
                    category: item.category || 'Other',
                    amount: item.estimatedCost || item.totalCost || 0,
                    description: `${request.title || 'Request'} - ${item.description}`,
                    expenseDate: new Date(),
                    paymentStatus: 'Pending',
                    createdBy: user._id,
                    period: 'monthly',
                    paymentMethod: 'Cash', // Default to cash for items without quotations
                    approvedBy: user._id,
                    approvedAt: new Date(),
                    approvedByEmail: user.email,
                    itemIndex: i,
                    expenseAccountCode: expenseAccountCode, // Set expense account code for items without quotations
                    notes: `Item: ${item.description} | Estimated cost: $${item.estimatedCost || item.totalCost || 0} | Payment: Cash | Account: ${expenseAccountCode} | Auto-resolved from description`
                };
                
                const newExpense = new Expense(expenseData);
                await newExpense.save();
                
                // ✅ CREATE DOUBLE-ENTRY TRANSACTION FOR ITEM WITHOUT QUOTATION
                try {
                    console.log(`💰 Creating double-entry transaction for item ${i} without quotation`);
                    
                    // Create a temp request object for the accounting service
                    const tempRequest = {
                        _id: request._id,
                        title: request.title,
                        residence: request.residence,
                        items: [item], // Only this item
                        totalEstimatedCost: item.estimatedCost || item.totalCost || 0,
                        isTemplate: false,
                        itemIndex: i,
                        skipExpenseCreation: true, // Skip expense creation since we already created it
                        disableDuplicateCheck: true
                    };

                    const transactionResult = await DoubleEntryAccountingService.recordMaintenanceApproval(tempRequest, user);

                    // Link expense to transaction
                    if (transactionResult && transactionResult.transaction) {
                        newExpense.transactionId = transactionResult.transaction._id;
                        await newExpense.save();
                        console.log(`✅ Linked expense to transaction: ${transactionResult.transaction._id}`);
                    }
                    
                } catch (transactionError) {
                    console.error(`❌ Error creating double-entry transaction for item ${i}:`, transactionError);
                    // Don't fail the expense creation if transaction fails
                }
                
                createdExpenses.push(newExpense);
                console.log(`✅ Expense created for item ${i} without quotation: ${expenseId} (Payment: Cash)`);
            }
        }
        
        console.log(`✅ Created ${createdExpenses.length} expenses for request ${request._id}`);
        return createdExpenses;
        
    } catch (error) {
        console.error('Error creating itemized expenses for request:', error);
        throw error;
    }
}

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
                // Find the approved quotation to get vendor information
                let vendorId = null;
                let vendorSpecificAccount = null;
                
                // Check for regular quotations first
                if (request.quotations && request.quotations.length > 0) {
                    const selectedQuotation = request.quotations.find(q => q.isSelected || q.isApproved);
                    if (selectedQuotation && selectedQuotation.provider) {
                        // Find or create vendor for the provider
                        const vendor = await autoCreateVendor(selectedQuotation.provider, user, request.type || 'other');
                        if (vendor) {
                            vendorId = vendor._id;
                            vendorSpecificAccount = vendor.chartOfAccountsCode;
                            console.log(`Linked vendor ${vendor.businessName} (${vendor.chartOfAccountsCode}) to expense from maintenance request`);
                        }
                    }
                }
                
                // If no regular quotations, check itemized quotations
                if (!vendorId && request.items && request.items.length > 0) {
                    for (const item of request.items) {
                        if (item.quotations && item.quotations.length > 0) {
                            const selectedQuotation = item.quotations.find(q => q.isSelected || q.isApproved);
                            if (selectedQuotation) {
                                // Use vendor information from the quotation if available
                                if (selectedQuotation.vendorId && selectedQuotation.vendorCode) {
                                    vendorId = selectedQuotation.vendorId;
                                    vendorSpecificAccount = selectedQuotation.vendorCode;
                                    
                                    // Also populate vendor details on the main request
                                    if (!request.vendorId) {
                                        request.vendorId = selectedQuotation.vendorId;
                                        request.vendorCode = selectedQuotation.vendorCode;
                                        request.vendorName = selectedQuotation.vendorName;
                                        request.vendorType = selectedQuotation.vendorType;
                                        request.vendorContact = selectedQuotation.vendorContact;
                                        request.expenseCategory = selectedQuotation.expenseCategory;
                                        request.paymentMethod = selectedQuotation.paymentMethod;
                                        request.hasBankDetails = selectedQuotation.hasBankDetails;
                                        
                                        console.log(`✅ Added vendor details to main request from selected quotation: ${selectedQuotation.vendorName} (${selectedQuotation.vendorCode})`);
                                    }
                                    
                                    console.log(`Linked vendor from quotation: ${selectedQuotation.vendorName} (${selectedQuotation.vendorCode})`);
                                    break;
                                } else if (selectedQuotation.provider) {
                                    // Fallback: Find or create vendor for the provider
                                    const vendor = await autoCreateVendor(selectedQuotation.provider, user, request.type || 'other');
                                    if (vendor) {
                                        vendorId = vendor._id;
                                        vendorSpecificAccount = vendor.chartOfAccountsCode;
                                        
                                        // Also populate vendor details on the main request
                                        if (!request.vendorId) {
                                            request.vendorId = vendor._id;
                                            request.vendorCode = vendor.chartOfAccountsCode;
                                            request.vendorName = vendor.businessName;
                                            request.vendorType = vendor.vendorType;
                                            request.vendorContact = {
                                                firstName: vendor.contactPerson?.firstName || '',
                                                lastName: vendor.contactPerson?.lastName || '',
                                                email: vendor.contactPerson?.email || '',
                                                phone: vendor.contactPerson?.phone || ''
                                            };
                                            request.expenseCategory = vendor.expenseCategory;
                                            request.paymentMethod = 'Cash';
                                            request.hasBankDetails = !!(vendor.bankDetails && vendor.bankDetails.bankName);
                                            
                                            console.log(`✅ Added vendor details to main request from auto-created vendor: ${vendor.businessName} (${vendor.chartOfAccountsCode})`);
                                        }
                                        
                                        console.log(`Linked vendor ${vendor.businessName} (${vendor.chartOfAccountsCode}) to expense from itemized maintenance request`);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                
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
                    maintenanceRequestId: request._id,
                    vendorId: vendorId, // Link the vendor
                    vendorSpecificAccount: vendorSpecificAccount // Store the vendor account code
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
        
        // Find or create vendor for the provider
        let vendor = null;
        if (provider) {
            try {
                // First, try to find existing vendor
                vendor = await Vendor.findOne({ businessName: provider });
                
                if (vendor) {
                    console.log(`Found existing vendor for quotation: ${provider} (${vendor._id})`);
                } else {
                    // Vendor doesn't exist, create new one
                    console.log(`Vendor not found, creating new vendor: ${provider}`);
                    
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
                }
            } catch (vendorError) {
                console.error('Error finding/creating vendor:', vendorError);
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
        
        // Also populate vendor details on the main request if vendor was created
        if (vendor && !request.vendorId) {
            request.vendorId = vendor._id;
            request.vendorCode = vendor.chartOfAccountsCode;
            request.vendorName = vendor.businessName;
            request.vendorType = vendor.vendorType;
            request.vendorContact = {
                firstName: vendor.contactPerson?.firstName || '',
                lastName: vendor.contactPerson?.lastName || '',
                email: vendor.contactPerson?.email || '',
                phone: vendor.contactPerson?.phone || ''
            };
            request.expenseCategory = vendor.expenseCategory;
            request.paymentMethod = determinePaymentMethod(vendor);
            request.hasBankDetails = !!(vendor.bankDetails && vendor.bankDetails.bankName);
            
            console.log(`✅ Added vendor details to main request: ${vendor.businessName} (${vendor.chartOfAccountsCode})`);
        }
        
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
        
        // Find or create vendor for the provider
        let vendor = null;
        if (provider) {
            try {
                // First, try to find existing vendor
                vendor = await Vendor.findOne({ businessName: provider });
                
                if (vendor) {
                    console.log(`Found existing vendor for item quotation: ${provider} (${vendor._id})`);
                } else {
                    // Vendor doesn't exist, create new one
                    console.log(`Vendor not found, creating new vendor: ${provider}`);
                    
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
                }
            } catch (vendorError) {
                console.error('Error finding/creating vendor:', vendorError);
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
        
        // Also populate vendor details on the main request if vendor was created
        if (vendor && !request.vendorId) {
            request.vendorId = vendor._id;
            request.vendorCode = vendor.chartOfAccountsCode;
            request.vendorName = vendor.businessName;
            request.vendorType = vendor.vendorType;
            request.vendorContact = {
                firstName: vendor.contactPerson?.firstName || '',
                lastName: vendor.contactPerson?.lastName || '',
                email: vendor.contactPerson?.email || '',
                phone: vendor.contactPerson?.phone || ''
            };
            request.expenseCategory = vendor.expenseCategory;
            request.paymentMethod = determinePaymentMethod(vendor);
            request.hasBankDetails = !!(vendor.bankDetails && vendor.bankDetails.bankName);
            
            console.log(`✅ Added vendor details to main request: ${vendor.businessName} (${vendor.chartOfAccountsCode})`);
        }
        
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
        const { provider, amount, description, isSelected } = req.body;
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

        // Handle isSelected field update
        if (isSelected !== undefined && isSelected !== quotation.isSelected) {
            const previousSelection = quotation.isSelected;
            
            if (isSelected) {
                // Deselect all other quotations first
                request.quotations.forEach((otherQuotation, index) => {
                    if (otherQuotation._id.toString() !== quotationId && otherQuotation.isSelected) {
                        otherQuotation.isSelected = false;
                        otherQuotation.deselectedBy = user._id;
                        otherQuotation.deselectedAt = new Date();
                        otherQuotation.deselectedByEmail = user.email;
                        
                        // Ensure selectionHistory is initialized
                        if (!otherQuotation.selectionHistory) {
                            otherQuotation.selectionHistory = [];
                        }
                        
                        otherQuotation.selectionHistory.push({
                            action: 'deselected',
                            user: user._id,
                            userEmail: user.email,
                            timestamp: new Date(),
                            reason: `Deselected by admin when updating quotation selection`
                        });
                    }
                });

                // Select this quotation
                quotation.isSelected = true;
                quotation.selectedBy = user._id;
                quotation.selectedAt = new Date();
                quotation.selectedByEmail = user.email;
                
                // Ensure selectionHistory is initialized
                if (!quotation.selectionHistory) {
                    quotation.selectionHistory = [];
                }
                
                quotation.selectionHistory.push({
                    action: 'selected',
                    user: user._id,
                    userEmail: user.email,
                    timestamp: new Date(),
                    reason: 'Selected by admin via quotation update'
                });

                changes.push('Quotation selected');
            } else {
                // Deselect this quotation
                quotation.isSelected = false;
                quotation.deselectedBy = user._id;
                quotation.deselectedAt = new Date();
                quotation.deselectedByEmail = user.email;
                
                // Ensure selectionHistory is initialized
                if (!quotation.selectionHistory) {
                    quotation.selectionHistory = [];
                }
                
                quotation.selectionHistory.push({
                    action: 'deselected',
                    user: user._id,
                    userEmail: user.email,
                    timestamp: new Date(),
                    reason: 'Deselected by admin via quotation update'
                });

                changes.push('Quotation deselected');
            }
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

        // Recalculate total estimated cost if selection changed
        if (isSelected !== undefined && isSelected !== quotation.isSelected) {
            let totalEstimatedCost = 0;
            
            // Add cost from request-level selected quotations
            if (request.quotations && request.quotations.length > 0) {
                request.quotations.forEach(q => {
                    if (q.isSelected) {
                        totalEstimatedCost += q.amount;
                    }
                });
            }
            
            // Add cost from items with selected quotations
            if (request.items && request.items.length > 0) {
                request.items.forEach(item => {
                    if (item.quotations && item.quotations.length > 0) {
                        const selectedQuotation = item.quotations.find(q => q.isSelected);
                        if (selectedQuotation) {
                            totalEstimatedCost += selectedQuotation.amount;
                        } else {
                            totalEstimatedCost += item.totalCost || 0;
                        }
                    } else {
                        totalEstimatedCost += item.totalCost || 0;
                    }
                });
            }
            
            request.totalEstimatedCost = totalEstimatedCost;
            changes.push(`Total estimated cost recalculated to: $${totalEstimatedCost}`);
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
        const { provider, amount, description, isSelected } = req.body;
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

        // Handle isSelected field update
        if (isSelected !== undefined && isSelected !== quotation.isSelected) {
            if (isSelected) {
                // Deselect all other quotations for this item first
                item.quotations.forEach((otherQuotation, index) => {
                    if (index !== parseInt(quotationIndex) && otherQuotation.isSelected) {
                        otherQuotation.isSelected = false;
                        otherQuotation.deselectedBy = user._id;
                        otherQuotation.deselectedAt = new Date();
                        otherQuotation.deselectedByEmail = user.email;
                        
                        // Ensure selectionHistory is initialized
                        if (!otherQuotation.selectionHistory) {
                            otherQuotation.selectionHistory = [];
                        }
                        
                        otherQuotation.selectionHistory.push({
                            action: 'deselected',
                            user: user._id,
                            userEmail: user.email,
                            timestamp: new Date(),
                            reason: `Deselected by admin when updating quotation selection`
                        });
                    }
                });

                // Select this quotation
                quotation.isSelected = true;
                quotation.selectedBy = user._id;
                quotation.selectedAt = new Date();
                quotation.selectedByEmail = user.email;
                
                // Ensure selectionHistory is initialized
                if (!quotation.selectionHistory) {
                    quotation.selectionHistory = [];
                }
                
                quotation.selectionHistory.push({
                    action: 'selected',
                    user: user._id,
                    userEmail: user.email,
                    timestamp: new Date(),
                    reason: 'Selected by admin via quotation update'
                });

                // Update item total cost to match selected quotation
                item.totalCost = quotation.amount;
                item.unitCost = quotation.amount / item.quantity;

                changes.push('Quotation selected and item cost updated');
            } else {
                // Deselect this quotation
                quotation.isSelected = false;
                quotation.deselectedBy = user._id;
                quotation.deselectedAt = new Date();
                quotation.deselectedByEmail = user.email;
                
                // Ensure selectionHistory is initialized
                if (!quotation.selectionHistory) {
                    quotation.selectionHistory = [];
                }
                
                quotation.selectionHistory.push({
                    action: 'deselected',
                    user: user._id,
                    userEmail: user.email,
                    timestamp: new Date(),
                    reason: 'Deselected by admin via quotation update'
                });

                changes.push('Quotation deselected');
            }
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

        // Recalculate total estimated cost if selection changed
        if (isSelected !== undefined && isSelected !== quotation.isSelected) {
            let totalEstimatedCost = 0;
            
            // Add cost from request-level selected quotations
            if (request.quotations && request.quotations.length > 0) {
                request.quotations.forEach(q => {
                    if (q.isSelected) {
                        totalEstimatedCost += q.amount;
                    }
                });
            }
            
            // Add cost from items with selected quotations
            if (request.items && request.items.length > 0) {
                request.items.forEach(item => {
                    if (item.quotations && item.quotations.length > 0) {
                        const selectedQuotation = item.quotations.find(q => q.isSelected);
                        if (selectedQuotation) {
                            totalEstimatedCost += selectedQuotation.amount;
                        } else {
                            totalEstimatedCost += item.totalCost || 0;
                        }
                    } else {
                        totalEstimatedCost += item.totalCost || 0;
                    }
                });
            }
            
            request.totalEstimatedCost = totalEstimatedCost;
            changes.push(`Total estimated cost recalculated to: $${totalEstimatedCost}`);
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
            console.log(`Found existing vendor: ${existingVendor.businessName} (${existingVendor._id})`);
            return existingVendor;
        }

        // Auto-generate unique chart of accounts code for vendor
        // Use consistent logic with vendorController.js
        const vendorCount = await Vendor.countDocuments();
        let chartOfAccountsCode = `200${(vendorCount + 1).toString().padStart(3, '0')}`;
        
        // Double-check that this code doesn't already exist in accounts
        const existingAccount = await Account.findOne({ code: chartOfAccountsCode });
        if (existingAccount) {
            // If account exists, find the next available code
            let nextCode = vendorCount + 2;
            let newChartOfAccountsCode;
            do {
                newChartOfAccountsCode = `200${nextCode.toString().padStart(3, '0')}`;
                const accountExists = await Account.findOne({ code: newChartOfAccountsCode });
                if (!accountExists) break;
                nextCode++;
            } while (nextCode < 1000); // Safety limit
            
            console.log(`⚠️ Account code ${chartOfAccountsCode} already exists, using ${newChartOfAccountsCode} instead`);
            chartOfAccountsCode = newChartOfAccountsCode;
        }
        
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

        // Log auto-created vendor
        await logVendorOperation('create', savedVendor, user._id, {
            source: 'Auto-Creation from Quotation',
            providerName: providerName,
            category: category,
            chartOfAccountsCode: chartOfAccountsCode,
            isAutoGenerated: true
        });

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
            
            // Log vendor account creation
            await logAccountOperation('create', vendorAccount, vendor.createdBy, {
                source: 'Auto-Creation from Quotation',
                vendorId: vendor._id,
                vendorName: vendor.businessName,
                accountCode: vendorAccount.code,
                accountType: 'Liability'
            });
            
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

// Download quotation file
exports.downloadQuotationFile = async (req, res) => {
    try {
        const { id, itemIndex, quotationIndex } = req.params;
        const user = req.user;

        const request = await Request.findById(id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Validate indices
        if (!request.items || itemIndex < 0 || itemIndex >= request.items.length) {
            return res.status(400).json({ message: 'Invalid item index' });
        }

        const item = request.items[itemIndex];
        if (!item.quotations || quotationIndex < 0 || quotationIndex >= item.quotations.length) {
            return res.status(400).json({ message: 'Invalid quotation index' });
        }

        const quotation = item.quotations[quotationIndex];
        
        if (!quotation.fileUrl) {
            return res.status(404).json({ message: 'No file attached to this quotation' });
        }

        // Redirect to S3 URL for download
        res.redirect(quotation.fileUrl);

    } catch (error) {
        console.error('Error downloading quotation file:', error);
        res.status(500).json({ message: error.message });
    }
};

// Select quotation for an item (Admin only)
exports.selectItemQuotation = async (req, res) => {
    try {
        const { requestId, itemIndex, quotationIndex } = req.params;
        const { reason } = req.body;
        const user = req.user;

        // Validate user role (admin only)
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can select quotations' });
        }

        const request = await Request.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Validate item index
        if (!request.items || itemIndex < 0 || itemIndex >= request.items.length) {
            return res.status(400).json({ message: 'Invalid item index' });
        }

        const item = request.items[itemIndex];
        
        // Validate quotation index
        if (!item.quotations || quotationIndex < 0 || quotationIndex >= item.quotations.length) {
            return res.status(400).json({ message: 'Invalid quotation index' });
        }

        // Deselect all other quotations for this item
        item.quotations.forEach((quotation, index) => {
            if (index !== parseInt(quotationIndex)) {
                quotation.isSelected = false;
                quotation.deselectedBy = user._id;
                quotation.deselectedAt = new Date();
                quotation.deselectedByEmail = user.email;
                
                // Ensure selectionHistory is initialized as an array
                if (!quotation.selectionHistory) {
                    quotation.selectionHistory = [];
                }
                
                quotation.selectionHistory.push({
                    action: 'deselected',
                    user: user._id,
                    userEmail: user.email,
                    timestamp: new Date(),
                    reason: `Deselected by admin when selecting quotation ${parseInt(quotationIndex) + 1}`
                });
            }
        });

        // Select the specified quotation
        const selectedQuotation = item.quotations[quotationIndex];
        selectedQuotation.isSelected = true;
        selectedQuotation.selectedBy = user._id;
        selectedQuotation.selectedAt = new Date();
        selectedQuotation.selectedByEmail = user.email;
        
        // Ensure selectionHistory is initialized as an array
        if (!selectedQuotation.selectionHistory) {
            selectedQuotation.selectionHistory = [];
        }
        
        selectedQuotation.selectionHistory.push({
            action: 'selected',
            user: user._id,
            userEmail: user.email,
            timestamp: new Date(),
            reason: reason || 'Selected by admin'
        });

        // Update item total cost to match selected quotation
        item.totalCost = selectedQuotation.amount;
        item.unitCost = selectedQuotation.amount / item.quantity;

        // Recalculate total estimated cost
        let totalEstimatedCost = 0;
        request.items.forEach(item => {
            if (item.quotations && item.quotations.length > 0) {
                const selectedQuotation = item.quotations.find(q => q.isSelected);
                if (selectedQuotation) {
                    totalEstimatedCost += selectedQuotation.amount;
                } else {
                    totalEstimatedCost += item.totalCost;
                }
            } else {
                totalEstimatedCost += item.totalCost;
            }
        });

        request.totalEstimatedCost = totalEstimatedCost;

        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'Quotation selected',
            user: user._id,
            changes: [
                `Admin selected quotation from ${selectedQuotation.provider} for item ${itemIndex + 1}`,
                `Amount: $${selectedQuotation.amount}`,
                `Reason: ${reason || 'No reason provided'}`
            ]
        });

        // Mark the arrays as modified to ensure they are saved
        request.markModified('items');
        
        // Mark the arrays as modified to ensure they are saved
        request.markModified('quotations');
        
        await request.save();

        const updatedRequest = await Request.findById(requestId)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.selectedBy', 'firstName lastName email')
            .populate('items.quotations.deselectedBy', 'firstName lastName email')
            .populate('residence', 'name');

        res.status(200).json({
            message: 'Quotation selected successfully',
            request: updatedRequest,
            selectedQuotation: {
                provider: selectedQuotation.provider,
                amount: selectedQuotation.amount,
                selectedBy: user.email,
                selectedAt: selectedQuotation.selectedAt
            }
        });

    } catch (error) {
        console.error('Error selecting quotation:', error);
        res.status(500).json({ message: error.message });
    }
};

// Select quotation for request-level quotations (Admin only)
exports.selectRequestQuotation = async (req, res) => {
    try {
        const { requestId, quotationIndex } = req.params;
        const { reason } = req.body;
        const user = req.user;

        // Validate user role (admin only)
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can select quotations' });
        }

        const request = await Request.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Validate quotation index
        if (!request.quotations || quotationIndex < 0 || quotationIndex >= request.quotations.length) {
            return res.status(400).json({ message: 'Invalid quotation index' });
        }

        // Deselect all other quotations
        request.quotations.forEach((quotation, index) => {
            if (index !== parseInt(quotationIndex)) {
                quotation.isSelected = false;
                quotation.deselectedBy = user._id;
                quotation.deselectedAt = new Date();
                quotation.deselectedByEmail = user.email;
                
                // Ensure selectionHistory is initialized as an array
                if (!quotation.selectionHistory) {
                    quotation.selectionHistory = [];
                }
                
                quotation.selectionHistory.push({
                    action: 'deselected',
                    user: user._id,
                    userEmail: user.email,
                    timestamp: new Date(),
                    reason: `Deselected by admin when selecting quotation ${parseInt(quotationIndex) + 1}`
                });
            }
        });

        // Select the specified quotation
        const selectedQuotation = request.quotations[quotationIndex];
        selectedQuotation.isSelected = true;
        selectedQuotation.selectedBy = user._id;
        selectedQuotation.selectedAt = new Date();
        selectedQuotation.selectedByEmail = user.email;
        
        // Ensure selectionHistory is initialized as an array
        if (!selectedQuotation.selectionHistory) {
            selectedQuotation.selectionHistory = [];
        }
        
        selectedQuotation.selectionHistory.push({
            action: 'selected',
            user: user._id,
            userEmail: user.email,
            timestamp: new Date(),
            reason: reason || 'Selected by admin'
        });

        // Update request amount
        request.amount = selectedQuotation.amount;

        // Add to request history
        request.requestHistory.push({
            date: new Date(),
            action: 'Quotation selected',
            user: user._id,
            changes: [
                `Admin selected quotation from ${selectedQuotation.provider}`,
                `Amount: $${selectedQuotation.amount}`,
                `Reason: ${reason || 'No reason provided'}`
            ]
        });

        // Mark the arrays as modified to ensure they are saved
        request.markModified('quotations');
        
        await request.save();

        const updatedRequest = await Request.findById(requestId)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('quotations.uploadedBy', 'firstName lastName email')
            .populate('quotations.selectedBy', 'firstName lastName email')
            .populate('quotations.deselectedBy', 'firstName lastName email')
            .populate('residence', 'name');

        res.status(200).json({
            message: 'Quotation selected successfully',
            request: updatedRequest,
            selectedQuotation: {
                provider: selectedQuotation.provider,
                amount: selectedQuotation.amount,
                selectedBy: user.email,
                selectedAt: selectedQuotation.selectedAt
            }
        });

    } catch (error) {
        console.error('Error selecting quotation:', error);
        res.status(500).json({ message: error.message });
    }
};

// Override quotation selection (Finance only)
exports.overrideQuotationSelection = async (req, res) => {
    try {
        const { requestId, itemIndex, quotationIndex } = req.params;
        const { reason } = req.body;
        const user = req.user;

        // Validate user role (finance only)
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can override quotation selections' });
        }

        const request = await Request.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Validate item index
        if (!request.items || itemIndex < 0 || itemIndex >= request.items.length) {
            return res.status(400).json({ message: 'Invalid item index' });
        }

        const item = request.items[itemIndex];
        
        // Validate quotation index
        if (!item.quotations || quotationIndex < 0 || quotationIndex >= item.quotations.length) {
            return res.status(400).json({ message: 'Invalid quotation index' });
        }

        // Find previously selected quotation
        const previouslySelected = item.quotations.find(q => q.isSelected);
        let overrideMessage = '';

        if (previouslySelected) {
            // Deselect previously selected quotation
            previouslySelected.isSelected = false;
            previouslySelected.deselectedBy = user._id;
            previouslySelected.deselectedAt = new Date();
            previouslySelected.deselectedByEmail = user.email;
            
            // Ensure selectionHistory is initialized as an array
            if (!previouslySelected.selectionHistory) {
                previouslySelected.selectionHistory = [];
            }
            
            previouslySelected.selectionHistory.push({
                action: 'deselected',
                user: user._id,
                userEmail: user.email,
                timestamp: new Date(),
                reason: `Deselected by finance (${user.email}) - ${reason || 'Override selection'}`
            });

            overrideMessage = `Finance (${user.email}) deselected quotation from ${previouslySelected.selectedByEmail} and selected new quotation`;
        }

        // Select the new quotation
        const selectedQuotation = item.quotations[quotationIndex];
        selectedQuotation.isSelected = true;
        selectedQuotation.selectedBy = user._id;
        selectedQuotation.selectedAt = new Date();
        selectedQuotation.selectedByEmail = user.email;
        
        // Ensure selectionHistory is initialized as an array
        if (!selectedQuotation.selectionHistory) {
            selectedQuotation.selectionHistory = [];
        }
        
        selectedQuotation.selectionHistory.push({
            action: 'selected',
            user: user._id,
            userEmail: user.email,
            timestamp: new Date(),
            reason: reason || 'Selected by finance'
        });

        // Update item total cost to match selected quotation
        item.totalCost = selectedQuotation.amount;
        item.unitCost = selectedQuotation.amount / item.quantity;

        // Recalculate total estimated cost
        let totalEstimatedCost = 0;
        request.items.forEach(item => {
            if (item.quotations && item.quotations.length > 0) {
                const selectedQuotation = item.quotations.find(q => q.isSelected);
                if (selectedQuotation) {
                    totalEstimatedCost += selectedQuotation.amount;
                } else {
                    totalEstimatedCost += item.totalCost;
                }
            } else {
                totalEstimatedCost += item.totalCost;
            }
        });

        request.totalEstimatedCost = totalEstimatedCost;

        // Add to request history
        const historyMessage = overrideMessage || `Finance (${user.email}) selected quotation from ${selectedQuotation.provider}`;
        request.requestHistory.push({
            date: new Date(),
            action: 'Quotation selection overridden',
            user: user._id,
            changes: [
                historyMessage,
                `Amount: $${selectedQuotation.amount}`,
                `Reason: ${reason || 'Finance override'}`
            ]
        });

        // Mark the arrays as modified to ensure they are saved
        request.markModified('items');
        
        await request.save();

        const updatedRequest = await Request.findById(requestId)
            .populate('submittedBy', 'firstName lastName email role')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.selectedBy', 'firstName lastName email')
            .populate('items.quotations.deselectedBy', 'firstName lastName email')
            .populate('residence', 'name');

        res.status(200).json({
            message: 'Quotation selection overridden successfully',
            request: updatedRequest,
            selectedQuotation: {
                provider: selectedQuotation.provider,
                amount: selectedQuotation.amount,
                selectedBy: user.email,
                selectedAt: selectedQuotation.selectedAt,
                override: !!previouslySelected
            }
        });

    } catch (error) {
        console.error('Error overriding quotation selection:', error);
        res.status(500).json({ message: error.message });
    }
};

// Mark expense as paid with double-entry bookkeeping
exports.markExpenseAsPaid = async (req, res) => {
    try {
        const { expenseId } = req.params;
        const { paymentMethod } = req.body;
        const user = req.user;

        // Validate user role (finance only)
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can mark expenses as paid' });
        }

        // Find the expense
        const expense = await Expense.findById(expenseId)
            .populate('residence', 'name')
            .populate('items.selectedQuotation.vendorId');

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        // Check if expense is already paid
        if (expense.paymentStatus === 'Paid') {
            return res.status(400).json({ message: 'Expense is already marked as paid' });
        }

        // Mark expense as paid with double-entry bookkeeping
        const FinancialService = require('../services/financialService');
        const paymentResult = await FinancialService.markExpenseAsPaid(expense, user, paymentMethod);

        // Update request status if linked
        if (expense.requestId) {
            await Request.findByIdAndUpdate(expense.requestId, {
                $set: { 
                    status: 'completed',
                    'approval.finance.paymentStatus': 'Paid',
                    'approval.finance.paidAt': new Date(),
                    'approval.finance.paidBy': user._id
                }
            });
        }

        console.log('✅ Expense marked as paid with double-entry bookkeeping');

        res.status(200).json({
            message: 'Expense marked as paid successfully',
            expense: {
                expenseId: expense.expenseId,
                paymentStatus: expense.paymentStatus,
                paidBy: user.email,
                paidAt: expense.paidDate,
                paymentMethod: expense.paymentMethod
            },
            financial: {
                paymentTransactionId: paymentResult.paymentTransaction.transactionId,
                paymentEntriesCount: paymentResult.paymentEntries.length,
                totalPaid: expense.amount
            }
        });

    } catch (error) {
        console.error('Error marking expense as paid:', error);
        res.status(500).json({ message: error.message });
    }
};