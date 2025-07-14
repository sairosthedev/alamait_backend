const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const timeoutMiddleware = require('../../middleware/timeout');
const { getPaymentHistory, uploadProofOfPayment, uploadNewProofOfPayment } = require('../../controllers/student/paymentHistoryController');
const { s3, bucketName } = require('../../config/s3');

// Apply authentication and role middleware
router.use(auth);
router.use(checkRole('student'));

// Apply timeout middleware for file uploads
router.use(timeoutMiddleware(60000)); // 60 seconds timeout for uploads

// Test S3 configuration endpoint
router.get('/test-s3', async (req, res) => {
    try {
        console.log('Testing S3 configuration...');
        console.log('Bucket name:', bucketName);
        
        // Test S3 connection by listing objects (limited to 1)
        const result = await s3.listObjectsV2({
            Bucket: bucketName,
            MaxKeys: 1
        }).promise();
        
        res.json({
            message: 'S3 connection successful',
            bucket: bucketName,
            objectsCount: result.KeyCount,
            isTruncated: result.IsTruncated
        });
    } catch (error) {
        console.error('S3 test failed:', error);
        res.status(500).json({
            error: 'S3 connection failed',
            message: error.message,
            bucket: bucketName
        });
    }
});

// Get payment history route
router.get('/', getPaymentHistory);

// Upload proof of payment route for existing payment
router.post('/:paymentId/upload-pop', uploadProofOfPayment);

// Upload new proof of payment route
// router.post('/upload-pop', uploadNewProofOfPayment);

module.exports = router; 