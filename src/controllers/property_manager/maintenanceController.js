const Maintenance = require('../../models/Maintenance');
const Residence = require('../../models/Residence');
const { validationResult } = require('express-validator');

// Get maintenance requests for managed residences
exports.getMaintenanceRequests = async (req, res) => {
    try {
        // Get all residences managed by the property manager
        const managedResidences = await Residence.find({ manager: req.user._id });
        const residenceIds = managedResidences.map(residence => residence._id);

        const { status, priority, category } = req.query;
        let query = { residence: { $in: residenceIds } };

        if (status) query.status = status;
        if (priority) query.priority = priority;
        if (category) query.category = category;

        const maintenanceRequests = await Maintenance.find(query)
            .populate('residence', 'name address')
            .populate('student', 'firstName lastName email phone')
            .populate('assignedTo', 'firstName lastName')
            .sort('-createdAt');

        res.json(maintenanceRequests);
    } catch (error) {
        console.error('Get maintenance requests error:', error);
        res.status(500).json({ error: 'Error fetching maintenance requests' });
    }
};

// Get single maintenance request
exports.getMaintenanceRequest = async (req, res) => {
    try {
        const maintenance = await Maintenance.findById(req.params.id)
            .populate('residence', 'name address manager')
            .populate('student', 'firstName lastName email phone')
            .populate('assignedTo', 'firstName lastName')
            .populate('comments.user', 'firstName lastName role');

        if (!maintenance) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Check if user manages this residence
        if (maintenance.residence.manager.toString() !== req.user._id.toString()) {
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

        const maintenance = await Maintenance.findById(req.params.id)
            .populate('residence', 'manager');

        if (!maintenance) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Check if user manages this residence
        if (maintenance.residence.manager.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Update allowed fields
        const allowedUpdates = [
            'status', 'priority', 'assignedTo', 'scheduledDate',
            'amount'
        ];

        allowedUpdates.forEach(update => {
            if (req.body[update] !== undefined) {
                maintenance[update] = req.body[update];
            }
        });

        // If status is being updated to completed, set completedDate
        if (req.body.status === 'completed') {
            maintenance.completedDate = new Date();
        }

        await maintenance.save();

        const updatedMaintenance = await Maintenance.findById(req.params.id)
            .populate('residence', 'name address')
            .populate('student', 'firstName lastName email')
            .populate('assignedTo', 'firstName lastName');

        res.json({
            ...updatedMaintenance.toObject(),
            amount: updatedMaintenance.amount !== null && updatedMaintenance.amount !== undefined ? updatedMaintenance.amount : 0,
        });
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

        const maintenance = await Maintenance.findById(req.params.id)
            .populate('residence', 'manager');

        if (!maintenance) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Check if user manages this residence
        if (maintenance.residence.manager.toString() !== req.user._id.toString()) {
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

// Get maintenance statistics
exports.getMaintenanceStats = async (req, res) => {
    try {
        // Get all residences managed by the property manager
        const managedResidences = await Residence.find({ manager: req.user._id });
        const residenceIds = managedResidences.map(residence => residence._id);

        const stats = await Maintenance.aggregate([
            {
                $match: {
                    residence: { $in: residenceIds }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    avgResolutionTime: {
                        $avg: {
                            $cond: [
                                { $eq: ['$status', 'completed'] },
                                {
                                    $divide: [
                                        { $subtract: ['$completedDate', '$createdAt'] },
                                        1000 * 60 * 60 * 24 // Convert to days
                                    ]
                                },
                                null
                            ]
                        }
                    }
                }
            }
        ]);

        const categoryStats = await Maintenance.aggregate([
            {
                $match: {
                    residence: { $in: residenceIds }
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            statusStats: stats,
            categoryStats
        });
    } catch (error) {
        console.error('Get maintenance stats error:', error);
        res.status(500).json({ error: 'Error fetching maintenance statistics' });
    }
}; 