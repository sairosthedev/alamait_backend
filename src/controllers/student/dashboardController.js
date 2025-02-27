const User = require('../../models/User');
const Room = require('../../models/Room');
const Payment = require('../../models/Payment');
const Maintenance = require('../../models/Maintenance');
const Message = require('../../models/Message');

// Get student dashboard data
exports.getDashboardData = async (req, res) => {
    try {
        // Get student profile
        const student = await User.findById(req.user._id)
            .select('-password')
            .lean();

        // Get next payment
        const nextPayment = await Payment.findOne({
            student: req.user._id,
            status: 'Pending'
        })
        .sort({ date: 1 })
        .lean();

        // Get active maintenance requests
        const activeMaintenanceCount = await Maintenance.countDocuments({
            student: req.user._id,
            status: { $in: ['pending', 'in-progress'] }
        });

        // Get unread messages count
        const unreadMessagesCount = await Message.countDocuments({
            recipient: req.user._id,
            read: false
        });

        // Get latest message
        const latestMessage = await Message.findOne({
            recipient: req.user._id
        })
        .sort({ createdAt: -1 })
        .lean();

        // Format dashboard data
        const dashboardData = {
            profile: {
                name: `${student.firstName} ${student.lastName}`,
                id: student.studentId,
                program: student.program,
                year: student.year,
                image: student.profileImage
            },
            cards: {
                payment: {
                    amount: nextPayment ? nextPayment.totalAmount : 0,
                    dueDate: nextPayment ? nextPayment.date : null
                },
                room: {
                    status: student.currentRoom ? 'Active' : 'None',
                    validUntil: student.roomValidUntil
                },
                maintenance: {
                    activeCount: activeMaintenanceCount,
                    status: activeMaintenanceCount > 0 ? 'In Progress' : 'No Active Requests'
                },
                messages: {
                    unreadCount: unreadMessagesCount,
                    latestMessageTime: latestMessage ? latestMessage.createdAt : null
                }
            }
        };

        res.json(dashboardData);
    } catch (error) {
        console.error('Error in getDashboardData:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get available rooms
exports.getAvailableRooms = async (req, res) => {
    try {
        const { search, status, capacity } = req.query;
        const query = { status: 'available' };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { features: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        if (capacity && capacity !== 'all') {
            query.capacity = parseInt(capacity);
        }

        const rooms = await Room.find(query)
            .populate('residence', 'name')
            .lean();

        // Transform rooms to match frontend format
        const transformedRooms = rooms.map(room => ({
            id: room._id,
            name: room.name,
            capacity: room.capacity,
            price: room.price,
            status: room.status,
            features: room.features,
            amenities: room.amenities,
            image: room.image || 'default-room-image.jpg'
        }));

        res.json(transformedRooms);
    } catch (error) {
        console.error('Error in getAvailableRooms:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get notifications
exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Message.find({
            recipient: req.user._id,
            read: false
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

        res.json(notifications);
    } catch (error) {
        console.error('Error in getNotifications:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 