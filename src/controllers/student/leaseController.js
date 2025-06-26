const path = require('path');
const User = require('../../models/User');
const Application = require('../../models/Application');
const Residence = require('../../models/Residence');
const Lease = require('../../models/Lease');

// Handles file upload (multer middleware will save the file)
exports.uploadLease = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  try {
    // Find the current user (assumes req.user is set by auth middleware)
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the latest approved or waitlisted application for this user
    const application = await Application.findOne({
      student: user._id,
      status: { $in: ['approved', 'waitlisted'] }
    }).sort({ applicationDate: -1 });

    let residence = null;
    let residenceName = null;
    let startDate = null;
    let endDate = null;

    if (application) {
      residence = application.residence;
      startDate = application.startDate;
      endDate = application.endDate;
      console.log('Lease upload: using residence from application', residence);
    } else {
      // Fallback to user's residence if no application found
      residence = user.residence;
      console.log('Lease upload: no application found, using user.residence', residence);
    }

    // Populate residence name if possible
    if (residence) {
      const residenceDoc = await Residence.findById(residence);
      if (residenceDoc) {
        residenceName = residenceDoc.name;
        console.log('Lease upload: found residence name', residenceName);
      } else {
        console.log('Lease upload: residence not found in DB for id', residence);
      }
    } else {
      console.log('Lease upload: no residence found');
    }

    // Create a Lease document in the leases collection
    const leaseDoc = await Lease.create({
      studentId: user._id,
      studentName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      residence: residence,
      residenceName: residenceName,
      startDate: startDate,
      endDate: endDate,
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date()
    });

    res.status(200).json({
      message: 'Lease uploaded successfully',
      lease: leaseDoc
    });
  } catch (error) {
    console.error('Error uploading lease:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// List uploaded leases for the current user
exports.listLeases = async (req, res) => {
  try {
    const leases = await Lease.find({ studentId: req.user.id });
    res.status(200).json(leases);
  } catch (error) {
    console.error('Error listing leases:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// List all leases for all users (admin only)
exports.listAllLeases = async (req, res) => {
  try {
    // Populate residence name for each user
    const users = await User.find({ 'leases.0': { $exists: true } }).populate('residence', 'name');
    const leases = [];
    users.forEach(user => {
      (user.leases || []).forEach(lease => {
        leases.push({
          studentId: user._id,
          studentName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          email: user.email,
          residence: user.residence && user.residence.name ? user.residence.name : '-',
          filename: lease.filename || '',
          originalname: lease.originalname || '',
          mimetype: lease.mimetype || '',
          size: lease.size || 0,
          uploadedAt: lease.uploadedAt || null
        });
      });
    });
    res.status(200).json(leases);
  } catch (error) {
    console.error('Error listing all leases:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 