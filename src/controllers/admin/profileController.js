const { validationResult } = require('express-validator');
const User = require('../../models/User');
const bcrypt = require('bcryptjs');

// Get admin profile
exports.getAdminProfile = async (req, res) => {
    try {
        const admin = await User.findById(req.user._id)
            .select('-password');

        if (!admin || admin.role !== 'admin') {
            return res.status(404).json({ error: 'Admin not found' });
        }

        res.json(admin);
    } catch (error) {
        console.error('Error in getAdminProfile:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update admin profile
exports.updateAdminProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            firstName,
            lastName,
            phone,
            department,
            office
        } = req.body;

        const admin = await User.findById(req.user._id);

        if (!admin || admin.role !== 'admin') {
            return res.status(404).json({ error: 'Admin not found' });
        }

        // Update fields if provided
        if (firstName) admin.firstName = firstName;
        if (lastName) admin.lastName = lastName;
        if (phone) admin.phone = phone;
        if (department) admin.department = department;
        if (office) admin.office = office;

        await admin.save();

        // Return updated admin without password
        const updatedAdmin = await User.findById(admin._id).select('-password');
        res.json(updatedAdmin);
    } catch (error) {
        console.error('Error in updateAdminProfile:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Change admin password
exports.changePassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { currentPassword, newPassword } = req.body;

        const admin = await User.findById(req.user._id);
        if (!admin || admin.role !== 'admin') {
            return res.status(404).json({ error: 'Admin not found' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, admin.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        admin.password = await bcrypt.hash(newPassword, salt);
        await admin.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error in changePassword:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 