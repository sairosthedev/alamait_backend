const User = require('../../models/User');

// GET /api/admin/leases - fetch all leases from all students
exports.getAllLeases = async (req, res) => {
  try {
    // Find all users with at least one lease
    const users = await User.find({ 'leases.0': { $exists: true } });
    const leases = [];
    users.forEach(user => {
      (user.leases || []).forEach(lease => {
        leases.push({
          studentName: `${user.firstName} ${user.lastName}`,
          email: user.email,
          residence: user.residence || '-',
          ...lease
        });
      });
    });
    res.json(leases);
  } catch (err) {
    console.error('Error fetching all leases:', err);
    res.status(500).json({ message: 'Failed to fetch leases' });
  }
}; 