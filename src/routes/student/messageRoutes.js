const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const messageController = require('../../controllers/student/messageController');

// Validation middleware
const messageValidation = [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('recipient').isIn(['admin', 'all-students', 'specific-student']).withMessage('Invalid recipient type'),
    body('specificStudent').optional().isMongoId().withMessage('Invalid student ID')
];

const replyValidation = [
    body('content').trim().notEmpty().withMessage('Reply content is required')
];

// Get all messages (with filtering and pagination)
router.get('/', auth, checkRole(['student']), messageController.getMessages);

// Create new message
router.post('/', 
    auth, 
    checkRole(['student']), 
    messageValidation,
    messageController.createMessage
);

// Add reply to message
router.post('/:messageId/reply',
    auth,
    checkRole(['student']),
    replyValidation,
    messageController.addReply
);

module.exports = router; 