require('dotenv').config();
const AWS = require('aws-sdk');

// Configure AWS SDK for S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
  httpOptions: {
    timeout: 30000,
    connectTimeout: 10000
  },
  maxRetries: 3,
  retryDelayOptions: {
    base: 1000
  }
});

const bucketName = process.env.AWS_BUCKET_NAME;

console.log('=== S3 Connection Test ===');
console.log('AWS_ACCESS_KEY:', process.env.AWS_ACCESS_KEY ? 'Set' : 'Not set');
console.log('AWS_SECRET_KEY:', process.env.AWS_SECRET_KEY ? 'Set' : 'Not set');
console.log('AWS_REGION:', process.env.AWS_REGION || 'Not set');
console.log('AWS_BUCKET_NAME:', bucketName || 'Not set');

async function testS3Connection() {
  try {
    console.log('\nTesting S3 connection...');
    
    // Test 1: List objects in bucket
    const result = await s3.listObjectsV2({
      Bucket: bucketName,
      MaxKeys: 5
    }).promise();
    
    console.log('✅ S3 connection successful!');
    console.log('Bucket:', bucketName);
    console.log('Objects found:', result.KeyCount);
    console.log('Sample objects:', result.Contents?.slice(0, 3).map(obj => obj.Key) || []);
    
    // Test 2: Check bucket permissions
    const bucketLocation = await s3.getBucketLocation({
      Bucket: bucketName
    }).promise();
    
    console.log('✅ Bucket permissions OK!');
    console.log('Bucket region:', bucketLocation.LocationConstraint || 'us-east-1');
    
    console.log('\n🎉 S3 is properly configured and ready for uploads!');
    
  } catch (error) {
    console.error('❌ S3 connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error status:', error.statusCode);
    
    if (error.code === 'CredentialsError') {
      console.log('\n💡 Solution: Check your AWS credentials in .env file');
    } else if (error.code === 'NoSuchBucket') {
      console.log('\n💡 Solution: Check your bucket name in .env file');
    } else if (error.code === 'AccessDenied') {
      console.log('\n💡 Solution: Check your AWS IAM permissions');
    }
  }
}

testS3Connection(); 