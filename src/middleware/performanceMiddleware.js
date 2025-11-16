/**
 * Performance Monitoring Middleware
 * Tracks response times and logs slow requests
 */

const performanceLog = [];

// Clear old logs every hour
setInterval(() => {
    if (performanceLog.length > 1000) {
        performanceLog.splice(0, performanceLog.length - 500);
    }
}, 3600000);

/**
 * Middleware to track API response times
 */
const performanceMonitor = (req, res, next) => {
    const startTime = Date.now();
    const path = req.path;
    const method = req.method;
    
    // Override res.json to capture response time
    const originalJson = res.json.bind(res);
    res.json = function(data) {
        const duration = Date.now() - startTime;
        
        // Log slow requests (> 1 second)
        if (duration > 1000) {
            const logEntry = {
                timestamp: new Date().toISOString(),
                method,
                path,
                duration: `${duration}ms`,
                query: req.query,
                params: req.params,
                statusCode: res.statusCode
            };
            
            performanceLog.push(logEntry);
            
            // Log to console for immediate visibility
            console.warn(`⚠️ SLOW REQUEST: ${method} ${path} took ${duration}ms`, {
                query: req.query,
                params: req.params
            });
        }
        
        // Add performance header
        res.setHeader('X-Response-Time', `${duration}ms`);
        
        return originalJson(data);
    };
    
    next();
};

/**
 * Get performance statistics
 */
const getPerformanceStats = () => {
    const slowRequests = performanceLog.filter(log => {
        const duration = parseInt(log.duration);
        return duration > 2000; // Requests over 2 seconds
    });
    
    const avgDuration = performanceLog.length > 0
        ? performanceLog.reduce((sum, log) => sum + parseInt(log.duration), 0) / performanceLog.length
        : 0;
    
    return {
        totalRequests: performanceLog.length,
        slowRequests: slowRequests.length,
        averageDuration: `${Math.round(avgDuration)}ms`,
        slowestEndpoints: slowRequests
            .sort((a, b) => parseInt(b.duration) - parseInt(a.duration))
            .slice(0, 10)
    };
};

module.exports = {
    performanceMonitor,
    getPerformanceStats,
    performanceLog
};

