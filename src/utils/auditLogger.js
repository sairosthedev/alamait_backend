/**
 * Comprehensive Audit Trail Logger
 * Logs every single action in the system for complete traceability
 */

const AuditLog = require('../models/AuditLog');

/**
 * Creates a comprehensive audit log entry
 * @param {Object} logData - The audit log data
 * @param {string} logData.action - The action performed (CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.)
 * @param {string} logData.resourceType - The type of resource (User, Student, Payment, etc.)
 * @param {string} logData.resourceId - The ID of the resource
 * @param {string} logData.userId - The ID of the user who performed the action
 * @param {Object} logData.before - Previous state (for updates/deletes)
 * @param {Object} logData.after - New state (for creates/updates)
 * @param {string} logData.details - Additional details about the action
 * @param {string} logData.ipAddress - IP address of the user
 * @param {string} logData.userAgent - User agent string
 * @param {string} logData.endpoint - API endpoint that was called
 * @param {Object} logData.requestBody - Request body data
 * @param {Object} logData.queryParams - Query parameters
 * @returns {Promise<Object>} Created audit log entry
 */
exports.createAuditLog = async (logData) => {
    const {
        action,
        resourceType,
        resourceId,
        userId,
        before = null,
        after = null,
        details = '',
        ipAddress = null,
        userAgent = null,
        endpoint = null,
        requestBody = null,
        queryParams = null
    } = logData;

    try {
        // Create comprehensive audit log entry
        const auditEntry = await AuditLog.create({
            user: userId,
            action: action.toUpperCase(),
            collection: resourceType,
            recordId: resourceId,
            before,
            after,
            details,
            ipAddress,
            userAgent,
            endpoint,
            requestBody,
            queryParams,
            timestamp: new Date()
        });

        // Log to console for immediate visibility
        console.log(`[AUDIT] ${new Date().toISOString()} | ${action.toUpperCase()} | ${resourceType} | ${resourceId} | User: ${userId} | ${details}`);
        
        return auditEntry;
    } catch (error) {
        console.error('Failed to save audit log:', error);
        // Even if database save fails, log to console
        console.log(`[AUDIT FAILED] ${new Date().toISOString()} | ${action.toUpperCase()} | ${resourceType} | ${resourceId} | User: ${userId} | ${details}`);
        throw error;
    }
};

/**
 * Creates audit log for user authentication events
 * @param {Object} data - Authentication data
 */
exports.logAuthEvent = async (data) => {
    const { action, userId, email, ipAddress, userAgent, success, details } = data;
    
    await exports.createAuditLog({
        action: action.toUpperCase(),
        resourceType: 'User',
        resourceId: userId,
        userId: userId,
        details: `${action} ${success ? 'SUCCESS' : 'FAILED'} - ${email} - ${details}`,
        ipAddress,
        userAgent,
        endpoint: '/api/auth/login'
    });
};

/**
 * Creates audit log for CRUD operations
 * @param {Object} data - CRUD operation data
 */
exports.logCRUDEvent = async (data) => {
    const { action, resourceType, resourceId, userId, before, after, details, req } = data;
    
    await exports.createAuditLog({
        action: action.toUpperCase(),
        resourceType,
        resourceId,
        userId,
        before,
        after,
        details,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers?.['user-agent'],
        endpoint: req?.originalUrl,
        requestBody: req?.body,
        queryParams: req?.query
    });
};

/**
 * Creates audit log for system events
 * @param {Object} data - System event data
 */
exports.logSystemEvent = async (data) => {
    const { action, resourceType, resourceId, userId, details, req } = data;
    
    await exports.createAuditLog({
        action: action.toUpperCase(),
        resourceType: resourceType || 'System',
        resourceId: resourceId || 'SYSTEM',
        userId: userId || 'SYSTEM',
        details,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers?.['user-agent'],
        endpoint: req?.originalUrl
    });
};

/**
 * Creates audit log for financial transactions
 * @param {Object} data - Financial transaction data
 */
exports.logFinancialEvent = async (data) => {
    const { action, resourceType, resourceId, userId, amount, currency, details, req } = data;
    
    await exports.createAuditLog({
        action: action.toUpperCase(),
        resourceType,
        resourceId,
        userId,
        details: `${details} - Amount: ${currency || '$'}${amount}`,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers?.['user-agent'],
        endpoint: req?.originalUrl,
        requestBody: req?.body
    });
};

/**
 * Creates audit log for student-related events
 * @param {Object} data - Student event data
 */
exports.logStudentEvent = async (data) => {
    const { action, studentId, userId, details, req } = data;
    
    await exports.createAuditLog({
        action: action.toUpperCase(),
        resourceType: 'Student',
        resourceId: studentId,
        userId,
        details,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers?.['user-agent'],
        endpoint: req?.originalUrl,
        requestBody: req?.body
    });
};

/**
 * Creates audit log for file operations
 * @param {Object} data - File operation data
 */
exports.logFileEvent = async (data) => {
    const { action, fileName, fileType, fileSize, userId, details, req } = data;
    
    await exports.createAuditLog({
        action: action.toUpperCase(),
        resourceType: 'File',
        resourceId: fileName,
        userId,
        details: `${details} - Type: ${fileType}, Size: ${fileSize} bytes`,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers?.['user-agent'],
        endpoint: req?.originalUrl
    });
};

/**
 * Creates audit log for permission/role changes
 * @param {Object} data - Permission change data
 */
exports.logPermissionEvent = async (data) => {
    const { action, targetUserId, userId, oldRole, newRole, details, req } = data;
    
    await exports.createAuditLog({
        action: action.toUpperCase(),
        resourceType: 'User',
        resourceId: targetUserId,
        userId,
        before: { role: oldRole },
        after: { role: newRole },
        details: `${details} - Role changed from ${oldRole} to ${newRole}`,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers?.['user-agent'],
        endpoint: req?.originalUrl
    });
};

/**
 * Creates audit log for data export/import operations
 * @param {Object} data - Export/import data
 */
exports.logDataOperation = async (data) => {
    const { action, resourceType, userId, recordCount, details, req } = data;
    
    await exports.createAuditLog({
        action: action.toUpperCase(),
        resourceType,
        resourceId: 'BULK_OPERATION',
        userId,
        details: `${details} - ${recordCount} records affected`,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers?.['user-agent'],
        endpoint: req?.originalUrl
    });
};

/**
 * Creates audit log for error events
 * @param {Object} data - Error event data
 */
exports.logErrorEvent = async (data) => {
    const { action, resourceType, resourceId, userId, error, details, req } = data;
    
    await exports.createAuditLog({
        action: 'ERROR',
        resourceType: resourceType || 'System',
        resourceId: resourceId || 'ERROR',
        userId: userId || 'SYSTEM',
        details: `${details} - Error: ${error.message || error}`,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers?.['user-agent'],
        endpoint: req?.originalUrl
    });
};

/**
 * Creates audit log for API access
 * @param {Object} data - API access data
 */
exports.logAPIAccess = async (data) => {
    const { method, endpoint, userId, statusCode, responseTime, details, req } = data;
    
    await exports.createAuditLog({
        action: 'API_ACCESS',
        resourceType: 'API',
        resourceId: `${method}_${endpoint}`,
        userId: userId || 'ANONYMOUS',
        details: `${method} ${endpoint} - Status: ${statusCode}, Time: ${responseTime}ms - ${details}`,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers?.['user-agent'],
        endpoint: req?.originalUrl,
        requestBody: req?.body,
        queryParams: req?.query
    });
}; 