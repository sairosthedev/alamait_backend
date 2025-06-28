const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3, s3Configs, fileFilter, fileTypes } = require('../../config/s3');
const Residence = require('../../models/Residence');
const mongoose = require('mongoose');

// Export the multer middleware for S3 uploads
exports.uploadMiddleware = multer({
    storage: multerS3({
        s3: s3,
        bucket: s3Configs.leaseTemplates.bucket,
        acl: s3Configs.leaseTemplates.acl,
        key: s3Configs.leaseTemplates.key
    }),
    fileFilter: fileFilter(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
}).single('leaseTemplate');

// This handler now saves the file to S3 and returns the S3 URL
exports.uploadLeaseTemplate = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Please select a file' });
    }

    try {
        const residenceId = req.body.residenceId;
        
        // The file is already uploaded to S3 by multer-s3
        // req.file.location contains the S3 URL
        
        res.status(200).json({ 
            message: `Lease agreement template for residence ${residenceId} uploaded successfully`,
            fileUrl: req.file.location,
            fileName: req.file.originalname
        });

    } catch (error) {
        console.error('Error uploading lease template to S3:', error);
        res.status(500).json({ error: 'Failed to upload the file to S3.' });
    }
}; 