const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const {
    getEvents,
    registerForEvent,
    submitEventFeedback
} = require('../../controllers/student/eventController');

// Validation middleware
const feedbackValidation = [
    check('rating', 'Rating must be between 1 and 5').isInt({ min: 1, max: 5 }),
    check('comment', 'Comment is required').optional().trim().notEmpty()
];

// All routes require student role
router.use(auth);
router.use(checkRole('student'));

// Routes
router.get('/', getEvents);
router.post('/:eventId/register', registerForEvent);
router.post('/:eventId/feedback', feedbackValidation, submitEventFeedback);

module.exports = router; 