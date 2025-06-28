const mongoose = require('mongoose');
const AWS = require('aws-sdk');
require('dotenv').config();

// Import Payment model
const Payment = require('../src/models/Payment');

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

const bucketName = process.env.AWS_BUCKET_NAME;

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

// Function to generate signed URL
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

// Function to update POP URLs in database to signed S3 URLs
const updatePOPUrlsToSignedS3 = async () => {
  console.log('\n=== Updating Proof of Payment URLs to Signed S3 URLs ===');
  try {
    // Find all payments with local POP file URLs
    const payments = await Payment.find({
      'proofOfPayment.fileUrl': {
        $regex: /^\/uploads\/pop\//
      }
    });

    console.log(`Found ${payments.length} payment records with local POP paths`);

    let updatedCount = 0;

    for (const payment of payments) {
      try {
        const dbFilePath = payment.proofOfPayment.fileUrl;
        const fileName = dbFilePath.split('/').pop(); // Get filename from path
        
        // Create S3 key
        const s3Key = `pop/${fileName}`;
        
        // Generate signed URL
        const signedUrl = await generateSignedUrl(s3Key);
        
        if (signedUrl) {
          // Update the fileUrl to signed S3 URL
          payment.proofOfPayment.fileUrl = signedUrl;
          await payment.save();
          
          console.log(`✅ Updated payment ${payment.paymentId}`);
          console.log(`   From: ${dbFilePath}`);
          console.log(`   To: ${signedUrl}`);
          console.log(`   Filename: ${payment.proofOfPayment.fileName}`);
          console.log('');
          
          updatedCount++;
        } else {
          console.log(`❌ Failed to generate signed URL for payment ${payment.paymentId}`);
        }
      } catch (error) {
        console.error(`Error processing payment ${payment.paymentId}:`, error);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`✅ Successfully updated: ${updatedCount} payments`);
    
  } catch (error) {
    console.error('Error updating POP URLs:', error);
  }
};

// Function to update existing S3 URLs to signed URLs
const updateExistingS3UrlsToSigned = async () => {
  console.log('\n=== Updating Existing S3 URLs to Signed URLs ===');
  try {
    // Find all payments with direct S3 URLs (not signed)
    const payments = await Payment.find({
      'proofOfPayment.fileUrl': {
        $regex: /^https:\/\/.*\.s3\.eu-north-1\.amazonaws\.com\/pop\//
      }
    });

    console.log(`Found ${payments.length} payment records with direct S3 URLs`);

    let updatedCount = 0;

    for (const payment of payments) {
      try {
        const currentUrl = payment.proofOfPayment.fileUrl;
        const fileName = currentUrl.split('/').pop(); // Get filename from URL
        
        // Create S3 key
        const s3Key = `pop/${fileName}`;
        
        // Generate signed URL
        const signedUrl = await generateSignedUrl(s3Key);
        
        if (signedUrl) {
          // Update the fileUrl to signed S3 URL
          payment.proofOfPayment.fileUrl = signedUrl;
          await payment.save();
          
          console.log(`✅ Updated payment ${payment.paymentId}`);
          console.log(`   From: ${currentUrl}`);
          console.log(`   To: ${signedUrl}`);
          console.log('');
          
          updatedCount++;
        } else {
          console.log(`❌ Failed to generate signed URL for payment ${payment.paymentId}`);
        }
      } catch (error) {
        console.error(`Error processing payment ${payment.paymentId}:`, error);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`✅ Successfully updated: ${updatedCount} payments`);
    
  } catch (error) {
    console.error('Error updating existing S3 URLs:', error);
  }
};

// Function to verify the updates
const verifyUpdates = async () => {
  console.log('\n=== Verifying Updates ===');
  try {
    const payments = await Payment.find({
      'proofOfPayment.fileUrl': {
        $regex: /^https:\/\/.*\.s3\./
      }
    });

    console.log(`Found ${payments.length} payments with S3 URLs:`);
    payments.forEach(payment => {
      const isSigned = payment.proofOfPayment.fileUrl.includes('X-Amz-');
      console.log(`   - ${payment.paymentId}: ${isSigned ? '✅ Signed' : '❌ Not Signed'}`);
    });

    const remainingLocal = await Payment.find({
      'proofOfPayment.fileUrl': {
        $regex: /^\/uploads\//
      }
    });

    if (remainingLocal.length === 0) {
      console.log('\n✅ All POP URLs have been successfully migrated to S3!');
    } else {
      console.log(`\n⚠️  Found ${remainingLocal.length} payments still using local paths`);
    }
  } catch (error) {
    console.error('Error verifying updates:', error);
  }
};

// Main function
const fixPaymentS3Urls = async () => {
  try {
    await connectDB();
    console.log('🚀 Starting POP URL migration to Signed S3 URLs...');
    await updatePOPUrlsToSignedS3();
    await updateExistingS3UrlsToSigned();
    await verifyUpdates();
    console.log('\n✅ POP URL migration completed!');
  } catch (error) {
    console.error('Error in POP URL migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the script
if (require.main === module) {
  fixPaymentS3Urls();
}

module.exports = { fixPaymentS3Urls }; 