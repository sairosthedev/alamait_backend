const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    getAvailableEvents,
    getMyEvents,
    registerForEvent,
    cancelRegistration,
    addFeedback
} = require('../../controllers/student/eventController');

// Validation middleware
const feedbackValidation = [
    check('rating', 'Rating is required and must be between 1 and 5')
        .isInt({ min: 1, max: 5 }),
    check('comment', 'Comment is required')
        .notEmpty()
        .isLength({ min: 10, max: 500 })
        .withMessage('Comment must be between 10 and 500 characters')
];

// All routes require student role
router.use(auth);
router.use(checkRole('student'));

// Routes
router.get('/available', getAvailableEvents);
router.get('/my-events', getMyEvents);
router.post('/:id/register', registerForEvent);
router.post('/:id/cancel', cancelRegistration);
router.post('/:id/feedback', feedbackValidation, addFeedback);

module.exports = router; 