const Lease = require('../../models/Lease');
const Residence = require('../../models/Residence');
const User = require('../../models/User');

// Get all leases (for finance)
exports.getAllLeases = async (req, res) => {
    try {
        const { page = 1, limit = 10, residence, status } = req.query;
        const filter = {};
        
        if (residence) filter.residence = residence;
        if (status) filter.status = status;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Lease.countDocuments(filter);
        
        const leases = await Lease.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('residence', 'name address')
            .populate('studentId', 'firstName lastName email phone')
            .lean();

        const formattedLeases = leases.map(lease => ({
            id: lease._id,
            filename: lease.filename,
            originalname: lease.originalname,
            status: lease.status,
            createdAt: lease.createdAt,
            residence: lease.residence ? {
                id: lease.residence._id,
                name: lease.residence.name
            } : null,
            student: lease.studentId ? {
                id: lease.studentId._id,
                name: `${lease.studentId.firstName} ${lease.studentId.lastName}`,
                email: lease.studentId.email
            } : null,
            downloadUrl: `/api/leases/download/${lease.filename}`
        }));

        res.json({
            leases: formattedLeases,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Finance: Error in getAllLeases:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get single lease (for finance)
exports.getLease = async (req, res) => {
    try {
        const lease = await Lease.findById(req.params.id)
            .populate('residence', 'name address')
            .populate('studentId', 'firstName lastName email phone')
            .lean();

        if (!lease) {
            return res.status(404).json({ error: 'Lease not found' });
        }

        res.json(lease);
    } catch (error) {
        console.error('Finance: Error in getLease:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get lease statistics (for finance)
exports.getLeaseStats = async (req, res) => {
    try {
        const { residence, startDate, endDate } = req.query;
        
        // Build filter object
        const filter = {};
        
        if (residence) {
            filter.residence = residence;
        }
        
        // Date filtering
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        // Get total leases
        const totalLeases = await Lease.countDocuments(filter);
        
        // Get leases by status
        const leasesByStatus = await Lease.aggregate([
            { $match: filter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        // Get leases by residence
        const leasesByResidence = await Lease.aggregate([
            { $match: filter },
            { $group: { _id: '$residence', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Populate residence names
        const residenceIds = leasesByResidence.map(item => item._id);
        const residences = await Residence.find({ _id: { $in: residenceIds } }, 'name');
        const residenceMap = {};
        residences.forEach(residence => {
            residenceMap[residence._id.toString()] = residence.name;
        });

        const formattedLeasesByResidence = leasesByResidence.map(item => ({
            residenceId: item._id,
            residenceName: residenceMap[item._id.toString()] || 'Unknown',
            count: item.count
        }));

        // Get recent leases (last 5)
        const recentLeases = await Lease.find(filter)
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('residence', 'name')
            .populate('studentId', 'firstName lastName email role')
            .lean();

        const formattedRecentLeases = recentLeases.map(lease => ({
            id: lease._id,
            filename: lease.originalname,
            studentName: lease.studentId ? `${lease.studentId.firstName} ${lease.studentId.lastName}` : 'Unknown',
            residenceName: lease.residence ? lease.residence.name : 'Unknown',
            createdAt: lease.createdAt,
            status: lease.status
        }));

        res.json({
            totalLeases,
            leasesByStatus,
            leasesByResidence: formattedLeasesByResidence,
            recentLeases: formattedRecentLeases
        });
    } catch (error) {
        console.error('Finance: Error in getLeaseStats:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get leases for a specific student (for finance)
exports.getLeasesByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { page = 1, limit = 10, status } = req.query;
        
        // Validate student ID
        if (!studentId) {
            return res.status(400).json({ error: 'Student ID is required' });
        }

        // Check if student exists
        const student = await User.findById(studentId).select('firstName lastName email role');
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Build query
        const filter = { studentId };
        if (status) filter.status = status;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Lease.countDocuments(filter);
        
        const leases = await Lease.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('residence', 'name address')
            .lean();

        const formattedLeases = leases.map(lease => ({
            id: lease._id,
            filename: lease.filename,
            originalname: lease.originalname,
            status: lease.status,
            createdAt: lease.createdAt,
            uploadedAt: lease.uploadedAt,
            residence: lease.residence ? {
                id: lease.residence._id,
                name: lease.residence.name
            } : null,
            student: {
                id: student._id,
                name: `${student.firstName} ${student.lastName}`,
                email: student.email
            },
            downloadUrl: lease.path,
            viewUrl: lease.path
        }));

        res.json({
            student: {
                id: student._id,
                name: `${student.firstName} ${student.lastName}`,
                email: student.email
            },
            leases: formattedLeases,
            totalLeases: total,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Finance: Error in getLeasesByStudent:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 