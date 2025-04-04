const express = require('express');
const router = express.Router();
const eventController = require('../../controllers/admin/eventController');
const { auth, isAdmin } = require('../../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);
router.use(isAdmin);

// Get all events
router.get('/', eventController.getEvents);

// Create a new event
router.post('/', eventController.createEvent);

// Update an event
router.put('/:id', eventController.updateEvent);

// Delete an event
router.delete('/:id', eventController.deleteEvent);

module.exports = router; 