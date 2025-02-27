const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    createMaintenanceRequest,
    getMyMaintenanceRequests,
    getMaintenanceRequest,
    updateMaintenanceRequest,
    addComment
} = require('../../controllers/student/maintenanceController');

// Validation middleware
const maintenanceValidation = [
    check('residence', 'Residence ID is required').notEmpty(),
    check('room.roomNumber', 'Room number is required').notEmpty(),
    check('title', 'Title is required').notEmpty(),
    check('description', 'Description is required').notEmpty(),
    check('category', 'Category is required').notEmpty()
        .isIn(['plumbing', 'electrical', 'furniture', 'appliance', 'structural', 'other']),
    check('priority', 'Invalid priority').optional()
        .isIn(['low', 'medium', 'high', 'urgent'])
];

const commentValidation = [
    check('text', 'Comment text is required').notEmpty()
];

// All routes require student role
router.use(auth);
router.use(checkRole('student'));

// Routes
router.post('/', maintenanceValidation, createMaintenanceRequest);
router.get('/my-requests', getMyMaintenanceRequests);
router.get('/:id', getMaintenanceRequest);
router.patch('/:id', maintenanceValidation, updateMaintenanceRequest);
router.post('/:id/comments', commentValidation, addComment);

module.exports = router; 