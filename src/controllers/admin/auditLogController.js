const AuditLog = require('../../models/AuditLog');

/** Actions treated as “real” audit events (not page views / GET reads). */
const WRITE_ACTIONS = {
  $nin: ['read']
};

exports.getAuditLogs = async (req, res) => {
  try {
    const { collection, action, user, startDate, endDate } = req.query;
    const filter = {};
    if (collection) filter.collection = collection;
    if (action) {
      filter.action = action;
    } else {
      // Default: hide historical read noise; only show create/update/delete/login/etc.
      filter.action = WRITE_ACTIONS;
    }
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
