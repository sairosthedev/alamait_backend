/**
 * Comprehensive Audit Middleware
 * Logs all API requests and responses for complete audit trail
 */

const { createAuditLog } = require('../utils/auditLogger');
const AuditLog = require('../models/AuditLog');
const { v4: uuidv4 } = require('uuid');

/**
 * Middleware to log all API requests
 */
const auditMiddleware = async (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    // Skip audit logging for certain paths
    const skipPaths = [
        '/health',
        '/ping',
        '/metrics',
        '/favicon.ico',
        '/static',
        '/assets'
    ];
    
    if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
    }
    
    // Capture request data
    const requestData = {
        method: req.method,
        path: req.path,
        query: req.query,
        body: sanitizeRequestBody(req.body),
        headers: sanitizeHeaders(req.headers),
        user: req.user ? {
            id: req.user._id,
            email: req.user.email,
            role: req.user.role
        } : null,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        timestamp: new Date()
    };
    
    // Override res.send to capture response
    res.send = function(data) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Capture the original req object for activity tracking
        const originalReq = req;
        
        // Log the request/response asynchronously (don't block response)
        // LOG EVERYTHING - No filters for comprehensive tracking
        // Use process.nextTick for better performance than setImmediate
        process.nextTick(async () => {
            try {
                const responseData = sanitizeResponseData(data);
                
                // For very large responses, just log metadata instead of full data
                const responseSize = JSON.stringify(responseData).length;
                let finalResponseData = responseData;
                
                if (responseSize > 100000) {
                    // Log summary instead of full data for large responses
                    finalResponseData = {
                        _truncated: true,
                        _size: responseSize,
                        _type: typeof responseData === 'object' ? 'object' : 'string',
                        _preview: typeof responseData === 'object' && responseData !== null 
                            ? Object.keys(responseData).slice(0, 10) 
                            : String(responseData).substring(0, 200)
                    };
                }
                
                await logAPIAudit({
                    request: requestData,
                    response: {
                        statusCode: res.statusCode,
                        data: finalResponseData,
                        duration: duration,
                        size: responseSize
                    },
                    originalReq: originalReq // Pass the original request object
                });
            } catch (error) {
                // Silently fail to not impact performance
                if (process.env.NODE_ENV === 'development') {
                    console.error('Failed to log API audit:', error);
                }
            }
        });
        
        // Call original send
        originalSend.call(this, data);
    };
    
    next();
};

/**
 * Log API request/response audit
 */
async function logAPIAudit({ request, response, originalReq }) {
    try {
        // Determine action based on HTTP method and path
        const action = determineAction(request.method, request.path);
        
        // Determine collection based on path
        const collection = determineCollection(request.path);
        
        // Extract record ID if present
        const recordId = extractRecordId(request.path, request.body);
        
        // Create audit log entry
        await createAuditLog({
            action,
            collection,
            recordId,
            userId: request.user?.id || null,
            before: null,
            after: response.data,
            details: JSON.stringify({
                method: request.method,
                path: request.path,
                query: request.query,
                statusCode: response.statusCode,
                duration: response.duration,
                ipAddress: request.ipAddress,
                userAgent: request.userAgent
            }),
            ipAddress: request.ipAddress,
            userAgent: request.userAgent
        });
        
        // Also track as user activity if user is authenticated
        if (request.user && request.user.id) {
            try {
                const UserActivityService = require('../services/userActivityService');
                const page = request.path;
                const pageTitle = collection || 'API Request';
                
                // Use the original request object if available, otherwise create a minimal one
                const reqForTracking = originalReq || {
                    sessionID: originalReq?.sessionID || uuidv4(), // Generate session ID if not available
                    requestId: request.requestId || uuidv4(),
                    ip: request.ipAddress,
                    connection: { remoteAddress: request.ipAddress },
                    headers: { 
                        'user-agent': request.userAgent,
                        'referer': originalReq?.headers?.['referer'] || null,
                        'referrer': originalReq?.headers?.['referrer'] || null
                    },
                    path: request.path,
                    method: request.method,
                    query: request.query,
                    url: request.path
                };
                
                // Ensure we have a session ID
                if (!reqForTracking.sessionID) {
                    reqForTracking.sessionID = uuidv4();
                }
                
                // Track as action for API calls
                const activityResult = await UserActivityService.trackAction(request.user.id, reqForTracking, {
                    page,
                    pageTitle,
                    action: action,
                    data: {
                        method: request.method,
                        path: request.path,
                        query: request.query,
                        statusCode: response.statusCode,
                        duration: response.duration
                    },
                    recordId: recordId,
                    collection: collection,
                    status: response.statusCode < 400 ? 'success' : 'error',
                    metadata: {
                        responseSize: response.size,
                        apiCall: true
                    }
                });
                
                if (!activityResult) {
                    console.warn(`⚠️ UserActivity tracking returned null for user ${request.user.id} on ${request.path}`);
                }
            } catch (activityError) {
                // Log error in all environments to help debug
                console.error('❌ Failed to track user activity:', activityError.message);
                console.error('   UserId:', request.user?.id);
                console.error('   Path:', request.path);
                console.error('   Action:', action);
                if (process.env.NODE_ENV === 'development') {
                    console.error('   Full error:', activityError);
                    console.error('   Stack:', activityError.stack?.split('\n').slice(0, 10).join('\n'));
                }
            }
        } else {
            // Log when user is not authenticated (for debugging)
            if (process.env.NODE_ENV === 'development' && request.path !== '/health' && !request.path.startsWith('/static')) {
                console.log(`ℹ️ Skipping activity tracking - no authenticated user for ${request.method} ${request.path}`);
            }
        }
    } catch (error) {
        console.error('Error creating API audit log:', error);
    }
}

/**
 * Determine action based on HTTP method and path
 */
function determineAction(method, path) {
    const methodActions = {
        'GET': 'read',
        'POST': 'create',
        'PUT': 'update',
        'PATCH': 'update',
        'DELETE': 'delete'
    };
    
    // Special cases for specific paths
    if (path.includes('/approve')) return 'approve';
    if (path.includes('/reject')) return 'reject';
    if (path.includes('/submit')) return 'submit';
    if (path.includes('/convert')) return 'convert';
    if (path.includes('/mark-paid')) return 'mark_paid';
    if (path.includes('/login')) return 'login';
    if (path.includes('/logout')) return 'logout';
    if (path.includes('/register')) return 'register';
    
    return methodActions[method] || 'unknown';
}

/**
 * Determine collection based on path
 */
function determineCollection(path) {
    // Extract collection from path
    const pathSegments = path.split('/').filter(segment => segment);
    
    // Map common paths to collections
    const pathMappings = {
        'users': 'User',
        'students': 'User',
        'applications': 'Application',
        'leases': 'Lease',
        'payments': 'Payment',
        'expenses': 'Expense',
        'requests': 'Request',
        'monthly-requests': 'MonthlyRequest',
        'accounts': 'Account',
        'transactions': 'Transaction',
        'vendors': 'Vendor',
        'debtors': 'Debtor',
        'residences': 'Residence',
        'rooms': 'Room',
        'quotations': 'Quotation',
        'invoices': 'Invoice',
        'audit-logs': 'AuditLog'
    };
    
    // Find the first segment that maps to a collection
    for (const segment of pathSegments) {
        if (pathMappings[segment]) {
            return pathMappings[segment];
        }
    }
    
    // Default to API if no specific collection found
    return 'API';
}

/**
 * Extract record ID from path or body
 */
function extractRecordId(path, body) {
    // Try to extract from path parameters
    const pathSegments = path.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    // Check if last segment looks like an ObjectId
    if (lastSegment && /^[0-9a-fA-F]{24}$/.test(lastSegment)) {
        return lastSegment;
    }
    
    // Try to extract from body
    if (body && body._id) {
        return body._id;
    }
    
    if (body && body.id) {
        return body.id;
    }
    
    return null;
}

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

/**
 * Sanitize response data
 */
function sanitizeResponseData(data) {
    if (!data) return data;
    
    try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        
        // Remove sensitive fields from response
        if (parsed && typeof parsed === 'object') {
            const sanitized = { ...parsed };
            const sensitiveFields = ['password', 'token', 'secret', 'key'];
            
            for (const field of sensitiveFields) {
                if (sanitized[field]) {
                    sanitized[field] = '[REDACTED]';
                }
            }
            
            return sanitized;
        }
        
        return parsed;
    } catch (error) {
        return data;
    }
}

/**
 * Get client IP address
 */
function getClientIP(req) {
    return req.headers['x-forwarded-for'] ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.ip;
}

/**
 * Middleware to log specific operations with before/after states
 */
const logOperation = (operation, collection, getRecordId) => {
    return async (req, res, next) => {
        const recordId = getRecordId ? getRecordId(req) : null;
        let beforeState = null;
        
        // Capture before state for update/delete operations
        if (['update', 'delete', 'approve', 'reject'].includes(operation) && recordId) {
            try {
                const Model = require(`../models/${collection}`);
                const record = await Model.findById(recordId);
                if (record) {
                    beforeState = record.toObject();
                }
            } catch (error) {
                console.error('Error capturing before state:', error);
            }
        }
        
        // Store before state in request for use in controller
        req.auditBefore = beforeState;
        req.auditOperation = operation;
        req.auditCollection = collection;
        
        next();
    };
};

/**
 * Helper function to log operation in controller
 */
const logOperationAudit = async (req, record, details = '') => {
    try {
        await createAuditLog({
            action: req.auditOperation || 'unknown',
            collection: req.auditCollection || 'Unknown',
            recordId: record._id,
            userId: req.user?._id,
            before: req.auditBefore,
            after: record.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify(details),
            ipAddress: getClientIP(req),
            userAgent: req.headers['user-agent']
        });
    } catch (error) {
        console.error('Error logging operation audit:', error);
    }
};

module.exports = {
    auditMiddleware,
    logOperation,
    logOperationAudit
};
