/**
 * Enhanced Utility for logging audit events
 * Comprehensive audit logging for all system operations
 */

const AuditLog = require('../models/AuditLog');
const { v4: uuidv4 } = require('uuid');

/**
 * Creates a comprehensive audit log entry
 * @param {Object} logData - The audit log data
 * @param {string} logData.action - The action performed
 * @param {string} logData.collection - The collection name
 * @param {string} logData.recordId - The ID of the record
 * @param {string} logData.userId - The ID of the user who performed the action
 * @param {Object} logData.before - The state before the action (optional)
 * @param {Object} logData.after - The state after the action (optional)
 * @param {string|Object} logData.details - Additional details about the action
 * @param {string} logData.ipAddress - IP address of the user (optional)
 * @param {string} logData.userAgent - User agent string (optional)
 * @param {string} logData.sessionId - Session ID (optional)
 * @param {string} logData.requestId - Request ID (optional)
 * @param {number} logData.duration - Duration in milliseconds (optional)
 * @param {number} logData.statusCode - HTTP status code (optional)
 * @param {string} logData.errorMessage - Error message if any (optional)
 * @returns {Promise<Object>} Created audit log entry
 */
exports.createAuditLog = async (logData) => {
    const {
        action,
        collection,
        recordId,
        userId,
        before = null,
        after = null,
        details = '',
        ipAddress = null,
        userAgent = null,
        sessionId = null,
        requestId = null,
        duration = null,
        statusCode = null,
        errorMessage = null
    } = logData;

    try {
        // Skip audit logging if no user ID provided
        if (!userId) {
            console.log(`[AUDIT] Skipping audit log for ${action} on ${collection} - no user ID provided`);
            return null;
        }

        // Generate request ID if not provided
        const finalRequestId = requestId || uuidv4();

        const auditEntry = await AuditLog.create({
            user: userId,
            action,
            collection,
            recordId,
            before,
            after,
            details: typeof details === 'string' ? details : JSON.stringify(details),
            timestamp: new Date(),
            ipAddress,
            userAgent,
            sessionId,
            requestId: finalRequestId,
            duration,
            statusCode,
            errorMessage
        });

        console.log(`[AUDIT] ${action} on ${collection} - ${recordId || 'N/A'} by user ${userId} (${finalRequestId})`);
        return auditEntry;
    } catch (error) {
        console.error('Failed to save audit log:', error);
        // Don't throw error to prevent breaking the main operation
        return null;
    }
};

/**
 * Log vendor operations
 */
exports.logVendorOperation = async (action, vendor, userId, details = '', before = null) => {
    return await exports.createAuditLog({
        action,
        collection: 'Vendor',
        recordId: vendor._id,
        userId,
        before,
        after: vendor.toObject(),
        details: typeof details === 'string' ? details : JSON.stringify(details)
    });
};

/**
 * Log transaction entry operations
 */
exports.logTransactionOperation = async (action, transaction, userId, details = '', before = null) => {
    return await exports.createAuditLog({
        action,
        collection: 'TransactionEntry',
        recordId: transaction._id,
        userId,
        before,
        after: transaction.toObject(),
        details: typeof details === 'string' ? details : JSON.stringify(details)
    });
};

/**
 * Log account operations
 */
exports.logAccountOperation = async (action, account, userId, details = '', before = null) => {
    return await exports.createAuditLog({
        action,
        collection: 'Account',
        recordId: account._id,
        userId,
        before,
        after: account.toObject(),
        details: typeof details === 'string' ? details : JSON.stringify(details)
    });
};

/**
 * Log expense operations
 */
exports.logExpenseOperation = async (action, expense, userId, details = '', before = null) => {
    return await exports.createAuditLog({
        action,
        collection: 'Expense',
        recordId: expense._id,
        userId,
        before,
        after: expense.toObject(),
        details: typeof details === 'string' ? details : JSON.stringify(details)
    });
};

/**
 * Log payment operations
 */
exports.logPaymentOperation = async (action, payment, userId, details = '', before = null) => {
    return await exports.createAuditLog({
        action,
        collection: 'Payment',
        recordId: payment._id,
        userId,
        before,
        after: payment.toObject(),
        details: typeof details === 'string' ? details : JSON.stringify(details)
    });
};

/**
 * Log debtor operations
 */
exports.logDebtorOperation = async (action, debtor, userId, details = '', before = null) => {
    return await exports.createAuditLog({
        action,
        collection: 'Debtor',
        recordId: debtor._id,
        userId,
        before,
        after: debtor.toObject(),
        details: typeof details === 'string' ? details : JSON.stringify(details)
    });
};

/**
 * Log system operations (for automated processes)
 */
exports.logSystemOperation = async (action, collection, recordId, details = '', before = null, after = null) => {
    const systemUserId = '68b7909295210ad2fa2c5dcf'; // System user ID
    return await exports.createAuditLog({
        action,
        collection,
        recordId,
        userId: systemUserId,
        before,
        after,
        details: typeof details === 'string' ? details : JSON.stringify(details)
    });
};

/**
 * Log user authentication operations
 */
exports.logAuthOperation = async (action, userId, details = '', ipAddress = null, userAgent = null) => {
    return await exports.createAuditLog({
        action,
        collection: 'User',
        recordId: userId,
        userId: userId,
        details: typeof details === 'string' ? details : JSON.stringify(details),
        ipAddress,
        userAgent
    });
};

/**
 * Log file operations
 */
exports.logFileOperation = async (action, fileInfo, userId, details = '', ipAddress = null, userAgent = null) => {
    return await exports.createAuditLog({
        action,
        collection: 'File',
        recordId: fileInfo.id || null,
        userId,
        details: typeof details === 'string' ? details : JSON.stringify({
            ...fileInfo,
            ...details
        }),
        ipAddress,
        userAgent
    });
};

/**
 * Log bulk operations
 */
exports.logBulkOperation = async (action, collection, userId, details = '', ipAddress = null, userAgent = null) => {
    return await exports.createAuditLog({
        action: `bulk_${action}`,
        collection,
        recordId: null, // Bulk operations don't have a single record ID
        userId,
        details: typeof details === 'string' ? details : JSON.stringify(details),
        ipAddress,
        userAgent
    });
};

/**
 * Log API operations with full context
 */
exports.logAPIOperation = async (req, res, action, collection, recordId = null, details = '') => {
    const startTime = req.startTime || Date.now();
    const duration = Date.now() - startTime;
    
    return await exports.createAuditLog({
        action,
        collection,
        recordId,
        userId: req.user?._id || null,
        details: typeof details === 'string' ? details : JSON.stringify({
            method: req.method,
            path: req.path,
            query: req.query,
            ...details
        }),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        sessionId: req.sessionID,
        requestId: req.requestId,
        duration,
        statusCode: res.statusCode,
        errorMessage: res.statusCode >= 400 ? res.statusMessage : null
    });
};

/**
 * Log approval workflow operations
 */
exports.logApprovalOperation = async (action, record, userId, details = '', before = null, ipAddress = null, userAgent = null) => {
    return await exports.createAuditLog({
        action,
        collection: record.constructor.modelName,
        recordId: record._id,
        userId,
        before,
        after: record.toObject(),
        details: typeof details === 'string' ? details : JSON.stringify(details),
        ipAddress,
        userAgent
    });
};

/**
 * Log financial operations
 */
exports.logFinancialOperation = async (action, record, userId, details = '', before = null, ipAddress = null, userAgent = null) => {
    return await exports.createAuditLog({
        action,
        collection: record.constructor.modelName,
        recordId: record._id,
        userId,
        before,
        after: record.toObject(),
        details: typeof details === 'string' ? details : JSON.stringify(details),
        ipAddress,
        userAgent
    });
};

/**
 * Log data export/import operations
 */
exports.logDataOperation = async (action, collection, userId, details = '', ipAddress = null, userAgent = null) => {
    return await exports.createAuditLog({
        action,
        collection,
        recordId: null,
        userId,
        details: typeof details === 'string' ? details : JSON.stringify(details),
        ipAddress,
        userAgent
    });
};

/**
 * Log error operations
 */
exports.logErrorOperation = async (error, req, details = '') => {
    return await exports.createAuditLog({
        action: 'error',
        collection: 'Error',
        recordId: null,
        userId: req.user?._id || null,
        details: typeof details === 'string' ? details : JSON.stringify({
            error: error.message,
            stack: error.stack,
            ...details
        }),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        sessionId: req.sessionID,
        requestId: req.requestId,
        errorMessage: error.message
    });
}; 