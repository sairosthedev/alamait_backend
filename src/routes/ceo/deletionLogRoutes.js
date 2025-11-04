const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const deletionLogController = require('../../controllers/deletionLogController');

// All routes require authentication
router.use(auth);

// CEO routes - can view all deletions
router.use(checkRole('ceo'));

// Get all deletions (across all models)
router.get('/', deletionLogController.getAllDeletions);

// Get deletions for a specific model
router.get('/:modelName', deletionLogController.getDeletionsByModel);

// Get a specific deletion log entry
router.get('/:modelName/:id', deletionLogController.getDeletionById);

// Restore a deleted document
router.patch('/:modelName/:id/restore', deletionLogController.restoreDeletion);

// Mark deletion as permanently deleted
router.patch('/:modelName/:id/permanent', deletionLogController.markAsPermanent);

module.exports = router;

