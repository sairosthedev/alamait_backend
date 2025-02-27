const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    getManagedResidences,
    getResidence,
    createResidence,
    updateResidence,
    addRoom,
    updateRoom,
    getRoomAvailability
} = require('../../controllers/property_manager/residenceController');

// Validation middleware
const residenceValidation = [
    check('name', 'Name is required').notEmpty(),
    check('description', 'Description is required').notEmpty(),
    check('address').isObject().withMessage('Address must be an object')
        .custom(value => {
            if (!value.street || !value.city || !value.country) {
                throw new Error('Address must include street, city, and country');
            }
            return true;
        }),
    check('location.coordinates').isArray().withMessage('Coordinates must be an array')
        .custom(value => {
            if (!Array.isArray(value) || value.length !== 2) {
                throw new Error('Coordinates must be [longitude, latitude]');
            }
            return true;
        })
];

const roomValidation = [
    check('roomNumber', 'Room number is required').notEmpty(),
    check('type', 'Invalid room type')
        .isIn(['single', 'double', 'studio', 'apartment']),
    check('price', 'Price must be a positive number')
        .isFloat({ min: 0 }),
    check('status', 'Invalid status')
        .optional()
        .isIn(['available', 'occupied', 'maintenance', 'reserved']),
    check('floor', 'Floor must be a number')
        .optional()
        .isInt(),
    check('area', 'Area must be a positive number')
        .optional()
        .isFloat({ min: 0 })
];

// All routes require property manager role
router.use(auth);
router.use(checkRole('property_manager'));

// Routes
router.get('/', getManagedResidences);
router.get('/:id', getResidence);
router.post('/', residenceValidation, createResidence);
router.patch('/:id', residenceValidation, updateResidence);
router.post('/:id/rooms', roomValidation, addRoom);
router.patch('/:residenceId/rooms/:roomNumber', roomValidation, updateRoom);
router.get('/:residenceId/rooms/:roomNumber/availability', getRoomAvailability);

module.exports = router; 