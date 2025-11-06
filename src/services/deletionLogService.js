const DeletionLog = require('../models/DeletionLog');
const User = require('../models/User');

/**
 * Deletion Logging Service
 * 
 * Centralized service for logging all deletions across the system
 * This creates an audit trail and allows for potential data recovery
 */
class DeletionLogService {
    
    /**
     * Log a deletion
     * 
     * @param {Object} options - Deletion options
     * @param {String} options.modelName - Name of the model (e.g., 'Report', 'Student', 'Transaction')
     * @param {String|ObjectId} options.documentId - ID of the deleted document
     * @param {Object} options.deletedData - Full snapshot of the deleted document
     * @param {String|ObjectId} options.deletedBy - User ID who performed the deletion
     * @param {String} options.reason - Optional reason for deletion
     * @param {String} options.context - Context of deletion (e.g., 'soft_delete', 'hard_delete', 'cascade_delete')
     * @param {Object} options.metadata - Additional metadata
     * 
     * @returns {Promise<DeletionLog>} The created deletion log entry
     */
    static async logDeletion({
        modelName,
        documentId,
        deletedData,
        deletedBy,
        reason = null,
        context = 'soft_delete',
        metadata = {}
    }) {
        try {
            // Get user info
            const user = await User.findById(deletedBy);
            if (!user) {
                throw new Error(`User not found: ${deletedBy}`);
            }

            // Create deletion log entry
            const deletionLog = new DeletionLog({
                deletedModel: modelName,
                deletedDocumentId: documentId,
                deletedData: deletedData,
                deletedBy: user._id,
                deletedByRole: user.role || 'unknown',
                deletedByEmail: user.email,
                reason: reason,
                context: context,
                metadata: metadata,
                status: 'deleted',
                deletedAt: new Date()
            });

            await deletionLog.save();
            
            console.log(`✅ Deletion logged: ${modelName} (${documentId}) deleted by ${user.email} (${user.role})`);
            
            return deletionLog;
        } catch (error) {
            console.error(`❌ Error logging deletion for ${modelName} (${documentId}):`, error);
            // Don't throw - deletion logging should not break the deletion process
            return null;
        }
    }

    /**
     * Mark a deletion as restored
     * 
     * @param {String} modelName - Name of the model
     * @param {String|ObjectId} documentId - ID of the restored document
     * @param {String|ObjectId} restoredBy - User ID who performed the restoration
     * 
     * @returns {Promise<DeletionLog>} The updated deletion log entry
     */
    static async markAsRestored(modelName, documentId, restoredBy) {
        try {
            const deletionLog = await DeletionLog.findOne({
                deletedModel: modelName,
                deletedDocumentId: documentId,
                status: 'deleted'
            }).sort({ deletedAt: -1 }); // Get most recent deletion

            if (!deletionLog) {
                throw new Error(`No deletion log found for ${modelName} (${documentId})`);
            }

            deletionLog.status = 'restored';
            deletionLog.restoredAt = new Date();
            deletionLog.restoredBy = restoredBy;

            await deletionLog.save();
            
            console.log(`✅ Deletion marked as restored: ${modelName} (${documentId})`);
            
            return deletionLog;
        } catch (error) {
            console.error(`❌ Error marking deletion as restored for ${modelName} (${documentId}):`, error);
            throw error;
        }
    }

    /**
     * Mark a deletion as permanently deleted (cannot be restored)
     * 
     * @param {String} modelName - Name of the model
     * @param {String|ObjectId} documentId - ID of the document
     * 
     * @returns {Promise<DeletionLog>} The updated deletion log entry
     */
    static async markAsPermanentlyDeleted(modelName, documentId) {
        try {
            const deletionLog = await DeletionLog.findOne({
                deletedModel: modelName,
                deletedDocumentId: documentId,
                status: 'deleted'
            }).sort({ deletedAt: -1 });

            if (!deletionLog) {
                throw new Error(`No deletion log found for ${modelName} (${documentId})`);
            }

            deletionLog.status = 'permanently_deleted';
            await deletionLog.save();
            
            console.log(`✅ Deletion marked as permanently deleted: ${modelName} (${documentId})`);
            
            return deletionLog;
        } catch (error) {
            console.error(`❌ Error marking deletion as permanent for ${modelName} (${documentId}):`, error);
            throw error;
        }
    }

    /**
     * Get deletion history for a specific model
     * 
     * @param {String} modelName - Name of the model
     * @param {Object} options - Query options
     * @param {Date} options.startDate - Start date filter
     * @param {Date} options.endDate - End date filter
     * @param {String|ObjectId} options.deletedBy - Filter by user who deleted
     * @param {Number} options.limit - Limit results
     * @param {Number} options.skip - Skip results
     * 
     * @returns {Promise<Array>} Array of deletion logs
     */
    static async getDeletionHistory(modelName, options = {}) {
        try {
            const query = DeletionLog.getDeletionsByModel(modelName, {
                startDate: options.startDate,
                endDate: options.endDate,
                deletedBy: options.deletedBy
            });

            if (options.limit) {
                query.limit(options.limit);
            }
            if (options.skip) {
                query.skip(options.skip);
            }

            const deletions = await query
                .populate('deletedBy', 'firstName lastName email')
                .populate('restoredBy', 'firstName lastName email')
                .sort({ deletedAt: -1 });

            return deletions;
        } catch (error) {
            console.error(`❌ Error getting deletion history for ${modelName}:`, error);
            throw error;
        }
    }

    /**
     * Get all deletions (across all models)
     * 
     * @param {Object} options - Query options
     * @param {Date} options.startDate - Start date filter
     * @param {Date} options.endDate - End date filter
     * @param {String|ObjectId} options.deletedBy - Filter by user who deleted
     * @param {String} options.modelName - Filter by model name
     * @param {Number} options.limit - Limit results
     * @param {Number} options.skip - Skip results
     * 
     * @returns {Promise<Object>} Object with deletions array and total count
     */
    static async getAllDeletions(options = {}) {
        try {
            const query = { status: 'deleted' };

            if (options.modelName) {
                query.deletedModel = options.modelName;
            }

            if (options.deletedBy) {
                query.deletedBy = options.deletedBy;
            }

            if (options.startDate || options.endDate) {
                query.deletedAt = {};
                if (options.startDate) query.deletedAt.$gte = new Date(options.startDate);
                if (options.endDate) query.deletedAt.$lte = new Date(options.endDate);
            }

            const total = await DeletionLog.countDocuments(query);

            const queryBuilder = DeletionLog.find(query)
                .populate('deletedBy', 'firstName lastName email')
                .populate('restoredBy', 'firstName lastName email')
                .sort({ deletedAt: -1 });

            if (options.limit) {
                queryBuilder.limit(options.limit);
            }
            if (options.skip) {
                queryBuilder.skip(options.skip);
            }

            const deletions = await queryBuilder;

            return {
                deletions,
                total,
                page: options.skip ? Math.floor(options.skip / (options.limit || 10)) + 1 : 1,
                limit: options.limit || 10,
                pages: Math.ceil(total / (options.limit || 10))
            };
        } catch (error) {
            console.error('❌ Error getting all deletions:', error);
            throw error;
        }
    }

    /**
     * Check if a document was deleted
     * 
     * @param {String} modelName - Name of the model
     * @param {String|ObjectId} documentId - ID of the document
     * 
     * @returns {Promise<DeletionLog|null>} Deletion log if found, null otherwise
     */
    static async wasDeleted(modelName, documentId) {
        try {
            return await DeletionLog.wasDeleted(modelName, documentId);
        } catch (error) {
            console.error(`❌ Error checking if ${modelName} (${documentId}) was deleted:`, error);
            return null;
        }
    }
}

module.exports = DeletionLogService;



