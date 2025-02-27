const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const residenceController = require('../../controllers/residenceController');
const authMiddleware = require('../../middleware/authMiddleware');
const roleMiddleware = require('../../middleware/roleMiddleware');

// Validation middleware
const residenceValidation = [
    body('name').notEmpty().trim().withMessage('Name is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('location.coordinates').isArray().withMessage('Location coordinates are required'),
    body('rooms').isArray().withMessage('Rooms information is required'),
    body('rooms.*.roomNumber').notEmpty().withMessage('Room number is required'),
    body('rooms.*.type').isIn(['single', 'double', 'studio', 'apartment']).withMessage('Invalid room type'),
    body('rooms.*.price').isNumeric().withMessage('Room price must be a number')
];

const roomValidation = [
    body('roomNumber').notEmpty().withMessage('Room number is required'),
    body('type').isIn(['single', 'double', 'studio', 'apartment']).withMessage('Invalid room type'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('status').optional().isIn(['available', 'occupied', 'maintenance', 'reserved']).withMessage('Invalid status'),
    body('floor').optional().isInt().withMessage('Floor must be a number'),
    body('area').optional().isFloat({ min: 0 }).withMessage('Area must be a positive number')
];

// Apply auth middleware to all routes
router.use(authMiddleware);
router.use(roleMiddleware(['property_manager']));

// Routes
router.post('/', residenceValidation, residenceController.addResidence);
router.get('/', residenceController.getAllResidences);
router.get('/:id', residenceController.getResidence);
router.put('/:id', residenceValidation, residenceController.updateResidence);
router.delete('/:id', residenceController.deleteResidence);
router.post('/:id/rooms', roomValidation, residenceController.addRoom);
router.patch('/:residenceId/rooms/:roomNumber', roomValidation, residenceController.updateRoom);

module.exports = router; 