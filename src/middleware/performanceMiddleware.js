/**
 * Performance Monitoring Middleware
 * Tracks response times and logs slow requests.
 * Set SLOW_REQUEST_MS=500 in .env to log more aggressively in dev.
 * Set LOG_ALL_REQUESTS=true to log every request with duration.
 */

const SLOW_MS = Number(process.env.SLOW_REQUEST_MS) || 800;
const VERY_SLOW_MS = Number(process.env.VERY_SLOW_REQUEST_MS) || 3000;
const LOG_ALL = process.env.LOG_ALL_REQUESTS === 'true' || process.env.NODE_ENV === 'development';

const performanceLog = [];

// Clear old logs every hour
setInterval(() => {
    if (performanceLog.length > 1000) {
        performanceLog.splice(0, performanceLog.length - 500);
    }
}, 3600000);

/**
 * Middleware to track API response times (all response types, not just res.json)
 */
const performanceMonitor = (req, res, next) => {
    const startTime = Date.now();
    const path = req.originalUrl || req.url;
    const method = req.method;

    // Skip static/noise
    if (path.startsWith('/api-docs') || path === '/health' || path === '/favicon.ico') {
        return next();
    }

    const recordTiming = () => {
        const duration = Date.now() - startTime;

        const logEntry = {
            timestamp: new Date().toISOString(),
            method,
            path,
            durationMs: duration,
            duration: `${duration}ms`,
            query: req.query,
            params: req.params,
            statusCode: res.statusCode
        };

        if (duration >= SLOW_MS) {
            performanceLog.push(logEntry);
        }

        if (duration >= VERY_SLOW_MS) {
            console.error(
                `🚨 VERY SLOW ${method} ${path} → ${duration}ms [${res.statusCode}]`,
                { query: req.query, params: req.params }
            );
        } else if (duration >= SLOW_MS) {
            console.warn(`⚠️ SLOW ${method} ${path} → ${duration}ms [${res.statusCode}]`);
        } else if (LOG_ALL) {
            console.log(`   ${method} ${path} → ${duration}ms [${res.statusCode}]`);
        }
    };

    // Set X-Response-Time header before body is sent
    const originalEnd = res.end.bind(res);
    res.end = function endWithTiming(...args) {
        if (!res.headersSent) {
            res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
        }
        recordTiming();
        return originalEnd(...args);
    };

    next();
};

/**
 * Get performance statistics
 */
const getPerformanceStats = () => {
    const slowRequests = performanceLog.filter((log) => log.durationMs >= VERY_SLOW_MS);

    const avgDuration =
        performanceLog.length > 0
            ? performanceLog.reduce((sum, log) => sum + log.durationMs, 0) / performanceLog.length
            : 0;

    return {
        slowThresholdMs: SLOW_MS,
        totalSlowRequests: performanceLog.length,
        verySlowRequests: slowRequests.length,
        averageSlowDuration: `${Math.round(avgDuration)}ms`,
        slowestEndpoints: [...performanceLog]
            .sort((a, b) => b.durationMs - a.durationMs)
            .slice(0, 20)
            .map(({ timestamp, method, path, duration, statusCode }) => ({
                timestamp,
                method,
                path,
                duration,
                statusCode
            })),
        recentSlow: [...performanceLog]
            .slice(-10)
            .reverse()
            .map(({ timestamp, method, path, duration, statusCode }) => ({
                timestamp,
                method,
                path,
                duration,
                statusCode
            }))
    };
};

module.exports = {
    performanceMonitor,
    getPerformanceStats,
    performanceLog
};
