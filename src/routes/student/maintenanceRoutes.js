const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { check } = require('express-validator');
const maintenanceController = require('../../controllers/student/maintenanceController');

// Apply authentication and role middleware to all routes
router.use(auth);
router.use(checkRole('student'));

// Validation middleware for maintenance requests
const validateMaintenanceRequest = [
    check('title').trim().notEmpty().withMessage('Title is required'),
    check('description').trim().notEmpty().withMessage('Description is required'),
    check('category').isIn(['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'other'])
        .withMessage('Invalid category'),
    check('priority').optional().isIn(['low', 'medium', 'high'])
        .withMessage('Invalid priority level'),
    check('location').trim().notEmpty().withMessage('Location is required')
];

// Get all maintenance requests
router.get('/', maintenanceController.getMaintenanceRequests);

// Create new maintenance request
router.post('/', validateMaintenanceRequest, maintenanceController.createMaintenanceRequest);

// Get single maintenance request details
router.get('/:requestId', maintenanceController.getMaintenanceRequestDetails);

// Update maintenance request
router.put('/:requestId', validateMaintenanceRequest, maintenanceController.updateMaintenanceRequest);

// Cancel maintenance request
router.delete('/:requestId', maintenanceController.cancelMaintenanceRequest);

module.exports = router; 