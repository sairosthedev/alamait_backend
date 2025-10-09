const Maintenance = require('../../models/Maintenance');
const { validationResult } = require('express-validator');
const User = require('../../models/User');
const { Residence } = require('../../models/Residence');
const EmailNotificationService = require('../../services/emailNotificationService');

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

// Helper function to get status description
function getStatusDescription(status) {
    switch (status) {
        case 'pending':
            return 'Pending';
        case 'in-progress':
            return 'In Progress';
        case 'completed':
            return 'Completed';
        case 'rejected':
            return 'Rejected';
        case 'waitlisted':
            return 'Waitlisted';
        default:
            return status;
    }
}

// Get all maintenance requests for a student
exports.getMaintenanceRequests = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        let query = { student: req.user._id };
        if (status) {
            query.status = status;
        }

        // Get total count for pagination
        const total = await Maintenance.countDocuments(query);

        // Fetch requests with pagination and populate residence
        const requests = await Maintenance.find(query)
            .sort({ requestDate: -1 })
            .skip(skip)
            .limit(limit)
            .populate('assignedTo', 'firstName lastName')
            .populate('residence', 'name') // Populate residence name
            .lean();

        // Format requests to match frontend structure
        const formattedRequests = requests.map(request => ({
            id: request._id,
            title: request.title,
            description: request.description,
            location: request.location,
            category: request.category,
            priority: request.priority,
            status: mapStatusForStudent(request.status), // Map status for students
            statusDescription: getStatusDescription(mapStatusForStudent(request.status)), // Add status description
            requestDate: request.requestDate || request.createdAt,
            expectedCompletion: request.estimatedCompletion,
            residence: request.residence ? request.residence.name : 'Unknown', // Include residence name
            updates: request.updates ? request.updates.map(update => ({
                date: update.date,
                message: update.message,
                author: update.author
            })) : []
        }));

        res.json({
            requests: formattedRequests,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error in getMaintenanceRequests:', error);
        res.status(500).json({ error: 'Error retrieving maintenance requests' });
    }
};

// Create new maintenance request
exports.createMaintenanceRequest = async (req, res) => {
    try {
        console.log('=== CREATE MAINTENANCE REQUEST DEBUG ===');
        console.log('User ID:', req.user._id);
        console.log('Request body:', req.body);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, description, category, priority, location, images, residenceId, room, studentResponse } = req.body;

        // Get user's residence automatically
        const user = await User.findById(req.user._id);
        console.log('Found user:', user ? { id: user._id, email: user.email, residence: user.residence } : 'User not found');
        
        if (!user) {
            return res.status(400).json({ 
                error: 'User not found' 
            });
        }

        // Determine residence ID - prioritize residenceId from request body, fallback to user's residence
        let finalResidenceId = null;
        if (residenceId) {
            finalResidenceId = residenceId;
            console.log('Using residenceId from request body:', finalResidenceId);
        } else if (user && user.residence) {
            finalResidenceId = user.residence;
            console.log('Using residence from user profile:', finalResidenceId);
        }
        
        if (!finalResidenceId) {
            return res.status(400).json({ 
                error: 'Residence information is missing. Please contact administrator.' 
            });
        }

        // Validate that the residence exists
        const residence = await Residence.findById(finalResidenceId);
        console.log('Found residence:', residence ? { id: residence._id, name: residence.name } : 'Residence not found');
        
        if (!residence) {
            return res.status(400).json({ 
                error: 'Invalid residence ID. Please contact administrator.' 
            });
        }

        // Check for duplicate requests before creating new one
        const duplicates = await Maintenance.checkForDuplicates(finalResidenceId, room, title);
        
        if (duplicates.length > 0) {
            // Analyze similarity for each duplicate
            const duplicateInfo = duplicates.map(dup => {
                const similarity = Maintenance.analyzeIssueSimilarity(title, dup.issue);
                return {
                    id: dup._id,
                    issue: dup.issue,
                    status: dup.status,
                    requestDate: dup.requestDate,
                    studentName: dup.student ? `${dup.student.firstName} ${dup.student.lastName}` : 'Unknown',
                    studentEmail: dup.student ? dup.student.email : 'Unknown',
                    residenceName: dup.residence ? dup.residence.name : 'Unknown',
                    similarity: {
                        score: similarity.score,
                        exactMatch: similarity.exactMatch,
                        keywordMatch: similarity.keywordMatch,
                        patternMatch: similarity.patternMatch,
                        commonWords: similarity.commonWords
                    }
                };
            });

            // Sort by similarity score (highest first)
            duplicateInfo.sort((a, b) => b.similarity.score - a.similarity.score);

            // Generate appropriate message based on similarity
            let message = 'A similar maintenance request already exists in your room.';
            let suggestion = 'Please check the existing request or contact maintenance staff if you need to add additional information.';
            
            if (duplicateInfo[0].similarity.exactMatch) {
                message = 'An identical maintenance request already exists in your room.';
                suggestion = 'This appears to be a duplicate submission. Please check the existing request.';
            } else if (duplicateInfo[0].similarity.score >= 70) {
                message = 'A very similar maintenance request already exists in your room.';
                suggestion = 'This appears to be the same issue described differently. Please check the existing request.';
            } else if (duplicateInfo[0].similarity.score >= 40) {
                message = 'A related maintenance request already exists in your room.';
                suggestion = 'This may be related to an existing issue. Please check if your problem is already being addressed.';
            }

            return res.status(409).json({
                error: 'Duplicate maintenance request detected',
                message: message,
                suggestion: suggestion,
                duplicates: duplicateInfo,
                similarityAnalysis: {
                    highestScore: duplicateInfo[0].similarity.score,
                    matchType: duplicateInfo[0].similarity.exactMatch ? 'exact' : 
                              duplicateInfo[0].similarity.patternMatch ? 'pattern' :
                              duplicateInfo[0].similarity.keywordMatch ? 'keyword' : 'partial'
                }
            });
        }

        const newRequest = new Maintenance({
            student: req.user._id, // Automatically set student ID
            residence: finalResidenceId, // Use determined residence ID
            issue: title, // Map title to issue
            description,
            category,
            priority: priority || 'low',
            location,
            room: room || null, // Include room if provided
            status: 'pending', // Always start as pending
            requestDate: new Date(),
            images: images || [],
            studentResponse: studentResponse || 'Waiting for response',
            updates: [{
                date: new Date(),
                message: 'Maintenance request submitted'
                // author field removed
            }]
        });

        console.log('Creating maintenance request with data:', {
            student: newRequest.student,
            residence: newRequest.residence,
            title: newRequest.title,
            category: newRequest.category,
            priority: newRequest.priority
        });

        await newRequest.save();
        console.log('Maintenance request saved successfully');

        // Send email notifications (non-blocking)
        try {
            // Send notification to admins about new maintenance request
            await EmailNotificationService.sendMaintenanceRequestSubmitted(newRequest, req.user);
            
            // Send confirmation email to student
            await EmailNotificationService.sendMaintenanceRequestConfirmation(newRequest, req.user);
        } catch (emailError) {
            console.error('Failed to send maintenance request email notifications:', emailError);
            // Don't fail the request if email fails
        }

        // Populate the response with student and residence info
        const populatedRequest = await Maintenance.findById(newRequest._id)
            .populate('student', 'firstName lastName email')
            .populate('residence', 'name');

        // Format dates to ISO string for response
        const formatDate = (date) => {
            return date ? new Date(date).toISOString().split('T')[0] : null;
        };

        const response = {
            ...populatedRequest.toObject(),
            id: populatedRequest._id,
            studentId: populatedRequest.student?._id,
            studentName: populatedRequest.student ? `${populatedRequest.student.firstName} ${populatedRequest.student.lastName}` : undefined,
            residenceName: populatedRequest.residence ? populatedRequest.residence.name : undefined,
            dateRequested: formatDate(populatedRequest.requestDate),
            expectedCompletion: formatDate(populatedRequest.estimatedCompletion),
            status: populatedRequest.status,
            priority: populatedRequest.priority,
            issue: populatedRequest.issue,
            description: populatedRequest.description,
            room: populatedRequest.room,
            category: populatedRequest.category,
            location: populatedRequest.location,
            images: populatedRequest.images,
            updates: populatedRequest.updates,
            requestHistory: populatedRequest.requestHistory
        };

        console.log('=== CREATE MAINTENANCE REQUEST SUCCESS ===');
        res.status(201).json({
            message: 'Maintenance request created successfully',
            request: response
        });
    } catch (error) {
        console.error('=== CREATE MAINTENANCE REQUEST ERROR ===');
        console.error('Error in createMaintenanceRequest:', error);
        res.status(500).json({ 
            error: 'Error creating maintenance request',
            details: error.message,
            stack: error.stack
        });
    }
};

// Get single maintenance request details
exports.getMaintenanceRequestDetails = async (req, res) => {
    try {
        const request = await Maintenance.findOne({
            _id: req.params.requestId,
            student: req.user._id
        })
        .populate('assignedTo', 'firstName lastName')
        .populate('residence', 'name') // Populate residence name
        .lean();

        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Add residence name to the response
        const response = {
            ...request,
            residenceName: request.residence ? request.residence.name : 'Unknown'
        };

        res.json(response);
    } catch (error) {
        console.error('Error in getMaintenanceRequestDetails:', error);
        res.status(500).json({ error: 'Error retrieving maintenance request details' });
    }
};

// Update maintenance request
exports.updateMaintenanceRequest = async (req, res) => {
    try {
        const request = await Maintenance.findOne({
            _id: req.params.requestId,
            student: req.user._id,
            status: 'pending'
        });

        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found or cannot be updated' });
        }

        const { issue, description, category, priority, status, amount, comment } = req.body;

        // Update allowed fields
        if (issue) request.issue = issue;
        if (description) request.description = description;
        if (category) request.category = category;
        if (priority) request.priority = priority;
        if (amount !== undefined) request.amount = parseFloat(amount) || 0;

        // Add update to history
        request.updates.push({
            date: new Date(),
            message: 'Request details updated by student',
            author: 'Student'
        });

        await request.save();

        res.json({
            ...request.toObject(),
            amount: request.amount !== null && request.amount !== undefined ? request.amount : 0,
        });
    } catch (error) {
        console.error('Error in updateMaintenanceRequest:', error);
        res.status(500).json({ error: 'Error updating maintenance request' });
    }
};

// Cancel maintenance request
exports.cancelMaintenanceRequest = async (req, res) => {
    try {
        const request = await Maintenance.findOne({
            _id: req.params.requestId,
            student: req.user._id,
            status: 'pending'
        });

        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found or cannot be cancelled' });
        }

        request.status = 'cancelled';
        request.updates.push({
            date: new Date(),
            message: 'Request cancelled by student',
            author: 'Student'
        });

        await request.save();

        res.json({ message: 'Maintenance request cancelled successfully' });
    } catch (error) {
        console.error('Error in cancelMaintenanceRequest:', error);
        res.status(500).json({ error: 'Error cancelling maintenance request' });
    }
}; 