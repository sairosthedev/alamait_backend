const { validationResult } = require('express-validator');
const Maintenance = require('../../models/Maintenance');
const User = require('../../models/User');

// Get maintenance dashboard stats
exports.getMaintenanceStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            openRequests,
            highPriorityCount,
            inProgressCount,
            completedToday
        ] = await Promise.all([
            Maintenance.countDocuments({ status: { $ne: 'completed' } }),
            Maintenance.countDocuments({ priority: 'high', status: { $ne: 'completed' } }),
            Maintenance.countDocuments({ status: 'in-progress' }),
            Maintenance.countDocuments({
                status: 'completed',
                completedDate: {
                    $gte: today,
                    $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                }
            })
        ]);

        res.json({
            openRequests,
            highPriorityCount,
            inProgressCount,
            completedToday
        });
    } catch (error) {
        console.error('Error in getMaintenanceStats:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get all maintenance requests
exports.getAllMaintenanceRequests = async (req, res) => {
    try {
        const { status, priority, search, page = 1, limit = 10 } = req.query;
        const query = {};

        if (status && status !== 'all') {
            query.status = status;
        }
        if (priority) {
            query.priority = priority;
        }
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
            Maintenance.find(query)
                .sort({ requestDate: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('student', 'firstName lastName')
                .populate('residence', 'name')
                .populate('assignedTo', 'firstName lastName')
                .populate('updates.author', 'firstName lastName'),
            Maintenance.countDocuments(query)
        ]);

        // Transform requests to match frontend format
        const transformedRequests = requests.map(request => ({
            id: request._id,
            title: request.title,
            description: request.description,
            location: request.location,
            category: request.category,
            status: request.status,
            priority: request.priority,
            requestedBy: `${request.student.firstName} ${request.student.lastName}`,
            requestDate: request.requestDate.toISOString(),
            expectedCompletion: request.estimatedCompletion,
            assignedTo: request.assignedTo?._id,
            updates: request.updates.map(update => ({
                date: update.date.toISOString(),
                message: update.message,
                author: update.author ? `${update.author.firstName} ${update.author.lastName}` : 'System'
            }))
        }));

        res.json({
            requests: transformedRequests,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error in getAllMaintenanceRequests:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create maintenance request
exports.createMaintenanceRequest = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            title,
            description,
            location,
            category,
            priority,
            residenceId,
            roomNumber,
            images
        } = req.body;

        const request = new Maintenance({
            title,
            description,
            location,
            category,
            priority,
            residence: residenceId,
            roomNumber,
            student: req.user._id,
            images: images?.map(url => ({ url })) || [],
            updates: [{
                message: 'Maintenance request created',
                author: req.user._id
            }]
        });

        await request.save();

        const populatedRequest = await Maintenance.findById(request._id)
            .populate('student', 'firstName lastName')
            .populate('residence', 'name')
            .populate('updates.author', 'firstName lastName');

        res.status(201).json(populatedRequest);
    } catch (error) {
        console.error('Error in createMaintenanceRequest:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update maintenance request
exports.updateMaintenanceRequest = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            status,
            assignedTo,
            estimatedCompletion,
            comment
        } = req.body;

        const request = await Maintenance.findById(req.params.requestId);

        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Update fields if provided
        if (status) {
            request.status = status;
            if (status === 'completed') {
                request.completedDate = new Date();
            }
        }
        if (assignedTo) request.assignedTo = assignedTo;
        if (estimatedCompletion) request.estimatedCompletion = estimatedCompletion;
        
        // Add update if comment provided
        if (comment) {
            request.updates.push({
                message: comment,
                author: req.user._id,
                date: new Date()
            });
        }

        await request.save();

        const updatedRequest = await Maintenance.findById(request._id)
            .populate('student', 'firstName lastName')
            .populate('residence', 'name')
            .populate('assignedTo', 'firstName lastName')
            .populate('updates.author', 'firstName lastName');

        res.json(updatedRequest);
    } catch (error) {
        console.error('Error in updateMaintenanceRequest:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get single maintenance request
exports.getMaintenanceRequest = async (req, res) => {
    try {
        const request = await Maintenance.findById(req.params.requestId)
            .populate('student', 'firstName lastName')
            .populate('residence', 'name')
            .populate('assignedTo', 'firstName lastName');

        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        res.json(request);
    } catch (error) {
        console.error('Error in getMaintenanceRequest:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Assign maintenance request
exports.assignMaintenanceRequest = async (req, res) => {
    try {
        const { staffId } = req.body;

        if (!staffId) {
            return res.status(400).json({ error: 'Staff ID is required' });
        }

        const request = await Maintenance.findById(req.params.requestId);
        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        const staff = await User.findById(staffId);
        if (!staff || staff.role !== 'maintenance_staff') {
            return res.status(400).json({ error: 'Invalid maintenance staff ID' });
        }

        request.assignedTo = staffId;
        request.status = 'assigned';
        await request.save();

        const updatedRequest = await Maintenance.findById(request._id)
            .populate('student', 'firstName lastName')
            .populate('residence', 'name')
            .populate('assignedTo', 'firstName lastName');

        res.json(updatedRequest);
    } catch (error) {
        console.error('Error in assignMaintenanceRequest:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get maintenance staff
exports.getMaintenanceStaff = async (req, res) => {
    try {
        const staff = await User.find({ role: 'maintenance_staff' })
            .select('-password')
            .sort({ firstName: 1 });

        res.json(staff);
    } catch (error) {
        console.error('Error in getMaintenanceStaff:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Add maintenance staff
exports.addMaintenanceStaff = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, firstName, lastName, phone } = req.body;

        // Check if user already exists
        let staff = await User.findOne({ email });
        if (staff) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Create new maintenance staff
        staff = new User({
            email,
            firstName,
            lastName,
            phone,
            role: 'maintenance_staff'
        });

        await staff.save();

        // Return staff without password
        const newStaff = await User.findById(staff._id).select('-password');
        res.status(201).json(newStaff);
    } catch (error) {
        console.error('Error in addMaintenanceStaff:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Remove maintenance staff
exports.removeMaintenanceStaff = async (req, res) => {
    try {
        const staff = await User.findById(req.params.staffId);
        
        if (!staff || staff.role !== 'maintenance_staff') {
            return res.status(404).json({ error: 'Maintenance staff not found' });
        }

        // Check if staff has any assigned maintenance requests
        const assignedRequests = await Maintenance.countDocuments({ 
            assignedTo: staff._id,
            status: { $in: ['assigned', 'in_progress'] }
        });

        if (assignedRequests > 0) {
            return res.status(400).json({ 
                error: 'Cannot remove staff with active maintenance requests' 
            });
        }

        await staff.remove();
        res.json({ message: 'Maintenance staff removed successfully' });
    } catch (error) {
        console.error('Error in removeMaintenanceStaff:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 