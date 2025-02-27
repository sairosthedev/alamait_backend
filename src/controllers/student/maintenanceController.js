const Maintenance = require('../../models/Maintenance');
const { validationResult } = require('express-validator');

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

        // Fetch requests with pagination
        const requests = await Maintenance.find(query)
            .sort({ requestDate: -1 })
            .skip(skip)
            .limit(limit)
            .populate('assignedTo', 'firstName lastName')
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
            updates: request.updates ? request.updates.map(update => ({
                date: update.date,
                message: update.message,
                author: update.author
            })) : []
        }));

        // Group requests by status
        const active = formattedRequests.filter(r => 
            ['pending', 'assigned', 'in-progress', 'on-hold'].includes(r.status));
        const completed = formattedRequests.filter(r => r.status === 'completed');

        res.json({
            active,
            completed,
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
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, description, category, priority, location, images } = req.body;

        const newRequest = new Maintenance({
            student: req.user._id,
            title,
            description,
            category,
            priority: priority || 'low',
            location,
            status: 'pending',
            requestDate: new Date(),
            images: images || [],
            updates: [{
                date: new Date(),
                message: 'Maintenance request submitted',
                author: 'System'
            }]
        });

        await newRequest.save();

        res.status(201).json(newRequest);
    } catch (error) {
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
        .lean();

        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        res.json(request);
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

        const { title, description, category, priority } = req.body;

        // Update allowed fields
        if (title) request.title = title;
        if (description) request.description = description;
        if (category) request.category = category;
        if (priority) request.priority = priority;

        // Add update to history
        request.updates.push({
            date: new Date(),
            message: 'Request details updated by student',
            author: 'Student'
        });

        await request.save();

        res.json(request);
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