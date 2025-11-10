/**
 * Comprehensive Audit Trail Service
 * 
 * This service provides easy-to-use methods to log all CRUD operations
 * and other actions across the system. It ensures every action is logged
 * in the audit trail.
 */

const { createAuditLog } = require('../utils/auditLogger');
const DeletionLogService = require('./deletionLogService');

/**
 * Audit Trail Service
 * Provides methods to automatically log all operations
 */
class AuditTrailService {
    
    /**
     * Log a CREATE operation
     * 
     * @param {Object} options
     * @param {String} options.collection - Collection name
     * @param {ObjectId|String} options.recordId - Record ID
     * @param {Object} options.after - Document data after creation
     * @param {ObjectId|String} options.userId - User ID
     * @param {Object} options.req - Express request object (optional, for IP/userAgent)
     * @param {String} options.details - Additional details
     * 
     * @returns {Promise<Object>} Audit log entry
     */
    static async logCreate({ collection, recordId, after, userId, req = null, details = '' }) {
        try {
            return await createAuditLog({
                action: 'create',
                collection,
                recordId,
                userId,
                after: after && typeof after.toObject === 'function' ? after.toObject() : after,
                details: details || `Created ${collection} record`,
                ipAddress: req?.ip || req?.connection?.remoteAddress || null,
                userAgent: req?.headers?.['user-agent'] || null
            });
        } catch (error) {
            console.error(`Error logging CREATE for ${collection}:`, error);
            return null;
        }
    }
    
    /**
     * Log a READ/VIEW operation
     * 
     * @param {Object} options
     * @param {String} options.collection - Collection name
     * @param {ObjectId|String} options.recordId - Record ID (null for list views)
     * @param {ObjectId|String} options.userId - User ID
     * @param {Object} options.req - Express request object (optional)
     * @param {String} options.details - Additional details
     * 
     * @returns {Promise<Object>} Audit log entry
     */
    static async logRead({ collection, recordId = null, userId, req = null, details = '' }) {
        try {
            return await createAuditLog({
                action: 'read',
                collection,
                recordId,
                userId,
                details: details || `Viewed ${collection}${recordId ? ` record ${recordId}` : ' list'}`,
                ipAddress: req?.ip || req?.connection?.remoteAddress || null,
                userAgent: req?.headers?.['user-agent'] || null
            });
        } catch (error) {
            console.error(`Error logging READ for ${collection}:`, error);
            return null;
        }
    }
    
    /**
     * Log an UPDATE/EDIT operation
     * 
     * @param {Object} options
     * @param {String} options.collection - Collection name
     * @param {ObjectId|String} options.recordId - Record ID
     * @param {Object} options.before - Document data before update
     * @param {Object} options.after - Document data after update
     * @param {ObjectId|String} options.userId - User ID
     * @param {Object} options.req - Express request object (optional)
     * @param {String} options.details - Additional details
     * 
     * @returns {Promise<Object>} Audit log entry
     */
    static async logUpdate({ collection, recordId, before, after, userId, req = null, details = '' }) {
        try {
            return await createAuditLog({
                action: 'update',
                collection,
                recordId,
                userId,
                before: before && typeof before.toObject === 'function' ? before.toObject() : before,
                after: after && typeof after.toObject === 'function' ? after.toObject() : after,
                details: details || `Updated ${collection} record ${recordId}`,
                ipAddress: req?.ip || req?.connection?.remoteAddress || null,
                userAgent: req?.headers?.['user-agent'] || null
            });
        } catch (error) {
            console.error(`Error logging UPDATE for ${collection}:`, error);
            return null;
        }
    }
    
    /**
     * Log a DELETE operation
     * 
     * @param {Object} options
     * @param {String} options.collection - Collection name
     * @param {ObjectId|String} options.recordId - Record ID
     * @param {Object} options.before - Document data before deletion
     * @param {ObjectId|String} options.userId - User ID
     * @param {Object} options.req - Express request object (optional)
     * @param {String} options.reason - Reason for deletion
     * @param {String} options.details - Additional details
     * @param {Boolean} options.logToDeletions - Also log to deletions collection (default: true)
     * 
     * @returns {Promise<Object>} Audit log entry
     */
    static async logDelete({ 
        collection, 
        recordId, 
        before, 
        userId, 
        req = null, 
        reason = null, 
        details = '',
        logToDeletions = true 
    }) {
        try {
            const beforeData = before && typeof before.toObject === 'function' ? before.toObject() : before;
            
            // Log to audit trail
            const auditLog = await createAuditLog({
                action: 'delete',
                collection,
                recordId,
                userId,
                before: beforeData,
                details: details || `Deleted ${collection} record ${recordId}${reason ? ` - Reason: ${reason}` : ''}`,
                ipAddress: req?.ip || req?.connection?.remoteAddress || null,
                userAgent: req?.headers?.['user-agent'] || null
            });
            
            // Also log to deletions collection if requested
            if (logToDeletions && beforeData) {
                try {
                    await DeletionLogService.logDeletion({
                        modelName: collection,
                        documentId: recordId,
                        deletedData: beforeData,
                        deletedBy: userId,
                        reason: reason,
                        context: 'soft_delete',
                        metadata: {}
                    });
                } catch (deletionLogError) {
                    console.error('Error logging to deletions collection:', deletionLogError);
                    // Don't fail if deletion logging fails
                }
            }
            
            return auditLog;
        } catch (error) {
            console.error(`Error logging DELETE for ${collection}:`, error);
            return null;
        }
    }
    
    /**
     * Log a RESTORE operation
     * 
     * @param {Object} options
     * @param {String} options.collection - Collection name
     * @param {ObjectId|String} options.recordId - Record ID
     * @param {Object} options.after - Document data after restoration
     * @param {ObjectId|String} options.userId - User ID
     * @param {Object} options.req - Express request object (optional)
     * @param {String} options.details - Additional details
     * 
     * @returns {Promise<Object>} Audit log entry
     */
    static async logRestore({ collection, recordId, after, userId, req = null, details = '' }) {
        try {
            return await createAuditLog({
                action: 'restore',
                collection,
                recordId,
                userId,
                after: after && typeof after.toObject === 'function' ? after.toObject() : after,
                details: details || `Restored ${collection} record ${recordId}`,
                ipAddress: req?.ip || req?.connection?.remoteAddress || null,
                userAgent: req?.headers?.['user-agent'] || null
            });
        } catch (error) {
            console.error(`Error logging RESTORE for ${collection}:`, error);
            return null;
        }
    }
    
    /**
     * Log a REVERT operation (undo/rollback)
     * 
     * @param {Object} options
     * @param {String} options.collection - Collection name
     * @param {ObjectId|String} options.recordId - Record ID
     * @param {Object} options.before - State before revert
     * @param {Object} options.after - State after revert
     * @param {ObjectId|String} options.userId - User ID
     * @param {Object} options.req - Express request object (optional)
     * @param {String} options.details - Additional details
     * 
     * @returns {Promise<Object>} Audit log entry
     */
    static async logRevert({ collection, recordId, before, after, userId, req = null, details = '' }) {
        try {
            return await createAuditLog({
                action: 'revert',
                collection,
                recordId,
                userId,
                before: before && typeof before.toObject === 'function' ? before.toObject() : before,
                after: after && typeof after.toObject === 'function' ? after.toObject() : after,
                details: details || `Reverted ${collection} record ${recordId}`,
                ipAddress: req?.ip || req?.connection?.remoteAddress || null,
                userAgent: req?.headers?.['user-agent'] || null
            });
        } catch (error) {
            console.error(`Error logging REVERT for ${collection}:`, error);
            return null;
        }
    }
    
    /**
     * Log a DOWNLOAD operation
     * 
     * @param {Object} options
     * @param {String} options.collection - Collection name
     * @param {ObjectId|String} options.recordId - Record ID
     * @param {ObjectId|String} options.userId - User ID
     * @param {Object} options.req - Express request object (optional)
     * @param {String} options.details - Additional details (e.g., filename)
     * 
     * @returns {Promise<Object>} Audit log entry
     */
    static async logDownload({ collection, recordId, userId, req = null, details = '' }) {
        try {
            return await createAuditLog({
                action: 'download',
                collection,
                recordId,
                userId,
                details: details || `Downloaded ${collection} record ${recordId}`,
                ipAddress: req?.ip || req?.connection?.remoteAddress || null,
                userAgent: req?.headers?.['user-agent'] || null
            });
        } catch (error) {
            console.error(`Error logging DOWNLOAD for ${collection}:`, error);
            return null;
        }
    }
    
    /**
     * Log an UPLOAD operation
     * 
     * @param {Object} options
     * @param {String} options.collection - Collection name
     * @param {ObjectId|String} options.recordId - Record ID
     * @param {ObjectId|String} options.userId - User ID
     * @param {Object} options.req - Express request object (optional)
     * @param {String} options.details - Additional details (e.g., filename, file size)
     * 
     * @returns {Promise<Object>} Audit log entry
     */
    static async logUpload({ collection, recordId, userId, req = null, details = '' }) {
        try {
            return await createAuditLog({
                action: 'upload',
                collection,
                recordId,
                userId,
                details: details || `Uploaded file to ${collection} record ${recordId}`,
                ipAddress: req?.ip || req?.connection?.remoteAddress || null,
                userAgent: req?.headers?.['user-agent'] || null
            });
        } catch (error) {
            console.error(`Error logging UPLOAD for ${collection}:`, error);
            return null;
        }
    }
}

module.exports = AuditTrailService;





