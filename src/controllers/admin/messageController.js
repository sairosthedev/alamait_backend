const Message = require('../../models/Message');
const User = require('../../models/User');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Get messages for admin
exports.getMessages = async (req, res) => {
    try {
        // Check database connection
        if (mongoose.connection.readyState !== 1) {
            console.error('Database not connected. State:', mongoose.connection.readyState);
            return res.status(503).json({ error: 'Database service unavailable' });
        }

        // Log request details
        console.log('Request details:', {
            user: req.user ? {
                id: req.user._id,
                role: req.user.role,
                email: req.user.email
            } : 'No user found',
            query: req.query,
            headers: {
                ...req.headers,
                authorization: req.headers.authorization ? '[REDACTED]' : undefined
            }
        });

        if (!req.user) {
            console.error('No user found in request');
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (req.user.role !== 'admin') {
            console.error('User is not an admin:', req.user.role);
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { filter = 'all', search, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Build base query
        let query = {};

        // Add condition to exclude student-to-student messages
        query.$or = [
            { 'author.role': 'admin' },  // Messages from admin
            { recipients: req.user._id }  // Messages to admin
        ];

        // Apply type filter
        if (filter === 'sent') {
            query.author = req.user._id;
        } else if (filter === 'received') {
            query.recipients = req.user._id;
        }

        // Apply search filter if provided
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
            ];
        }

        console.log('Database query:', JSON.stringify(query));

        try {
            // Get total count for pagination
            console.log('Counting documents...');
            const total = await Message.countDocuments(query).exec();
            console.log('Total messages found:', total);

            // Fetch messages with pagination
            console.log('Fetching messages...');
            const messages = await Message.find(query)
                .sort({ pinned: -1, createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate({
                    path: 'author',
                    select: 'firstName lastName role',
                    model: 'User'
                })
                .populate({
                    path: 'recipients',
                    select: 'firstName lastName role',
                    model: 'User'
                })
                .populate({
                    path: 'replies.author',
                    select: 'firstName lastName role',
                    model: 'User'
                })
                .lean()
                .exec();

            console.log('Messages fetched successfully:', messages.length);

            // Format messages
            const formattedMessages = messages.map(message => {
                try {
                    const formattedMessage = {
                        id: message._id,
                        author: message.author ? `${message.author.firstName} ${message.author.lastName}` : 'Unknown',
                        role: message.author?.role || 'unknown',
                        title: message.title,
                        content: message.content,
                        timestamp: message.createdAt,
                        pinned: message.pinned,
                        recipients: (message.recipients || []).map(r => ({
                            id: r._id,
                            name: `${r.firstName} ${r.lastName}`,
                            role: r.role
                        })),
                        replies: (message.replies || []).map(reply => ({
                            id: reply._id,
                            author: reply.author ? `${reply.author.firstName} ${reply.author.lastName}` : 'Unknown',
                            role: reply.author?.role || 'unknown',
                            content: reply.content,
                            timestamp: reply.timestamp
                        }))
                    };
                    console.log('Formatted message:', formattedMessage.id);
                    return formattedMessage;
                } catch (err) {
                    console.error('Error formatting message:', err);
                    return null;
                }
            }).filter(Boolean);

            console.log('Sending response with', formattedMessages.length, 'messages');
            res.json({
                messages: formattedMessages,
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                total
            });
        } catch (dbError) {
            console.error('Database error:', {
                message: dbError.message,
                code: dbError.code,
                name: dbError.name,
                stack: dbError.stack
            });
            
            if (dbError.name === 'MongoError' || dbError.name === 'MongoServerError') {
                return res.status(503).json({ 
                    error: 'Database service unavailable',
                    details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
                });
            }
            
            throw dbError;
        }
    } catch (error) {
        console.error('Error in getMessages:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            name: error.name
        });
        res.status(500).json({ 
            error: 'Error retrieving messages',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Create new message (announcement)
exports.createMessage = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, content, recipient, specificStudent } = req.body;

        // Get recipients based on type
        let recipients = [];
        if (recipient === 'all-students') {
            const students = await User.find({ role: 'student' }).select('_id');
            recipients = students.map(student => student._id);
        } else if (recipient === 'specific-student') {
            if (!specificStudent) {
                return res.status(400).json({ error: 'Specific student ID is required' });
            }
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
            type: 'announcement',
            recipients,
            pinned: false
        });

        await newMessage.save();

        // Format response
        const populatedMessage = await Message.findById(newMessage._id)
            .populate('author', 'firstName lastName role')
            .populate('recipients', 'firstName lastName role')
            .lean();

        const formattedMessage = {
            id: populatedMessage._id,
            author: `${populatedMessage.author.firstName} ${populatedMessage.author.lastName}`,
            role: populatedMessage.author.role,
            title: populatedMessage.title,
            content: populatedMessage.content,
            timestamp: populatedMessage.createdAt,
            pinned: populatedMessage.pinned,
            recipients: populatedMessage.recipients.map(r => ({
                id: r._id,
                name: `${r.firstName} ${r.lastName}`,
                role: r.role
            })),
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

        const message = await Message.findById(req.params.messageId);

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
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
            timestamp: latestReply.timestamp
        };

        res.status(201).json(formattedReply);
    } catch (error) {
        console.error('Error in addReply:', error);
        res.status(500).json({ error: 'Error adding reply' });
    }
};

// Toggle pin status of a message
exports.togglePinMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        message.pinned = !message.pinned;
        await message.save();

        res.json({ pinned: message.pinned });
    } catch (error) {
        console.error('Error in togglePinMessage:', error);
        res.status(500).json({ error: 'Error updating message pin status' });
    }
}; 