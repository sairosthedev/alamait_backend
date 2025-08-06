/**
 * Utility for logging audit events
 */

// We'd typically use a database or external logging service for audit logs
// For now, we'll just log to console, but in a real app, you'd implement a proper logger
// that stores audit information in a separate collection or table

/**
 * Creates a simple audit log entry
 * @param {Object} logData - The audit log data
 * @param {string} logData.action - The action performed
 * @param {string} logData.collection - The collection name
 * @param {string} logData.recordId - The ID of the record
 * @param {string} logData.userId - The ID of the user who performed the action
 * @param {string} logData.details - Additional details about the action
 * @returns {Promise<Object>} Created audit log entry
 */
const AuditLog = require('../models/AuditLog');
exports.createAuditLog = async (logData) => {
    const {
        action,
        collection,
        recordId,
        userId,
        before = null,
        after = null,
        details = ''
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
            timestamp: new Date()
        });

        console.log(`[AUDIT] ${action} on ${collection} - ${recordId} by user ${userId}`);
        return auditEntry;
    } catch (error) {
        console.error('Failed to save audit log:', error);
        throw error;
    }
}; 