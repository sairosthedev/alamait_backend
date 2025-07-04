const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const messageController = require('../../controllers/student/messageController');
const { getAllUsersForMessaging } = require('../../controllers/student/studentController');

// Validation middleware
const messageValidation = [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('recipient').isIn(['admin', 'all-students', 'specific-student']).withMessage('Invalid recipient type'),
    body('specificStudent').optional().isMongoId().withMessage('Invalid student ID'),
    body('residence').optional().isMongoId().withMessage('Invalid residence ID format')
];

const editMessageValidation = [
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
    body('content').optional().trim().notEmpty().withMessage('Content cannot be empty')
];

const replyValidation = [
    body('content').trim().notEmpty().withMessage('Reply content is required')
];

// Get all messages (with filtering and pagination)
router.get('/', auth, checkRole('student'), messageController.getMessages);

// Create new message
router.post('/', 
    auth, 
    checkRole('student'), 
    messageValidation,
    messageController.createMessage
);

// Edit message
router.put('/:messageId',
    auth,
    checkRole('student'),
    editMessageValidation,
    messageController.editMessage
);

// Delete message
router.delete('/:messageId',
    auth,
    checkRole('student'),
    messageController.deleteMessage
);

// Add reply to message
router.post('/:messageId/reply',
    auth,
    checkRole('student'),
    replyValidation,
    messageController.addReply
);

// Edit reply
router.put('/:messageId/reply/:replyId',
    auth,
    checkRole('student'),
    replyValidation,
    messageController.editReply
);

// Delete reply
router.delete('/:messageId/reply/:replyId',
    auth,
    checkRole('student'),
    messageController.deleteReply
);

// New endpoints for conversation functionality
// Get all conversations for the current user
router.get('/conversations', 
    auth, 
    checkRole('student'), 
    messageController.getConversations
);

// Get messages for a specific conversation
router.get('/conversation/:conversationId', 
    auth, 
    checkRole('student'), 
    messageController.getConversationMessages
);

// Send message in a conversation
router.post('/conversation/:conversationId', 
    auth, 
    checkRole('student'),
    [body('content').trim().notEmpty().withMessage('Message content is required')],
    messageController.sendConversationMessage
);

// Mark conversation as read
router.post('/conversation/:conversationId/read',
    auth,
    checkRole('student'),
    messageController.markConversationAsRead
);

// Add route for getting all students for messaging
router.get('/users/students', auth, checkRole('student'), getAllUsersForMessaging);

module.exports = router; 