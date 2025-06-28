const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const messageController = require('../../controllers/admin/messageController');
const Message = require('../../models/Message');
const mongoose = require('mongoose');

// Test endpoint to check database state
router.get('/test', async (req, res) => {
    try {
        const count = await Message.countDocuments();
        const collections = await mongoose.connection.db.listCollections().toArray();
        res.json({
            messageCount: count,
            collections: collections.map(c => c.name),
            connectionState: mongoose.connection.readyState
        });
    } catch (error) {
        console.error('Test endpoint error:', error);
        res.status(500).json({ error: 'Test failed', details: error.message });
    }
});

// Validation middleware
const messageValidation = [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('recipient').isIn(['all-students', 'specific-student']).withMessage('Invalid recipient type'),
    body('specificStudent').optional().isMongoId().withMessage('Invalid student ID'),
    body('residence').notEmpty().isMongoId().withMessage('Residence ID is required and must be a valid MongoDB ID')
];

const replyValidation = [
    body('content').trim().notEmpty().withMessage('Reply content is required')
];

// Get all messages (with filtering and pagination)
router.get('/', auth, checkRole('admin'), messageController.getMessages);

// Create new message (announcement)
router.post('/', 
    auth, 
    checkRole('admin'), 
    messageValidation,
    messageController.createMessage
);

// Add reply to message
router.post('/:messageId/reply',
    auth,
    checkRole('admin'),
    replyValidation,
    messageController.addReply
);

// Pin/unpin message
router.patch('/:messageId/pin',
    auth,
    checkRole('admin'),
    messageController.togglePinMessage
);

// Delete message
router.delete('/:messageId',
    auth,
    checkRole('admin'),
    messageController.deleteMessage
);

// Delete reply from message
router.delete('/:messageId/replies/:replyId',
    auth,
    checkRole('admin'),
    messageController.deleteReply
);

module.exports = router; 