const axios = require('axios');
const Request = require('../../models/Request');
const Transaction = require('../../models/Transaction');
const Expense = require('../../models/finance/Expense');
const Payment = require('../../models/Payment');

// Get dashboard overview (similar to admin dashboard)
exports.getDashboardOverview = async (req, res) => {
    try {
        // Get current month and year
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const startOfMonth = new Date(currentYear, currentMonth, 1);
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0);

        // Get total income for current month
        const totalIncome = await Payment.aggregate([
            {
                $match: {
                    status: 'Confirmed',
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        // Get total expenses for current month
        const totalExpenses = await Expense.aggregate([
            {
                $match: {
                    expenseDate: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        // Get pending CEO approvals
        const pendingCEOApprovals = await Request.countDocuments({
            'approval.admin.approved': true,
            'approval.finance.approved': true,
            'approval.ceo.approved': { $ne: true },
            type: { $in: ['financial', 'operational'] }
        });

        // Get total requests this month
        const totalRequests = await Request.countDocuments({
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        });

        // Get occupancy rate
        const totalRooms = await require('../../models/Residence').aggregate([
            {
                $unwind: '$rooms'
            },
            {
                $group: {
                    _id: null,
                    totalRooms: { $sum: 1 },
                    occupiedRooms: {
                        $sum: {
                            $cond: [
                                { $eq: ['$rooms.status', 'occupied'] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const overview = {
            totalIncome: totalIncome.length > 0 ? totalIncome[0].total : 0,
            totalExpenses: totalExpenses.length > 0 ? totalExpenses[0].total : 0,
            netIncome: (totalIncome.length > 0 ? totalIncome[0].total : 0) - (totalExpenses.length > 0 ? totalExpenses[0].total : 0),
            pendingCEOApprovals,
            totalRequests,
            occupancyRate: totalRooms.length > 0 ? Math.round((totalRooms[0].occupiedRooms / totalRooms[0].totalRooms) * 100) : 0,
            currentMonth: now.toLocaleString('default', { month: 'long', year: 'numeric' })
        };

        res.json(overview);
    } catch (error) {
        console.error('Error fetching CEO dashboard overview:', error);
        res.status(500).json({ error: 'Error fetching dashboard overview' });
    }
};

// Get income distribution
exports.getIncomeDistribution = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        let startDate, endDate;

        const now = new Date();
        if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (period === 'quarter') {
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        } else if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
        }

        const incomeDistribution = await Payment.aggregate([
            {
                $match: {
                    status: 'Confirmed',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: '$createdAt' },
                        year: { $year: '$createdAt' }
                    },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);

        res.json(incomeDistribution);
    } catch (error) {
        console.error('Error fetching income distribution:', error);
        res.status(500).json({ error: 'Error fetching income distribution' });
    }
};

// Get expense distribution
exports.getExpenseDistribution = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        let startDate, endDate;

        const now = new Date();
        if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (period === 'quarter') {
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        } else if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
        }

        const expenseDistribution = await Expense.aggregate([
            {
                $match: {
                    expenseDate: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { total: -1 }
            }
        ]);

        res.json(expenseDistribution);
    } catch (error) {
        console.error('Error fetching expense distribution:', error);
        res.status(500).json({ error: 'Error fetching expense distribution' });
    }
};

// Get recent transactions
exports.getRecentTransactions = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const recentTransactions = await Transaction.find()
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('residence', 'name')
            .populate('student', 'firstName lastName email')
            .select('-__v');

        res.json(recentTransactions);
    } catch (error) {
        console.error('Error fetching recent transactions:', error);
        res.status(500).json({ error: 'Error fetching recent transactions' });
    }
};

// Get recent requests
exports.getRecentRequests = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const recentRequests = await Request.find()
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('submittedBy', 'firstName lastName email')
            .populate('residence', 'name')
            .populate('approval.admin.approvedBy', 'firstName lastName')
            .populate('approval.finance.approvedBy', 'firstName lastName')
            .populate('approval.ceo.approvedBy', 'firstName lastName')
            .select('-__v');

        res.json(recentRequests);
    } catch (error) {
        console.error('Error fetching recent requests:', error);
        res.status(500).json({ error: 'Error fetching recent requests' });
    }
}; 