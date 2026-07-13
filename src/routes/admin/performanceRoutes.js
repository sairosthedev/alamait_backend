const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { getPerformanceStats } = require('../../middleware/performanceMiddleware');
const cacheService = require('../../services/cacheService');

router.get('/stats', auth, checkRole(['admin', 'ceo', 'finance', 'finance_admin']), (req, res) => {
    res.json({
        success: true,
        performance: getPerformanceStats(),
        cache: cacheService.getStats()
    });
});

module.exports = router;
