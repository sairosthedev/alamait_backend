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

// Check if file exists in S3
const checkFileExistsInS3 = async (filename) => {
  try {
    // Try different possible S3 keys for the file
    const possibleKeys = [
      filename,
      `leases/${filename}`,
      `signed_leases/${filename}`,
      `general/${filename}`
    ];

    for (const key of possibleKeys) {
      try {
        await s3.headObject({
          Bucket: bucketName,
          Key: key
        }).promise();
        
        console.log(`✅ File found in S3 with key: ${key}`);
        return `https://${bucketName}.s3.amazonaws.com/${key}`;
      } catch (error) {
        if (error.code === 'NotFound') {
          continue; // Try next key
        } else {
          throw error; // Other error
        }
      }
    }
    
    console.log(`❌ File not found in S3: ${filename}`);
    return null;
  } catch (error) {
    console.error(`Error checking file in S3: ${filename}`, error);
    return null;
  }
};

// Update lease records with local paths
const updateRemainingLeases = async () => {
  console.log('\n=== Updating Remaining Lease Records ===');
  
  try {
    // Find all lease records that don't have S3 URLs
    const leases = await Lease.find({
      $or: [
        { path: { $regex: /^[A-Z]:\\/ } }, // Windows paths
        { path: { $regex: /^\/opt\/render\/project\/src\/uploads\// } }, // Render paths
        { path: { $regex: /^\/uploads\// } }, // Unix paths
        { path: { $not: /^https?:\/\// } }, // Not URLs
        { path: null } // Null paths
      ]
    });

    console.log(`Found ${leases.length} lease records that need updating`);

    for (const lease of leases) {
      try {
        console.log(`\nProcessing lease: ${lease.filename}`);
        console.log(`Current path: ${lease.path}`);
        
        // Check if file exists in S3
        const s3Url = await checkFileExistsInS3(lease.filename);
        
        if (s3Url) {
          // Update database record with S3 URL
          lease.path = s3Url;
          await lease.save();
          console.log(`✅ Updated lease ${lease.filename} to S3 URL: ${s3Url}`);
        } else {
          console.log(`❌ File not found in S3 for: ${lease.filename}`);
          console.log('Keeping path as null - file may need to be re-uploaded');
        }
      } catch (error) {
        console.error(`Error processing lease ${lease.filename}:`, error);
      }
    }
  } catch (error) {
    console.error('Error updating remaining leases:', error);
  }
};

// Update specific lease records based on your data
const updateSpecificLeases = async () => {
  console.log('\n=== Updating Specific Lease Records ===');
  
  const specificUpdates = [
    {
      id: '685d813fd4c3b8462e39c57b',
      filename: '1750958399154-116289298-ST Kilda Boarding Agreement1.docx'
    },
    {
      id: '685d914536237048a58fac53', 
      filename: '1750962499723-686663459-ST Kilda Boarding Agreement signed miccs.pdf'
    },
    {
      id: '685e8dc2a79798715afd1f08',
      filename: '1751027137588-124355220-1750976070365-485903764-ST Kilda Boarding Agreement Kudzai[1].pdf'
    }
  ];

  for (const update of specificUpdates) {
    try {
      console.log(`\nProcessing specific lease: ${update.filename}`);
      
      const lease = await Lease.findById(update.id);
      if (!lease) {
        console.log(`❌ Lease record not found: ${update.id}`);
        continue;
      }

      console.log(`Current path: ${lease.path}`);
      
      // Check if file exists in S3
      const s3Url = await checkFileExistsInS3(update.filename);
      
      if (s3Url) {
        // Update database record with S3 URL
        lease.path = s3Url;
        await lease.save();
        console.log(`✅ Updated lease ${update.filename} to S3 URL: ${s3Url}`);
      } else {
        console.log(`❌ File not found in S3 for: ${update.filename}`);
      }
    } catch (error) {
      console.error(`Error processing specific lease ${update.filename}:`, error);
    }
  }
};

// Main function
const updateAllLeases = async () => {
  try {
    await connectDB();
    
    console.log('🚀 Starting lease update process...');
    
    await updateSpecificLeases();
    await updateRemainingLeases();
    
    console.log('\n✅ All lease updates completed!');
    console.log('Check your database to verify the updates.');
    
  } catch (error) {
    console.error('Error in lease update process:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the script
if (require.main === module) {
  updateAllLeases();
}

module.exports = { updateAllLeases }; 