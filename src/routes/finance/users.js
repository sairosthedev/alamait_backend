const express = require('express');
const router = express.Router();
const { auth, checkAdminOrFinance } = require('../../middleware/auth');
const User = require('../../models/User');

// GET /api/finance/users - return all users (finance or admin only)
router.get('/', auth, checkAdminOrFinance, async (req, res) => {
  try {
    const users = await User.find({}, 'firstName lastName email _id');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

module.exports = router; 