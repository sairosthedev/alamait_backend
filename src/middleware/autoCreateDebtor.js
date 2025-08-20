const { createDebtorForStudent } = require('../services/debtorService');

/**
 * Middleware to automatically create debtor accounts for students
 * This ensures that when role is student, they are automatically debtors
 * so they can be fetched in the debtors collection in frontend
 * 
 * NOTE: Debtors are now only created from approved applications, not automatically
 * when students are created. This middleware is kept for backward compatibility
 * but the automatic creation is disabled.
 */

const autoCreateDebtor = async (req, res, next) => {
    try {
        // Only proceed if this is a student creation/update
        if (req.body.role !== 'student' && req.user?.role !== 'student') {
            return next();
        }

        // DISABLED: Automatic debtor creation when students are created
        // Debtors should only be created from approved applications
        // This prevents creating debtors without proper financial data
        
        // If this is a new student being created
        if (req.method === 'POST' && req.body.role === 'student') {
            // Store the original response.json method
            const originalJson = res.json;
            
            // Override res.json to intercept the response
            res.json = function(data) {
                // DISABLED: Don't create debtor automatically
                // Debtors will be created when applications are approved
                if (data.user && data.user._id && data.user.role === 'student') {
                    console.log(`ℹ️  Student created: ${data.user.email} - Debtor will be created when application is approved`);
                }
                
                // Call the original json method
                return originalJson.call(this, data);
            };
        }

        // If this is an existing student being updated to have role 'student'
        if (req.method === 'PUT' || req.method === 'PATCH') {
            const userId = req.params.id || req.body._id;
            if (userId && req.body.role === 'student') {
                // DISABLED: Don't create debtor automatically
                // Check if debtor already exists
                const Debtor = require('../models/Debtor');
                const existingDebtor = await Debtor.findOne({ user: userId });
                
                if (!existingDebtor) {
                    console.log(`ℹ️  Student role updated: ${userId} - Debtor will be created when application is approved`);
                } else {
                    console.log(`✅ Debtor already exists for student: ${userId}`);
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