// Timeout middleware for file uploads
const timeoutMiddleware = (timeoutMs = 60000) => {
    return (req, res, next) => {
        // Set timeout for file upload routes
        if (req.method === 'POST' && (
            req.path.includes('upload-pop') || 
            req.path.includes('upload') ||
            req.path.includes('lease')
        )) {
            req.setTimeout(timeoutMs);
            res.setTimeout(timeoutMs);
            
            // Add timeout handler
            const timeout = setTimeout(() => {
                if (!res.headersSent) {
                    console.error(`Request timeout after ${timeoutMs}ms for ${req.method} ${req.path}`);
                    res.status(408).json({ 
                        error: 'Request timeout - upload took too long',
                        message: 'Please try uploading a smaller file or check your internet connection'
                    });
                }
            }, timeoutMs);
            
            // Clear timeout when response is sent
            res.on('finish', () => {
                clearTimeout(timeout);
            });
            
            res.on('close', () => {
                clearTimeout(timeout);
            });
        }
        next();
    };
};

module.exports = timeoutMiddleware; 