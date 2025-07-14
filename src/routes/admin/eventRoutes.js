const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const eventController = require('../../controllers/admin/eventController');
const { auth, isAdmin } = require('../../middleware/auth');

// Validation middleware
const eventValidation = [
    check('title', 'Title is required').notEmpty(),
    check('date', 'Date is required').notEmpty(),
    check('location', 'Location is required').notEmpty(),
    check('category', 'Category is required').isIn(['Workshop', 'Social', 'Training', 'Safety']),
    check('description', 'Description is required').notEmpty(),
    check('residence', 'Residence ID is required').notEmpty().isMongoId().withMessage('Invalid residence ID format')
];

// Apply auth middleware to all routes
router.use(auth);
router.use(isAdmin);

// Get all events
router.get('/', eventController.getEvents);

// Create a new event
router.post('/', eventValidation, eventController.createEvent);

// Update an event
router.put('/:id', eventValidation, eventController.updateEvent);

// Delete an event
router.delete('/:id', eventController.deleteEvent);

router.get('/:id/rsvp-summary', eventController.getEventRSVPSummary);
router.get('/:id/poll-summary', eventController.getEventPollSummary);

module.exports = router; 