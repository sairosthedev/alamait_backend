const mongoose = require('mongoose');
const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

const bucketName = process.env.AWS_BUCKET_NAME;

// Import models
const Lease = require('../src/models/Lease');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Function to upload file to S3 and return URL
const uploadFileToS3 = async (localPath, s3Key) => {
  try {
    const fs = require('fs');
    
    // Check if local file exists
    if (!fs.existsSync(localPath)) {
      console.log(`Local file not found: ${localPath}`);
      return null;
    }

    const fileContent = fs.readFileSync(localPath);
    
    await s3.upload({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/pdf'
    }).promise();

    return `https://${bucketName}.s3.amazonaws.com/${s3Key}`;
  } catch (error) {
    console.error(`Error uploading ${localPath} to S3:`, error);
    return null;
  }
};

// Fix specific lease record
const fixSpecificLease = async () => {
  console.log('\n=== Fixing Specific Lease Record ===');
  
  try {
    // Find the specific lease record
    const lease = await Lease.findById('685e8dc2a79798715afd1f08');
    
    if (!lease) {
      console.log('Lease record not found');
      return;
    }

    console.log(`Processing lease: ${lease.filename}`);
    console.log(`Current path: ${lease.path}`);

    // Check if it's already an S3 URL
    if (lease.path && lease.path.startsWith('https://')) {
      console.log('✅ Lease already has S3 URL');
      return;
    }

    // Create S3 key
    const s3Key = `leases/${lease.studentId}_${Date.now()}_${lease.filename}`;
    
    // Try to upload to S3
    const s3Url = await uploadFileToS3(lease.path, s3Key);
    
    if (s3Url) {
      // Update database record
      lease.path = s3Url;
      await lease.save();
      console.log(`✅ Updated lease ${lease.filename} to S3 URL: ${s3Url}`);
    } else {
      console.log(`❌ Failed to upload lease ${lease.filename}`);
      console.log('The local file might not exist. You may need to re-upload the file.');
    }
  } catch (error) {
    console.error('Error fixing specific lease:', error);
  }
};

// Fix all remaining lease records with local paths
const fixAllRemainingLeases = async () => {
  console.log('\n=== Fixing All Remaining Lease Records ===');
  
  try {
    const leases = await Lease.find({
      $or: [
        { path: { $regex: /^\/opt\/render\/project\/src\/uploads\// } }, // Render paths
        { path: { $regex: /^[A-Z]:\\/ } }, // Windows paths
        { path: { $regex: /^\/uploads\// } }, // Unix paths
        { path: { $not: /^https?:\/\// } } // Not URLs
      ]
    });

    console.log(`Found ${leases.length} lease records with local paths`);

    for (const lease of leases) {
      try {
        console.log(`Processing lease: ${lease.filename}`);
        console.log(`Current path: ${lease.path}`);
        
        // Create S3 key
        const s3Key = `leases/${lease.studentId}_${Date.now()}_${lease.filename}`;
        
        // Try to upload to S3
        const s3Url = await uploadFileToS3(lease.path, s3Key);
        
        if (s3Url) {
          // Update database record
          lease.path = s3Url;
          await lease.save();
          console.log(`✅ Updated lease ${lease.filename} to S3 URL`);
        } else {
          console.log(`❌ Failed to upload lease ${lease.filename}`);
          console.log('Setting path to null since file is not available');
          lease.path = null;
          await lease.save();
        }
      } catch (error) {
        console.error(`Error processing lease ${lease.filename}:`, error);
      }
    }
  } catch (error) {
    console.error('Error fixing remaining leases:', error);
  }
};

// Main function
const fixLeases = async () => {
  try {
    await connectDB();
    
    console.log('🚀 Starting lease fix...');
    
    await fixSpecificLease();
    await fixAllRemainingLeases();
    
    console.log('\n✅ Lease fix completed!');
    
  } catch (error) {
    console.error('Error in lease fix:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the script
if (require.main === module) {
  fixLeases();
}

module.exports = { fixLeases }; 