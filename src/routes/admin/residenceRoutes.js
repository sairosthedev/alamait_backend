const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');

// Import controllers
const {
    addResidence,
    getAllResidences,
    getResidence,
    updateResidence,
    deleteResidence,
    getRoomsByResidence
} = require('../../controllers/admin/residenceController');

// Validation middleware
const residenceValidation = [
    body('name').notEmpty().trim().withMessage('Name is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('address').isObject().withMessage('Address must be an object'),
    body('address.street').notEmpty().withMessage('Street address is required'),
    body('address.city').notEmpty().withMessage('City is required'),
    body('address.state').notEmpty().withMessage('State is required'),
    body('address.country').notEmpty().withMessage('Country is required'),
    body('location').isObject().withMessage('Location must be an object'),
    body('location.type').equals('Point').withMessage('Location type must be Point'),
    body('location.coordinates').isArray().withMessage('Location coordinates are required'),
    body('location.coordinates').custom((value) => {
        if (!Array.isArray(value) || value.length !== 2) {
            throw new Error('Coordinates must be an array of [longitude, latitude]');
        }
        const [longitude, latitude] = value;
        if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
            throw new Error('Invalid coordinates');
        }
        return true;
    }),
    body('rooms').isArray().withMessage('Rooms must be an array'),
    body('rooms.*.roomNumber').notEmpty().withMessage('Room number is required'),
    body('rooms.*.type').isIn(['single', 'double', 'studio', 'apartment', 'triple', 'quad']).withMessage('Invalid room type'),
    body('rooms.*.capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
    body('rooms.*.price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('rooms.*.status').isIn(['available', 'occupied', 'maintenance', 'reserved']).withMessage('Invalid status'),
    body('rooms.*.currentOccupancy').isInt({ min: 0 }).withMessage('Current occupancy must be a non-negative number'),
    body('rooms.*.features').isArray().withMessage('Features must be an array'),
    body('rooms.*.amenities').isArray().withMessage('Amenities must be an array'),
    body('rooms.*.floor').isInt({ min: 0 }).withMessage('Floor must be a non-negative number'),
    body('rooms.*.area').isFloat({ min: 0 }).withMessage('Area must be a positive number'),
    body('rooms.*.images').isArray().withMessage('Images must be an array'),
    body('amenities').isArray().withMessage('Amenities must be an array'),
    body('images').isArray().withMessage('Images must be an array'),
    body('rules').isArray().withMessage('Rules must be an array'),
    body('features').isArray().withMessage('Features must be an array'),
    body('status').isIn(['active', 'inactive', 'maintenance']).withMessage('Invalid status'),
    body('contactInfo').isObject().withMessage('Contact info must be an object'),
    body('contactInfo.email').optional().isEmail().withMessage('Invalid email'),
    body('contactInfo.phone').optional().isString().withMessage('Phone must be a string'),
    body('contactInfo.website').optional().isURL().withMessage('Invalid website URL')
];

// Apply auth middleware to all routes
router.use(auth);
router.use(checkRole('admin'));

// Routes
router.post('/', residenceValidation, addResidence);
router.get('/', getAllResidences);
router.get('/:id', getResidence);
router.put('/:id', residenceValidation, updateResidence);
router.delete('/:id', deleteResidence);
router.get('/:residenceId/rooms', getRoomsByResidence);

module.exports = router; 