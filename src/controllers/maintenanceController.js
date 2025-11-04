const Maintenance = require('../models/Maintenance');
const Expense = require('../models/finance/Expense');
const { generateUniqueId } = require('../utils/idGenerator');
const EmailNotificationService = require('../services/emailNotificationService');
const { s3, s3Configs } = require('../config/s3');
const { Residence } = require('../models/Residence');

// Get all maintenance requests
exports.getAllMaintenance = async (req, res) => {
    try {
        const maintenance = await Maintenance.find()
            .sort({ dateAssigned: -1 })
            .populate('requestedBy', 'firstName lastName email role')
            .populate('student', 'firstName lastName email');
        res.status(200).json(maintenance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get maintenance request by ID
exports.getMaintenanceById = async (req, res) => {
    try {
        const maintenance = await Maintenance.findById(req.params.id)
            .populate('requestedBy', 'firstName lastName email role')
            .populate('student', 'firstName lastName email');
        if (!maintenance) {
            return res.status(404).json({ message: 'Maintenance request not found' });
        }
        res.status(200).json(maintenance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create new maintenance request
exports.createMaintenance = async (req, res) => {
    try {
        // Accept both 'issue' and 'title' (map 'title' to 'issue' if 'issue' is missing)
        let { issue, title, description, room, category, priority, residence, residenceId, assignedTo, amount, laborCost, paymentMethod, paymentIcon } = req.body;

        // Map 'title' to 'issue' if 'issue' is not provided
        if (!issue && title) {
            issue = title;
        }

        // Accept 'residenceId' as an alias for 'residence'
        if (!residence && residenceId) {
            residence = residenceId;
        }

        // Set defaults for optional fields if not provided
        const maintenanceIssue = issue || title || 'Maintenance Request';
        const maintenanceDescription = description || 'No description provided';
        const maintenanceRoom = room || 'General';
        
        // Map category to valid enum value
        let maintenanceCategory = category || 'general_maintenance';
        if (maintenanceCategory === 'general') {
            maintenanceCategory = 'general_maintenance';
        }
        
        // Only residence is truly required
        if (!residence) {
            return res.status(400).json({ message: 'Residence is required' });
        }

        // Validate payment method if provided
        if (paymentMethod) {
            const validPaymentMethods = ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal'];
            const normalizedPaymentMethod = paymentMethod.toLowerCase();
            const validLowercaseMethods = validPaymentMethods.map(method => method.toLowerCase());
            
            if (!validLowercaseMethods.includes(normalizedPaymentMethod)) {
                return res.status(400).json({ 
                    message: 'Invalid payment method',
                    validPaymentMethods: validPaymentMethods
                });
            }
            
            // Normalize to title case
            const mapping = {
                'bank transfer': 'Bank Transfer',
                'cash': 'Cash',
                'online payment': 'Online Payment',
                'ecocash': 'Ecocash',
                'innbucks': 'Innbucks',
                'mastercard': 'MasterCard',
                'visa': 'Visa',
                'paypal': 'PayPal'
            };
            paymentMethod = mapping[normalizedPaymentMethod];
        }

        // Always set requestedBy from the authenticated user
        const requestedBy = req.user ? req.user._id : undefined;

        // Handle image uploads if present
        let images = [];
        
        // Handle multipart file uploads
        if (req.files && req.files.length > 0) {
            console.log(`Processing ${req.files.length} images for maintenance request`);
            
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                try {
                    // Generate S3 key for maintenance images
                    const timestamp = Date.now();
                    const s3Key = `maintenance-images/${residence}/${timestamp}_${i}_${file.originalname}`;

                    // Upload to S3
                    const s3UploadParams = {
                        Bucket: s3Configs.general.bucket,
                        Key: s3Key,
                        Body: file.buffer,
                        ContentType: file.mimetype,
                        ACL: 'public-read',
                        Metadata: {
                            fieldName: file.fieldname,
                            uploadedBy: requestedBy?.toString() || 'unknown',
                            uploadDate: new Date().toISOString(),
                            uploadType: 'maintenance',
                            residenceId: residence
                        }
                    };

                    const s3Result = await s3.upload(s3UploadParams).promise();
                    console.log(`Image ${i + 1} uploaded successfully to S3:`, s3Result.Location);

                    images.push({
                        url: s3Result.Location,
                        caption: `Maintenance image ${i + 1}`,
                        uploadedAt: new Date()
                    });
                } catch (imageError) {
                    console.error(`Error uploading image ${i + 1}:`, imageError);
                    // Continue with other images even if one fails
                }
            }
        }
        
        // Handle pre-uploaded images sent as JSON data
        if (req.body.images && Array.isArray(req.body.images) && req.body.images.length > 0) {
            console.log(`Processing ${req.body.images.length} pre-uploaded images for maintenance request`);
            
            for (let i = 0; i < req.body.images.length; i++) {
                const imageData = req.body.images[i];
                try {
                    // If the image already has a URL, use it directly
                    if (imageData.url) {
                        images.push({
                            url: imageData.url,
                            caption: imageData.caption || `Maintenance image ${i + 1}`,
                            uploadedAt: imageData.uploadedAt ? new Date(imageData.uploadedAt) : new Date()
                        });
                        console.log(`Added pre-uploaded image ${i + 1}:`, imageData.url);
                    }
                } catch (imageError) {
                    console.error(`Error processing pre-uploaded image ${i + 1}:`, imageError);
                    // Continue with other images even if one fails
                }
            }
        }

        // Build the maintenance request data
        const maintenanceData = {
            issue: maintenanceIssue,
            description: maintenanceDescription,
            room: maintenanceRoom,
            category: maintenanceCategory,
            priority,
            residence,
            status: 'pending',
            requestDate: new Date(),
            requestedBy,
            amount: amount ? parseFloat(amount) : 0,
            laborCost: laborCost ? parseFloat(laborCost) : 0,
            paymentMethod,
            paymentIcon,
            images: images
        };

        // If assignedTo is provided, set it
        if (assignedTo && assignedTo._id) {
            maintenanceData.assignedTo = {
                _id: assignedTo._id,
                name: assignedTo.name,
                surname: assignedTo.surname,
                role: assignedTo.role
            };
        }

        const maintenance = new Maintenance(maintenanceData);
        const savedMaintenance = await maintenance.save();

        // Send email notifications (non-blocking)
        try {
            // Check if the user is an admin - if so, send to CEO and Finance Admin
            if (req.user && (req.user.role === 'admin' || req.user.role === 'property_manager')) {
                await EmailNotificationService.sendAdminMaintenanceRequestToCEOAndFinance(savedMaintenance, req.user);
            } else {
                // For students, send to admins
                await EmailNotificationService.sendMaintenanceRequestSubmitted(savedMaintenance, req.user);
            }
            
            // If there's a student associated with this request, send confirmation email
            if (savedMaintenance.student) {
                const User = require('../models/User');
                const student = await User.findById(savedMaintenance.student);
                if (student) {
                    await EmailNotificationService.sendMaintenanceRequestConfirmation(savedMaintenance, student);
                }
            }
        } catch (emailError) {
            console.error('Failed to send maintenance request email notifications:', emailError);
            // Don't fail the request if email fails
        }

        // Populate requestedBy for the response
        await savedMaintenance.populate('requestedBy', 'firstName lastName email role');
        res.status(201).json(savedMaintenance);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update maintenance request
exports.updateMaintenance = async (req, res) => {
    try {
        const { financeStatus, amount, paymentMethod, paymentIcon, dateApproved } = req.body;
        
        // Check if financeStatus is being updated to 'approved'
        const maintenance = await Maintenance.findById(req.params.id);
        if (!maintenance) {
            return res.status(404).json({ message: 'Maintenance request not found' });
        }

        // If financeStatus is being set to 'approved' and amount is provided, create an expense
        if (financeStatus === 'approved' && amount && amount > 0) {
            try {
                // Delete any existing expense for this maintenance request
                await Expense.deleteMany({ maintenanceRequestId: maintenance._id });

                // Generate unique expense ID
                const expenseId = await generateUniqueId('EXP');

                // Create expense data
                const approvalDate = dateApproved ? new Date(dateApproved) : new Date();
                const expenseData = {
                    expenseId,
                    residence: maintenance.residence,
                    category: 'Maintenance',
                    amount: parseFloat(amount),
                    description: `Maintenance: ${maintenance.issue} - ${maintenance.description}`,
                    expenseDate: approvalDate,
                    paymentStatus: 'Pending',
                    createdBy: req.user._id,
                    period: 'monthly',
                    paymentMethod: paymentMethod || maintenance.paymentMethod || 'Bank Transfer',
                    paymentIcon: paymentIcon || maintenance.paymentIcon,
                    maintenanceRequestId: maintenance._id,
                    notes: `Converted from maintenance request${maintenance.provider ? ` - Provider: ${maintenance.provider}` : ''}`
                };

                // Create the expense
                const newExpense = new Expense(expenseData);
                await newExpense.save();

                console.log(`Expense created for maintenance request ${maintenance._id}: ${expenseId}`);
            } catch (expenseError) {
                console.error('Error creating expense for maintenance:', expenseError);
                // Continue with maintenance update even if expense creation fails
            }
        }

        // Build safe update payload
        const updatePayload = { ...req.body };

        // Normalize and append images if provided in body
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'images')) {
            let incomingImages = [];

            try {
                let rawImages = req.body.images;

                // If images is a stringified JSON, parse it
                if (typeof rawImages === 'string') {
                    try { rawImages = JSON.parse(rawImages); } catch (_) {}
                }

                if (Array.isArray(rawImages)) {
                    incomingImages = rawImages;
                } else if (rawImages && typeof rawImages === 'object') {
                    // Single object sent instead of array
                    incomingImages = [rawImages];
                }

                // Map to schema shape
                incomingImages = incomingImages
                    .filter(img => img && (img.url || img.Location))
                    .map((img, index) => ({
                        url: img.url || img.Location,
                        caption: img.caption || `Maintenance image ${index + 1}`,
                        uploadedAt: img.uploadedAt ? new Date(img.uploadedAt) : new Date()
                    }));
            } catch (e) {
                console.error('Failed to normalize incoming images:', e);
                incomingImages = [];
            }

            // Remove direct images set from update payload to avoid cast errors
            delete updatePayload.images;

            if (incomingImages.length > 0) {
                // Use atomic push to append images
                await Maintenance.findByIdAndUpdate(
                    req.params.id,
                    { $push: { images: { $each: incomingImages } } },
                    { new: false }
                );
            }
        }

        // Proceed with remaining fields update
        const updatedMaintenance = await Maintenance.findByIdAndUpdate(
            req.params.id,
            updatePayload,
            { new: true, runValidators: true }
        );

        res.status(200).json(updatedMaintenance);
    } catch (error) {
        console.error('Error updating maintenance:', error);
        res.status(400).json({ message: error.message });
    }
};

// Delete maintenance request
exports.deleteMaintenance = async (req, res) => {
    try {
        const maintenance = await Maintenance.findByIdAndDelete(req.params.id);
        if (!maintenance) {
            return res.status(404).json({ message: 'Maintenance request not found' });
        }
        res.status(200).json({ message: 'Maintenance request deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get maintenance requests by status
exports.getMaintenanceByStatus = async (req, res) => {
    try {
        const maintenance = await Maintenance.find({ status: req.params.status })
            .sort({ dateAssigned: -1 })
            .populate('requestedBy', 'firstName lastName email role')
            .populate('student', 'firstName lastName email');
        res.status(200).json(maintenance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get maintenance requests by room
exports.getMaintenanceByRoom = async (req, res) => {
    try {
        const maintenance = await Maintenance.find({ room: req.params.room })
            .sort({ dateAssigned: -1 })
            .populate('requestedBy', 'firstName lastName email role')
            .populate('student', 'firstName lastName email');
        res.status(200).json(maintenance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get maintenance requests by priority
exports.getMaintenanceByPriority = async (req, res) => {
    try {
        const maintenance = await Maintenance.find({ priority: req.params.priority })
            .sort({ dateAssigned: -1 })
            .populate('requestedBy', 'firstName lastName email role')
            .populate('student', 'firstName lastName email');
        res.status(200).json(maintenance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Add update to request history
exports.addRequestHistory = async (req, res) => {
    try {
        const maintenance = await Maintenance.findById(req.params.id);
        if (!maintenance) {
            return res.status(404).json({ message: 'Maintenance request not found' });
        }
        
        maintenance.requestHistory.push({
            date: new Date(),
            action: req.body.action,
            user: req.body.user
        });
        
        const updatedMaintenance = await maintenance.save();
        res.status(200).json(updatedMaintenance);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Create property maintenance request with images (for properties page)
exports.createPropertyMaintenance = async (req, res) => {
    try {
        const { residenceId } = req.params;
        const { issue, title, description, room, category, priority, amount, laborCost, paymentMethod, paymentIcon } = req.body;

        // Validate residence exists
        const residence = await Residence.findById(residenceId);
        if (!residence) {
            return res.status(404).json({ message: 'Residence not found' });
        }

        // Use issue or title, with defaults if not provided
        const maintenanceIssue = issue || title || 'Property Maintenance Request';
        
        // Set defaults for optional fields
        const maintenanceDescription = description || 'No description provided';
        const maintenanceRoom = room || 'General';
        
        // Map category to valid enum value
        let maintenanceCategory = category || 'general_maintenance';
        if (maintenanceCategory === 'general') {
            maintenanceCategory = 'general_maintenance';
        }

        // Always set requestedBy from the authenticated user
        const requestedBy = req.user ? req.user._id : undefined;

        // Handle image uploads
        let images = [];
        
        // Handle multipart file uploads
        if (req.files && req.files.length > 0) {
            console.log(`Processing ${req.files.length} images for property maintenance request`);
            
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                try {
                    // Generate S3 key for maintenance images
                    const timestamp = Date.now();
                    const s3Key = `maintenance-images/${residenceId}/${timestamp}_${i}_${file.originalname}`;

                    // Upload to S3
                    const s3UploadParams = {
                        Bucket: s3Configs.general.bucket,
                        Key: s3Key,
                        Body: file.buffer,
                        ContentType: file.mimetype,
                        ACL: 'public-read',
                        Metadata: {
                            fieldName: file.fieldname,
                            uploadedBy: requestedBy?.toString() || 'unknown',
                            uploadDate: new Date().toISOString(),
                            uploadType: 'property-maintenance',
                            residenceId: residenceId,
                            residenceName: residence.name
                        }
                    };

                    const s3Result = await s3.upload(s3UploadParams).promise();
                    console.log(`Property maintenance image ${i + 1} uploaded successfully to S3:`, s3Result.Location);

                    images.push({
                        url: s3Result.Location,
                        caption: `Property maintenance image ${i + 1}`,
                        uploadedAt: new Date()
                    });
                } catch (imageError) {
                    console.error(`Error uploading property maintenance image ${i + 1}:`, imageError);
                    // Continue with other images even if one fails
                }
            }
        }
        
        // Handle pre-uploaded images sent as JSON data
        if (req.body.images && Array.isArray(req.body.images) && req.body.images.length > 0) {
            console.log(`Processing ${req.body.images.length} pre-uploaded images for property maintenance request`);
            
            for (let i = 0; i < req.body.images.length; i++) {
                const imageData = req.body.images[i];
                try {
                    // If the image already has a URL, use it directly
                    if (imageData.url) {
                        images.push({
                            url: imageData.url,
                            caption: imageData.caption || `Property maintenance image ${i + 1}`,
                            uploadedAt: imageData.uploadedAt ? new Date(imageData.uploadedAt) : new Date()
                        });
                        console.log(`Added pre-uploaded property maintenance image ${i + 1}:`, imageData.url);
                    }
                } catch (imageError) {
                    console.error(`Error processing pre-uploaded property maintenance image ${i + 1}:`, imageError);
                    // Continue with other images even if one fails
                }
            }
        }

        // Build the maintenance request data
        const maintenanceData = {
            issue: maintenanceIssue,
            description: maintenanceDescription,
            room: maintenanceRoom,
            category: maintenanceCategory,
            priority: priority || 'medium',
            residence: residenceId,
            status: 'pending',
            requestDate: new Date(),
            requestedBy,
            amount: amount ? parseFloat(amount) : 0,
            laborCost: laborCost ? parseFloat(laborCost) : 0,
            paymentMethod,
            paymentIcon,
            images: images
        };

        const maintenance = new Maintenance(maintenanceData);
        const savedMaintenance = await maintenance.save();

        // Populate the response with residence and user details
        const populatedMaintenance = await Maintenance.findById(savedMaintenance._id)
            .populate('requestedBy', 'firstName lastName email role')
            .populate('residence', 'name address');

        // Send email notifications (non-blocking)
        try {
            if (req.user && (req.user.role === 'admin' || req.user.role === 'property_manager')) {
                await EmailNotificationService.sendAdminMaintenanceRequestToCEOAndFinance(savedMaintenance, req.user);
            } else {
                await EmailNotificationService.sendMaintenanceRequestSubmitted(savedMaintenance, req.user);
            }
        } catch (emailError) {
            console.error('Error sending maintenance request email:', emailError);
            // Don't fail the request if email fails
        }

        res.status(201).json({
            success: true,
            message: 'Property maintenance request created successfully',
            data: {
                maintenance: populatedMaintenance,
                imagesUploaded: images.length,
                residence: {
                    id: residence._id,
                    name: residence.name
                }
            }
        });

    } catch (error) {
        console.error('Error creating property maintenance request:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to create property maintenance request',
            error: error.message 
        });
    }
}; 