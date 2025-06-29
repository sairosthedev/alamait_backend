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
    acl: 'private'
  },
  
  // For proof of payment files
  proofOfPayment: {
    bucket: bucketName,
    key: (req, file) => `pop/${req.user._id}_${Date.now()}_${file.originalname}`,
    acl: 'private'
  },
  
  // For lease uploads
  leases: {
    bucket: bucketName,
    key: (req, file) => `leases/${req.user._id}_${Date.now()}_${file.originalname}`,
    acl: 'private'
  },
  
  // For lease templates
  leaseTemplates: {
    bucket: bucketName,
    key: (req, file) => `lease_templates/${req.body.residenceId}_${Date.now()}_${file.originalname}`,
    acl: 'private'
  },
  
  // For general uploads
  general: {
    bucket: bucketName,
    key: (req, file) => `general/${Date.now()}_${file.originalname}`,
    acl: 'private'
  }
};

// Function to generate signed URL for private objects
const generateSignedUrl = async (key, expiresIn = 3600) => {
  try {
    const signedUrl = await s3.getSignedUrlPromise('getObject', {
      Bucket: bucketName,
      Key: key,
      Expires: expiresIn // URL expires in 1 hour by default
    });
    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
};

// Function to extract key from S3 URL
const getKeyFromUrl = (s3Url) => {
  if (!s3Url || !s3Url.includes(bucketName)) return null;
  return s3Url.split(`${bucketName}.s3.amazonaws.com/`)[1];
};

// Function to convert S3 URL to signed URL
const convertToSignedUrl = async (s3Url) => {
  if (!s3Url || s3Url.startsWith('http')) {
    const key = getKeyFromUrl(s3Url);
    if (key) {
      return await generateSignedUrl(key);
    }
  }
  return s3Url;
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
  fileTypes,
  generateSignedUrl,
  getKeyFromUrl,
  convertToSignedUrl
}; 