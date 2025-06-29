const Maintenance = require('../../models/Maintenance');
const { validationResult } = require('express-validator');
const User = require('../../models/User');
const Residence = require('../../models/Residence');

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
            status: request.status,
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

        // Determine residence ID - prioritize user's residence, fallback to sent residenceId
        let finalResidenceId = user.residence;
        
        if (!finalResidenceId && residenceId) {
            // If user doesn't have a residence but frontend sent one, use it
            finalResidenceId = residenceId;
        }
        
        console.log('Final residence ID:', finalResidenceId);
        
        if (!finalResidenceId) {
            return res.status(400).json({ 
                error: 'Student not assigned to any residence. Please contact administrator.' 
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

        const newRequest = new Maintenance({
            student: req.user._id, // Automatically set student ID
            residence: finalResidenceId, // Use determined residence ID
            title,
            description,
            category,
            priority: priority || 'low',
            location,
            room: room || null, // Include room if provided
            status: 'pending', // Always start as pending
            requestDate: new Date(),
            images: images || [],
            studentResponse: studentResponse || 'Waiting for response', // Include student response if provided
            updates: [{
                date: new Date(),
                message: 'Maintenance request submitted',
                author: 'System'
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

        // Populate the response with student and residence info
        const populatedRequest = await Maintenance.findById(newRequest._id)
            .populate('student', 'firstName lastName email')
            .populate('residence', 'name');

        console.log('=== CREATE MAINTENANCE REQUEST SUCCESS ===');
        res.status(201).json({
            message: 'Maintenance request created successfully',
            request: populatedRequest
        });
    } catch (error) {
        console.error('=== CREATE MAINTENANCE REQUEST ERROR ===');
        console.error('Error in createMaintenanceRequest:', error);
        res.status(500).json({ error: 'Error creating maintenance request' });
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

        const { title, description, category, priority, status, amount, comment } = req.body;

        // Update allowed fields
        if (title) request.title = title;
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