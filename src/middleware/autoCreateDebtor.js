const { createDebtorForStudent } = require('../services/debtorService');

/**
 * Middleware to automatically create debtor accounts for students
 * This ensures that when role is student, they are automatically debtors
 * so they can be fetched in the debtors collection in frontend
 */

const autoCreateDebtor = async (req, res, next) => {
    try {
        // Only proceed if this is a student creation/update
        if (req.body.role !== 'student' && req.user?.role !== 'student') {
            return next();
        }

        // If this is a new student being created
        if (req.method === 'POST' && req.body.role === 'student') {
            // Store the original response.json method
            const originalJson = res.json;
            
            // Override res.json to intercept the response
            res.json = function(data) {
                // If student was created successfully, create debtor account
                if (data.user && data.user._id && data.user.role === 'student') {
                    createDebtorForStudent(data.user, {
                        createdBy: data.user._id
                    }).then(() => {
                        console.log(`✅ Auto-created debtor account for student: ${data.user.email}`);
                    }).catch((error) => {
                        console.error(`❌ Failed to auto-create debtor account for student: ${data.user.email}`, error);
                    });
                }
                
                // Call the original json method
                return originalJson.call(this, data);
            };
        }

        // If this is an existing student being updated to have role 'student'
        if (req.method === 'PUT' || req.method === 'PATCH') {
            const userId = req.params.id || req.body._id;
            if (userId && req.body.role === 'student') {
                // Check if debtor already exists
                const Debtor = require('../models/Debtor');
                const existingDebtor = await Debtor.findOne({ user: userId });
                
                if (!existingDebtor) {
                    // Get user details
                    const User = require('../models/User');
                    const user = await User.findById(userId);
                    
                    if (user) {
                        createDebtorForStudent(user, {
                            createdBy: req.user?._id || 'system'
                        }).then(() => {
                            console.log(`✅ Auto-created debtor account for existing student: ${user.email}`);
                        }).catch((error) => {
                            console.error(`❌ Failed to auto-create debtor account for existing student: ${user.email}`, error);
                        });
                    }
                }
            }
        }

        next();
    } catch (error) {
        console.error('Error in autoCreateDebtor middleware:', error);
        // Don't block the request if debtor creation fails
        next();
    }
};

module.exports = autoCreateDebtor; 