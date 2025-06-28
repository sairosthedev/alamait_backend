const { s3, bucketName } = require('../config/s3');

// Map residence names to their S3 template keys
const residenceTemplateMap = {
  'st kilda': 'lease_templates/st_kilda_boarding_agreement.docx',
  'belvedere': 'lease_templates/belvedere_agreement.docx', 
  'newlands': 'lease_templates/newlands_agreement.docx',
  'office': 'lease_templates/alamait_office_agreement.docx'
};

/**
 * Get the S3 URL for a lease template based on residence name
 * @param {string} residenceName - The name of the residence
 * @returns {string|null} - The S3 URL for the template or null if not found
 */
const getLeaseTemplateUrl = async (residenceName) => {
  try {
    const normalizedName = residenceName.toLowerCase();
    let templateKey = null;
    
    // Find matching template
    for (const [key, value] of Object.entries(residenceTemplateMap)) {
      if (normalizedName.includes(key)) {
        templateKey = value;
        break;
      }
    }
    
    if (!templateKey) {
      console.log(`No lease template found for residence: ${residenceName}`);
      return null;
    }
    
    // Generate a signed URL that expires in 1 hour
    const signedUrl = await s3.getSignedUrlPromise('getObject', {
      Bucket: bucketName,
      Key: templateKey,
      Expires: 3600 // 1 hour
    });
    
    return signedUrl;
  } catch (error) {
    console.error('Error getting lease template URL:', error);
    return null;
  }
};

/**
 * Get lease template attachment for email
 * @param {string} residenceName - The name of the residence
 * @returns {Object|null} - Attachment object for email or null if not found
 */
const getLeaseTemplateAttachment = async (residenceName) => {
  try {
    const normalizedName = residenceName.toLowerCase();
    let templateKey = null;
    let fileName = null;
    
    // Find matching template
    for (const [key, value] of Object.entries(residenceTemplateMap)) {
      if (normalizedName.includes(key)) {
        templateKey = value;
        fileName = value.split('/').pop(); // Get filename from key
        break;
      }
    }
    
    if (!templateKey) {
      console.log(`No lease template found for residence: ${residenceName}`);
      return null;
    }
    
    // Get the file from S3
    const fileData = await s3.getObject({
      Bucket: bucketName,
      Key: templateKey
    }).promise();
    
    return {
      filename: fileName,
      content: fileData.Body,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
  } catch (error) {
    console.error('Error getting lease template attachment:', error);
    return null;
  }
};

/**
 * Upload a new lease template to S3
 * @param {Buffer} fileBuffer - The file buffer
 * @param {string} residenceId - The residence ID
 * @param {string} originalName - Original filename
 * @returns {string} - The S3 URL of the uploaded template
 */
const uploadLeaseTemplate = async (fileBuffer, residenceId, originalName) => {
  try {
    const key = `lease_templates/${residenceId}_${Date.now()}_${originalName}`;
    
    await s3.upload({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }).promise();
    
    return `https://${bucketName}.s3.amazonaws.com/${key}`;
  } catch (error) {
    console.error('Error uploading lease template:', error);
    throw error;
  }
};

module.exports = {
  getLeaseTemplateUrl,
  getLeaseTemplateAttachment,
  uploadLeaseTemplate,
  residenceTemplateMap
}; 