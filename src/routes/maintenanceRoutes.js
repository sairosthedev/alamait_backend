const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth } = require('../middleware/auth');
const maintenanceController = require('../controllers/maintenanceController');

router.use(auth);

// Validation middleware
const maintenanceValidation = [
    check('issue').optional().notEmpty(),
    check('title').optional().notEmpty(),
    check('description', 'Description is required').notEmpty(),
    check('room', 'Room is required').notEmpty(),
    check('category').optional().isIn(['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'other']),
    check('priority').optional().isIn(['low', 'medium', 'high']),
    check('residence').optional().isMongoId().withMessage('Invalid residence ID format'),
    check('residenceId').optional().isMongoId().withMessage('Invalid residence ID format')
];

// Get all maintenance requests
router.get('/', maintenanceController.getAllMaintenance);

// Get maintenance requests by status
router.get('/status/:status', maintenanceController.getMaintenanceByStatus);

// Get maintenance requests by room
router.get('/room/:room', maintenanceController.getMaintenanceByRoom);

// Get maintenance requests by priority
router.get('/priority/:priority', maintenanceController.getMaintenanceByPriority);

// Create new maintenance request
router.post('/', maintenanceValidation, maintenanceController.createMaintenance);

// Add update to request history
router.post('/:id/history', maintenanceController.addRequestHistory);

// Get maintenance request by ID
router.get('/:id', maintenanceController.getMaintenanceById);

// Update maintenance request
router.put('/:id', maintenanceValidation, maintenanceController.updateMaintenance);

// Delete maintenance request
router.delete('/:id', maintenanceController.deleteMaintenance);

module.exports = router; 