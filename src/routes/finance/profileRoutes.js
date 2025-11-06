// src/routes/finance/profileRoutes.js
const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const multer = require('multer');
const { fileFilter, fileTypes } = require('../../config/s3');
const {
    getAdminProfile,
    updateAdminProfile,
    changePassword,
    uploadProfilePicture
} = require('../../controllers/admin/profileController');

// Configure multer for profile picture upload
const profilePictureUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: fileFilter(fileTypes.images),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB for profile pictures
        files: 1
    }
});

// Get finance profile (for finance roles)
router.get('/', auth, checkRole('finance_admin', 'finance_user', 'admin', 'ceo'), getAdminProfile);

// Update finance profile (for finance roles)
router.put('/', [
    auth,
    checkRole('finance_admin', 'finance_user', 'admin', 'ceo'),
    check('firstName', 'First name is required').optional().notEmpty(),
    check('lastName', 'Last name is required').optional().notEmpty(),
    check('phone', 'Please include a valid phone number').optional().notEmpty(),
    check('department', 'Department is required').optional().notEmpty(),
    check('office', 'Office location is required').optional().notEmpty(),
    check('bio', 'Bio must be less than 500 characters').optional().isLength({ max: 500 }),
], updateAdminProfile);

// Change password (for finance roles)
router.put('/change-password', [
    auth,
    checkRole('finance_admin', 'finance_user', 'admin', 'ceo'),
    check('currentPassword', 'Current password is required').notEmpty(),
    check('newPassword', 'Please enter a password with 8 or more characters').isLength({ min: 8 }),
], changePassword);

// Upload profile picture (for finance roles) - supports both POST and PUT
router.post('/picture', 
    auth, 
    checkRole('finance_admin', 'finance_user', 'admin', 'ceo'),
    (req, res, next) => {
        profilePictureUpload.single('profilePicture')(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        message: 'File too large. Maximum size is 5MB'
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: `Upload error: ${err.message}`
                });
            } else if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message || 'File upload error'
                });
            }
            next();
        });
    },
    uploadProfilePicture
);

router.put('/picture', 
    auth, 
    checkRole('finance_admin', 'finance_user', 'admin', 'ceo'),
    (req, res, next) => {
        profilePictureUpload.single('profilePicture')(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        message: 'File too large. Maximum size is 5MB'
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: `Upload error: ${err.message}`
                });
            } else if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message || 'File upload error'
                });
            }
            next();
        });
    },
    uploadProfilePicture
);

module.exports = router;

