const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    sendMessage,
    getInbox,
    getSentMessages,
    getMessage,
    updateMessageStatus,
    deleteMessage,
    getMessageThread
} = require('../../controllers/student/messageController');

// Validation middleware
const messageValidation = [
    check('recipient', 'Recipient ID is required').notEmpty().isMongoId(),
    check('subject', 'Subject is required')
        .notEmpty()
        .isLength({ min: 1, max: 200 }),
    check('content', 'Message content is required')
        .notEmpty()
        .isLength({ min: 1, max: 5000 })
];

const statusValidation = [
    check('status', 'Invalid status')
        .isIn(['unread', 'read', 'archived'])
];

// All routes require student role
router.use(auth);
router.use(checkRole('student'));

// Routes
router.post('/', messageValidation, sendMessage);
router.get('/inbox', getInbox);
router.get('/sent', getSentMessages);
router.get('/:id', getMessage);
router.get('/:id/thread', getMessageThread);
router.patch('/:id/status', statusValidation, updateMessageStatus);
router.delete('/:id', deleteMessage);

module.exports = router; 