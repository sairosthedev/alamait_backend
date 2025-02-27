const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const {
    getAdminProfile,
    updateAdminProfile,
    changePassword
} = require('../../controllers/admin/profileController');

// Get admin profile
router.get('/', auth, checkRole('admin'), getAdminProfile);

// Update admin profile
router.put('/', [
    auth,
    checkRole('admin'),
    check('firstName', 'First name is required').optional().notEmpty(),
    check('lastName', 'Last name is required').optional().notEmpty(),
    check('phone', 'Please include a valid phone number').optional().notEmpty(),
    check('department', 'Department is required').optional().notEmpty(),
    check('office', 'Office location is required').optional().notEmpty(),
], updateAdminProfile);

// Change password
router.put('/change-password', [
    auth,
    checkRole('admin'),
    check('currentPassword', 'Current password is required').notEmpty(),
    check('newPassword', 'Please enter a password with 8 or more characters').isLength({ min: 8 }),
], changePassword);

module.exports = router; 