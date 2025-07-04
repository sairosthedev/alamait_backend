const Message = require('../../models/Message');
const User = require('../../models/User');
const { validationResult } = require('express-validator');

// Get messages for student
exports.getMessages = async (req, res) => {
    try {
        console.log('Getting messages for user:', {
            userId: req.user._id,
            role: req.user.role,
            email: req.user.email
        });

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
            query.$and = [
                {
                    $or: [
                        { title: { $regex: search, $options: 'i' } },
                        { content: { $regex: search, $options: 'i' } }
                    ]
                }
            ];
        }

        console.log('Final query:', JSON.stringify(query, null, 2));

        // Get total count for pagination
        const total = await Message.countDocuments(query);
        console.log('Total messages found:', total);

        // Fetch messages with pagination
        const messages = await Message.find(query)
            .sort({ pinned: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('author', 'firstName lastName role')
            .populate('recipients', 'firstName lastName role')
            .populate('replies.author', 'firstName lastName role')
            .populate('deliveryStatus.recipient', 'firstName lastName role')
            .populate('residence', 'name _id')
            .lean();

        console.log('Messages retrieved:', messages.length);

        // Format messages
        const formattedMessages = messages.map(message => {
            // Get recipient details
            const recipientDetails = message.recipients?.map(r => ({
                _id: r._id,
                firstName: r.firstName,
                lastName: r.lastName,
                role: r.role,
                email: r.email
            })) || [];

            // Get the first recipient's name for display
            const firstRecipient = recipientDetails[0] ? `${recipientDetails[0].firstName} ${recipientDetails[0].lastName}` : 'No recipient';

            // Get delivery indicators
            const deliveryIndicators = message.deliveryStatus?.map(ds => ({
                recipient: {
                    _id: ds.recipient._id,
                    firstName: ds.recipient.firstName,
                    lastName: ds.recipient.lastName,
                    role: ds.recipient.role,
                    email: ds.recipient.email
                },
                status: ds.status,
                deliveredAt: ds.deliveredAt,
                readAt: ds.readAt
            })) || [];

            return {
                _id: message._id,
                author: message.author ? {
                    _id: message.author._id,
                    firstName: message.author.firstName,
                    lastName: message.author.lastName,
                    role: message.author.role,
                    email: message.author.email
                } : null,
                title: message.title,
                content: message.content,
                type: message.type,
                timestamp: message.createdAt,
                createdAt: message.createdAt,
                time: message.createdAt ? new Date(message.createdAt).toLocaleString() : 'Date not available',
                pinned: message.pinned,
                residence: message.residence ? {
                    _id: message.residence._id,
                    name: message.residence.name
                } : null,
                recipients: recipientDetails,
                recipientName: firstRecipient,
                preview: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
                deliveryIndicators,
                // Edit indicators
                isEdited: message.isEdited || false,
                editedAt: message.editedAt,
                replies: message.replies?.map(reply => ({
                    _id: reply._id,
                    author: reply.author ? {
                        _id: reply.author._id,
                        firstName: reply.author.firstName,
                        lastName: reply.author.lastName,
                        role: reply.author.role,
                        email: reply.author.email
                    } : null,
                    content: reply.content,
                    timestamp: reply.timestamp,
                    createdAt: reply.timestamp,
                    time: reply.timestamp ? new Date(reply.timestamp).toLocaleString() : 'Date not available',
                    isEdited: reply.isEdited || false,
                    editedAt: reply.editedAt
                })) || []
            };
        });

        // Group messages by type
        const announcements = formattedMessages.filter(m => m.type === 'announcement');
        const discussions = formattedMessages.filter(m => m.type === 'discussion');

        console.log('Formatted messages:', {
            total: formattedMessages.length,
            announcements: announcements.length,
            discussions: discussions.length
        });

        res.json({
            announcements,
            discussions,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error in getMessages:', error);
        res.status(500).json({ 
            error: 'Error retrieving messages',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Create new message
exports.createMessage = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, content, recipient, specificStudent, residence } = req.body;

        // Get residence ID from request body or user's residence
        let residenceId = residence;
        if (!residenceId) {
            const user = await User.findById(req.user._id);
            if (!user || !user.residence) {
                return res.status(400).json({ error: 'Residence ID is required' });
            }
            residenceId = user.residence;
        }

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

        // Determine message type: if sent to all-students, it's an announcement
        const messageType = recipient === 'all-students' ? 'announcement' : 'discussion';

        // Initialize delivery status for all recipients
        const deliveryStatus = recipients.map(recipientId => ({
            recipient: recipientId,
            status: 'sent',
            deliveredAt: null,
            readAt: null
        }));

        const newMessage = new Message({
            author: req.user._id,
            residence: residenceId,
            title,
            content,
            type: messageType,
            recipients,
            pinned: false,
            deliveryStatus
        });

        await newMessage.save();

        // Populate author and recipients for the response
        const populatedMessage = await Message.findById(newMessage._id)
            .populate('author', 'firstName lastName role email')
            .populate('recipients', 'firstName lastName role email')
            .populate('deliveryStatus.recipient', 'firstName lastName role email')
            .lean();

        // Format the response to include user details and delivery status
        const formattedMessage = {
            ...populatedMessage,
            author: {
                _id: populatedMessage.author._id,
                firstName: populatedMessage.author.firstName,
                lastName: populatedMessage.author.lastName,
                role: populatedMessage.author.role,
                email: populatedMessage.author.email
            },
            recipients: populatedMessage.recipients.map(recipient => ({
                _id: recipient._id,
                firstName: recipient.firstName,
                lastName: recipient.lastName,
                role: recipient.role,
                email: recipient.email
            })),
            deliveryStatus: populatedMessage.deliveryStatus.map(ds => ({
                recipient: {
                    _id: ds.recipient._id,
                    firstName: ds.recipient.firstName,
                    lastName: ds.recipient.lastName,
                    role: ds.recipient.role,
                    email: ds.recipient.email
                },
                status: ds.status,
                deliveredAt: ds.deliveredAt,
                readAt: ds.readAt
            }))
        };

        res.status(201).json({
            success: true,
            message: 'Message created successfully',
            data: formattedMessage
        });
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
            .populate('replies.author', 'firstName lastName role email')
            .lean();

        const latestReply = populatedMessage.replies[populatedMessage.replies.length - 1];
        const formattedReply = {
            _id: latestReply._id,
            content: latestReply.content,
            timestamp: latestReply.timestamp,
            author: {
                _id: latestReply.author._id,
                firstName: latestReply.author.firstName,
                lastName: latestReply.author.lastName,
                role: latestReply.author.role,
                email: latestReply.author.email
            }
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

// Edit message
exports.editMessage = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, content } = req.body;
        const messageId = req.params.messageId;

        // Find the message
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is authorized to edit the message (only author can edit)
        if (message.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to edit this message' });
        }

        // Check if message is too old to edit (e.g., within 24 hours)
        const messageAge = Date.now() - message.createdAt.getTime();
        const maxEditTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        if (messageAge > maxEditTime) {
            return res.status(400).json({ error: 'Message cannot be edited after 24 hours' });
        }

        // Update message fields
        if (title !== undefined) message.title = title;
        if (content !== undefined) message.content = content;

        // Add edit timestamp
        message.editedAt = new Date();
        message.isEdited = true;

        await message.save();

        // Populate and return updated message
        const updatedMessage = await Message.findById(messageId)
            .populate('author', 'firstName lastName role email')
            .populate('recipients', 'firstName lastName role email')
            .populate('deliveryStatus.recipient', 'firstName lastName role email')
            .lean();

        const formattedMessage = {
            ...updatedMessage,
            author: {
                _id: updatedMessage.author._id,
                firstName: updatedMessage.author.firstName,
                lastName: updatedMessage.author.lastName,
                role: updatedMessage.author.role,
                email: updatedMessage.author.email
            },
            recipients: updatedMessage.recipients.map(recipient => ({
                _id: recipient._id,
                firstName: recipient.firstName,
                lastName: recipient.lastName,
                role: recipient.role,
                email: recipient.email
            })),
            deliveryStatus: updatedMessage.deliveryStatus?.map(ds => ({
                recipient: {
                    _id: ds.recipient._id,
                    firstName: ds.recipient.firstName,
                    lastName: ds.recipient.lastName,
                    role: ds.recipient.role,
                    email: ds.recipient.email
                },
                status: ds.status,
                deliveredAt: ds.deliveredAt,
                readAt: ds.readAt
            })) || []
        };

        res.json({
            success: true,
            message: 'Message updated successfully',
            data: formattedMessage
        });
    } catch (error) {
        console.error('Error in editMessage:', error);
        res.status(500).json({ error: 'Error updating message' });
    }
};

// Delete message
exports.deleteMessage = async (req, res) => {
    try {
        const messageId = req.params.messageId;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is authorized to delete the message (author or recipient can delete)
        const isAuthor = message.author.toString() === req.user._id.toString();
        const isRecipient = message.recipients.some(id => id.toString() === req.user._id.toString());
        
        if (!isAuthor && !isRecipient) {
            return res.status(403).json({ error: 'Not authorized to delete this message' });
        }

        // Check if message is too old to delete (e.g., within 24 hours for recipients, no limit for author)
        if (!isAuthor) {
            const messageAge = Date.now() - message.createdAt.getTime();
            const maxDeleteTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
            if (messageAge > maxDeleteTime) {
                return res.status(400).json({ error: 'Message cannot be deleted after 24 hours' });
            }
        }

        await message.deleteOne();
        res.json({ 
            success: true,
            message: 'Message deleted successfully' 
        });
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

            // Calculate unread count
            let unreadCount = 0;
            
            // Count unread replies
            if (msg.replies.length > 0) {
                unreadCount = msg.replies.filter(reply => 
                    !msg.readBy.some(read => 
                        read.user.toString() === req.user._id.toString() && 
                        new Date(read.readAt) > new Date(reply.timestamp)
                    )
                ).length;
            }
            
            // Count main message as unread if user is recipient and hasn't read it
            if (msg.author._id.toString() !== req.user._id.toString() && 
                !msg.readBy.some(read => read.user.toString() === req.user._id.toString())) {
                unreadCount++;
            }
            
            return {
                _id: msg._id,
                id: msg._id,
                name,
                author: `${msg.author.firstName} ${msg.author.lastName}`,
                role: msg.author.role,
                subject: msg.title,
                content: msg.content,
                preview: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
                lastMessage: {
                    content: lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : ''),
                    timestamp: lastMessage.timestamp
                },
                participants: [...new Set([msg.author, ...msg.recipients].map(p => p._id.toString()))],
                recipients: msg.recipients.map(r => ({
                    id: r._id,
                    name: `${r.firstName} ${r.lastName}`,
                    role: r.role
                })),
                updatedAt: msg.updatedAt || msg.createdAt,
                createdAt: msg.createdAt,
                time: msg.createdAt ? new Date(msg.createdAt).toLocaleString() : 'Date not available',
                unreadCount,
                pinned: msg.pinned || false
            };
        });
        
        // Sort by last updated
        conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        
        // Calculate total unread conversations
        const totalUnreadConversations = conversations.filter(conv => conv.unreadCount > 0).length;
        
        res.json({
            conversations,
            totalUnreadConversations,
            totalConversations: conversations.length
        });
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
            .populate('replies.author', 'firstName lastName role email')
            .lean();
            
        const latestReply = populatedMessage.replies[populatedMessage.replies.length - 1];
        
        const formattedReply = {
            _id: latestReply._id,
            content: latestReply.content,
            author: {
                _id: latestReply.author._id,
                firstName: latestReply.author.firstName,
                lastName: latestReply.author.lastName,
                role: latestReply.author.role,
                email: latestReply.author.email
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

// Mark message as read (enhanced version with delivery status)
exports.markMessageAsRead = async (req, res) => {
    try {
        const messageId = req.params.messageId;
        
        // Find the message
        const message = await Message.findById(messageId);
        
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is authorized to mark the message as read
        const isAuthor = message.author.toString() === req.user._id.toString();
        const isRecipient = message.recipients.some(id => id.toString() === req.user._id.toString());
        
        if (!isAuthor && !isRecipient) {
            return res.status(403).json({ error: 'Not authorized to access this message' });
        }

        // Add user to readBy if not already there
        const alreadyRead = message.readBy.some(read => read.user.toString() === req.user._id.toString());
        if (!alreadyRead) {
            message.readBy.push({
                user: req.user._id,
                readAt: new Date()
            });
        }

        // Update delivery status for the current user
        const deliveryStatusIndex = message.deliveryStatus.findIndex(
            ds => ds.recipient.toString() === req.user._id.toString()
        );

        if (deliveryStatusIndex !== -1) {
            message.deliveryStatus[deliveryStatusIndex].status = 'read';
            message.deliveryStatus[deliveryStatusIndex].readAt = new Date();
        } else if (isRecipient) {
            // If no delivery status exists for this recipient, create one
            message.deliveryStatus.push({
                recipient: req.user._id,
                status: 'read',
                readAt: new Date()
            });
        }

        await message.save();

        res.json({ 
            success: true,
            message: 'Message marked as read successfully',
            readAt: new Date()
        });
    } catch (error) {
        console.error('Error in markMessageAsRead:', error);
        res.status(500).json({ error: 'Error marking message as read' });
    }
};

// Mark message as viewed (legacy function for backward compatibility)
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

// Mark conversation as read
exports.markConversationAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        
        // Find the conversation
        const message = await Message.findById(conversationId);
        
        if (!message) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        // Check if user is part of this conversation
        const isParticipant = 
            message.author.toString() === req.user._id.toString() ||
            message.recipients.some(id => id.toString() === req.user._id.toString());
            
        if (!isParticipant) {
            return res.status(403).json({ error: 'Not authorized to access this conversation' });
        }
        
        // Add or update readBy entry for the current user
        const readByIndex = message.readBy.findIndex(
            read => read.user.toString() === req.user._id.toString()
        );
        
        if (readByIndex === -1) {
            // Add new read entry
            message.readBy.push({
                user: req.user._id,
                readAt: new Date()
            });
        } else {
            // Update existing read entry
            message.readBy[readByIndex].readAt = new Date();
        }
        
        await message.save();
        
        res.json({ message: 'Conversation marked as read' });
    } catch (error) {
        console.error('Error marking conversation as read:', error);
        res.status(500).json({ error: 'Error marking conversation as read' });
    }
};

// Edit reply
exports.editReply = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { content } = req.body;
        const { messageId, replyId } = req.params;

        // Find the message
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Find the reply
        const reply = message.replies.id(replyId);
        if (!reply) {
            return res.status(404).json({ error: 'Reply not found' });
        }

        // Check if user is authorized to edit the reply (only author can edit)
        if (reply.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to edit this reply' });
        }

        // Check if reply is too old to edit (e.g., within 24 hours)
        const replyAge = Date.now() - reply.timestamp.getTime();
        const maxEditTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        if (replyAge > maxEditTime) {
            return res.status(400).json({ error: 'Reply cannot be edited after 24 hours' });
        }

        // Update reply content
        reply.content = content;
        reply.editedAt = new Date();
        reply.isEdited = true;

        await message.save();

        // Get populated reply
        const updatedMessage = await Message.findById(messageId)
            .populate('replies.author', 'firstName lastName role email')
            .lean();

        const updatedReply = updatedMessage.replies.find(r => r._id.toString() === replyId);
        const formattedReply = {
            _id: updatedReply._id,
            content: updatedReply.content,
            timestamp: updatedReply.timestamp,
            editedAt: updatedReply.editedAt,
            isEdited: updatedReply.isEdited,
            author: {
                _id: updatedReply.author._id,
                firstName: updatedReply.author.firstName,
                lastName: updatedReply.author.lastName,
                role: updatedReply.author.role,
                email: updatedReply.author.email
            }
        };

        res.json({
            success: true,
            message: 'Reply updated successfully',
            data: formattedReply
        });
    } catch (error) {
        console.error('Error in editReply:', error);
        res.status(500).json({ error: 'Error updating reply' });
    }
};

// Delete reply
exports.deleteReply = async (req, res) => {
    try {
        const { messageId, replyId } = req.params;

        // Find the message
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Find the reply
        const reply = message.replies.id(replyId);
        if (!reply) {
            return res.status(404).json({ error: 'Reply not found' });
        }

        // Check if user is authorized to delete the reply (only author can delete)
        if (reply.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to delete this reply' });
        }

        // Check if reply is too old to delete (e.g., within 24 hours)
        const replyAge = Date.now() - reply.timestamp.getTime();
        const maxDeleteTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        if (replyAge > maxDeleteTime) {
            return res.status(400).json({ error: 'Reply cannot be deleted after 24 hours' });
        }

        // Remove the reply
        message.replies.pull(replyId);
        await message.save();

        res.json({
            success: true,
            message: 'Reply deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteReply:', error);
        res.status(500).json({ error: 'Error deleting reply' });
    }
};

// Update delivery status
exports.updateDeliveryStatus = async (req, res) => {
    try {
        const messageId = req.params.messageId;
        const { status, recipientId } = req.body; // status: 'sent', 'delivered', 'read'
        
        // Find the message
        const message = await Message.findById(messageId);
        
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is authorized (only author can update delivery status)
        if (message.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to update delivery status' });
        }

        // Validate status
        if (!['sent', 'delivered', 'read'].includes(status)) {
            return res.status(400).json({ error: 'Invalid delivery status' });
        }

        // Update delivery status for the specified recipient
        const deliveryStatusIndex = message.deliveryStatus.findIndex(
            ds => ds.recipient.toString() === recipientId
        );

        if (deliveryStatusIndex !== -1) {
            message.deliveryStatus[deliveryStatusIndex].status = status;
            
            if (status === 'delivered') {
                message.deliveryStatus[deliveryStatusIndex].deliveredAt = new Date();
            } else if (status === 'read') {
                message.deliveryStatus[deliveryStatusIndex].readAt = new Date();
            }
        } else {
            // Create new delivery status entry
            const newDeliveryStatus = {
                recipient: recipientId,
                status: status
            };
            
            if (status === 'delivered') {
                newDeliveryStatus.deliveredAt = new Date();
            } else if (status === 'read') {
                newDeliveryStatus.readAt = new Date();
            }
            
            message.deliveryStatus.push(newDeliveryStatus);
        }

        await message.save();

        res.json({ 
            success: true,
            message: 'Delivery status updated successfully',
            status: status,
            updatedAt: new Date()
        });
    } catch (error) {
        console.error('Error in updateDeliveryStatus:', error);
        res.status(500).json({ error: 'Error updating delivery status' });
    }
};

// Get delivery status for a message
exports.getDeliveryStatus = async (req, res) => {
    try {
        const messageId = req.params.messageId;
        
        // Find the message
        const message = await Message.findById(messageId)
            .populate('deliveryStatus.recipient', 'firstName lastName role email')
            .lean();
        
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is authorized to view delivery status
        const isAuthor = message.author.toString() === req.user._id.toString();
        const isRecipient = message.recipients.some(id => id.toString() === req.user._id.toString());
        
        if (!isAuthor && !isRecipient) {
            return res.status(403).json({ error: 'Not authorized to view delivery status' });
        }

        // Format delivery status
        const formattedDeliveryStatus = message.deliveryStatus.map(ds => ({
            recipient: {
                _id: ds.recipient._id,
                firstName: ds.recipient.firstName,
                lastName: ds.recipient.lastName,
                role: ds.recipient.role,
                email: ds.recipient.email
            },
            status: ds.status,
            deliveredAt: ds.deliveredAt,
            readAt: ds.readAt
        }));

        res.json({
            success: true,
            deliveryStatus: formattedDeliveryStatus
        });
    } catch (error) {
        console.error('Error in getDeliveryStatus:', error);
        res.status(500).json({ error: 'Error fetching delivery status' });
    }
}; 