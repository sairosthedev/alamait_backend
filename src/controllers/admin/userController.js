const User = require('../../models/User');
const { validationResult } = require('express-validator');

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: 'Error fetching users' });
    }
};

// Get user by ID
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Error fetching user' });
    }
};

// Update user
exports.updateUser = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { role, isVerified, ...updateData } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { 
                ...updateData,
                role,
                isVerified
            },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Error updating user' });
    }
};

// Delete user
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Decrement room occupancy if user has a currentRoom and residence
        if (user.currentRoom && user.residence) {
            const Residence = require('../../models/Residence');
            const residence = await Residence.findById(user.residence);
            if (residence) {
                const room = residence.rooms.find(r => r.roomNumber === user.currentRoom);
                if (room) {
                    room.currentOccupancy = Math.max(0, (room.currentOccupancy || 1) - 1);
                    // Update room status based on new occupancy
                    if (room.currentOccupancy === 0) {
                        room.status = 'available';
                    } else if (room.currentOccupancy < room.capacity) {
                        room.status = 'reserved';
                    } else {
                        room.status = 'occupied';
                    }
                    // Remove user from occupants array if present
                    if (room.occupants) {
                        room.occupants = room.occupants.filter(occ => occ.toString() !== user._id.toString());
                    }
                    await residence.save();
                }
            }
        }

        await user.remove();
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Error deleting user' });
    }
};

// Get user statistics
exports.getUserStats = async (req, res) => {
    try {
        const stats = await User.aggregate([
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]);

        const verifiedStats = await User.aggregate([
            {
                $group: {
                    _id: '$isVerified',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            roleStats: stats,
            verificationStats: verifiedStats
        });
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({ error: 'Error fetching user statistics' });
    }
}; 