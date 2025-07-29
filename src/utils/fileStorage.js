const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
});

/**
 * Ensures that necessary upload directories exist
 * Note: This function is kept for backward compatibility but is now a no-op
 * since all files are stored in S3 instead of local directories
 */
const ensureUploadDirectoriesExist = () => {
    // No longer needed since we're using S3 for all file storage
    console.log('File storage is now handled by S3 - no local directories needed');
};

/**
 * Upload file to S3
 * @param {Object} file - Multer file object
 * @param {string} folder - Folder name in S3 bucket
 * @returns {Promise<string>} - S3 URL of uploaded file
 */
const uploadToS3 = async (file, folder = 'uploads') => {
    try {
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `${folder}/${uuidv4()}.${fileExtension}`;
        
        const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: 'public-read'
        };
        
        const result = await s3.upload(params).promise();
        return result.Location;
    } catch (error) {
        console.error('Error uploading to S3:', error);
        throw new Error('Failed to upload file to S3');
    }
};

module.exports = {
    ensureUploadDirectoriesExist,
    uploadToS3
}; 