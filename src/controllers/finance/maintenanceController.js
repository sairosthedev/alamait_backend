const Maintenance = require('../../models/Maintenance');
const { validationResult } = require('express-validator');

// Get all maintenance requests with financial details
exports.getAllMaintenanceRequests = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, financeStatus } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (status) query.status = status;
        if (financeStatus) query.financeStatus = financeStatus;

        // Get total count for pagination
        const total = await Maintenance.countDocuments(query);

        // Fetch requests with pagination
        const requests = await Maintenance.find(query)
            .sort({ requestDate: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('student', 'firstName lastName')
            .populate('assignedTo', 'firstName lastName')
            .lean();

        // Format requests to include financial details
        const formattedRequests = requests.map(request => ({
            id: request._id,
            issue: request.issue,
            description: request.description,
            room: request.room,
            category: request.category,
            priority: request.priority,
            status: request.status,
            student: request.student,
            assignedTo: request.assignedTo,
            requestDate: request.requestDate,
            scheduledDate: request.scheduledDate,
            estimatedCompletion: request.estimatedCompletion,
            completedDate: request.completedDate,
            materials: request.materials,
            labour: request.labour,
            financeStatus: request.financeStatus,
            financeNotes: request.financeNotes,
            updates: request.updates
        }));

        res.json({
            requests: formattedRequests,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error in getAllMaintenanceRequests:', error);
        res.status(500).json({ error: 'Error retrieving maintenance requests' });
    }
};

// Get maintenance request by ID
exports.getMaintenanceRequestById = async (req, res) => {
    try {
        const request = await Maintenance.findById(req.params.id)
            .populate('student', 'firstName lastName')
            .populate('assignedTo', 'firstName lastName')
            .lean();

        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        res.json(request);
    } catch (error) {
        console.error('Error in getMaintenanceRequestById:', error);
        res.status(500).json({ error: 'Error retrieving maintenance request' });
    }
};

// Update maintenance request financial details
exports.updateMaintenanceRequestFinance = async (req, res) => {
    try {
        const { materials, labour, financeStatus, financeNotes } = req.body;

        const request = await Maintenance.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Update financial details
        if (materials !== undefined) request.materials = parseFloat(materials);
        if (labour !== undefined) request.labour = parseFloat(labour);
        if (financeStatus) request.financeStatus = financeStatus.toLowerCase();
        if (financeNotes) request.financeNotes = financeNotes;

        // Add update to history
        request.updates.push({
            date: new Date(),
            message: 'Financial details updated',
            author: req.user._id
        });

        await request.save();

        res.json({
            message: 'Maintenance request financial details updated successfully',
            request
        });
    } catch (error) {
        console.error('Error in updateMaintenanceRequestFinance:', error);
        res.status(500).json({ error: 'Error updating maintenance request financial details' });
    }
};

// Get maintenance requests by finance status
exports.getMaintenanceRequestsByFinanceStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const query = { financeStatus: status.toLowerCase() };
        const total = await Maintenance.countDocuments(query);

        const requests = await Maintenance.find(query)
            .sort({ requestDate: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('student', 'firstName lastName')
            .populate('assignedTo', 'firstName lastName')
            .lean();

        res.json({
            requests,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error in getMaintenanceRequestsByFinanceStatus:', error);
        res.status(500).json({ error: 'Error retrieving maintenance requests' });
    }
};

// Get maintenance financial statistics
exports.getMaintenanceFinancialStats = async (req, res) => {
    try {
        const stats = await Maintenance.aggregate([
            {
                $group: {
                    _id: '$financeStatus',
                    count: { $sum: 1 },
                    totalMaterials: { $sum: '$materials' },
                    totalLabour: { $sum: '$labour' }
                }
            }
        ]);

        const totalStats = {
            totalRequests: await Maintenance.countDocuments(),
            pendingRequests: await Maintenance.countDocuments({ financeStatus: 'pending' }),
            approvedRequests: await Maintenance.countDocuments({ financeStatus: 'approved' }),
            rejectedRequests: await Maintenance.countDocuments({ financeStatus: 'rejected' }),
            totalMaterials: stats.reduce((sum, stat) => sum + (stat.totalMaterials || 0), 0),
            totalLabour: stats.reduce((sum, stat) => sum + (stat.totalLabour || 0), 0)
        };

        res.json(totalStats);
    } catch (error) {
        console.error('Error in getMaintenanceFinancialStats:', error);
        res.status(500).json({ error: 'Error retrieving maintenance financial statistics' });
    }
}; 