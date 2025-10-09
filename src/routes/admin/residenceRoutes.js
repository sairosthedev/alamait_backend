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
    getRoomsByResidence,
    getResidenceRooms,
    bulkAddRooms
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

// Validation middleware for bulk room addition (flexible for both JSON and CSV)
const bulkRoomsValidation = [
    body().custom((value) => {
        // Check if either 'rooms' array or 'csvData' string is provided
        if (!value.rooms && !value.csvData) {
            throw new Error('Either rooms array or csvData string is required');
        }
        
        // If csvData is provided, it should be a string
        if (value.csvData && typeof value.csvData !== 'string') {
            throw new Error('csvData must be a string');
        }
        
        // If rooms is provided, it should be an array
        if (value.rooms && !Array.isArray(value.rooms)) {
            throw new Error('rooms must be an array');
        }
        
        return true;
    })
];

// Apply auth middleware to all routes
router.use(auth);
router.use(checkRole('admin', 'ceo'));

// Routes
router.post(
  '/residences',
  [
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
    body('contactInfo')
      .optional({ nullable: true })
      .custom(value => value === null || typeof value === 'object')
      .withMessage('Contact info must be an object or null')
  ],
  addResidence
);
router.get('/', getAllResidences);
router.get('/:id', getResidence);
router.get('/:id/rooms', getResidenceRooms);
router.put(
  '/:id', // <-- FIXED: remove '/residences'
  [
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
    body('contactInfo')
      .optional({ nullable: true })
      .custom(value => value === null || typeof value === 'object')
      .withMessage('Contact info must be an object or null')
  ],
  updateResidence
);
router.delete('/:id', deleteResidence);
router.get('/:residenceId/rooms', getRoomsByResidence);
router.post('/:id/rooms/bulk', bulkRoomsValidation, bulkAddRooms);

module.exports = router;