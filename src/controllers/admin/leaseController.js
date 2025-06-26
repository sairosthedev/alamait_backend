const Lease = require('../../models/Lease');
const Residence = require('../../models/Residence');

// GET /api/admin/leases - fetch all leases from all students
exports.getAllLeases = async (req, res) => {
  try {
    // Find all leases and populate residence name
    const leases = await Lease.find({});
    // Collect all unique residence ObjectIds
    const residenceIds = Array.from(new Set(leases.map(l => l.residence && l.residence.toString()).filter(Boolean)));
    // Fetch all residences in one go
    const residences = await Residence.find({ _id: { $in: residenceIds } });
    const residenceMap = {};
    residences.forEach(r => { residenceMap[r._id.toString()] = r.name; });

    // Format leases to include residence name and download/view URLs
    const formattedLeases = leases.map(lease => {
      const leaseObject = lease.toObject();
      let residenceName = leaseObject.residenceName;
      if (!residenceName && leaseObject.residence) {
        residenceName = residenceMap[leaseObject.residence.toString()] || null;
      }
      return {
        ...leaseObject,
        residenceName,
        downloadUrl: `/api/leases/download/${leaseObject.filename}`,
        viewUrl: `/api/leases/view/${leaseObject.filename}`
      };
    });
    res.json(formattedLeases);
  } catch (err) {
    console.error('Error fetching all leases:', err);
    res.status(500).json({ message: 'Failed to fetch leases' });
  }
}; 