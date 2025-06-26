const Lease = require('../../models/Lease');
const Residence = require('../../models/Residence');

// GET /api/admin/leases - fetch all leases from all students
exports.getAllLeases = async (req, res) => {
  try {
    // Find all leases and populate residence name
    const leases = await Lease.find({}).populate('residence', 'name');
    // Format leases to include residence name at top level
    const formattedLeases = leases.map(lease => ({
      ...lease.toObject(),
      residenceName: lease.residence && lease.residence.name ? lease.residence.name : lease.residenceName || '-',
    }));
    res.json(formattedLeases);
  } catch (err) {
    console.error('Error fetching all leases:', err);
    res.status(500).json({ message: 'Failed to fetch leases' });
  }
}; 