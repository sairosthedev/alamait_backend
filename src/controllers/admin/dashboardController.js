const User = require('../../models/User');
const Booking = require('../../models/Booking');
const Maintenance = require('../../models/Maintenance');
const Residence = require('../../models/Residence');
const { validationResult } = require('express-validator');

// Get overall dashboard statistics
exports.getDashboardStats = async (req, res) => {
    try {
        const totalStudents = await User.countDocuments({ role: 'student' });
        const totalBookings = await Booking.countDocuments();
        const totalMaintenance = await Maintenance.countDocuments();
        const totalResidences = await Residence.countDocuments();

        // Get recent activities
        const recentBookings = await Booking.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('student', 'firstName lastName')
            .populate('residence', 'name');

        const recentMaintenance = await Maintenance.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('student', 'firstName lastName')
            .populate('assignedTo', 'firstName lastName');

        res.json({
            stats: {
                totalStudents,
                totalBookings,
                totalMaintenance,
                totalResidences
            },
            recentActivities: {
                bookings: recentBookings,
                maintenance: recentMaintenance
            }
        });
    } catch (error) {
        console.error('Error in getDashboardStats:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get financial statistics
exports.getFinancialStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const query = {};
        
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const bookings = await Booking.find(query);
        
        // Calculate financial metrics
        const totalRevenue = bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
        const paidAmount = bookings.reduce((sum, booking) => sum + booking.paidAmount, 0);
        const pendingAmount = totalRevenue - paidAmount;

        // Group bookings by status
        const bookingsByStatus = bookings.reduce((acc, booking) => {
            acc[booking.status] = (acc[booking.status] || 0) + 1;
            return acc;
        }, {});

        // Calculate monthly trends
        const monthlyRevenue = await Booking.aggregate([
            {
                $match: query
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    revenue: { $sum: "$totalAmount" },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1 }
            }
        ]);

        res.json({
            summary: {
                totalRevenue,
                paidAmount,
                pendingAmount,
                bookingsByStatus
            },
            trends: {
                monthly: monthlyRevenue
            }
        });
    } catch (error) {
        console.error('Error in getFinancialStats:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get maintenance statistics
exports.getMaintenanceStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const query = {};
        
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Get maintenance requests grouped by status
        const statusStats = await Maintenance.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get maintenance requests grouped by category
        const categoryStats = await Maintenance.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$category",
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get average resolution time
        const resolvedRequests = await Maintenance.find({
            ...query,
            status: 'completed',
            completedDate: { $exists: true }
        });

        const avgResolutionTime = resolvedRequests.reduce((sum, request) => {
            const resolutionTime = new Date(request.completedDate) - new Date(request.createdAt);
            return sum + resolutionTime;
        }, 0) / (resolvedRequests.length || 1);

        res.json({
            byStatus: statusStats,
            byCategory: categoryStats,
            averageResolutionTime: avgResolutionTime,
            totalRequests: await Maintenance.countDocuments(query),
            completedRequests: resolvedRequests.length
        });
    } catch (error) {
        console.error('Error in getMaintenanceStats:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get occupancy statistics
exports.getOccupancyStats = async (req, res) => {
    try {
        const residences = await Residence.find();
        
        let totalRooms = 0;
        let occupiedRooms = 0;
        const occupancyByResidence = [];

        for (const residence of residences) {
            const totalRoomsInResidence = residence.rooms.length;
            const occupiedRoomsInResidence = residence.rooms.filter(
                room => room.status === 'occupied'
            ).length;

            totalRooms += totalRoomsInResidence;
            occupiedRooms += occupiedRoomsInResidence;

            occupancyByResidence.push({
                residenceId: residence._id,
                name: residence.name,
                totalRooms: totalRoomsInResidence,
                occupiedRooms: occupiedRoomsInResidence,
                occupancyRate: (occupiedRoomsInResidence / totalRoomsInResidence) * 100
            });
        }

        const overallOccupancyRate = (occupiedRooms / totalRooms) * 100;

        res.json({
            overall: {
                totalRooms,
                occupiedRooms,
                occupancyRate: overallOccupancyRate
            },
            byResidence: occupancyByResidence
        });
    } catch (error) {
        console.error('Error in getOccupancyStats:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get transactions
exports.getTransactions = async (req, res) => {
    try {
        const { startDate, endDate, type, page = 1, limit = 10 } = req.query;
        const query = {};

        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        if (type && type !== 'all') {
            query.type = type;
        }

        const skip = (page - 1) * limit;

        const bookings = await Booking.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('student', 'firstName lastName')
            .populate('residence', 'name');

        const total = await Booking.countDocuments(query);

        res.json({
            transactions: bookings,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error in getTransactions:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Export transactions
exports.exportTransactions = async (req, res) => {
    try {
        const { startDate, endDate, type } = req.body;
        const query = {};

        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        if (type && type !== 'all') {
            query.type = type;
        }

        const transactions = await Booking.find(query)
            .populate('student', 'firstName lastName')
            .populate('residence', 'name');

        // Format transactions for export
        const formattedTransactions = transactions.map(t => ({
            Date: t.createdAt.toISOString().split('T')[0],
            Student: `${t.student.firstName} ${t.student.lastName}`,
            Residence: t.residence.name,
            Amount: t.totalAmount,
            Status: t.status,
            PaymentStatus: t.paymentStatus
        }));

        res.json(formattedTransactions);
    } catch (error) {
        console.error('Error in exportTransactions:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Generate dashboard report
exports.generateDashboardReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.body;

        // Gather all necessary data
        const [
            financialStats,
            maintenanceStats,
            occupancyStats
        ] = await Promise.all([
            // Reuse existing functions
            this.getFinancialStats({ query: { startDate, endDate } }, { json: data => data }),
            this.getMaintenanceStats({ query: { startDate, endDate } }, { json: data => data }),
            this.getOccupancyStats({}, { json: data => data })
        ]);

        const report = {
            generatedAt: new Date(),
            period: {
                startDate,
                endDate
            },
            financial: financialStats,
            maintenance: maintenanceStats,
            occupancy: occupancyStats
        };

        res.json(report);
    } catch (error) {
        console.error('Error in generateDashboardReport:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 