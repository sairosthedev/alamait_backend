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
        const message = await Message.findById(req.params.messageId);
        
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is authorized to delete the message
        const isAuthor = message.author.toString() === req.user._id.toString();
        const isRecipient = message.recipients.some(id => id.toString() === req.user._id.toString());
        
        if (!isAuthor && !isRecipient) {
            return res.status(403).json({ error: 'Not authorized to delete this message' });
        }

        await message.deleteOne();
        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Error in deleteMessage:', error);
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

// Get user conversations
exports.getConversations = async (req, res) => {
    try {
        // This endpoint will return all conversations (or threads) that the user is part of
        // A conversation is essentially a group of messages between the same set of users
        
        // Find all messages where user is either author or recipient
        const messages = await Message.find({
            $or: [
                { author: req.user._id },
                { recipients: req.user._id }
            ]
        })
        .sort({ createdAt: -1 })
        .populate('author', 'firstName lastName role')
        .populate('recipients', 'firstName lastName role')
        .lean();
        
        // Group messages into conversations
        // For simplicity, we'll treat each message with its replies as a separate conversation
        const conversations = messages.map(msg => {
            // Determine the other participant(s) name
            let name;
            if (msg.author._id.toString() === req.user._id.toString()) {
                // If user is the author, use the first recipient's name
                const recipient = msg.recipients.find(r => r._id.toString() !== req.user._id.toString());
                name = recipient ? `${recipient.firstName} ${recipient.lastName}` : 'Unnamed';
            } else {
                // If user is recipient, use author's name
                name = `${msg.author.firstName} ${msg.author.lastName}`;
            }
            
            // Get last message (either main message or last reply)
            const lastMessage = msg.replies.length > 0 ? 
                msg.replies[msg.replies.length - 1] : 
                { content: msg.content, timestamp: msg.createdAt };
            
            return {
                _id: msg._id,
                name,
                subject: msg.title,
                lastMessage: {
                    content: lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : ''),
                    timestamp: lastMessage.timestamp
                },
                participants: [...new Set([msg.author, ...msg.recipients].map(p => p._id.toString()))],
                updatedAt: msg.updatedAt || msg.createdAt,
                unreadCount: 0 // We'll implement this later
            };
        });
        
        // Sort by last updated
        conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        
        res.json(conversations);
    } catch (error) {
        console.error('Error getting conversations:', error);
        res.status(500).json({ error: 'Error retrieving conversations' });
    }
};

// Get messages for a specific conversation
exports.getConversationMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        
        // Find the main message
        const mainMessage = await Message.findById(conversationId)
            .populate('author', 'firstName lastName role')
            .populate('recipients', 'firstName lastName role')
            .lean();
            
        if (!mainMessage) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        // Check if user is part of this conversation
        const isParticipant = 
            mainMessage.author._id.toString() === req.user._id.toString() ||
            mainMessage.recipients.some(r => r._id.toString() === req.user._id.toString());
            
        if (!isParticipant) {
            return res.status(403).json({ error: 'Not authorized to view this conversation' });
        }
        
        // Format the conversation messages (main message + replies)
        const messages = [
            {
                _id: mainMessage._id,
                content: mainMessage.content,
                author: mainMessage.author,
                createdAt: mainMessage.createdAt
            },
            ...mainMessage.replies.map(reply => ({
                _id: reply._id,
                content: reply.content,
                author: reply.author,
                createdAt: reply.timestamp
            }))
        ];
        
        // Sort messages by date
        messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        res.json(messages);
    } catch (error) {
        console.error('Error getting conversation messages:', error);
        res.status(500).json({ error: 'Error retrieving conversation messages' });
    }
};

// Send message in a conversation
exports.sendConversationMessage = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { conversationId } = req.params;
        const { content } = req.body;
        
        // Find the conversation (message)
        const message = await Message.findById(conversationId);
        
        if (!message) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        // Check if user is part of this conversation
        const isAuthor = message.author.toString() === req.user._id.toString();
        const isRecipient = message.recipients.some(id => id.toString() === req.user._id.toString());
        
        if (!isAuthor && !isRecipient) {
            return res.status(403).json({ error: 'Not authorized to participate in this conversation' });
        }
        
        // Add reply to the conversation
        const reply = {
            author: req.user._id,
            content: content.trim(),
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
            _id: latestReply._id,
            content: latestReply.content,
            author: {
                _id: latestReply.author._id,
                firstName: latestReply.author.firstName,
                lastName: latestReply.author.lastName,
                role: latestReply.author.role
            },
            createdAt: latestReply.timestamp
        };
        
        res.status(201).json(formattedReply);
    } catch (error) {
        console.error('Error sending conversation message:', error);
        res.status(500).json({ error: 'Error sending message' });
    }
};

// Toggle message pin status
exports.toggleMessagePin = async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is authorized to pin/unpin the message
        const isAuthor = message.author.toString() === req.user._id.toString();
        const isRecipient = message.recipients.some(id => id.toString() === req.user._id.toString());
        
        if (!isAuthor && !isRecipient) {
            return res.status(403).json({ error: 'Not authorized to modify this message' });
        }

        message.pinned = !message.pinned;
        await message.save();

        res.json({ 
            message: message.pinned ? 'Message pinned successfully' : 'Message unpinned successfully',
            pinned: message.pinned 
        });
    } catch (error) {
        console.error('Error in toggleMessagePin:', error);
        res.status(500).json({ error: 'Error updating message pin status' });
    }
};

// Delete a conversation
exports.deleteConversation = async (req, res) => {
    try {
        const message = await Message.findById(req.params.conversationId);
        
        if (!message) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Check if user is authorized to delete the conversation
        const isAuthor = message.author.toString() === req.user._id.toString();
        const isRecipient = message.recipients.some(id => id.toString() === req.user._id.toString());
        
        if (!isAuthor && !isRecipient) {
            return res.status(403).json({ error: 'Not authorized to delete this conversation' });
        }

        // Delete the main message and all its replies
        await message.deleteOne();
        
        res.json({ message: 'Conversation deleted successfully' });
    } catch (error) {
        console.error('Error in deleteConversation:', error);
        res.status(500).json({ error: 'Error deleting conversation' });
    }
};

// Toggle conversation pin status
exports.toggleConversationPin = async (req, res) => {
    try {
        const message = await Message.findById(req.params.conversationId);
        
        if (!message) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Check if user is authorized to pin/unpin the conversation
        const isAuthor = message.author.toString() === req.user._id.toString();
        const isRecipient = message.recipients.some(id => id.toString() === req.user._id.toString());
        
        if (!isAuthor && !isRecipient) {
            return res.status(403).json({ error: 'Not authorized to modify this conversation' });
        }

        message.pinned = !message.pinned;
        await message.save();

        res.json({ 
            message: message.pinned ? 'Conversation pinned successfully' : 'Conversation unpinned successfully',
            pinned: message.pinned 
        });
    } catch (error) {
        console.error('Error in toggleConversationPin:', error);
        res.status(500).json({ error: 'Error updating conversation pin status' });
    }
};

// Mark message as viewed
exports.markMessageAsViewed = async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is authorized to view the message
        const isAuthor = message.author.toString() === req.user._id.toString();
        const isRecipient = message.recipients.some(id => id.toString() === req.user._id.toString());
        
        if (!isAuthor && !isRecipient) {
            return res.status(403).json({ error: 'Not authorized to view this message' });
        }

        // Add user to readBy if not already there
        const alreadyRead = message.readBy.some(read => read.user.toString() === req.user._id.toString());
        if (!alreadyRead) {
            message.readBy.push({
                user: req.user._id,
                readAt: new Date()
            });
            await message.save();
        }

        res.json({ message: 'Message marked as viewed' });
    } catch (error) {
        console.error('Error in markMessageAsViewed:', error);
        res.status(500).json({ error: 'Error marking message as viewed' });
    }
};

// Get message stats including unread count
exports.getMessageStats = async (req, res) => {
    try {
        // Count unread messages where user is a recipient
        const unreadCount = await Message.countDocuments({
            recipients: req.user._id,
            'readBy.user': { $ne: req.user._id }
        });

        // Count total messages where user is either author or recipient
        const totalCount = await Message.countDocuments({
            $or: [
                { author: req.user._id },
                { recipients: req.user._id }
            ]
        });

        // Count pinned messages
        const pinnedCount = await Message.countDocuments({
            $or: [
                { author: req.user._id },
                { recipients: req.user._id }
            ],
            pinned: true
        });

        // Get recent unread messages (last 5)
        const recentUnreadMessages = await Message.find({
            recipients: req.user._id,
            'readBy.user': { $ne: req.user._id }
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('author', 'firstName lastName role')
        .lean();

        // Format recent unread messages
        const formattedUnreadMessages = recentUnreadMessages.map(message => ({
            id: message._id,
            title: message.title,
            content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
            author: `${message.author.firstName} ${message.author.lastName}`,
            role: message.author.role,
            timestamp: message.createdAt,
            avatar: message.author.role === 'admin' ? '🏛️' : '👨‍🎓'
        }));

        res.json({
            unreadCount,
            totalCount,
            pinnedCount,
            recentUnreadMessages: formattedUnreadMessages
        });
    } catch (error) {
        console.error('Error in getMessageStats:', error);
        res.status(500).json({ error: 'Error fetching message stats' });
    }
}; 