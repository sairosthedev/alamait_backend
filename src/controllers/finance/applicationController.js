const Application = require('../../models/Application');
const Residence = require('../../models/Residence');
const User = require('../../models/User');

// Get all applications (for finance)
exports.getAllApplications = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            status, 
            residence, 
            startDate, 
            endDate,
            sortBy = 'applicationDate',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};
        
        if (status) {
            filter.status = status;
        }
        
        if (residence) {
            filter.residence = residence;
        }
        
        // Date filtering
        if (startDate || endDate) {
            filter.applicationDate = {};
            if (startDate) filter.applicationDate.$gte = new Date(startDate);
            if (endDate) filter.applicationDate.$lte = new Date(endDate);
        }

        // Sorting
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get total count for pagination
        const total = await Application.countDocuments(filter);
        
        // Get applications with pagination and population
        const applications = await Application.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('residence', 'name address')
            .populate('student', 'firstName lastName email phone')
            .lean();

        // Format applications for response
        const formattedApplications = applications.map(app => ({
            id: app._id,
            applicationCode: app.applicationCode,
            firstName: app.firstName,
            lastName: app.lastName,
            email: app.email,
            phone: app.phone,
            requestType: app.requestType,
            status: app.status,
            paymentStatus: app.paymentStatus,
            applicationDate: app.applicationDate,
            startDate: app.startDate,
            endDate: app.endDate,
            preferredRoom: app.preferredRoom,
            allocatedRoom: app.allocatedRoom,
            currentRoom: app.currentRoom,
            reason: app.reason,
            residence: app.residence ? {
                id: app.residence._id,
                name: app.residence.name,
                address: app.residence.address
            } : null,
            student: app.student ? {
                id: app.student._id,
                name: `${app.student.firstName} ${app.student.lastName}`,
                email: app.student.email,
                phone: app.student.phone
            } : null
        }));

        res.json({
            applications: formattedApplications,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Finance: Error in getAllApplications:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get single application (for finance)
exports.getApplication = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id)
            .populate('residence', 'name address')
            .populate('student', 'firstName lastName email phone')
            .lean();

        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        const formattedApplication = {
            id: application._id,
            applicationCode: application.applicationCode,
            firstName: application.firstName,
            lastName: application.lastName,
            email: application.email,
            phone: application.phone,
            requestType: application.requestType,
            status: application.status,
            paymentStatus: application.paymentStatus,
            applicationDate: application.applicationDate,
            startDate: application.startDate,
            endDate: application.endDate,
            preferredRoom: application.preferredRoom,
            allocatedRoom: application.allocatedRoom,
            currentRoom: application.currentRoom,
            reason: application.reason,
            residence: application.residence ? {
                id: application.residence._id,
                name: application.residence.name,
                address: application.residence.address
            } : null,
            student: application.student ? {
                id: application.student._id,
                name: `${application.student.firstName} ${application.student.lastName}`,
                email: application.student.email,
                phone: application.student.phone
            } : null
        };

        res.json(formattedApplication);
    } catch (error) {
        console.error('Finance: Error in getApplication:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get application statistics (for finance)
exports.getApplicationStats = async (req, res) => {
    try {
        const { residence, startDate, endDate } = req.query;
        
        // Build filter object
        const filter = {};
        
        if (residence) {
            filter.residence = residence;
        }
        
        // Date filtering
        if (startDate || endDate) {
            filter.applicationDate = {};
            if (startDate) filter.applicationDate.$gte = new Date(startDate);
            if (endDate) filter.applicationDate.$lte = new Date(endDate);
        }

        // Get total applications
        const totalApplications = await Application.countDocuments(filter);
        
        // Get applications by status
        const applicationsByStatus = await Application.aggregate([
            { $match: filter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        // Get applications by residence
        const applicationsByResidence = await Application.aggregate([
            { $match: filter },
            { $group: { _id: '$residence', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Populate residence names
        const residenceIds = applicationsByResidence.map(item => item._id);
        const residences = await Residence.find({ _id: { $in: residenceIds } }, 'name');
        const residenceMap = {};
        residences.forEach(residence => {
            residenceMap[residence._id.toString()] = residence.name;
        });

        const formattedApplicationsByResidence = applicationsByResidence.map(item => ({
            residenceId: item._id,
            residenceName: residenceMap[item._id.toString()] || 'Unknown',
            count: item.count
        }));

        // Get applications by payment status
        const applicationsByPaymentStatus = await Application.aggregate([
            { $match: filter },
            { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
        ]);

        // Get recent applications (last 5)
        const recentApplications = await Application.find(filter)
            .sort({ applicationDate: -1 })
            .limit(5)
            .populate('residence', 'name')
            .populate('student', 'firstName lastName')
            .lean();

        const formattedRecentApplications = recentApplications.map(app => ({
            id: app._id,
            applicationCode: app.applicationCode,
            studentName: app.student ? `${app.student.firstName} ${app.student.lastName}` : 'Unknown',
            residenceName: app.residence ? app.residence.name : 'Unknown',
            applicationDate: app.applicationDate,
            status: app.status,
            paymentStatus: app.paymentStatus
        }));

        res.json({
            totalApplications,
            applicationsByStatus,
            applicationsByResidence: formattedApplicationsByResidence,
            applicationsByPaymentStatus,
            recentApplications: formattedRecentApplications
        });
    } catch (error) {
        console.error('Finance: Error in getApplicationStats:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 