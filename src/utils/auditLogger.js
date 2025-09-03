/**
 * Enhanced Utility for logging audit events
 * Comprehensive audit logging for all system operations
 */

const AuditLog = require('../models/AuditLog');

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
        userAgent = null
    } = logData;

    try {
        const auditEntry = await AuditLog.create({
            user: userId,
            action,
            collection,
            recordId,
            before,
            after,
            details,
            timestamp: new Date(),
            ipAddress,
            userAgent
        });

        console.log(`[AUDIT] ${action} on ${collection} - ${recordId} by user ${userId}`);
        return auditEntry;
    } catch (error) {
        console.error('Failed to save audit log:', error);
        throw error;
    }
};

/**
 * Log vendor operations
 */
exports.logVendorOperation = async (action, vendor, userId, details = '', before = null) => {
    return await this.createAuditLog({
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
    return await this.createAuditLog({
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
    return await this.createAuditLog({
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
    return await this.createAuditLog({
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
    return await this.createAuditLog({
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
    return await this.createAuditLog({
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
    return await this.createAuditLog({
        action,
        collection,
        recordId,
        userId: systemUserId,
        before,
        after,
        details: typeof details === 'string' ? details : JSON.stringify(details)
    });
}; 