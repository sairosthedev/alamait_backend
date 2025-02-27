const Maintenance = require('../../models/Maintenance');
const { validationResult } = require('express-validator');

// Create maintenance request
exports.createMaintenanceRequest = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const maintenance = new Maintenance({
            ...req.body,
            student: req.user._id
        });

        await maintenance.save();

        const populatedMaintenance = await Maintenance.findById(maintenance._id)
            .populate('residence', 'name address')
            .populate('assignedTo', 'firstName lastName');

        res.status(201).json(populatedMaintenance);
    } catch (error) {
        console.error('Create maintenance request error:', error);
        res.status(500).json({ error: 'Error creating maintenance request' });
    }
};

// Get student's maintenance requests
exports.getMyMaintenanceRequests = async (req, res) => {
    try {
        const maintenance = await Maintenance.find({ student: req.user._id })
            .populate('residence', 'name address')
            .populate('assignedTo', 'firstName lastName')
            .sort('-createdAt');

        res.json(maintenance);
    } catch (error) {
        console.error('Get maintenance requests error:', error);
        res.status(500).json({ error: 'Error fetching maintenance requests' });
    }
};

// Get single maintenance request
exports.getMaintenanceRequest = async (req, res) => {
    try {
        const maintenance = await Maintenance.findById(req.params.id)
            .populate('residence', 'name address')
            .populate('assignedTo', 'firstName lastName')
            .populate('comments.user', 'firstName lastName role');

        if (!maintenance) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Check if user is authorized
        if (maintenance.student.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.json(maintenance);
    } catch (error) {
        console.error('Get maintenance request error:', error);
        res.status(500).json({ error: 'Error fetching maintenance request' });
    }
};

// Update maintenance request
exports.updateMaintenanceRequest = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const maintenance = await Maintenance.findById(req.params.id);
        
        if (!maintenance) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Check if user is authorized
        if (maintenance.student.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Students can only update certain fields
        const allowedUpdates = ['description', 'images'];
        const updates = Object.keys(req.body)
            .filter(key => allowedUpdates.includes(key))
            .reduce((obj, key) => {
                obj[key] = req.body[key];
                return obj;
            }, {});

        Object.assign(maintenance, updates);
        await maintenance.save();

        const updatedMaintenance = await Maintenance.findById(req.params.id)
            .populate('residence', 'name address')
            .populate('assignedTo', 'firstName lastName');

        res.json(updatedMaintenance);
    } catch (error) {
        console.error('Update maintenance request error:', error);
        res.status(500).json({ error: 'Error updating maintenance request' });
    }
};

// Add comment to maintenance request
exports.addComment = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const maintenance = await Maintenance.findById(req.params.id);
        
        if (!maintenance) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Check if user is authorized
        if (maintenance.student.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        maintenance.comments.push({
            user: req.user._id,
            text: req.body.text
        });

        await maintenance.save();

        const updatedMaintenance = await Maintenance.findById(req.params.id)
            .populate('comments.user', 'firstName lastName role');

        res.json(updatedMaintenance);
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Error adding comment' });
    }
}; 