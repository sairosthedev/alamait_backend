const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getUserStats,
    createUser
} = require('../../controllers/admin/userController');

// Validation middleware
const userUpdateValidation = [
    check('email', 'Please include a valid email').optional().isEmail(),
    check('role').optional().isIn(['student', 'admin', 'property_manager']),
    check('isVerified').optional().isBoolean()
];

const createUserValidation = [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('firstName', 'First name is required').notEmpty(),
    check('lastName', 'Last name is required').notEmpty(),
    check('phone', 'Phone number is required').notEmpty(),
    check('role', 'Role is required').isIn(['admin', 'ceo', 'finance_admin', 'finance_user'])
];

// All routes require admin role (CEO can view but not create users)
router.use(auth);
router.use(checkRole('admin', 'ceo'));

// Routes
router.get('/', getAllUsers);
router.get('/stats', getUserStats);
router.post('/', createUserValidation, checkRole('admin'), createUser); // Only admin can create users
router.get('/:id', getUserById);
router.patch('/:id', userUpdateValidation, checkRole('admin'), updateUser); // Only admin can update users
router.delete('/:id', checkRole('admin'), deleteUser); // Only admin can delete users

module.exports = router; 