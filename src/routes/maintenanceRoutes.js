const express = require('express');
const router = express.Router();
const multer = require('multer');
const { check } = require('express-validator');
const { auth } = require('../middleware/auth');
const maintenanceController = require('../controllers/maintenanceController');
const { s3, s3Configs, fileFilter, fileTypes } = require('../config/s3');

router.use(auth);

// Configure multer for maintenance image uploads
const maintenanceImageUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: fileFilter(fileTypes.images),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per image
        files: 5 // Maximum 5 images per maintenance request
    }
});

// Validation middleware (all fields optional except residence)
const maintenanceValidation = [
    check('issue').optional().notEmpty(),
    check('title').optional().notEmpty(),
    check('description').optional().notEmpty(),
    check('room').optional().notEmpty(),
    check('category').optional().isIn(['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'cleaning', 'pest_control', 'security', 'furniture', 'fire_safety', 'emergency', 'landscaping', 'internet_it', 'accessibility', 'parking', 'exterior', 'communication', 'general_maintenance', 'other']),
    check('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    check('residence').optional().isMongoId().withMessage('Invalid residence ID format'),
    check('residenceId').optional().isMongoId().withMessage('Invalid residence ID format'),
    check('paymentMethod').optional().custom((value) => {
        if (value) {
            const validMethods = ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal'];
            const validLowercaseMethods = validMethods.map(method => method.toLowerCase());
            const normalizedValue = value.toLowerCase();
            
            if (!validLowercaseMethods.includes(normalizedValue)) {
                throw new Error('Invalid payment method');
            }
        }
        return true;
    }).withMessage('Invalid payment method'),
    check('paymentIcon').optional().isString().withMessage('Payment icon must be a string')
];

// Property maintenance validation (all fields optional)
const propertyMaintenanceValidation = [
    check('issue').optional().notEmpty(),
    check('title').optional().notEmpty(),
    check('description').optional().notEmpty(),
    check('room').optional().notEmpty(),
    check('category').optional().isIn(['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'cleaning', 'pest_control', 'security', 'furniture', 'fire_safety', 'emergency', 'landscaping', 'internet_it', 'accessibility', 'parking', 'exterior', 'communication', 'general_maintenance', 'other']),
    check('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    check('paymentMethod').optional().custom((value) => {
        if (value) {
            const validMethods = ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal'];
            const validLowercaseMethods = validMethods.map(method => method.toLowerCase());
            const normalizedValue = value.toLowerCase();
            
            if (!validLowercaseMethods.includes(normalizedValue)) {
                throw new Error('Invalid payment method');
            }
        }
        return true;
    }).withMessage('Invalid payment method'),
    check('paymentIcon').optional().isString().withMessage('Payment icon must be a string')
];

// Get all maintenance requests
router.get('/', maintenanceController.getAllMaintenance);

// Get maintenance requests by status
router.get('/status/:status', maintenanceController.getMaintenanceByStatus);

// Get maintenance requests by room
router.get('/room/:room', maintenanceController.getMaintenanceByRoom);

// Get maintenance requests by priority
router.get('/priority/:priority', maintenanceController.getMaintenanceByPriority);

// Create new maintenance request (with image upload support)
router.post('/', 
    (req, res, next) => {
        // Check if this is a multipart request (file upload)
        if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
            // Use multer for file uploads
            maintenanceImageUpload.array('images', 5)(req, res, next);
        } else {
            // Skip multer for JSON requests
            next();
        }
    },
    maintenanceValidation, 
    maintenanceController.createMaintenance
);

// Add update to request history
router.post('/:id/history', maintenanceController.addRequestHistory);

// Get maintenance request by ID
router.get('/:id', maintenanceController.getMaintenanceById);

// Update maintenance request
router.put('/:id', maintenanceValidation, maintenanceController.updateMaintenance);
// Alias: allow PATCH for updates too
router.patch('/:id', maintenanceValidation, maintenanceController.updateMaintenance);

// Delete maintenance request
router.delete('/:id', maintenanceController.deleteMaintenance);

// Create property maintenance request with images (for properties page)
router.post('/property/:residenceId', 
    maintenanceImageUpload.array('images', 5),
    propertyMaintenanceValidation, 
    maintenanceController.createPropertyMaintenance
);

module.exports = router; 