/**
 * Comprehensive Error Handling Middleware
 * Logs all errors to audit trail and provides consistent error responses
 */

const { logErrorEvent } = require('../utils/auditHelpers');

/**
 * Global error handler middleware
 */
const errorHandler = async (err, req, res, next) => {
    // Log the error to audit trail
    try {
        await logErrorEvent(err, req, {
            method: req.method,
            path: req.path,
            query: req.query,
            body: sanitizeRequestBody(req.body),
            headers: sanitizeHeaders(req.headers)
        });
    } catch (auditError) {
        console.error('Failed to log error to audit trail:', auditError);
    }

    // Log error to console
    console.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
        user: req.user?._id,
        timestamp: new Date().toISOString()
    });

    // Default error response
    let statusCode = err.statusCode || err.status || 500;
    let message = err.message || 'Internal Server Error';
    let details = null;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
        details = Object.values(err.errors).map(e => e.message);
    } else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
    } else if (err.code === 11000) {
        statusCode = 400;
        message = 'Duplicate entry';
        const field = Object.keys(err.keyValue)[0];
        details = `${field} already exists`;
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    } else if (err.name === 'MongoNetworkError') {
        statusCode = 503;
        message = 'Database connection error';
    } else if (err.name === 'MongooseError') {
        statusCode = 500;
        message = 'Database error';
    }

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'Internal Server Error';
        details = null;
    }

    // Send error response
    res.status(statusCode).json({
        success: false,
        message,
        ...(details && { details }),
        ...(process.env.NODE_ENV === 'development' && { 
            stack: err.stack,
            error: err 
        })
    });
};

/**
 * Handle 404 errors
 */
const notFoundHandler = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
};

/**
 * Handle async errors
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Sanitize request body to remove sensitive data
 */
function sanitizeRequestBody(body) {
    if (!body || typeof body !== 'object') {
        return body;
    }
    
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    
    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    }
    
    return sanitized;
}

/**
 * Sanitize headers to remove sensitive data
 */
function sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    
    for (const header of sensitiveHeaders) {
        if (sanitized[header]) {
            sanitized[header] = '[REDACTED]';
        }
    }
    
    return sanitized;
}

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler
};
