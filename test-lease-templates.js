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

console.log('=== Lease Templates Check ===');
console.log('Bucket:', bucketName);

async function checkLeaseTemplates() {
  try {
    console.log('\n1. Checking for lease templates in S3...');
    
    // List all objects in the lease_templates folder
    const result = await s3.listObjectsV2({
      Bucket: bucketName,
      Prefix: 'lease_templates/',
      MaxKeys: 10
    }).promise();
    
    console.log('✅ S3 connection successful!');
    console.log('Lease templates found:', result.KeyCount);
    
    if (result.Contents && result.Contents.length > 0) {
      console.log('Available templates:');
      result.Contents.forEach(obj => {
        console.log(`  - ${obj.Key} (${obj.Size} bytes)`);
      });
    } else {
      console.log('❌ No lease templates found in S3');
    }
    
    // Check for specific residence templates
    const residences = ['St Kilda', 'Belvedere', 'Macdonald'];
    console.log('\n2. Checking for specific residence templates...');
    
    for (const residence of residences) {
      try {
        const templateKey = `lease_templates/${residence}_lease_template.docx`;
        await s3.headObject({
          Bucket: bucketName,
          Key: templateKey
        }).promise();
        console.log(`✅ Found template for ${residence}: ${templateKey}`);
      } catch (error) {
        console.log(`❌ No template found for ${residence}`);
      }
    }
    
    console.log('\n3. Checking local uploads directory...');
    const fs = require('fs');
    const path = require('path');
    
    const uploadsDir = path.join(__dirname, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      const leaseFiles = files.filter(file => file.includes('lease'));
      console.log('Local lease files found:', leaseFiles.length);
      leaseFiles.forEach(file => {
        console.log(`  - ${file}`);
      });
    } else {
      console.log('❌ Local uploads directory not found');
    }
    
    console.log('\n📝 Recommendations:');
    if (result.KeyCount === 0) {
      console.log('1. Upload lease templates to S3 in the lease_templates/ folder');
      console.log('2. Use naming convention: {residenceId}_lease_template.docx');
      console.log('3. Or upload to local uploads/ directory with naming: lease_agreement_{residenceId}.docx');
    }
    
  } catch (error) {
    console.error('❌ Error checking lease templates:', error.message);
  }
}

checkLeaseTemplates(); 