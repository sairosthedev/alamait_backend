const promClient = require('prom-client');
const responseTime = require('response-time');

class MonitoringService {
    constructor() {
        // Initialize Prometheus registry
        this.register = new promClient.Registry();
        
        // Add default metrics (CPU, memory, etc.)
        promClient.collectDefaultMetrics({ register: this.register });

        // Create custom metrics
        this.httpRequestDurationMicroseconds = new promClient.Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.1, 0.5, 1, 2, 5]  // Define buckets for response time (in seconds)
        });

        this.httpRequestTotal = new promClient.Counter({
            name: 'http_request_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status_code']
        });

        // Register custom metrics
        this.register.registerMetric(this.httpRequestDurationMicroseconds);
        this.register.registerMetric(this.httpRequestTotal);
    }

    // Middleware to monitor response time
    responseTimeMiddleware() {
        return responseTime((req, res, time) => {
            if (req.route) {
                const route = req.route.path;
                const method = req.method;
                const statusCode = res.statusCode;

                // Record response time
                this.httpRequestDurationMicroseconds
                    .labels(method, route, statusCode)
                    .observe(time / 1000); // Convert to seconds

                // Increment request counter
                this.httpRequestTotal
                    .labels(method, route, statusCode)
                    .inc();

                // Alert if response time exceeds 2 seconds (as per SRS requirement)
                if (time > 2000) {
                    console.warn(`Slow response detected: ${method} ${route} took ${time}ms`);
                    // Here you could add additional alerting (e.g., email, Slack notification)
                }
            }
        });
    }

    // Endpoint to expose metrics
    async getMetrics() {
        return await this.register.metrics();
    }

    // Method to check if performance meets SRS requirements
    async checkPerformance() {
        const metrics = await this.register.getMetricsAsJSON();
        
        // Find dashboard response times
        const dashboardMetrics = metrics.find(m => 
            m.name === 'http_request_duration_seconds' && 
            m.values.some(v => v.labels.route.includes('/dashboard'))
        );

        if (dashboardMetrics) {
            const slowRequests = dashboardMetrics.values.filter(v => v.value > 2);
            return {
                totalRequests: dashboardMetrics.values.length,
                slowRequests: slowRequests.length,
                performanceMeetsSLA: slowRequests.length === 0
            };
        }

        return null;
    }
}

module.exports = new MonitoringService(); 