const AuditLog = require('../../models/AuditLog');

/**
 * Get audit logs with comprehensive filtering
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const {
      user,
      action,
      collection,
      recordId,
      startDate,
      endDate,
      ipAddress,
      endpoint,
      statusCode,
      page = 1,
      limit = 50,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      user,
      action,
      collection,
      recordId,
      startDate,
      endDate,
      ipAddress,
      endpoint,
      statusCode,
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    };

    const result = await AuditLog.getAuditLogs(filters);

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching audit logs', 
      error: error.message 
    });
  }
};

/**
 * Get audit log statistics
 */
exports.getAuditStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await AuditLog.getAuditStats(startDate, endDate);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching audit statistics', 
      error: error.message 
    });
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

    const filters = {
      user: userId,
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy: 'timestamp',
      sortOrder: 'desc'
    };

    const result = await AuditLog.getAuditLogs(filters);

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination
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

/**
 * Get audit logs for a specific record
 */
exports.getRecordAuditLogs = async (req, res) => {
  try {
    const { recordId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const filters = {
      recordId,
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy: 'timestamp',
      sortOrder: 'desc'
    };

    const result = await AuditLog.getAuditLogs(filters);

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching record audit logs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching record audit logs', 
      error: error.message 
    });
  }
};

/**
 * Export audit logs to CSV
 */
exports.exportAuditLogs = async (req, res) => {
  try {
    const {
      user,
      action,
      collection,
      startDate,
      endDate,
      format = 'csv'
    } = req.query;

    const filters = {
      user,
      action,
      collection,
      startDate,
      endDate,
      page: 1,
      limit: 10000 // Large limit for export
    };

    const result = await AuditLog.getAuditLogs(filters);

    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = [
        'Timestamp',
        'User',
        'Action',
        'Collection',
        'Record ID',
        'Details',
        'IP Address',
        'Endpoint',
        'Status Code',
        'Response Time'
      ];

      const csvRows = result.logs.map(log => [
        log.timestamp.toISOString(),
        log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Unknown',
        log.action,
        log.collection,
        log.recordId,
        log.details,
        log.ipAddress || '',
        log.endpoint || '',
        log.statusCode || '',
        log.responseTime || ''
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvContent);
    } else {
      res.json({
        success: true,
        data: result.logs,
        total: result.pagination.total
      });
    }
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error exporting audit logs', 
      error: error.message 
    });
  }
};

/**
 * Get recent audit activity
 */
exports.getRecentActivity = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const recentLogs = await AuditLog.find({})
      .populate('user', 'firstName lastName email role')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: recentLogs
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching recent activity', 
      error: error.message 
    });
  }
};

/**
 * Get audit log summary
 */
exports.getAuditSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Get total count
    const totalCount = await AuditLog.countDocuments();

    // Get counts by action
    const actionStats = await AuditLog.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get counts by collection
    const collectionStats = await AuditLog.aggregate([
      { $group: { _id: '$collection', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get counts by user
    const userStats = await AuditLog.aggregate([
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get recent activity count (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await AuditLog.countDocuments({
      timestamp: { $gte: last24Hours }
    });

    res.json({
      success: true,
      data: {
        totalCount,
        recentCount,
        actionStats,
        collectionStats,
        userStats
      }
    });
  } catch (error) {
    console.error('Error fetching audit summary:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching audit summary', 
      error: error.message 
    });
  }
};

/**
 * Clean old audit logs (for maintenance)
 */
exports.cleanOldAuditLogs = async (req, res) => {
  try {
    const { days = 365 } = req.query; // Default to 1 year

    const cutoffDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const result = await AuditLog.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    res.json({
      success: true,
      message: `Cleaned ${result.deletedCount} old audit logs`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error cleaning old audit logs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error cleaning old audit logs', 
      error: error.message 
    });
  }
}; 