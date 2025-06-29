const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

const bucketName = process.env.AWS_BUCKET_NAME;
const uploadsDir = path.join(__dirname, '../uploads');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function uploadFileToS3(filePath, s3Key) {
  const fileContent = fs.readFileSync(filePath);
  return s3.upload({
    Bucket: bucketName,
    Key: s3Key,
    Body: fileContent,
  
    
  }).promise();
}

(async () => {
  const files = [];
  walkDir(uploadsDir, (filePath) => files.push(filePath));
  for (const filePath of files) {
    const s3Key = path.relative(uploadsDir, filePath).replace(/\\/g, '/');
    try {
      const data = await uploadFileToS3(filePath, s3Key);
      console.log(`Uploaded: ${filePath} -> ${data.Location}`);
    } catch (err) {
      console.error(`Failed to upload ${filePath}:`, err);
    }
  }
})(); 