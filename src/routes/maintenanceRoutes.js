const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');

// Get all maintenance requests
router.get('/', maintenanceController.getAllMaintenance);

// Get maintenance requests by status
router.get('/status/:status', maintenanceController.getMaintenanceByStatus);

// Get maintenance requests by room
router.get('/room/:room', maintenanceController.getMaintenanceByRoom);

// Get maintenance requests by priority
router.get('/priority/:priority', maintenanceController.getMaintenanceByPriority);

// Create new maintenance request
router.post('/', maintenanceController.createMaintenance);

// Add update to request history
router.post('/:id/history', maintenanceController.addRequestHistory);

// Get maintenance request by ID
router.get('/:id', maintenanceController.getMaintenanceById);

// Update maintenance request
router.put('/:id', maintenanceController.updateMaintenance);

// Delete maintenance request
router.delete('/:id', maintenanceController.deleteMaintenance);

module.exports = router; 