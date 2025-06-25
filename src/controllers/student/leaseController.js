const path = require('path');

// In-memory store for uploaded leases (for demo only)
const uploadedLeases = [];

// Handles file upload (multer middleware will save the file)
exports.uploadLease = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  // Store file info in memory (simulate DB)
  uploadedLeases.push({
    filename: req.file.filename,
    originalname: req.file.originalname,
    path: req.file.path,
    mimetype: req.file.mimetype,
    size: req.file.size,
    uploadedAt: new Date()
  });
  res.status(200).json({
    message: 'Lease uploaded successfully',
    filename: req.file.filename,
    originalname: req.file.originalname,
    path: req.file.path,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
};

// List uploaded leases (for demo only)
exports.listLeases = (req, res) => {
  res.status(200).json(uploadedLeases);
}; 