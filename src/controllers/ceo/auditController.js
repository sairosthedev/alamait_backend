const AuditLog = require('../../models/AuditLog');
const Request = require('../../models/Request');
const Expense = require('../../models/finance/Expense');
const Payment = require('../../models/Payment');

// Get audit logs (simple endpoint similar to admin audit-log)
exports.getAuditLogs = async (req, res) => {
  try {
    const { collection, action, user, startDate, endDate } = req.query;
    const filter = {};
    if (collection) filter.collection = collection;
    if (action) filter.action = action;
    if (user) filter.user = user;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(filter)
      .populate('user', 'firstName lastName email role')
      .sort({ timestamp: -1 })
      .limit(500);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching audit log', error: error.message });
  }
};

// Get audit reports
exports.getAuditReports = async (req, res) => {
    try {
        const { page = 1, limit = 10, action, collection, startDate, endDate } = req.query;
        const query = {};

        if (action) {
            query.action = action;
        }
        if (collection) {
            query.collection = collection;
        }
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const skip = (page - 1) * limit;

        const [auditLogs, total] = await Promise.all([
            AuditLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('user', 'firstName lastName email role')
                .lean(),
            AuditLog.countDocuments(query)
        ]);

        // Get summary statistics
        const actionStats = await AuditLog.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$action',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const collectionStats = await AuditLog.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$collection',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.json({
            auditLogs,
            summary: {
                actionStats,
                collectionStats,
                totalActions: total
            },
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / limit),
                totalItems: total
            }
        });
    } catch (error) {
        console.error('Error fetching audit reports:', error);
        res.status(500).json({ error: 'Error fetching audit reports' });
    }
};

// Get audit trail
exports.getAuditTrail = async (req, res) => {
    try {
        const { page = 1, limit = 10, userId, recordId, collection } = req.query;
        const query = {};

        if (userId) {
            query.user = userId;
        }
        if (recordId) {
            query.recordId = recordId;
        }
        if (collection) {
            query.collection = collection;
        }

        const skip = (page - 1) * limit;

        const [auditTrail, total] = await Promise.all([
            AuditLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('user', 'firstName lastName email role')
                .lean(),
            AuditLog.countDocuments(query)
        ]);

        res.json({
            auditTrail,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / limit),
                totalItems: total
            }
        });
    } catch (error) {
        console.error('Error fetching audit trail:', error);
        res.status(500).json({ error: 'Error fetching audit trail' });
    }
};

// Get audit trail by ID
exports.getAuditTrailById = async (req, res) => {
    try {
        const auditLog = await AuditLog.findById(req.params.id)
            .populate('user', 'firstName lastName email role');

        if (!auditLog) {
            return res.status(404).json({ error: 'Audit log not found' });
        }

        res.json(auditLog);
    } catch (error) {
        console.error('Error fetching audit trail by ID:', error);
        res.status(500).json({ error: 'Error fetching audit trail' });
    }
};

// Get CEO-specific audit summary
exports.getCEOAuditSummary = async (req, res) => {
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

        // Get CEO approval statistics
        const ceoApprovals = await Request.aggregate([
            {
                $match: {
                    'approval.ceo.approvedBy': { $exists: true },
                    'approval.ceo.approvedAt': { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        approved: '$approval.ceo.approved',
                        month: { $month: '$approval.ceo.approvedAt' }
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get CEO audit actions
        const ceoAuditActions = await AuditLog.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            {
                $match: {
                    'userInfo.role': 'ceo'
                }
            },
            {
                $group: {
                    _id: '$action',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get request approval timeline
        const approvalTimeline = await Request.aggregate([
            {
                $match: {
                    'approval.ceo.approvedBy': { $exists: true },
                    'approval.ceo.approvedAt': { $gte: startDate, $lte: endDate }
                }
            },
            {
                $project: {
                    title: 1,
                    type: 1,
                    amount: 1,
                    'approval.admin.approvedAt': 1,
                    'approval.finance.approvedAt': 1,
                    'approval.ceo.approvedAt': 1,
                    approvalTime: {
                        $subtract: [
                            '$approval.ceo.approvedAt',
                            '$approval.finance.approvedAt'
                        ]
                    }
                }
            },
            {
                $sort: { 'approval.ceo.approvedAt': -1 }
            },
            {
                $limit: 10
            }
        ]);

        res.json({
            ceoApprovals,
            ceoAuditActions,
            approvalTimeline,
            period: {
                start: startDate,
                end: endDate,
                type: period
            }
        });
    } catch (error) {
        console.error('Error fetching CEO audit summary:', error);
        res.status(500).json({ error: 'Error fetching CEO audit summary' });
    }
}; 