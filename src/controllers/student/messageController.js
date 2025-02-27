const Message = require('../../models/Message');
const User = require('../../models/User');
const { validationResult } = require('express-validator');

// Get messages for student
exports.getMessages = async (req, res) => {
    try {
        const { filter = 'all', search, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Build base query
        let query = {
            $or: [
                { author: req.user._id },
                { recipients: req.user._id }
            ]
        };

        // Apply type filter
        if (filter === 'announcements') {
            query.type = 'announcement';
        } else if (filter === 'discussions') {
            query.type = 'discussion';
        }

        // Apply search filter if provided
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
            ];
        }

        // Get total count for pagination
        const total = await Message.countDocuments(query);

        // Fetch messages with pagination
        const messages = await Message.find(query)
            .sort({ pinned: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('author', 'firstName lastName role')
            .populate('replies.author', 'firstName lastName role')
            .lean();

        // Format messages
        const formattedMessages = messages.map(message => ({
            id: message._id,
            author: `${message.author.firstName} ${message.author.lastName}`,
            role: message.author.role,
            title: message.title,
            content: message.content,
            timestamp: message.createdAt,
            pinned: message.pinned,
            avatar: message.author.role === 'admin' ? '🏛️' : '👨‍🎓',
            replies: message.replies.map(reply => ({
                id: reply._id,
                author: `${reply.author.firstName} ${reply.author.lastName}`,
                role: reply.author.role,
                content: reply.content,
                timestamp: reply.timestamp,
                avatar: reply.author.role === 'admin' ? '🏛️' : '👨‍🎓'
            }))
        }));

        // Group messages by type
        const announcements = formattedMessages.filter(m => m.role === 'admin');
        const discussions = formattedMessages.filter(m => m.role === 'student');

        res.json({
            announcements,
            discussions,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error in getMessages:', error);
        res.status(500).json({ error: 'Error retrieving messages' });
    }
};

// Create new message
exports.createMessage = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, content, recipient, specificStudent } = req.body;

        // Validate recipient type
        if (recipient === 'specific-student' && !specificStudent) {
            return res.status(400).json({ error: 'Specific student ID is required' });
        }

        // Get recipients based on type
        let recipients = [];
        if (recipient === 'admin') {
            const admins = await User.find({ role: 'admin' }).select('_id');
            recipients = admins.map(admin => admin._id);
        } else if (recipient === 'all-students') {
            const students = await User.find({ role: 'student' }).select('_id');
            recipients = students.map(student => student._id);
        } else if (recipient === 'specific-student') {
            const student = await User.findOne({ _id: specificStudent, role: 'student' });
            if (!student) {
                return res.status(404).json({ error: 'Student not found' });
            }
            recipients = [student._id];
        }

        const newMessage = new Message({
            author: req.user._id,
            title,
            content,
            type: 'discussion',
            recipients,
            pinned: false
        });

        await newMessage.save();

        // Format response
        const populatedMessage = await Message.findById(newMessage._id)
            .populate('author', 'firstName lastName role')
            .lean();

        const formattedMessage = {
            id: populatedMessage._id,
            author: `${populatedMessage.author.firstName} ${populatedMessage.author.lastName}`,
            role: populatedMessage.author.role,
            title: populatedMessage.title,
            content: populatedMessage.content,
            timestamp: populatedMessage.createdAt,
            pinned: populatedMessage.pinned,
            avatar: populatedMessage.author.role === 'admin' ? '🏛️' : '👨‍🎓',
            replies: []
        };

        res.status(201).json(formattedMessage);
    } catch (error) {
        console.error('Error in createMessage:', error);
        res.status(500).json({ error: 'Error creating message' });
    }
};

// Add reply to message
exports.addReply = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const message = await Message.findById(req.params.messageId)
            .populate('author', 'firstName lastName role');

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is allowed to reply
        const isRecipient = message.recipients.includes(req.user._id);
        const isAuthor = message.author._id.toString() === req.user._id.toString();
        if (!isRecipient && !isAuthor) {
            return res.status(403).json({ error: 'Not authorized to reply to this message' });
        }

        const reply = {
            author: req.user._id,
            content: req.body.content,
            timestamp: new Date()
        };

        message.replies.push(reply);
        await message.save();

        // Get populated reply
        const populatedMessage = await Message.findById(message._id)
            .populate('replies.author', 'firstName lastName role')
            .lean();

        const latestReply = populatedMessage.replies[populatedMessage.replies.length - 1];
        const formattedReply = {
            id: latestReply._id,
            author: `${latestReply.author.firstName} ${latestReply.author.lastName}`,
            role: latestReply.author.role,
            content: latestReply.content,
            timestamp: latestReply.timestamp,
            avatar: latestReply.author.role === 'admin' ? '🏛️' : '👨‍🎓'
        };

        res.status(201).json(formattedReply);
    } catch (error) {
        console.error('Error in addReply:', error);
        res.status(500).json({ error: 'Error adding reply' });
    }
};

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