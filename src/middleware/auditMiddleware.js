const { createAuditLog, logAPIAccess, logErrorEvent } = require('../utils/auditLogger');

/**
 * Comprehensive Audit Middleware
 * Automatically logs all API requests, responses, and errors
 */

// Store request start times for response time calculation
const requestTimers = new Map();

/**
 * Middleware to log API access
 */
exports.logAPIAccess = async (req, res, next) => {
    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store start time
    requestTimers.set(requestId, startTime);
    
    // Add request ID to request object
    req.requestId = requestId;
    
    // Log the API access
    try {
        await logAPIAccess({
            method: req.method,
            endpoint: req.originalUrl,
            userId: req.user?._id || 'ANONYMOUS',
            statusCode: null, // Will be set in response
            responseTime: null, // Will be calculated in response
            details: 'API Request Started',
            req
        });
    } catch (error) {
        console.error('Failed to log API access:', error);
    }
    
    // Override res.end to capture response data
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Log the response
        try {
            logAPIAccess({
                method: req.method,
                endpoint: req.originalUrl,
                userId: req.user?._id || 'ANONYMOUS',
                statusCode: res.statusCode,
                responseTime,
                details: `API Response - Status: ${res.statusCode}`,
                req
            });
        } catch (error) {
            console.error('Failed to log API response:', error);
        }
        
        // Clean up
        requestTimers.delete(requestId);
        
        // Call original end
        originalEnd.call(this, chunk, encoding);
    };
    
    next();
};

/**
 * Middleware to log CRUD operations
 */
exports.logCRUDOperation = (action, resourceType) => {
    return async (req, res, next) => {
        const originalSend = res.send;
        
        res.send = async function(data) {
            try {
                // Determine resource ID from request
                const resourceId = req.params.id || req.body._id || 'NEW_RECORD';
                
                // Get before and after data for updates
                let before = null;
                let after = null;
                
                if (action === 'UPDATE' && req.params.id) {
                    // For updates, you might want to fetch the before state
                    // This depends on your specific implementation
                    before = req.beforeState || null;
                }
                
                if (action === 'CREATE' || action === 'UPDATE') {
                    after = req.body;
                }
                
                // Log the CRUD operation
                await createAuditLog({
                    action,
                    resourceType,
                    resourceId,
                    userId: req.user?._id || 'SYSTEM',
                    before,
                    after,
                    details: `${action} operation on ${resourceType}`,
                    req
                });
            } catch (error) {
                console.error('Failed to log CRUD operation:', error);
            }
            
            // Call original send
            originalSend.call(this, data);
        };
        
        next();
    };
};

/**
 * Middleware to log authentication events
 */
exports.logAuthEvents = async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = async function(data) {
        try {
            if (req.originalUrl.includes('/auth/login')) {
                const responseData = JSON.parse(data);
                const success = responseData.success || responseData.token;
                
                await createAuditLog({
                    action: success ? 'LOGIN' : 'LOGIN_FAILED',
                    resourceType: 'User',
                    resourceId: responseData.user?._id || 'UNKNOWN',
                    userId: responseData.user?._id || 'ANONYMOUS',
                    details: `Login attempt ${success ? 'SUCCESS' : 'FAILED'} - ${req.body.email}`,
                    req
                });
            } else if (req.originalUrl.includes('/auth/logout')) {
                await createAuditLog({
                    action: 'LOGOUT',
                    resourceType: 'User',
                    resourceId: req.user?._id || 'UNKNOWN',
                    userId: req.user?._id || 'ANONYMOUS',
                    details: 'User logged out',
                    req
                });
            }
        } catch (error) {
            console.error('Failed to log auth event:', error);
        }
        
        originalSend.call(this, data);
    };
    
    next();
};

/**
 * Middleware to log file operations
 */
exports.logFileOperations = async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = async function(data) {
        try {
            if (req.file || req.files) {
                const files = req.files || [req.file];
                
                for (const file of files) {
                    await createAuditLog({
                        action: 'FILE_UPLOADED',
                        resourceType: 'File',
                        resourceId: file.filename || file.originalname,
                        userId: req.user?._id || 'ANONYMOUS',
                        details: `File uploaded - ${file.originalname} (${file.size} bytes)`,
                        req
                    });
                }
            }
        } catch (error) {
            console.error('Failed to log file operation:', error);
        }
        
        originalSend.call(this, data);
    };
    
    next();
};

/**
 * Middleware to log financial transactions
 */
exports.logFinancialTransactions = (transactionType) => {
    return async (req, res, next) => {
        const originalSend = res.send;
        
        res.send = async function(data) {
            try {
                const responseData = JSON.parse(data);
                
                if (responseData.success && req.body.amount) {
                    await createAuditLog({
                        action: transactionType,
                        resourceType: 'Financial',
                        resourceId: responseData.data?._id || 'TRANSACTION',
                        userId: req.user?._id || 'SYSTEM',
                        amount: req.body.amount,
                        currency: req.body.currency || '$',
                        details: `${transactionType} transaction processed`,
                        req
                    });
                }
            } catch (error) {
                console.error('Failed to log financial transaction:', error);
            }
            
            originalSend.call(this, data);
        };
        
        next();
    };
};

/**
 * Middleware to log student operations
 */
exports.logStudentOperations = (action) => {
    return async (req, res, next) => {
        const originalSend = res.send;
        
        res.send = async function(data) {
            try {
                const responseData = JSON.parse(data);
                const studentId = req.params.studentId || responseData.student?._id || responseData.data?._id;
                
                if (studentId) {
                    await createAuditLog({
                        action,
                        resourceType: 'Student',
                        resourceId: studentId,
                        userId: req.user?._id || 'SYSTEM',
                        details: `${action} operation on student`,
                        req
                    });
                }
            } catch (error) {
                console.error('Failed to log student operation:', error);
            }
            
            originalSend.call(this, data);
        };
        
        next();
    };
};

/**
 * Error logging middleware
 */
exports.logErrors = (error, req, res, next) => {
    try {
        logErrorEvent({
            action: 'ERROR',
            resourceType: 'System',
            resourceId: req.requestId || 'ERROR',
            userId: req.user?._id || 'ANONYMOUS',
            error: error.message || error,
            details: `Error occurred in ${req.method} ${req.originalUrl}`,
            req
        });
    } catch (logError) {
        console.error('Failed to log error:', logError);
    }
    
    next(error);
};

/**
 * Middleware to log permission changes
 */
exports.logPermissionChanges = async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = async function(data) {
        try {
            if (req.originalUrl.includes('/users/') && req.method === 'PUT') {
                const responseData = JSON.parse(data);
                
                if (responseData.data && req.body.role) {
                    await createAuditLog({
                        action: 'ROLE_CHANGED',
                        resourceType: 'User',
                        resourceId: req.params.id,
                        userId: req.user?._id || 'SYSTEM',
                        oldRole: responseData.data.role,
                        newRole: req.body.role,
                        details: `Role changed from ${responseData.data.role} to ${req.body.role}`,
                        req
                    });
                }
            }
        } catch (error) {
            console.error('Failed to log permission change:', error);
        }
        
        originalSend.call(this, data);
    };
    
    next();
};

/**
 * Middleware to log data export/import operations
 */
exports.logDataOperations = (operationType) => {
    return async (req, res, next) => {
        const originalSend = res.send;
        
        res.send = async function(data) {
            try {
                const responseData = JSON.parse(data);
                const recordCount = responseData.total || responseData.count || 0;
                
                await createAuditLog({
                    action: operationType,
                    resourceType: 'Data',
                    resourceId: 'BULK_OPERATION',
                    userId: req.user?._id || 'SYSTEM',
                    recordCount,
                    details: `${operationType} operation completed - ${recordCount} records affected`,
                    req
                });
            } catch (error) {
                console.error('Failed to log data operation:', error);
            }
            
            originalSend.call(this, data);
        };
        
        next();
    };
};

/**
 * Middleware to capture before state for updates
 */
exports.captureBeforeState = (model) => {
    return async (req, res, next) => {
        try {
            if (req.method === 'PUT' && req.params.id) {
                const beforeState = await model.findById(req.params.id).lean();
                req.beforeState = beforeState;
            }
        } catch (error) {
            console.error('Failed to capture before state:', error);
        }
        
        next();
    };
}; 