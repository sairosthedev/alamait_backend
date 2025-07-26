const express = require('express');
const router = express.Router();
const { auth, checkAdminOrFinance } = require('../../middleware/auth');
const User = require('../../models/User');

// GET /api/finance/users - return all users (finance or admin only)
router.get('/', auth, checkAdminOrFinance, async (req, res) => {
  try {
    console.log('\n=== BACKEND DEBUG: Finance Users Route Called ===');
    console.log('Query parameters:', req.query);
    
    const { page = 1, limit = 10, search, role, status } = req.query;
    const query = {};

    // Add filters
    if (role) {
      query.role = role;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    console.log('Database query:', JSON.stringify(query, null, 2));

    const skip = (page - 1) * limit;

    // First, let's check what's in the database
    console.log('\n=== BACKEND DEBUG: Checking database ===');
    const allUsersInDB = await User.find({}).select('email firstName lastName role').lean();
    console.log('All users in database:');
    allUsersInDB.forEach(user => {
      console.log(`  ${user.email}: ${user.role || 'NO ROLE'}`);
    });

    // Now get the actual users with the query
    console.log('\n=== BACKEND DEBUG: Raw users from database ===');
    const users = await User.find(query)
      .select('firstName lastName email role status createdAt isVerified phone applicationCode currentRoom roomValidUntil roomApprovalDate residence emergencyContact lastLogin')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    console.log(`Found ${users.length} users matching query`);
    
    // Check each user for role field
    users.forEach((user, index) => {
      console.log(`Raw user ${index + 1}:`, {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role || 'UNDEFINED',
        hasRoleField: 'role' in user,
        allFields: Object.keys(user)
      });
    });

    // Process users to ensure role field is present
    console.log('\n=== BACKEND DEBUG: Processing users ===');
    const processedUsers = users.map((user, index) => {
      const processedUser = {
        ...user,
        role: user.role || 'student' // Default fallback
      };
      
      console.log(`Processed user ${index + 1}:`, {
        _id: processedUser._id,
        email: processedUser.email,
        firstName: processedUser.firstName,
        lastName: processedUser.lastName,
        role: processedUser.role,
        hasRoleField: 'role' in processedUser
      });
      
      return processedUser;
    });

    const total = await User.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    console.log('\n=== BACKEND DEBUG: Final response ===');
    console.log(`Sending ${processedUsers.length} users to frontend`);
    console.log('Sample user in response:', processedUsers[0]);

    const response = {
      users: processedUsers,
      currentPage: parseInt(page),
      totalPages,
      total,
      limit: parseInt(limit)
    };

    console.log('Full response structure:', {
      usersCount: response.users.length,
      currentPage: response.currentPage,
      totalPages: response.totalPages,
      total: response.total
    });

    res.status(200).json(response);
    
    console.log('=== BACKEND DEBUG: Response sent successfully ===\n');
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 