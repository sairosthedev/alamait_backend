const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

const bucketName = process.env.AWS_BUCKET_NAME;

// Function to disable public access blocks
const disablePublicAccessBlocks = async () => {
  console.log('🔓 Disabling public access blocks...');
  
  try {
    await s3.putPublicAccessBlock({
      Bucket: bucketName,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false
      }
    }).promise();
    
    console.log('✅ Public access blocks disabled successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error disabling public access blocks:', error.message);
    return false;
  }
};

// Function to set bucket policy for public read access
const setPublicBucketPolicy = async () => {
  console.log('📝 Setting bucket policy for public read access...');
  
  const bucketPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowPublicReadForAllObjects',
        Effect: 'Allow',
        Principal: '*',
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${bucketName}/*`
      }
    ]
  };

  try {
    await s3.putBucketPolicy({
      Bucket: bucketName,
      Policy: JSON.stringify(bucketPolicy)
    }).promise();
    
    console.log('✅ Bucket policy set successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error setting bucket policy:', error.message);
    return false;
  }
};

// Function to check current bucket settings
const checkBucketSettings = async () => {
  console.log('\n=== Current Bucket Settings ===');
  
  try {
    // Check public access block settings
    const publicAccessBlock = await s3.getPublicAccessBlock({
      Bucket: bucketName
    }).promise();
    
    console.log('Public Access Block Settings:');
    console.log(`  BlockPublicAcls: ${publicAccessBlock.PublicAccessBlockConfiguration.BlockPublicAcls}`);
    console.log(`  IgnorePublicAcls: ${publicAccessBlock.PublicAccessBlockConfiguration.IgnorePublicAcls}`);
    console.log(`  BlockPublicPolicy: ${publicAccessBlock.PublicAccessBlockConfiguration.BlockPublicPolicy}`);
    console.log(`  RestrictPublicBuckets: ${publicAccessBlock.PublicAccessBlockConfiguration.RestrictPublicBuckets}`);
    
    // Check bucket policy
    try {
      const bucketPolicy = await s3.getBucketPolicy({
        Bucket: bucketName
      }).promise();
      
      console.log('\nBucket Policy:');
      console.log(bucketPolicy.Policy);
    } catch (error) {
      console.log('\nBucket Policy: None set');
    }
    
  } catch (error) {
    console.error('Error checking bucket settings:', error.message);
  }
};

// Function to test public access
const testPublicAccess = async () => {
  console.log('\n=== Testing Public Access ===');
  
  try {
    // List a few objects to test
    const objects = await s3.listObjectsV2({
      Bucket: bucketName,
      MaxKeys: 3
    }).promise();
    
    if (objects.Contents && objects.Contents.length > 0) {
      const testObject = objects.Contents[0];
      const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${testObject.Key}`;
      
      console.log(`Testing access to: ${publicUrl}`);
      console.log('If you can access this URL in your browser, public access is working!');
      console.log('If you get "Access Denied", the configuration is not complete.');
    }
    
  } catch (error) {
    console.error('Error testing public access:', error.message);
  }
};

// Main function
const configurePublicAccess = async () => {
  try {
    console.log('🚀 Configuring S3 bucket for public access...\n');
    
    // Step 1: Check current settings
    await checkBucketSettings();
    
    // Step 2: Disable public access blocks
    const blocksDisabled = await disablePublicAccessBlocks();
    
    // Step 3: Set bucket policy
    const policySet = await setPublicBucketPolicy();
    
    // Step 4: Check settings again
    console.log('\n=== Updated Bucket Settings ===');
    await checkBucketSettings();
    
    // Step 5: Test public access
    await testPublicAccess();
    
    if (blocksDisabled && policySet) {
      console.log('\n✅ S3 bucket configured for public access!');
      console.log('🎉 All files should now be publicly accessible.');
    } else {
      console.log('\n⚠️  Some configuration steps failed. Check the errors above.');
    }
    
  } catch (error) {
    console.error('Error configuring public access:', error);
  }
};

// Run the script
if (require.main === module) {
  configurePublicAccess();
}

module.exports = { configurePublicAccess }; 