const User = require('../../models/User');
const Residence = require('../../models/Residence');
const Payment = require('../../models/Payment');
const Maintenance = require('../../models/Maintenance');
const Message = require('../../models/Message');
const Application = require('../../models/Application');

// Get student dashboard data
exports.getDashboardData = async (req, res) => {
    try {
        console.log('Getting dashboard data for user:', {
            userId: req.user._id,
            role: req.user.role,
            email: req.user.email
        });

        // Get student profile and application
        const student = await User.findById(req.user._id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const application = await Application.findOne({ 
            email: student.email,
            status: { $in: ['approved', 'pending'] }
        }).sort({ createdAt: -1 });

        console.log('Student data from DB:', {
            id: student._id,
            email: student.email,
            application: application
        });

        // Get payment status and details
        let paymentInfo = {
            amount: 0,
            status: 'none',
            dueDate: null
        };

        if (application) {
            const currentDate = new Date();
            const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            
            if (application.paymentStatus === 'paid') {
                // If payment is already paid, show as paid
                paymentInfo = {
                    amount: 0,
                    status: 'paid',
                    dueDate: null,
                    paidDate: application.updatedAt,
                    nextPaymentDate: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
                };
            } else {
                // If payment is not paid, check if we're past the 1st of the month
                if (currentDate > firstDayOfMonth) {
                    // Payment is due
                    paymentInfo = {
                        amount: application.roomPrice || 0,
                        status: 'due',
                        dueDate: firstDayOfMonth,
                        lastPaymentDate: null
                    };
                } else {
                    // Payment is not due yet
                    paymentInfo = {
                        amount: application.roomPrice || 0,
                        status: 'pending',
                        dueDate: firstDayOfMonth,
                        lastPaymentDate: null
                    };
                }
            }
        }

        // Get active maintenance requests
        const activeMaintenanceCount = await Maintenance.countDocuments({
            student: req.user._id,
            status: { $in: ['pending', 'in-progress'] }
        });

        // Get unread messages count
        const unreadMessagesCount = await Message.countDocuments({
            recipients: req.user._id,
            readBy: { 
                $not: { 
                    $elemMatch: { 
                        user: req.user._id 
                    } 
                } 
            }
        });

        // Get latest message
        const latestMessage = await Message.findOne({
            recipients: req.user._id
        })
        .sort({ createdAt: -1 })
        .populate('author', 'firstName lastName role')
        .lean();

        // Format dashboard data
        const dashboardData = {
            profile: {
                name: `${student.firstName} ${student.lastName}`,
                id: student.studentId || application?.applicationCode,
                email: student.email,
                program: student.program,
                year: student.year,
                image: student.profileImage
            },
            cards: {
                payment: paymentInfo,
                room: {
                    status: application ? (application.allocatedRoom ? 'Allocated' : 'Pending') : 'None',
                    roomNumber: application?.allocatedRoom || application?.preferredRoom || 'None',
                    applicationStatus: application?.status || 'none'
                },
                maintenance: {
                    activeCount: activeMaintenanceCount,
                    status: activeMaintenanceCount > 0 ? 'In Progress' : 'No Active Requests'
                },
                messages: {
                    unreadCount: unreadMessagesCount,
                    latestMessage: latestMessage ? {
                        id: latestMessage._id,
                        title: latestMessage.title,
                        content: latestMessage.content,
                        author: latestMessage.author,
                        createdAt: latestMessage.createdAt
                    } : null
                }
            }
        };

        console.log('Sending dashboard data:', {
            profile: dashboardData.profile,
            cards: {
                payment: dashboardData.cards.payment.status,
                room: dashboardData.cards.room.status,
                maintenance: dashboardData.cards.maintenance.activeCount,
                messages: dashboardData.cards.messages.unreadCount
            }
        });

        res.json(dashboardData);
    } catch (error) {
        console.error('Error in getDashboardData:', error);
        res.status(500).json({ 
            error: 'Server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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