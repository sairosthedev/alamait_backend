const Maintenance = require('../models/Maintenance');

// Get all maintenance requests
exports.getAllMaintenance = async (req, res) => {
    try {
        const maintenance = await Maintenance.find().sort({ dateAssigned: -1 })
            .populate('requestedBy', 'firstName lastName email role')
            .populate('student', 'firstName lastName email role');
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
            .populate('student', 'firstName lastName email role');
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
        const { issue, description, room, category, priority, residence } = req.body;

        // Validate residence ID
        if (!residence) {
            return res.status(400).json({ message: 'Residence ID is required' });
        }

        const maintenance = new Maintenance({
            issue,
            description,
            room,
            category,
            priority,
            residence,
            status: 'pending',
            requestDate: new Date()
        });
        
        const savedMaintenance = await maintenance.save();
        res.status(201).json(savedMaintenance);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update maintenance request
exports.updateMaintenance = async (req, res) => {
    try {
        const maintenance = await Maintenance.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!maintenance) {
            return res.status(404).json({ message: 'Maintenance request not found' });
        }
        res.status(200).json(maintenance);
    } catch (error) {
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
            .populate('student', 'firstName lastName email role');
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
            .populate('student', 'firstName lastName email role');
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
            .populate('student', 'firstName lastName email role');
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