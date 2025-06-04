const express = require('express');
const router = express.Router();
const maintenanceStaffController = require('../controllers/maintenanceStaffController');

// Get maintenance staff by speciality (specific route)
router.get('/speciality/:speciality', maintenanceStaffController.getMaintenanceStaffBySpeciality);

// Get maintenance staff by location (specific route)
router.get('/location/:location', maintenanceStaffController.getMaintenanceStaffByLocation);

// Get all maintenance staff (specific route)
router.get('/', maintenanceStaffController.getAllMaintenanceStaff);

// Create new maintenance staff
router.post('/', maintenanceStaffController.createMaintenanceStaff);

// Update staff performance (specific route)
router.patch('/:id/performance', maintenanceStaffController.updateStaffPerformance);

// Get maintenance staff by ID (generic route)
router.get('/:id', maintenanceStaffController.getMaintenanceStaffById);

// Update maintenance staff (generic route)
router.put('/:id', maintenanceStaffController.updateMaintenanceStaff);

// Delete maintenance staff (generic route)
router.delete('/:id', maintenanceStaffController.deleteMaintenanceStaff);

module.exports = router; 