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