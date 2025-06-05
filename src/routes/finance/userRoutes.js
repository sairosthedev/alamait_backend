const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const User = require('../../models/User');

// Get list of admin users
router.get('/admins', auth, async (req, res) => {
    try {
        const adminUsers = await User.find({
            role: { $in: ['admin', 'finance', 'property_manager'] }
        })
        .select('firstName lastName role')
        .sort('firstName');
        
        res.json(adminUsers);
    } catch (error) {
        console.error('Error fetching admin users:', error);
        res.status(500).json({ error: 'Error fetching admin users' });
    }
});

module.exports = router; 