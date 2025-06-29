const path = require('path');
const User = require('../../models/User');
const Application = require('../../models/Application');
const Residence = require('../../models/Residence');
const Lease = require('../../models/Lease');
const { s3, s3Configs, generateSignedUrl, getKeyFromUrl } = require('../../config/s3');

// Handles file upload with manual S3 upload
exports.uploadLease = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  
  try {
    console.log('=== Starting lease upload ===');
    console.log('File received:', {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Find the current user (assumes req.user is set by auth middleware)
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Manually upload to S3
    console.log('Uploading file to S3...');
    const s3Key = `leases/${req.user.id}_${Date.now()}_${req.file.originalname}`;
    
    const s3UploadParams = {
      Bucket: s3Configs.leases.bucket,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: s3Configs.leases.acl,
      Metadata: {
        fieldName: req.file.fieldname,
        uploadedBy: req.user.id,
        uploadDate: new Date().toISOString()
      }
    };

    const s3Result = await s3.upload(s3UploadParams).promise();
    console.log('File uploaded successfully to S3:', s3Result.Location);

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
      console.log('Lease upload: using residence from application', residence, typeof residence);
    } else {
      // Fallback to user's residence if no application found
      residence = user.residence;
      console.log('Lease upload: no application found, using user.residence', residence, typeof residence);
    }

    // Ensure residence is available
    if (!residence) {
      return res.status(400).json({ message: 'No residence found for user. Please contact administrator.' });
    }

    // Populate residence name if possible
    if (residence) {
      const residenceDoc = await Residence.findById(residence);
      if (residenceDoc) {
        residenceName = residenceDoc.name;
        console.log('Lease upload: found residence name', residenceName);
      } else {
        console.log('Lease upload: residence not found in DB for id', residence);
        return res.status(400).json({ message: 'Invalid residence. Please contact administrator.' });
      }
    } else {
      console.log('Lease upload: no residence found');
      return res.status(400).json({ message: 'No residence found for user. Please contact administrator.' });
    }

    // Create a Lease document in the leases collection with S3 URL
    const leaseDoc = await Lease.create({
      studentId: user._id,
      studentName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      residence: residence,
      residenceName: residenceName,
      startDate: startDate,
      endDate: endDate,
      filename: req.file.originalname,
      originalname: req.file.originalname,
      path: s3Result.Location, // Use the S3 URL from manual upload
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date()
    });

    console.log('Lease document created successfully:', leaseDoc._id);

    res.status(200).json({
      message: 'Lease uploaded successfully',
      lease: leaseDoc
    });
  } catch (error) {
    console.error('Error uploading lease:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// List uploaded leases for the current user with signed URLs
exports.listLeases = async (req, res) => {
  try {
    const leases = await Lease.find({ studentId: req.user.id });
    
    // Convert S3 URLs to signed URLs for each lease
    const leasesWithSignedUrls = await Promise.all(
      leases.map(async (lease) => {
        const leaseObj = lease.toObject();
        if (leaseObj.path) {
          try {
            const key = getKeyFromUrl(leaseObj.path);
            if (key) {
              leaseObj.path = await generateSignedUrl(key);
            }
          } catch (error) {
            console.error('Error generating signed URL:', error);
            // Keep original URL if signed URL generation fails
          }
        }
        return leaseObj;
      })
    );
    
    res.status(200).json(leasesWithSignedUrls);
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