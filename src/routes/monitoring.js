const express = require('express');
const router = express.Router();
const monitoringService = require('../services/monitoringService');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

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