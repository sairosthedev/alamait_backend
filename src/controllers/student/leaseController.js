const path = require('path');
const User = require('../../models/User');

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
    // Push lease info to user's leases array
    user.leases.push({
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date()
    });
    await user.save();
    res.status(200).json({
      message: 'Lease uploaded successfully',
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading lease:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// List uploaded leases for the current user
exports.listLeases = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user.leases || []);
  } catch (error) {
    console.error('Error listing leases:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 