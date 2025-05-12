const User = require('../models/User');
const Application = require('../models/Application');
const { sendEmail } = require('./email');

/**
 * Check and handle expired unpaid applications
 * This function will:
 * 1. Find all applications that are unpaid for more than 7 days
 * 2. Revoke them
 * 3. Send notification emails
 * 4. Delete associated user accounts
 */
const handleExpiredApplications = async () => {
    try {
        // Calculate the date 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Find all unpaid applications older than 7 days
        const expiredApplications = await Application.find({
            paymentStatus: 'unpaid',
            createdAt: { $lt: sevenDaysAgo },
            status: { $in: ['approved', 'waitlisted'] }
        }).populate('student');

        for (const application of expiredApplications) {
            try {
                // Send revocation email
                await sendEmail({
                    to: application.email,
                    subject: 'Application Revoked - Alamait Student Accommodation',
                    text: `
                        Dear ${application.firstName} ${application.lastName},

                        Your application for accommodation has been automatically revoked due to non-payment within the 7-day period.
                        
                        Application Details:
                        - Application Code: ${application.applicationCode}
                        - Room: ${application.allocatedRoom || application.waitlistedRoom}
                        - Application Date: ${application.createdAt.toLocaleDateString()}

                        If you wish to reapply, please submit a new application through our platform.

                        Best regards,
                        Alamait Student Accommodation Team
                    `
                });

                // Delete user account if it exists
                if (application.student) {
                    await User.findByIdAndDelete(application.student._id);
                }

                // Update application status
                application.status = 'rejected';
                application.rejectionReason = 'Payment not received within 7 days';
                await application.save();

                console.log(`Revoked application ${application.applicationCode} for ${application.email}`);
            } catch (error) {
                console.error(`Error processing expired application ${application.applicationCode}:`, error);
            }
        }
    } catch (error) {
        console.error('Error handling expired applications:', error);
    }
};

module.exports = {
    handleExpiredApplications
}; 