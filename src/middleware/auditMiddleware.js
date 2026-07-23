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
    
    // Skip audit logging for high-volume read endpoints and health checks
    const skipPaths = [
        '/health',
        '/ping',
        '/metrics',
        '/favicon.ico',
        '/static',
        '/assets'
    ];

    const skipReadPaths = [
        '/api/residences',
        '/api/admin/residences',
        '/api/finance/residences',
        '/api/applications',
        '/api/admin/applications',
        '/api/finance/applications',
        '/api/monthly-requests',
        '/api/requests/pending-count',
        '/api/finance/dashboard/badges',
        '/pending-count',
        '/approvals',
        '/templates'
    ];
    
    // Audit trail is for write actions (create/update/delete/approve/etc.), not reads
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }

    // Never audit the activity tracker itself — it is telemetry, not business CRUD.
    // Frontend POSTs here to report real UI actions; logging that POST as "create" is noise.
    if (
        req.path.includes('/user-activity') ||
        req.path.includes('/user-activities') ||
        req.originalUrl?.includes('/user-activity')
    ) {
        return next();
    }

    // Auth owns login/logout audit entries — avoid duplicate login rows
    if (
        req.path.includes('/auth/login') ||
        req.path.includes('/auth/logout') ||
        req.path.includes('/auth/register') ||
        req.path.includes('/auth/magic-login')
    ) {
        return next();
    }

    if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    if (req.method === 'GET' && skipReadPaths.some((segment) => req.path.includes(segment))) {
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
                
                const responseSize = typeof data === 'string'
                    ? data.length
                    : (Buffer.isBuffer(data) ? data.length : JSON.stringify(responseData).length);
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

                // Auth runs on the route AFTER this middleware — read user at response time
                const authenticatedUser = originalReq.user
                    ? {
                        id: originalReq.user._id || originalReq.user.id,
                        email: originalReq.user.email,
                        role: originalReq.user.role,
                        firstName: originalReq.user.firstName,
                        lastName: originalReq.user.lastName
                    }
                    : requestData.user;
                
                await logAPIAudit({
                    request: {
                        ...requestData,
                        user: authenticatedUser
                    },
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

        // Never persist read/view traffic in AuditLog
        if (action === 'read' || action === 'unknown' && request.method === 'GET') {
            return;
        }
        
        // Determine collection based on path
        const collection = determineCollection(request.path);

        // Only audit real entity CRUD / workflow actions — not unmapped telemetry POSTs
        const workflowActions = new Set([
            'approve', 'reject', 'submit', 'convert', 'mark_paid',
            'login', 'logout', 'register'
        ]);
        if (collection === 'API' && !workflowActions.has(action)) {
            return;
        }
        
        // Extract record ID if present
        const recordId = extractRecordId(request.path, request.body);
        
        // Create audit log entry (fire-and-forget — never block the response path)
        createAuditLog({
            action,
            collection,
            recordId,
            userId: request.user?.id || null,
            before: null,
            after: sanitizeAuditAfter(response.data, collection, action),
            details: JSON.stringify({
                method: request.method,
                path: request.path,
                query: request.query,
                statusCode: response.statusCode,
                duration: response.duration,
                ipAddress: request.ipAddress,
                userAgent: request.userAgent,
                actorEmail: request.user?.email || null,
                actorName: [request.user?.firstName, request.user?.lastName].filter(Boolean).join(' ') || null,
                actorRole: request.user?.role || null
            }),
            ipAddress: request.ipAddress,
            userAgent: request.userAgent
        }).catch(() => {});

        // Do NOT dual-write UserActivity here — frontend /user-activity/track owns UX telemetry.
        // Middleware UserActivity.create doubled Atlas writes on every mutation.
    } catch (error) {
        console.error('Error creating API audit log:', error);
    }
}

/**
 * Prefer entity payload over raw HTTP envelope for audit "after" snapshots
 */
function sanitizeAuditAfter(responseData, collection, action) {
    if (!responseData || typeof responseData !== 'object') {
        return responseData;
    }
    // Prefer created/updated entity if present
    if (responseData.data && typeof responseData.data === 'object') {
        return responseData.data;
    }
    if (responseData[collection?.toLowerCase?.()]) {
        return responseData[collection.toLowerCase()];
    }
    return {
        action,
        collection,
        success: responseData.success,
        message: responseData.message,
        id: responseData._id || responseData.id || null
    };
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
        'payment-allocation': 'Payment',
        'expenses': 'Expense',
        'requests': 'Request',
        'monthly-requests': 'MonthlyRequest',
        'accounts': 'Account',
        'transactions': 'Transaction',
        'transaction-entries': 'Transaction',
        'journals': 'Transaction',
        'journal-entries': 'Transaction',
        'vendors': 'Vendor',
        'debtors': 'Debtor',
        'residences': 'Residence',
        'rooms': 'Room',
        'quotations': 'Quotation',
        'invoices': 'Invoice',
        'audit-logs': 'AuditLog',
        'other-income': 'OtherIncome',
        'creditors': 'Creditor'
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
