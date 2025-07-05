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

        // Apply type filter
        if (filter === 'sent') {
            query.author = req.user._id;
        } else if (filter === 'received') {
            query.recipients = req.user._id;
        } else if (filter === 'announcements') {
            query.type = 'announcement';
        } else if (filter === 'discussions') {
            query.type = 'discussion';
        } else if (filter === 'group') {
            // Messages sent to all students (group messages)
            query.recipients = { $exists: true, $ne: [] };
        }

        // Add condition to exclude student-to-student messages for admin view
        if (filter !== 'received') {
            query.$or = [
                { author: req.user._id },  // Messages from admin
                { type: 'announcement' }   // All announcements
            ];
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
                .populate({
                    path: 'deliveryStatus.recipient',
                    select: 'firstName lastName role',
                    model: 'User'
                })
                .populate({
                    path: 'readBy.user',
                    select: 'firstName lastName role',
                    model: 'User'
                })
                .populate({
                    path: 'residence',
                    select: 'name _id',
                    model: 'Residence'
                })
                .lean()
                .exec();

            console.log('Messages fetched successfully:', messages.length);

            // Format messages
            const formattedMessages = messages.map(message => {
                try {
                    // Calculate delivery status summary
                    const totalRecipients = message.recipients?.length || 0;
                    const deliveredCount = message.deliveryStatus?.filter(ds => ds.status === 'delivered' || ds.status === 'read').length || 0;
                    const readCount = message.deliveryStatus?.filter(ds => ds.status === 'read').length || 0;
                    
                    // Get delivery indicators
                    const deliveryIndicators = message.deliveryStatus?.map(ds => ({
                        recipient: {
                            id: ds.recipient._id,
                            name: `${ds.recipient.firstName} ${ds.recipient.lastName}`,
                            role: ds.recipient.role
                        },
                        status: ds.status,
                        deliveredAt: ds.deliveredAt,
                        readAt: ds.readAt
                    })) || [];

                    // Get read by information
                    const readBy = message.readBy?.map(read => ({
                        user: {
                            id: read.user._id,
                            name: `${read.user.firstName} ${read.user.lastName}`,
                            role: read.user.role
                        },
                        readAt: read.readAt
                    })) || [];

                    const formattedMessage = {
                        id: message._id,
                        author: message.author ? `${message.author.firstName} ${message.author.lastName}` : 'Unknown',
                        role: message.author?.role || 'unknown',
                        title: message.title,
                        content: message.content,
                        type: message.type || 'discussion',
                        timestamp: message.createdAt,
                        pinned: message.pinned,
                        residence: message.residence ? {
                            id: message.residence._id,
                            name: message.residence.name
                        } : null,
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
                            timestamp: reply.timestamp,
                            isEdited: reply.isEdited || false,
                            editedAt: reply.editedAt
                        })),
                        // Delivery and read status
                        deliveryStatus: {
                            totalRecipients,
                            deliveredCount,
                            readCount,
                            deliveredPercentage: totalRecipients > 0 ? (deliveredCount / totalRecipients) * 100 : 0,
                            readPercentage: totalRecipients > 0 ? (readCount / totalRecipients) * 100 : 0
                        },
                        deliveryIndicators,
                        readBy,
                        // Edit indicators
                        isEdited: message.isEdited || false,
                        editedAt: message.editedAt
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

        const { title, content, recipient, specificStudent, residence } = req.body;

        // Validate residence ID
        if (!residence) {
            return res.status(400).json({ error: 'Residence ID is required' });
        }

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

        // Initialize delivery status for all recipients
        const deliveryStatus = recipients.map(recipientId => ({
            recipient: recipientId,
            status: 'sent',
            deliveredAt: null,
            readAt: null
        }));

        const newMessage = new Message({
            author: req.user._id,
            residence,
            title,
            content,
            type: 'announcement',
            recipients,
            pinned: false,
            deliveryStatus
        });

        await newMessage.save();

        // Format response
        const populatedMessage = await Message.findById(newMessage._id)
            .populate('author', 'firstName lastName role')
            .populate('recipients', 'firstName lastName role')
            .populate('deliveryStatus.recipient', 'firstName lastName role')
            .lean();

        // Calculate delivery status summary
        const totalRecipients = populatedMessage.recipients?.length || 0;
        const deliveredCount = populatedMessage.deliveryStatus?.filter(ds => ds.status === 'delivered' || ds.status === 'read').length || 0;
        const readCount = populatedMessage.deliveryStatus?.filter(ds => ds.status === 'read').length || 0;

        const formattedMessage = {
            id: populatedMessage._id,
            author: `${populatedMessage.author.firstName} ${populatedMessage.author.lastName}`,
            role: populatedMessage.author.role,
            title: populatedMessage.title,
            content: populatedMessage.content,
            type: populatedMessage.type,
            timestamp: populatedMessage.createdAt,
            pinned: populatedMessage.pinned,
            residence: populatedMessage.residence ? {
                id: populatedMessage.residence._id,
                name: populatedMessage.residence.name
            } : null,
            recipients: populatedMessage.recipients.map(r => ({
                id: r._id,
                name: `${r.firstName} ${r.lastName}`,
                role: r.role
            })),
            replies: [],
            // Delivery and read status
            deliveryStatus: {
                totalRecipients,
                deliveredCount,
                readCount,
                deliveredPercentage: totalRecipients > 0 ? (deliveredCount / totalRecipients) * 100 : 0,
                readPercentage: totalRecipients > 0 ? (readCount / totalRecipients) * 100 : 0
            },
            deliveryIndicators: populatedMessage.deliveryStatus?.map(ds => ({
                recipient: {
                    id: ds.recipient._id,
                    name: `${ds.recipient.firstName} ${ds.recipient.lastName}`,
                    role: ds.recipient.role
                },
                status: ds.status,
                deliveredAt: ds.deliveredAt,
                readAt: ds.readAt
            })) || []
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

        res.json({ message: 'Message pinned successfully', pinned: message.pinned });
    } catch (error) {
        console.error('Error in togglePinMessage:', error);
        res.status(500).json({ error: 'Error updating message pin status' });
    }
};

// Mark message as read
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
            .populate('author', 'firstName lastName role')
            .populate('recipients', 'firstName lastName role')
            .populate('deliveryStatus.recipient', 'firstName lastName role')
            .lean();

        const formattedMessage = {
            id: updatedMessage._id,
            author: `${updatedMessage.author.firstName} ${updatedMessage.author.lastName}`,
            role: updatedMessage.author.role,
            title: updatedMessage.title,
            content: updatedMessage.content,
            type: updatedMessage.type,
            timestamp: updatedMessage.createdAt,
            pinned: updatedMessage.pinned,
            isEdited: updatedMessage.isEdited,
            editedAt: updatedMessage.editedAt,
            recipients: updatedMessage.recipients.map(r => ({
                id: r._id,
                name: `${r.firstName} ${r.lastName}`,
                role: r.role
            }))
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

        // Find the message
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is authorized to delete the message (only author can delete)
        if (message.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to delete this message' });
        }

        // Check if message is too old to delete (e.g., within 24 hours)
        const messageAge = Date.now() - message.createdAt.getTime();
        const maxDeleteTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        if (messageAge > maxDeleteTime) {
            return res.status(400).json({ error: 'Message cannot be deleted after 24 hours' });
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

// Delete reply from message
exports.deleteReply = async (req, res) => {
    try {
        const { messageId, replyId } = req.params;
        
        const message = await Message.findById(messageId);
        
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Find the reply in the message's replies array
        const replyIndex = message.replies.findIndex(
            reply => reply._id.toString() === replyId
        );

        if (replyIndex === -1) {
            return res.status(404).json({ error: 'Reply not found' });
        }

        // Check if user is authorized to delete the reply
        const isReplyAuthor = message.replies[replyIndex].author.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        
        if (!isReplyAuthor && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to delete this reply' });
        }

        // Remove the reply from the array
        message.replies.splice(replyIndex, 1);
        await message.save();
        
        res.json({ message: 'Reply deleted successfully' });
    } catch (error) {
        console.error('Error in deleteReply:', error);
        res.status(500).json({ error: 'Error deleting reply' });
    }
}; 