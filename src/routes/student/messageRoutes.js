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
    body('specificStudent').optional().isMongoId().withMessage('Invalid student ID')
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

// Add reply to message
router.post('/:messageId/reply',
    auth,
    checkRole('student'),
    replyValidation,
    messageController.addReply
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

// Add route for getting all students for messaging
router.get('/users/students', auth, checkRole('student'), getAllUsersForMessaging);

// Delete a specific message
router.delete('/:messageId',
    auth,
    checkRole('student'),
    messageController.deleteMessage
);

// Pin/unpin a specific message
router.patch('/:messageId/pin',
    auth,
    checkRole('student'),
    messageController.toggleMessagePin
);

// Delete a conversation
router.delete('/conversation/:conversationId',
    auth,
    checkRole('student'),
    messageController.deleteConversation
);

// Pin/unpin a conversation
router.patch('/conversation/:conversationId/pin',
    auth,
    checkRole('student'),
    messageController.toggleConversationPin
);

// Get unread message stats
router.get('/unread', 
    auth, 
    checkRole('student'), 
    messageController.getMessageStats
);

// Mark message as viewed
router.patch('/:messageId/view',
    auth,
    checkRole('student'),
    messageController.markMessageAsViewed
);

module.exports = router; 