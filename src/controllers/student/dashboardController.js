const User = require('../../models/User');
const Residence = require('../../models/Residence');
const Payment = require('../../models/Payment');
const Maintenance = require('../../models/Maintenance');
const Message = require('../../models/Message');

// Get student dashboard data
exports.getDashboardData = async (req, res) => {
    try {
        // Get student profile
        const student = await User.findById(req.user._id);
        
        if (student.currentRoom && student.roomApprovalDate) {
            // Calculate validity period (4 months from approval date)
            const validUntil = new Date(student.roomApprovalDate);
            validUntil.setMonth(student.roomApprovalDate.getMonth() + 4);
            
            if (!student.roomValidUntil || student.roomValidUntil.getTime() !== validUntil.getTime()) {
                student.roomValidUntil = validUntil;
                await student.save();
            }
        }

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
                    validUntil: student.roomValidUntil,
                    approvalDate: student.roomApprovalDate
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
        const { search, type, minPrice, maxPrice } = req.query;

        // Find all active residences
        const residences = await Residence.find({ status: 'active' })
            .populate('manager', 'firstName lastName email');

        // Extract all available rooms from residences
        let availableRooms = [];
        residences.forEach(residence => {
            const rooms = residence.rooms
                .filter(room => room.status === 'available')
                .map(room => ({
                    id: room._id,
                    residenceId: residence._id,
                    residenceName: residence.name,
                    roomNumber: room.roomNumber,
                    type: room.type,
                    price: room.price,
                    features: room.features,
                    floor: room.floor,
                    area: room.area,
                    amenities: residence.amenities,
                    address: residence.address,
                    contactInfo: residence.contactInfo
                }));
            availableRooms = [...availableRooms, ...rooms];
        });

        // Apply filters if provided
        if (search) {
            availableRooms = availableRooms.filter(room => 
                room.residenceName.toLowerCase().includes(search.toLowerCase()) ||
                room.roomNumber.toLowerCase().includes(search.toLowerCase())
            );
        }

        if (type) {
            availableRooms = availableRooms.filter(room => room.type === type);
        }

        if (minPrice) {
            availableRooms = availableRooms.filter(room => room.price >= parseFloat(minPrice));
        }

        if (maxPrice) {
            availableRooms = availableRooms.filter(room => room.price <= parseFloat(maxPrice));
        }

        res.json(availableRooms);
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

// Refresh dashboard data
exports.refreshDashboardData = async (req, res) => {
    try {
        // Get student profile
        const student = await User.findById(req.user._id);
        
        if (student.currentRoom && student.roomApprovalDate) {
            // Calculate validity period (4 months from approval date)
            const validUntil = new Date(student.roomApprovalDate);
            validUntil.setMonth(student.roomApprovalDate.getMonth() + 4);
            
            student.roomValidUntil = validUntil;
            await student.save();
        }

        // Get updated data
        const nextPayment = await Payment.findOne({
            student: req.user._id,
            status: 'Pending'
        })
        .sort({ date: 1 })
        .lean();

        const activeMaintenanceCount = await Maintenance.countDocuments({
            student: req.user._id,
            status: { $in: ['pending', 'in-progress'] }
        });

        const unreadMessagesCount = await Message.countDocuments({
            recipient: req.user._id,
            read: false
        });

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
                    validUntil: student.roomValidUntil,
                    approvalDate: student.roomApprovalDate
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
        console.error('Error in refreshDashboardData:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 