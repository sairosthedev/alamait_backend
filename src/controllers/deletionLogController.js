const DeletionLogService = require('../services/deletionLogService');
const DeletionLog = require('../models/DeletionLog');
const User = require('../models/User');
const AuditTrailService = require('../services/auditTrailService');

/**
 * Get all deletions (across all models)
 * GET /api/admin/deletions
 * GET /api/ceo/deletions
 */
exports.getAllDeletions = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            modelName, 
            deletedBy, 
            startDate, 
            endDate,
            status 
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const options = {
            limit: parseInt(limit),
            skip: skip,
            modelName: modelName,
            deletedBy: deletedBy,
            startDate: startDate,
            endDate: endDate
        };

        const result = await DeletionLogService.getAllDeletions(options);

        // Filter by status if provided
        if (status) {
            result.deletions = result.deletions.filter(d => d.status === status);
        }

        res.json({
            success: true,
            data: result.deletions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: result.total,
                pages: result.pages
            }
        });
    } catch (error) {
        console.error('Get all deletions error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching deletions',
            error: error.message
        });
    }
};

/**
 * Get deletions for a specific model
 * GET /api/admin/deletions/:modelName
 */
exports.getDeletionsByModel = async (req, res) => {
    try {
        const { modelName } = req.params;
        const { 
            page = 1, 
            limit = 20, 
            deletedBy, 
            startDate, 
            endDate 
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const options = {
            limit: parseInt(limit),
            skip: skip,
            deletedBy: deletedBy,
            startDate: startDate,
            endDate: endDate
        };

        const deletions = await DeletionLogService.getDeletionHistory(modelName, options);

        res.json({
            success: true,
            data: deletions,
            modelName: modelName
        });
    } catch (error) {
        console.error(`Get deletions for ${req.params.modelName} error:`, error);
        res.status(500).json({
            success: false,
            message: 'Error fetching deletions',
            error: error.message
        });
    }
};

/**
 * Get a specific deletion log entry
 * GET /api/admin/deletions/:modelName/:id
 */
exports.getDeletionById = async (req, res) => {
    try {
        const { modelName, id } = req.params;

        const deletionLog = await DeletionLog.findOne({
            deletedModel: modelName,
            deletedDocumentId: id
        }).sort({ deletedAt: -1 });

        if (!deletionLog) {
            return res.status(404).json({
                success: false,
                message: 'Deletion log not found'
            });
        }

        await deletionLog.populate('deletedBy', 'firstName lastName email');
        await deletionLog.populate('restoredBy', 'firstName lastName email');

        res.json({
            success: true,
            data: deletionLog
        });
    } catch (error) {
        console.error('Get deletion by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching deletion log',
            error: error.message
        });
    }
};

/**
 * Restore a deleted document (mark as restored)
 * PATCH /api/admin/deletions/:modelName/:id/restore
 */
exports.restoreDeletion = async (req, res) => {
    try {
        const { modelName, id } = req.params;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if deletion log exists
        const deletionLog = await DeletionLogService.wasDeleted(modelName, id);

        if (!deletionLog) {
            return res.status(404).json({
                success: false,
                message: 'Deletion log not found'
            });
        }

        // Mark as restored
        const restoredLog = await DeletionLogService.markAsRestored(modelName, id, user._id);

        // Log audit trail - RESTORE
        await AuditTrailService.logRestore({
            collection: modelName,
            recordId: id,
            after: restoredLog,
            userId: user._id,
            req: req,
            details: `Deleted ${modelName} (${id}) marked as restored`
        });

        res.json({
            success: true,
            message: 'Deletion marked as restored. Note: You may need to manually restore the document in its collection.',
            data: restoredLog
        });
    } catch (error) {
        console.error('Restore deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Error restoring deletion',
            error: error.message
        });
    }
};

/**
 * Mark deletion as permanently deleted
 * PATCH /api/admin/deletions/:modelName/:id/permanent
 */
exports.markAsPermanent = async (req, res) => {
    try {
        const { modelName, id } = req.params;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Only admin and CEO can mark as permanent
        if (!['admin', 'ceo'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only admin and CEO can mark deletions as permanent.'
            });
        }

        const permanentLog = await DeletionLogService.markAsPermanentlyDeleted(modelName, id);

        // Log audit trail - REVERT (permanent deletion)
        await AuditTrailService.logRevert({
            collection: modelName,
            recordId: id,
            before: permanentLog,
            userId: user._id,
            req: req,
            details: `Deleted ${modelName} (${id}) marked as permanently deleted (cannot be restored)`
        });

        res.json({
            success: true,
            message: 'Deletion marked as permanently deleted'
        });
    } catch (error) {
        console.error('Mark as permanent error:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking deletion as permanent',
            error: error.message
        });
    }
};

