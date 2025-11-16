/**
 * Performance Monitoring Middleware
 * 
 * Logs slow requests (>1 second) to help identify performance bottlenecks.
 * In production, this should be integrated with your monitoring service.
 */

const performanceMonitor = (req, res, next) => {
    const start = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    // Log when response finishes
    res.on('finish', () => {
        const duration = Date.now() - start;
        const endMemory = process.memoryUsage().heapUsed;
        const memoryUsed = (endMemory - startMemory) / 1024 / 1024; // MB

        // Log slow requests (>1 second)
        if (duration > 1000) {
            console.warn(`⚠️  SLOW REQUEST: ${req.method} ${req.url}`);
            console.warn(`   Duration: ${duration}ms`);
            console.warn(`   Memory: ${memoryUsed.toFixed(2)}MB`);
            console.warn(`   Status: ${res.statusCode}`);
            console.warn(`   Timestamp: ${new Date().toISOString()}`);
        }

        // Log very slow requests (>5 seconds) with more detail
        if (duration > 5000) {
            console.error(`🚨 VERY SLOW REQUEST: ${req.method} ${req.url}`);
            console.error(`   Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
            console.error(`   Memory: ${memoryUsed.toFixed(2)}MB`);
            console.error(`   Status: ${res.statusCode}`);
            console.error(`   Query: ${JSON.stringify(req.query)}`);
            console.error(`   Params: ${JSON.stringify(req.params)}`);
        }
    });

    next();
};

module.exports = performanceMonitor;


