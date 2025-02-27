const Message = require('../../models/Message');
const User = require('../../models/User');
const { validationResult } = require('express-validator');

// Send message
exports.sendMessage = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { recipient, subject, content, parentMessage } = req.body;

        // Check if recipient exists
        const recipientUser = await User.findById(recipient);
        if (!recipientUser) {
            return res.status(404).json({ error: 'Recipient not found' });
        }

        const message = new Message({
            sender: req.user._id,
            recipient,
            subject,
            content,
            parentMessage,
            status: 'unread'
        });

        await message.save();

        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'firstName lastName email')
            .populate('recipient', 'firstName lastName email');

        res.status(201).json(populatedMessage);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Error sending message' });
    }
};

// Get inbox messages
exports.getInbox = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const messages = await Message.find({ recipient: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('sender', 'firstName lastName email')
            .populate('parentMessage');

        const total = await Message.countDocuments({ recipient: req.user._id });
        const totalPages = Math.ceil(total / limit);

        res.json({
            messages,
            currentPage: page,
            totalPages,
            totalMessages: total
        });
    } catch (error) {
        console.error('Get inbox error:', error);
        res.status(500).json({ error: 'Error fetching inbox messages' });
    }
};

// Get sent messages
exports.getSentMessages = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const messages = await Message.find({ sender: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('recipient', 'firstName lastName email')
            .populate('parentMessage');

        const total = await Message.countDocuments({ sender: req.user._id });
        const totalPages = Math.ceil(total / limit);

        res.json({
            messages,
            currentPage: page,
            totalPages,
            totalMessages: total
        });
    } catch (error) {
        console.error('Get sent messages error:', error);
        res.status(500).json({ error: 'Error fetching sent messages' });
    }
};

// Get single message
exports.getMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id)
            .populate('sender', 'firstName lastName email')
            .populate('recipient', 'firstName lastName email')
            .populate('parentMessage');

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is authorized to view the message
        if (message.sender.toString() !== req.user._id.toString() && 
            message.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to view this message' });
        }

        // Mark as read if recipient is viewing
        if (message.recipient.toString() === req.user._id.toString() && 
            message.status === 'unread') {
            message.status = 'read';
            await message.save();
        }

        res.json(message);
    } catch (error) {
        console.error('Get message error:', error);
        res.status(500).json({ error: 'Error fetching message' });
    }
};

// Update message status
exports.updateMessageStatus = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Only recipient can update status
        if (message.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to update this message' });
        }

        message.status = req.body.status;
        await message.save();

        res.json(message);
    } catch (error) {
        console.error('Update message status error:', error);
        res.status(500).json({ error: 'Error updating message status' });
    }
};

// Delete message
exports.deleteMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is authorized to delete the message
        if (message.sender.toString() !== req.user._id.toString() && 
            message.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to delete this message' });
        }

        await message.deleteOne();
        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Error deleting message' });
    }
};

// Get message thread
exports.getMessageThread = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is authorized to view the thread
        if (message.sender.toString() !== req.user._id.toString() && 
            message.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to view this thread' });
        }

        // Get parent message if exists
        const parentMessage = message.parentMessage ? 
            await Message.findById(message.parentMessage)
                .populate('sender', 'firstName lastName email')
                .populate('recipient', 'firstName lastName email') : null;

        // Get replies to this message
        const replies = await Message.find({ parentMessage: message._id })
            .populate('sender', 'firstName lastName email')
            .populate('recipient', 'firstName lastName email')
            .sort({ createdAt: 1 });

        res.json({
            parentMessage,
            message,
            replies
        });
    } catch (error) {
        console.error('Get message thread error:', error);
        res.status(500).json({ error: 'Error fetching message thread' });
    }
}; 