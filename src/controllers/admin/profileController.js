const { validationResult } = require('express-validator');
const User = require('../../models/User');
const Profile = require('../../models/Profile');
const bcrypt = require('bcryptjs');
const { s3, s3Configs } = require('../../config/s3');

// Get admin profile
exports.getAdminProfile = async (req, res) => {
    try {
        // Validate user role (admin, CEO, or finance roles)
        const allowedRoles = ['admin', 'ceo', 'finance_admin', 'finance_user'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied. Only admin, CEO, and finance roles can access this profile' });
        }

        const user = await User.findById(req.user._id)
            .select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get profile picture if available
        const profile = await Profile.findOne({ userId: req.user._id });
        const userObj = user.toObject();
        
        if (profile && profile.profilePicture) {
            userObj.profilePicture = {
                url: profile.profilePicture.url,
                fileName: profile.profilePicture.fileName,
                uploadedAt: profile.profilePicture.uploadedAt
            };
        }

        res.json(userObj);
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
        // Validate user role (admin, CEO, or finance roles)
        const allowedRoles = ['admin', 'ceo', 'finance_admin', 'finance_user'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied. Only admin, CEO, and finance roles can update profile' });
        }

        const {
            firstName,
            lastName,
            phone,
            department,
            office,
            bio
        } = req.body;

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update fields if provided
        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (phone !== undefined) user.phone = phone;
        if (department !== undefined) user.department = department;
        if (office !== undefined) user.office = office;
        if (bio !== undefined) user.bio = bio;

        await user.save();

        // Get profile picture if available
        const profile = await Profile.findOne({ userId: req.user._id });
        const userObj = user.toObject();
        
        if (profile && profile.profilePicture) {
            userObj.profilePicture = {
                url: profile.profilePicture.url,
                fileName: profile.profilePicture.fileName,
                uploadedAt: profile.profilePicture.uploadedAt
            };
        }

        // Return updated user without password
        delete userObj.password;
        res.json(userObj);
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
        // Validate user role (admin, CEO, or finance roles)
        const allowedRoles = ['admin', 'ceo', 'finance_admin', 'finance_user'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied. Only admin, CEO, and finance roles can change password' });
        }

        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error in changePassword:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Upload profile picture
exports.uploadProfilePicture = async (req, res) => {
    try {
        console.log('=== Profile Picture Upload ===');
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided'
            });
        }

        // Validate user role (admin, CEO, or finance roles)
        const allowedRoles = ['admin', 'ceo', 'finance_admin', 'finance_user'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only admin, CEO, and finance roles can upload profile pictures'
            });
        }

        console.log('Profile picture file received:', {
            userId: req.user._id,
            role: req.user.role,
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        // Generate S3 key for profile pictures
        const timestamp = Date.now();
        const userId = req.user._id.toString();
        const s3Key = `profile-pictures/${userId}_${timestamp}_${req.file.originalname}`;

        // Upload to S3
        const s3UploadParams = {
            Bucket: s3Configs.general.bucket,
            Key: s3Key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ACL: 'public-read', // Make profile pictures publicly accessible
            Metadata: {
                fieldName: req.file.fieldname,
                uploadedBy: userId,
                uploadDate: new Date().toISOString(),
                uploadType: 'profile_picture',
                userRole: req.user.role
            }
        };

        const s3Result = await s3.upload(s3UploadParams).promise();
        console.log('Profile picture uploaded successfully to S3:', s3Result.Location);

        // Prepare profile picture data
        const profilePictureData = {
            url: s3Result.Location,
            fileName: req.file.originalname,
            s3Key: s3Key,
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploadedAt: new Date(),
            uploadedBy: req.user._id
        };

        // Find or create profile document
        let profile = await Profile.findOne({ userId: req.user._id });

        if (profile) {
            // If old profile picture exists, delete it from S3
            if (profile.profilePicture && profile.profilePicture.s3Key) {
                try {
                    await s3.deleteObject({
                        Bucket: s3Configs.general.bucket,
                        Key: profile.profilePicture.s3Key
                    }).promise();
                    console.log('Old profile picture deleted from S3');
                } catch (deleteError) {
                    console.error('Error deleting old profile picture from S3:', deleteError);
                    // Continue even if deletion fails
                }
            }
            // Update existing profile
            profile.profilePicture = profilePictureData;
            profile.role = req.user.role;
            profile.updatedAt = new Date();
            await profile.save();
        } else {
            // Create new profile document
            profile = new Profile({
                userId: req.user._id,
                role: req.user.role,
                profilePicture: profilePictureData
            });
            await profile.save();
        }

        console.log('Profile picture saved to database:', profile._id);

        res.json({
            success: true,
            message: 'Profile picture uploaded successfully',
            data: {
                profileId: profile._id,
                profilePicture: {
                    url: profilePictureData.url,
                    fileName: profilePictureData.fileName,
                    uploadedAt: profilePictureData.uploadedAt
                }
            }
        });

    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading profile picture',
            error: error.message
        });
    }
}; 