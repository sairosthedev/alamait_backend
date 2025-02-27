const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getUserStats
} = require('../../controllers/admin/userController');

// Validation middleware
const userUpdateValidation = [
    check('email', 'Please include a valid email').optional().isEmail(),
    check('role').optional().isIn(['student', 'admin', 'property_manager']),
    check('isVerified').optional().isBoolean()
];

// All routes require admin role
router.use(auth);
router.use(checkRole('admin'));

// Routes
router.get('/', getAllUsers);
router.get('/stats', getUserStats);
router.get('/:id', getUserById);
router.patch('/:id', userUpdateValidation, updateUser);
router.delete('/:id', deleteUser);

module.exports = router; 