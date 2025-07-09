const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const path = require('path');
require('dotenv').config();

// === CONFIGURATION ===
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alamait';
const S3_BUCKET = process.env.S3_BUCKET || 'your-s3-bucket-name';
const S3_PREFIX = process.env.S3_LEASE_PREFIX || 'leases/'; // Change if your leases are in a different folder

// === MONGOOSE MODELS ===
const Lease = require('../src/models/Lease');

// === S3 SETUP ===
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

async function main() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  ('Connected to MongoDB');

  // List all lease files in S3
  const s3Files = await s3.listObjectsV2({ Bucket: S3_BUCKET, Prefix: S3_PREFIX }).promise();
  const leaseFiles = s3Files.Contents.filter(obj => obj.Key.endsWith('.pdf') || obj.Key.endsWith('.docx'));
  ('Found', leaseFiles.length, 'lease files in S3');

  let created = 0;
  for (const file of leaseFiles) {
    const filename = path.basename(file.Key);
    // Example: Lease_Makanaka_Pemhiwa.pdf => Makanaka Pemhiwa
    let studentName = filename.replace(/^Lease[_-]/i, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/-/g, ' ');
    studentName = studentName.replace(/\s+/g, ' ').trim();
    // Optionally, parse email or other info from filename if available

    // Build S3 download URL (public or signed, depending on your setup)
    const downloadUrl = s3.getSignedUrl('getObject', { Bucket: S3_BUCKET, Key: file.Key, Expires: 60 * 60 * 24 * 7 });

    // Check if Lease already exists for this file
    const exists = await Lease.findOne({ filename });
    if (exists) {
      ('Lease already exists for', filename);
      continue;
    }

    // Create Lease document
    const leaseDoc = new Lease({
      studentName,
      filename,
      downloadUrl,
      uploadedAt: file.LastModified,
      // Add more fields if you have a mapping (e.g., email, studentId)
    });
    await leaseDoc.save();
    created++;
    ('Created Lease doc for', filename, '->', studentName);
  }

  ('Done. Created', created, 'new Lease documents.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 