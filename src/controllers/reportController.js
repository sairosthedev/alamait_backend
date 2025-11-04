const Report = require('../models/Report');
const User = require('../models/User');
const { s3, s3Configs, getKeyFromUrl } = require('../config/s3');
const { v4: uuidv4 } = require('uuid');
const DeletionLogService = require('../services/deletionLogService');
const AuditTrailService = require('../services/auditTrailService');

// S3 configuration for reports
const reportsS3Config = {
    bucket: s3Configs.general.bucket || process.env.S3_BUCKET_NAME,
    folder: 'reports',
    acl: 'private'
};

/**
 * Upload a report
 * POST /api/reports/upload
 */
exports.uploadReport = async (req, res) => {
    try {
        const { title, description, category, tags, isCEOOnly } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Title is required'
            });
        }

        // Get user info
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Determine if this should be CEO-only
        // Only CEO can mark reports as CEO-only
        const ceoOnly = user.role === 'ceo' && (isCEOOnly === 'true' || isCEOOnly === true);

        // Generate unique file key
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `${uuidv4()}_${Date.now()}.${fileExtension}`;
        const fileKey = `${reportsS3Config.folder}/${fileName}`;

        // Upload to S3
        const uploadParams = {
            Bucket: reportsS3Config.bucket,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: reportsS3Config.acl,
            Metadata: {
                originalName: file.originalname,
                uploadedBy: user._id.toString(),
                uploadedByRole: user.role
            }
        };

        const s3Result = await s3.upload(uploadParams).promise();
        const fileUrl = s3Result.Location;

        // Create report record
        const reportDoc = new Report({
            title: title.trim(),
            description: description ? description.trim() : '',
            fileName: file.originalname,
            fileUrl: fileUrl,
            fileSize: file.size,
            mimeType: file.mimetype,
            category: category || 'other',
            uploadedBy: user._id,
            uploadedByRole: user.role,
            isCEOOnly: ceoOnly,
            tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
            status: 'active'
        });

        await reportDoc.save();

        // Populate uploadedBy
        await reportDoc.populate('uploadedBy', 'firstName lastName email');

        // Log audit trail - CREATE
        await AuditTrailService.logCreate({
            collection: 'Report',
            recordId: reportDoc._id,
            after: reportDoc,
            userId: user._id,
            req: req,
            details: `Report uploaded: ${reportDoc.title} (${reportDoc.category})`
        });

        res.status(201).json({
            success: true,
            message: 'Report uploaded successfully',
            data: reportDoc
        });
    } catch (error) {
        console.error('Upload report error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading report',
            error: error.message
        });
    }
};

/**
 * Get all visible reports for the current user's role
 * GET /api/reports
 */
exports.getAllReports = async (req, res) => {
    try {
        const { page = 1, limit = 20, category, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Build query based on user role
        let query = Report.getVisibleReports(user.role).getQuery();

        // Add filters
        if (category) {
            query.category = category;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        // Get reports
        const reports = await Report.find(query)
            .populate('uploadedBy', 'firstName lastName email')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count
        const total = await Report.countDocuments(query);

        // Log audit trail - READ (list view)
        await AuditTrailService.logRead({
            collection: 'Report',
            recordId: null,
            userId: user._id,
            req: req,
            details: `Report list viewed - Page ${page}, Filter: ${category || 'all'}, Search: ${search || 'none'}`
        });

        res.json({
            success: true,
            data: reports,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get all reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching reports',
            error: error.message
        });
    }
};

/**
 * Get a single report by ID
 * GET /api/reports/:id
 */
exports.getReportById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const report = await Report.findById(id);
        
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Check visibility based on user role
        if (report.isCEOOnly && user.role !== 'ceo') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. This report is CEO-only.'
            });
        }

        // Check if report is active
        if (report.status !== 'active') {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        await report.populate('uploadedBy', 'firstName lastName email');

        // Log audit trail - READ
        await AuditTrailService.logRead({
            collection: 'Report',
            recordId: report._id,
            userId: user._id,
            req: req,
            details: `Report viewed: ${report.title}`
        });

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('Get report by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching report',
            error: error.message
        });
    }
};

/**
 * Delete a report
 * DELETE /api/reports/:id
 */
exports.deleteReport = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const report = await Report.findById(id);
        
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Check permissions: Only admin, CEO (for their own reports), or finance (for non-CEO-only reports)
        const canDelete = 
            user.role === 'admin' ||
            (user.role === 'ceo' && report.uploadedBy.toString() === user._id.toString()) ||
            (['finance', 'finance_admin', 'finance_user'].includes(user.role) && !report.isCEOOnly);

        if (!canDelete) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You do not have permission to delete this report.'
            });
        }

        // Delete from S3
        try {
            const fileKey = getKeyFromUrl(report.fileUrl) || 
                           report.fileUrl.split(`${reportsS3Config.bucket}.s3.amazonaws.com/`)[1] || 
                           report.fileUrl.split(`${reportsS3Config.bucket}/`)[1];
            
            if (fileKey) {
                await s3.deleteObject({
                    Bucket: reportsS3Config.bucket,
                    Key: fileKey
                }).promise();
            }
        } catch (s3Error) {
            console.error('Error deleting file from S3:', s3Error);
            // Continue with database deletion even if S3 deletion fails
        }

        // Create snapshot of deleted data before deletion
        const deletedDataSnapshot = {
            _id: report._id,
            title: report.title,
            description: report.description,
            fileName: report.fileName,
            fileUrl: report.fileUrl,
            fileSize: report.fileSize,
            mimeType: report.mimeType,
            category: report.category,
            uploadedBy: report.uploadedBy,
            uploadedByRole: report.uploadedByRole,
            isCEOOnly: report.isCEOOnly,
            tags: report.tags,
            metadata: report.metadata,
            status: report.status,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt
        };

        // Soft delete: mark as deleted
        report.status = 'deleted';
        await report.save();

        // Log audit trail - DELETE (also logs to deletions collection)
        await AuditTrailService.logDelete({
            collection: 'Report',
            recordId: report._id,
            before: deletedDataSnapshot,
            userId: user._id,
            req: req,
            reason: req.body.reason || null,
            details: `Report deleted: ${report.title}`,
            logToDeletions: true
        });

        res.json({
            success: true,
            message: 'Report deleted successfully'
        });
    } catch (error) {
        console.error('Delete report error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting report',
            error: error.message
        });
    }
};

/**
 * Update report metadata
 * PUT /api/reports/:id
 */
exports.updateReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, category, tags } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const report = await Report.findById(id);
        
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Check permissions: Only admin, CEO (for their own reports), or finance (for non-CEO-only reports)
        const canUpdate = 
            user.role === 'admin' ||
            (user.role === 'ceo' && report.uploadedBy.toString() === user._id.toString()) ||
            (['finance', 'finance_admin', 'finance_user'].includes(user.role) && !report.isCEOOnly);

        if (!canUpdate) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You do not have permission to update this report.'
            });
        }

        // Update fields
        if (title) report.title = title.trim();
        if (description !== undefined) report.description = description.trim();
        if (category) report.category = category;
        if (tags) {
            report.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
        }

        // Create snapshot of before state
        const beforeState = {
            title: report.title,
            description: report.description,
            category: report.category,
            tags: report.tags,
            status: report.status
        };

        await report.save();
        await report.populate('uploadedBy', 'firstName lastName email');

        // Log audit trail - UPDATE
        await AuditTrailService.logUpdate({
            collection: 'Report',
            recordId: report._id,
            before: beforeState,
            after: report,
            userId: user._id,
            req: req,
            details: `Report updated: ${report.title}`
        });

        res.json({
            success: true,
            message: 'Report updated successfully',
            data: report
        });
    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating report',
            error: error.message
        });
    }
};

/**
 * Get report download URL (signed URL for private files)
 * GET /api/reports/:id/download
 */
exports.getDownloadUrl = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const report = await Report.findById(id);
        
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Check visibility based on user role
        if (report.isCEOOnly && user.role !== 'ceo') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. This report is CEO-only.'
            });
        }

        // Check if report is active
        if (report.status !== 'active') {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Generate signed URL (valid for 1 hour)
        const fileKey = getKeyFromUrl(report.fileUrl) || 
                       report.fileUrl.split(`${reportsS3Config.bucket}.s3.amazonaws.com/`)[1] || 
                       report.fileUrl.split(`${reportsS3Config.bucket}/`)[1];

        if (!fileKey) {
            return res.status(500).json({
                success: false,
                message: 'Error generating download URL'
            });
        }

        const signedUrl = s3.getSignedUrl('getObject', {
            Bucket: reportsS3Config.bucket,
            Key: fileKey,
            Expires: 3600 // 1 hour
        });

        // Log audit trail - DOWNLOAD
        await AuditTrailService.logDownload({
            collection: 'Report',
            recordId: report._id,
            userId: user._id,
            req: req,
            details: `Report downloaded: ${report.fileName}`
        });

        res.json({
            success: true,
            downloadUrl: signedUrl,
            fileName: report.fileName
        });
    } catch (error) {
        console.error('Get download URL error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating download URL',
            error: error.message
        });
    }
};

