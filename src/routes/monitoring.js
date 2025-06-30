const express = require('express');
const router = express.Router();
const monitoringService = require('../services/monitoringService');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const s3 = require('../config/s3');

// S3 connectivity test endpoint
router.get('/test-s3-connection', async (req, res) => {
    try {
        console.log('Testing S3 connectivity...');
        
        // Test basic S3 operations
        const testResults = {
            timestamp: new Date().toISOString(),
            bucketAccess: false,
            uploadAccess: false,
            downloadAccess: false,
            errors: []
        };

        try {
            // Test bucket access
            await s3.headBucket({ Bucket: process.env.AWS_BUCKET_NAME }).promise();
            testResults.bucketAccess = true;
            console.log('✅ Bucket access successful');
        } catch (error) {
            testResults.errors.push(`Bucket access failed: ${error.message}`);
            console.log('❌ Bucket access failed:', error.message);
        }

        try {
            // Test upload access (create a test object)
            const testKey = `test-connection-${Date.now()}.txt`;
            await s3.putObject({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: testKey,
                Body: 'S3 connectivity test',
                ContentType: 'text/plain'
            }).promise();
            testResults.uploadAccess = true;
            console.log('✅ Upload access successful');

            // Test download access
            await s3.getObject({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: testKey
            }).promise();
            testResults.downloadAccess = true;
            console.log('✅ Download access successful');

            // Clean up test file
            await s3.deleteObject({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: testKey
            }).promise();
            console.log('✅ Test file cleaned up');

        } catch (error) {
            testResults.errors.push(`Upload/Download test failed: ${error.message}`);
            console.log('❌ Upload/Download test failed:', error.message);
        }

        res.json({
            status: testResults.bucketAccess && testResults.uploadAccess ? 'success' : 'partial',
            message: 'S3 connectivity test completed',
            results: testResults
        });

    } catch (error) {
        console.error('S3 connectivity test error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'S3 connectivity test failed',
            error: error.message 
        });
    }
});

// Prometheus metrics endpoint
router.get('/metrics', [auth, admin], async (req, res) => {
    try {
        res.set('Content-Type', monitoringService.register.contentType);
        res.end(await monitoringService.getMetrics());
    } catch (error) {
        res.status(500).end(error);
    }
});

// Performance check endpoint
router.get('/performance', [auth, admin], async (req, res) => {
    try {
        const performance = await monitoringService.checkPerformance();
        res.json(performance);
    } catch (error) {
        res.status(500).json({ error: 'Error checking performance' });
    }
});

// System health endpoint with enhanced metrics
router.get('/health', async (req, res) => {
    try {
        const metrics = await monitoringService.register.getMetricsAsJSON();
        const memory = process.memoryUsage();
        
        res.json({
            status: 'ok',
            timestamp: new Date(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV,
            memory: {
                heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
                heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
                rss: Math.round(memory.rss / 1024 / 1024) + 'MB'
            },
            metrics: metrics
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching health metrics' });
    }
});

module.exports = router; 