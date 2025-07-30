const { s3, s3Configs } = require('../config/s3');

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
 * Upload a file to S3 and return the URL
 * @param {Object} file - The file object from multer
 * @param {string} folder - The folder name in S3 (e.g., 'quotations', 'monthly-request-quotations')
 * @returns {Object} - Object containing url and fileName
 */
const uploadToS3 = async (file, folder) => {
    try {
        if (!file) {
            throw new Error('No file provided');
        }

        console.log('Uploading file to S3:', {
            originalname: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            folder: folder
        });

        // Generate S3 key
        const timestamp = Date.now();
        const s3Key = `${folder}/${timestamp}_${file.originalname}`;

        // Upload to S3
        const s3UploadParams = {
            Bucket: s3Configs.general.bucket,
            Key: s3Key,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: s3Configs.general.acl,
            Metadata: {
                fieldName: file.fieldname,
                uploadDate: new Date().toISOString(),
                folder: folder
            }
        };

        const s3Result = await s3.upload(s3UploadParams).promise();
        console.log('File uploaded successfully to S3:', s3Result.Location);

        return {
            url: s3Result.Location,
            fileName: file.originalname
        };
    } catch (error) {
        console.error('Error uploading file to S3:', error);
        throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
};

module.exports = {
    ensureUploadDirectoriesExist,
    uploadToS3
}; 