const Lease = require('../../models/Lease');
const Residence = require('../../models/Residence');

// GET /api/admin/leases - fetch all leases from all students
exports.getAllLeases = async (req, res) => {
  try {
    // Find all leases and populate residence name
    const leases = await Lease.find({}).populate('residence', 'name');
    // Format leases to include residence name and download URL at top level
    const formattedLeases = leases.map(lease => {
      const leaseObject = lease.toObject();
      return {
        ...leaseObject,
        residenceName: lease.residence && lease.residence.name ? lease.residence.name : leaseObject.residenceName || '-',
        downloadUrl: `/api/leases/download/${leaseObject.filename}`
      };
    });
    res.json(formattedLeases);
  } catch (err) {
    console.error('Error fetching all leases:', err);
    res.status(500).json({ message: 'Failed to fetch leases' });
  }
}; 