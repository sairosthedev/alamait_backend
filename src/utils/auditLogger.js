/**
 * Utility for logging audit events
 */

// We'd typically use a database or external logging service for audit logs
// For now, we'll just log to console, but in a real app, you'd implement a proper logger
// that stores audit information in a separate collection or table

/**
 * Creates an audit log entry
 * @param {Object} logData - The audit log data
 * @param {string} logData.action - The action performed (CREATE, UPDATE, DELETE, etc.)
 * @param {string} logData.resourceType - The type of resource (Expense, BalanceSheet, etc.)
 * @param {string} logData.resourceId - The ID of the resource
 * @param {string} logData.userId - The ID of the user who performed the action
 * @param {string} logData.details - Additional details about the action
 * @returns {Promise<void>}
 */
const AuditLog = require('../models/AuditLog');
exports.createAuditLog = async (logData) => {
    const { action, resourceType, resourceId, userId, details } = logData;
    // Log to console
    console.log(`[AUDIT LOG] ${new Date().toISOString()} | ${action} | ${resourceType} | ${resourceId} | User: ${userId} | ${details}`);
    // Persist to database
    try {
        await AuditLog.create({ action, resourceType, resourceId, userId, details });
    } catch (err) {
        console.error('Failed to save audit log:', err);
    }
    return true;
}; 