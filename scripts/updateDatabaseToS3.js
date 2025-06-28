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
const Payment = require('../src/models/Payment');
const User = require('../src/models/User');

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
    const path = require('path');
    
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

// Update Lease records
const updateLeaseRecords = async () => {
  console.log('\n=== Updating Lease Records ===');
  
  try {
    const leases = await Lease.find({
      $or: [
        { path: { $regex: /^[A-Z]:\\/ } }, // Windows paths
        { path: { $regex: /^\/uploads\// } }, // Unix paths
        { path: { $not: /^https?:\/\// } } // Not URLs
      ]
    });

    console.log(`Found ${leases.length} lease records with local paths`);

    for (const lease of leases) {
      try {
        console.log(`Processing lease: ${lease.filename}`);
        
        // Create S3 key
        const s3Key = `leases/${lease.studentId}_${Date.now()}_${lease.filename}`;
        
        // Upload to S3
        const s3Url = await uploadFileToS3(lease.path, s3Key);
        
        if (s3Url) {
          // Update database record
          lease.path = s3Url;
          await lease.save();
          console.log(`✅ Updated lease ${lease.filename} to S3 URL`);
        } else {
          console.log(`❌ Failed to upload lease ${lease.filename}`);
        }
      } catch (error) {
        console.error(`Error processing lease ${lease.filename}:`, error);
      }
    }
  } catch (error) {
    console.error('Error updating lease records:', error);
  }
};

// Update Payment records
const updatePaymentRecords = async () => {
  console.log('\n=== Updating Payment Records ===');
  
  try {
    const payments = await Payment.find({
      'proofOfPayment.fileUrl': {
        $regex: /^\/uploads\//
      }
    });

    console.log(`Found ${payments.length} payment records with local paths`);

    for (const payment of payments) {
      try {
        console.log(`Processing payment: ${payment.paymentId}`);
        
        if (payment.proofOfPayment && payment.proofOfPayment.fileUrl) {
          // Create S3 key
          const s3Key = `proof_of_payment/${payment.student}_${Date.now()}_${payment.proofOfPayment.fileName || 'proof.pdf'}`;
          
          // Upload to S3
          const s3Url = await uploadFileToS3(payment.proofOfPayment.fileUrl, s3Key);
          
          if (s3Url) {
            // Update database record
            payment.proofOfPayment.fileUrl = s3Url;
            await payment.save();
            console.log(`✅ Updated payment ${payment.paymentId} to S3 URL`);
          } else {
            console.log(`❌ Failed to upload payment ${payment.paymentId}`);
          }
        }
      } catch (error) {
        console.error(`Error processing payment ${payment.paymentId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error updating payment records:', error);
  }
};

// Update User records (signed leases)
const updateUserRecords = async () => {
  console.log('\n=== Updating User Records ===');
  
  try {
    const users = await User.find({
      signedLeasePath: {
        $or: [
          { $regex: /^\/uploads\// }, // Unix paths
          { $not: /^https?:\/\// } // Not URLs
        ]
      }
    });

    console.log(`Found ${users.length} user records with local paths`);

    for (const user of users) {
      try {
        console.log(`Processing user: ${user.email}`);
        
        if (user.signedLeasePath) {
          // Create S3 key
          const s3Key = `signed_leases/${user._id}_${Date.now()}_signed_lease.pdf`;
          
          // Upload to S3
          const s3Url = await uploadFileToS3(user.signedLeasePath, s3Key);
          
          if (s3Url) {
            // Update database record
            user.signedLeasePath = s3Url;
            await user.save();
            console.log(`✅ Updated user ${user.email} to S3 URL`);
          } else {
            console.log(`❌ Failed to upload user ${user.email}`);
          }
        }
      } catch (error) {
        console.error(`Error processing user ${user.email}:`, error);
      }
    }
  } catch (error) {
    console.error('Error updating user records:', error);
  }
};

// Main function
const updateDatabaseToS3 = async () => {
  try {
    await connectDB();
    
    console.log('🚀 Starting database update to S3 URLs...');
    
    await updateLeaseRecords();
    await updatePaymentRecords();
    await updateUserRecords();
    
    console.log('\n✅ Database update completed!');
    console.log('All local file paths have been updated to S3 URLs.');
    
  } catch (error) {
    console.error('Error in database update:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the script
if (require.main === module) {
  updateDatabaseToS3();
}

module.exports = { updateDatabaseToS3 }; 