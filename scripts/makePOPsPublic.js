const AWS = require('aws-sdk');
const mongoose = require('mongoose');
require('dotenv').config();

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

const bucketName = process.env.AWS_BUCKET_NAME;

// Import Payment model
const Payment = require('../src/models/Payment');

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

// Function to list all POP files in S3
const listPOPFiles = async () => {
  try {
    const params = {
      Bucket: bucketName,
      Prefix: 'pop/'
    };

    const data = await s3.listObjectsV2(params).promise();
    return data.Contents || [];
  } catch (error) {
    console.error('Error listing POP files:', error);
    return [];
  }
};

// Function to update database URLs to use direct S3 URLs
const updateDatabaseToDirectUrls = async () => {
  console.log('\n=== Updating Database URLs to Direct S3 URLs ===');
  
  try {
    // Connect to MongoDB
    await connectDB();

    // Find all payments with signed S3 URLs
    const payments = await Payment.find({
      'proofOfPayment.fileUrl': {
        $regex: /X-Amz-/
      }
    });

    console.log(`Found ${payments.length} payments with signed URLs`);

    let updatedCount = 0;

    for (const payment of payments) {
      try {
        const currentUrl = payment.proofOfPayment.fileUrl;
        
        // Extract the base S3 URL (remove signed parameters)
        const baseUrl = currentUrl.split('?')[0];
        
        // Update to direct S3 URL
        payment.proofOfPayment.fileUrl = baseUrl;
        await payment.save();
        
        console.log(`✅ Updated payment ${payment.paymentId}`);
        console.log(`   From: ${currentUrl.substring(0, 100)}...`);
        console.log(`   To: ${baseUrl}`);
        console.log('');
        
        updatedCount++;
      } catch (error) {
        console.error(`Error updating payment ${payment.paymentId}:`, error);
      }
    }

    console.log(`\n📊 Database Update Summary:`);
    console.log(`✅ Successfully updated: ${updatedCount} payments`);

    // Verify updates
    const remainingSigned = await Payment.find({
      'proofOfPayment.fileUrl': {
        $regex: /X-Amz-/
      }
    });

    if (remainingSigned.length === 0) {
      console.log('\n✅ All POP URLs are now using direct S3 URLs!');
    } else {
      console.log(`\n⚠️  Found ${remainingSigned.length} payments still using signed URLs`);
    }

  } catch (error) {
    console.error('Error updating database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Function to check bucket public access settings
const checkBucketPublicAccess = async () => {
  console.log('\n=== Checking S3 Bucket Public Access Settings ===');
  
  try {
    // Try to get bucket public access block settings
    const publicAccessBlock = await s3.getPublicAccessBlock({
      Bucket: bucketName
    }).promise();
    
    console.log('Bucket public access block settings:');
    console.log(`  BlockPublicAcls: ${publicAccessBlock.PublicAccessBlockConfiguration.BlockPublicAcls}`);
    console.log(`  IgnorePublicAcls: ${publicAccessBlock.PublicAccessBlockConfiguration.IgnorePublicAcls}`);
    console.log(`  BlockPublicPolicy: ${publicAccessBlock.PublicAccessBlockConfiguration.BlockPublicPolicy}`);
    console.log(`  RestrictPublicBuckets: ${publicAccessBlock.PublicAccessBlockConfiguration.RestrictPublicBuckets}`);
    
    if (publicAccessBlock.PublicAccessBlockConfiguration.BlockPublicAcls) {
      console.log('\n⚠️  ACLs are blocked on this bucket. Files cannot be made public via ACL.');
      console.log('💡 You need to either:');
      console.log('   1. Configure bucket policy to allow public access to pop/ folder');
      console.log('   2. Use signed URLs (more secure)');
      console.log('   3. Disable public access blocks in AWS console');
    }
    
  } catch (error) {
    console.error('Error checking bucket public access:', error);
  }
};

// Main function
const main = async () => {
  try {
    console.log('🔓 Checking S3 bucket settings and updating database...\n');
    
    // Step 1: Check bucket settings
    await checkBucketPublicAccess();
    
    // Step 2: List POP files in S3
    const files = await listPOPFiles();
    console.log(`\n📁 Found ${files.length} POP files in S3 bucket`);
    
    // Step 3: Update database URLs to direct S3 URLs
    await updateDatabaseToDirectUrls();
    
    console.log('\n✅ Database URLs updated to direct S3 URLs!');
    console.log('💡 Note: If you still get "Access Denied", you need to configure bucket policy for public access.');
    
  } catch (error) {
    console.error('Error in main function:', error);
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { updateDatabaseToDirectUrls, checkBucketPublicAccess }; 