/**
 * Request Deduplication Middleware
 * 
 * Prevents duplicate concurrent API requests from being processed.
 * If the same request comes in while one is already processing, it waits for the first one.
 * 
 * This is especially useful for:
 * - Dashboard endpoints that are called multiple times on page load
 * - Expensive queries that shouldn't run in parallel
 * - Preventing race conditions
 */

const pendingRequests = new Map();

/**
 * Generate a unique key for a request
 */
function getRequestKey(req) {
    // Use method + path + query params + user ID (if authenticated)
    const user = req.user?._id || req.user?.id || 'anonymous';
    const queryString = JSON.stringify(req.query);
    return `${req.method}:${req.path}:${queryString}:${user}`;
}

/**
 * Request deduplication middleware
 */
const requestDeduplication = (req, res, next) => {
    // Only apply to GET requests (safe to deduplicate)
    if (req.method !== 'GET') {
        return next();
    }

    // Skip for certain endpoints that should always run fresh
    const skipPaths = [
        '/api/auth',
        '/api/logout',
        '/api/health',
        '/api/status'
    ];
    
    if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    const requestKey = getRequestKey(req);
    
    // Check if this request is already being processed
    if (pendingRequests.has(requestKey)) {
        // Wait for the existing request to complete
        return pendingRequests.get(requestKey)
            .then(result => {
                // Return the cached result
                res.status(result.status || 200).json(result.data);
            })
            .catch(error => {
                // If the original request failed, let this one proceed
                pendingRequests.delete(requestKey);
                next();
            });
    }

    // Store original res.json to intercept the response
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    
    let responseStatus = 200;
    res.status = function(code) {
        responseStatus = code;
        return originalStatus(code);
    };

    // Create a promise that will be resolved when the response is sent
    const requestPromise = new Promise((resolve, reject) => {
        res.json = function(data) {
            // Store the response
            const response = {
                status: responseStatus,
                data: data
            };
            
            // Remove from pending requests
            pendingRequests.delete(requestKey);
            
            // Resolve for any waiting requests
            resolve(response);
            
            // Send the actual response
            return originalJson(data);
        };

        // Handle errors
        res.on('close', () => {
            if (pendingRequests.has(requestKey)) {
                pendingRequests.delete(requestKey);
            }
        });

        // Continue with the request
        next();
    });

    // Store the promise
    pendingRequests.set(requestKey, requestPromise);

    // Clean up after 30 seconds (timeout protection)
    setTimeout(() => {
        if (pendingRequests.has(requestKey)) {
            pendingRequests.delete(requestKey);
        }
    }, 30000);
};

module.exports = requestDeduplication;


