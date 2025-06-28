const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

const bucketName = process.env.AWS_BUCKET_NAME;

// Function to check account-level public access block settings
const checkAccountPublicAccessBlock = async () => {
  console.log('\n=== Checking Account-Level Public Access Block Settings ===');
  
  try {
    const accountPublicAccessBlock = await s3.getPublicAccessBlock({
      Bucket: bucketName
    }).promise();
    
    console.log('Account Public Access Block Settings:');
    console.log(`  BlockPublicAcls: ${accountPublicAccessBlock.PublicAccessBlockConfiguration.BlockPublicAcls}`);
    console.log(`  IgnorePublicAcls: ${accountPublicAccessBlock.PublicAccessBlockConfiguration.IgnorePublicAcls}`);
    console.log(`  BlockPublicPolicy: ${accountPublicAccessBlock.PublicAccessBlockConfiguration.BlockPublicPolicy}`);
    console.log(`  RestrictPublicBuckets: ${accountPublicAccessBlock.PublicAccessBlockConfiguration.RestrictPublicBuckets}`);
    
    return accountPublicAccessBlock.PublicAccessBlockConfiguration;
  } catch (error) {
    console.error('Error checking account public access block:', error.message);
    return null;
  }
};

// Function to disable account-level public access blocks
const disableAccountPublicAccessBlock = async () => {
  console.log('\n🔓 Disabling Account-Level Public Access Blocks...');
  
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
    
    console.log('✅ Account-level public access blocks disabled!');
    return true;
  } catch (error) {
    console.error('❌ Error disabling account-level public access blocks:', error.message);
    return false;
  }
};

// Function to set comprehensive bucket policy
const setComprehensiveBucketPolicy = async () => {
  console.log('\n📝 Setting Comprehensive Bucket Policy...');
  
  const bucketPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowPublicReadForAllObjects',
        Effect: 'Allow',
        Principal: {
          AWS: '*'
        },
        Action: [
          's3:GetObject',
          's3:GetObjectVersion'
        ],
        Resource: `arn:aws:s3:::${bucketName}/*`
      },
      {
        Sid: 'AllowPublicListBucket',
        Effect: 'Allow',
        Principal: {
          AWS: '*'
        },
        Action: 's3:ListBucket',
        Resource: `arn:aws:s3:::${bucketName}`
      }
    ]
  };

  try {
    await s3.putBucketPolicy({
      Bucket: bucketName,
      Policy: JSON.stringify(bucketPolicy)
    }).promise();
    
    console.log('✅ Comprehensive bucket policy set!');
    return true;
  } catch (error) {
    console.error('❌ Error setting bucket policy:', error.message);
    return false;
  }
};

// Function to check bucket ownership controls
const checkBucketOwnershipControls = async () => {
  console.log('\n=== Checking Bucket Ownership Controls ===');
  
  try {
    const ownershipControls = await s3.getBucketOwnershipControls({
      Bucket: bucketName
    }).promise();
    
    console.log('Bucket Ownership Controls:');
    console.log(`  Object Ownership: ${ownershipControls.OwnershipControls.Rules[0].ObjectOwnership}`);
    
    return ownershipControls.OwnershipControls.Rules[0].ObjectOwnership;
  } catch (error) {
    console.log('No bucket ownership controls found (this is normal for older buckets)');
    return null;
  }
};

// Function to set bucket ownership controls to bucket owner preferred
const setBucketOwnershipControls = async () => {
  console.log('\n🔧 Setting Bucket Ownership Controls...');
  
  try {
    await s3.putBucketOwnershipControls({
      Bucket: bucketName,
      OwnershipControls: {
        Rules: [
          {
            ObjectOwnership: 'BucketOwnerPreferred'
          }
        ]
      }
    }).promise();
    
    console.log('✅ Bucket ownership controls set to BucketOwnerPreferred!');
    return true;
  } catch (error) {
    console.error('❌ Error setting bucket ownership controls:', error.message);
    return false;
  }
};

// Function to test file access with different methods
const testFileAccess = async () => {
  console.log('\n=== Testing File Access ===');
  
  try {
    // List objects to get a test file
    const objects = await s3.listObjectsV2({
      Bucket: bucketName,
      MaxKeys: 5
    }).promise();
    
    if (objects.Contents && objects.Contents.length > 0) {
      console.log('Test URLs (try these in your browser):');
      
      objects.Contents.forEach((obj, index) => {
        const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`;
        console.log(`${index + 1}. ${publicUrl}`);
      });
      
      console.log('\nIf these URLs still show "Access Denied", there might be:');
      console.log('1. Account-level S3 Block Public Access settings enabled');
      console.log('2. IAM policies restricting access');
      console.log('3. Organization-level restrictions');
      console.log('4. CloudFront distribution issues');
    }
    
  } catch (error) {
    console.error('Error testing file access:', error.message);
  }
};

// Function to check if bucket exists and is accessible
const checkBucketAccess = async () => {
  console.log('\n=== Checking Bucket Access ===');
  
  try {
    const bucketLocation = await s3.getBucketLocation({
      Bucket: bucketName
    }).promise();
    
    console.log(`✅ Bucket "${bucketName}" exists and is accessible`);
    console.log(`📍 Bucket location: ${bucketLocation.LocationConstraint || 'us-east-1'}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error accessing bucket "${bucketName}":`, error.message);
    return false;
  }
};

// Main function
const fixS3Access = async () => {
  try {
    console.log('🚀 Comprehensive S3 Access Fix...\n');
    
    // Step 1: Check bucket access
    const bucketAccessible = await checkBucketAccess();
    if (!bucketAccessible) {
      console.log('❌ Cannot access bucket. Check your AWS credentials and bucket name.');
      return;
    }
    
    // Step 2: Check current settings
    await checkAccountPublicAccessBlock();
    await checkBucketOwnershipControls();
    
    // Step 3: Disable public access blocks
    await disableAccountPublicAccessBlock();
    
    // Step 4: Set bucket ownership controls
    await setBucketOwnershipControls();
    
    // Step 5: Set comprehensive bucket policy
    await setComprehensiveBucketPolicy();
    
    // Step 6: Check settings again
    console.log('\n=== Updated Settings ===');
    await checkAccountPublicAccessBlock();
    await checkBucketOwnershipControls();
    
    // Step 7: Test access
    await testFileAccess();
    
    console.log('\n✅ All S3 access configurations applied!');
    console.log('💡 If you still get "Access Denied", check:');
    console.log('   - AWS Console > S3 > Block Public Access (Account level)');
    console.log('   - IAM policies for your user/role');
    console.log('   - Organization SCPs (if applicable)');
    
  } catch (error) {
    console.error('Error fixing S3 access:', error);
  }
};

// Run the script
if (require.main === module) {
  fixS3Access();
}

module.exports = { fixS3Access }; 