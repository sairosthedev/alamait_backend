const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth');
const Lease = require('../models/Lease');

// GET /api/leases/download/:filename
// Allows authenticated users (students or admins) to download a lease file
router.get('/download/:filename', auth, async (req, res) => {
  try {
    const { filename } = req.params;

    // Optional: Add extra security check to ensure the user has permission
    // For now, any authenticated user can download if they have the filename

    const filePath = path.join(__dirname, '../../uploads', filename);

    // Check if file exists
    if (fs.existsSync(filePath)) {
      res.download(filePath, (err) => {
        if (err) {
          console.error('Error downloading file:', err);
          res.status(500).json({ error: 'Failed to download file' });
        }
      });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Error in download route:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/leases/view/:filename
// Allows authenticated users to view a lease file in the browser
router.get('/view/:filename', auth, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads', filename);

    if (fs.existsSync(filePath)) {
      // Set headers to display the file inline in the browser
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Error in view route:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 