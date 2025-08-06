const AuditLog = require('../../models/AuditLog');

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

    const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).limit(500);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching audit log', error: error.message });
  }
};

/**
 * Get audit log by ID
 */
exports.getAuditLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const auditLog = await AuditLog.findById(id)
      .populate('user', 'firstName lastName email role');

    if (!auditLog) {
      return res.status(404).json({
        success: false,
        message: 'Audit log not found'
      });
    }

    res.json({
      success: true,
      data: auditLog
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching audit log', 
      error: error.message 
    });
  }
};

/**
 * Get audit logs for a specific user
 */
exports.getUserAuditLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await AuditLog.find({ user: userId })
      .populate('user', 'firstName lastName email role')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments({ user: userId });

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching user audit logs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user audit logs', 
      error: error.message 
    });
  }
}; 