const Lease = require('../../models/Lease');
const { Residence } = require('../../models/Residence');
const { generateSignedUrl, getKeyFromUrl } = require('../../config/s3');

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

    // Format leases to include residence name and signed S3 URLs
    const formattedLeases = await Promise.all(leases.map(async lease => {
      const leaseObject = lease.toObject();
      let residenceName = leaseObject.residenceName;
      if (!residenceName && leaseObject.residence) {
        residenceName = residenceMap[leaseObject.residence.toString()] || null;
      }
      let signedUrl = leaseObject.path;
      if (leaseObject.path) {
        try {
          const key = getKeyFromUrl(leaseObject.path);
          if (key) {
            signedUrl = await generateSignedUrl(key);
          }
        } catch (err) {
          // If signed URL generation fails, fallback to original path
        }
      }
      return {
        ...leaseObject,
        residenceName,
        path: signedUrl,
        downloadUrl: signedUrl,
        viewUrl: signedUrl
      };
    }));
    res.json(formattedLeases);
  } catch (err) {
    console.error('Error fetching all leases:', err);
    res.status(500).json({ message: 'Failed to fetch leases' });
  }
};

// GET /api/admin/leases/student/:studentId - fetch leases for a specific student
exports.getLeasesByStudentId = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }
    const leases = await Lease.find({ studentId });
    res.json(leases);
  } catch (err) {
    console.error('Error fetching leases by student ID:', err);
    res.status(500).json({ message: 'Failed to fetch leases for student' });
  }
}; 