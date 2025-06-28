const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Lease = require('../models/Lease');

// GET /api/leases/download/:leaseId
// Allows authenticated users (students or admins) to download a lease file
router.get('/download/:leaseId', auth, async (req, res) => {
  try {
    const { leaseId } = req.params;

    // Find the lease by ID
    const lease = await Lease.findById(leaseId);
    
    if (!lease) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    // Check if the user has permission to download this lease
    if (req.user.role !== 'admin' && lease.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // lease.path now contains an S3 URL
    if (lease.path && lease.path.startsWith('http')) {
      // Redirect to S3 URL for download
      res.redirect(lease.path);
    } else {
      res.status(404).json({ error: 'Lease file not available' });
    }
  } catch (error) {
    console.error('Error in download route:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 