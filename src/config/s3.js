const AWS = require('aws-sdk');

// Configure AWS SDK for S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

const bucketName = process.env.AWS_BUCKET_NAME;

// Common S3 upload configurations
const s3Configs = {
  // For signed leases
  signedLeases: {
    bucket: bucketName,
    key: (req, file) => `signed_leases/${req.user._id}_${Date.now()}_${file.originalname}`,
    acl: 'public-read'
  },
  
  // For proof of payment files
  proofOfPayment: {
    bucket: bucketName,
    key: (req, file) => `proof_of_payment/${req.user._id}_${Date.now()}_${file.originalname}`,
    acl: 'public-read'
  },
  
  // For lease uploads
  leases: {
    bucket: bucketName,
    key: (req, file) => `leases/${req.user._id}_${Date.now()}_${file.originalname}`,
    acl: 'public-read'
  },
  
  // For lease templates
  leaseTemplates: {
    bucket: bucketName,
    key: (req, file) => `lease_templates/${req.body.residenceId}_${Date.now()}_${file.originalname}`,
    acl: 'public-read'
  },
  
  // For general uploads
  general: {
    bucket: bucketName,
    key: (req, file) => `general/${Date.now()}_${file.originalname}`,
    acl: 'public-read'
  }
};

// File filter function
const fileFilter = (allowedTypes) => (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

// Common file type configurations
const fileTypes = {
  images: ['image/jpeg', 'image/png', 'image/gif'],
  documents: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  all: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

module.exports = {
  s3,
  bucketName,
  s3Configs,
  fileFilter,
  fileTypes
}; 