const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    getEvents,
    getEvent,
    createEvent,
    updateEvent,
    cancelEvent,
    getEventStats
} = require('../../controllers/property_manager/eventController');

// Validation middleware
const eventValidation = [
    check('title', 'Title is required').notEmpty(),
    check('description', 'Description is required').notEmpty(),
    check('residence', 'Residence ID is required').notEmpty().isMongoId(),
    check('date', 'Date is required').notEmpty().isISO8601(),
    check('startTime', 'Start time is required').notEmpty(),
    check('endTime', 'End time is required').notEmpty(),
    check('location', 'Location is required').notEmpty(),
    check('category', 'Category is required')
        .isIn(['social', 'academic', 'sports', 'cultural', 'other']),
    check('capacity', 'Capacity must be a positive number')
        .isInt({ min: 1 }),
    check('requirements')
        .optional()
        .isArray(),
    check('resources')
        .optional()
        .isArray()
        .custom(value => {
            if (!value.every(resource => resource.name && resource.url)) {
                throw new Error('Each resource must have a name and URL');
            }
            return true;
        })
];

// All routes require property manager role
router.use(auth);
router.use(checkRole('property_manager'));

// Routes
router.get('/', getEvents);
router.get('/stats', getEventStats);
router.get('/:id', getEvent);
router.post('/', eventValidation, createEvent);
router.patch('/:id', eventValidation, updateEvent);
router.post('/:id/cancel', cancelEvent);

module.exports = router; 