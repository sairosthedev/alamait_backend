const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    getMaintenanceRequests,
    getMaintenanceRequest,
    updateMaintenanceRequest,
    addComment,
    getMaintenanceStats
} = require('../../controllers/property_manager/maintenanceController');

// Validation middleware
const maintenanceUpdateValidation = [
    check('status')
        .optional()
        .isIn(['pending', 'assigned', 'in-progress', 'on-hold', 'completed', 'approved', 'rejected']),
    check('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent']),
    check('assignedTo', 'Invalid assigned user ID')
        .optional()
        .isMongoId(),
    check('scheduledDate')
        .optional()
        .isISO8601(),
    check('estimatedCost')
        .optional()
        .isFloat({ min: 0 }),
    check('actualCost')
        .optional()
        .isFloat({ min: 0 })
];

const commentValidation = [
    check('text', 'Comment text is required')
        .notEmpty()
        .isLength({ min: 1, max: 1000 })
];

// All routes require property manager role
router.use(auth);
router.use(checkRole('property_manager'));

// Routes
router.get('/', getMaintenanceRequests);
router.get('/stats', getMaintenanceStats);
router.get('/:id', getMaintenanceRequest);
router.patch('/:id', maintenanceUpdateValidation, updateMaintenanceRequest);
router.post('/:id/comments', commentValidation, addComment);

module.exports = router; 