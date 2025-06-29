const User = require('../models/User');
const Application = require('../models/Application');
const { sendEmail } = require('./email');
const Residence = require('../models/Residence');
const ExpiredStudent = require('../models/ExpiredStudent');

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
        // Find all unpaid applications approved more than 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const expiredApplications = await Application.find({
            paymentStatus: 'unpaid',
            status: 'approved',
            actionDate: { $lt: sevenDaysAgo }
        }).populate('student');

        for (const application of expiredApplications) {
            try {
                // Archive before deleting
                if (application.student) {
                    await ExpiredStudent.create({
                        student: application.student,
                        application: application.toObject(),
                        previousApplicationCode: application.applicationCode,
                        archivedAt: new Date(),
                        reason: 'revoked'
                    });
                }
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

        // NEW: Delete students whose application endDate is before today
        const today = new Date();
        const endedApplications = await Application.find({
            endDate: { $lt: today },
            status: 'approved'
        }).populate('student');

        for (const application of endedApplications) {
            try {
                if (application.student) {
                    await ExpiredStudent.create({
                        student: application.student,
                        application: application.toObject(),
                        previousApplicationCode: application.applicationCode,
                        archivedAt: new Date(),
                        reason: 'lease_expired'
                    });
                    // Update room status in residence
                    if (application.residence && application.allocatedRoom) {
                        const residence = await Residence.findById(application.residence);
                        if (residence) {
                            const room = residence.rooms.find(r => r.roomNumber === application.allocatedRoom);
                            if (room) {
                                room.currentOccupancy = Math.max(0, (room.currentOccupancy || 1) - 1);
                                if (room.currentOccupancy === 0) {
                                    room.status = 'available';
                                } else if (room.currentOccupancy < room.capacity) {
                                    room.status = 'reserved';
                                } else {
                                    room.status = 'occupied';
                                }
                                await residence.save();
                            }
                        }
                    }
                    await User.findByIdAndDelete(application.student._id);
                }
                application.status = 'expired';
                application.rejectionReason = 'Lease end date reached';
                await application.save();
                console.log(`Deleted student for expired lease: ${application.email}`);
            } catch (error) {
                console.error(`Error processing ended application ${application.applicationCode}:`, error);
            }
        }
    } catch (error) {
        console.error('Error handling expired applications:', error);
    }
};

// Send warning emails 24 hours before expiry
const sendExpiryWarnings = async () => {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Applications expiring in 24h
    const expiringApps = await Application.find({
        status: 'approved',
        endDate: { $gte: now, $lte: in24h }
    }).populate('student');

    for (const app of expiringApps) {
        if (app.student) {
            await sendEmail({
                to: app.email,
                subject: 'Your Lease Will Expire Soon',
                text: `Dear ${app.firstName},\n\nYour lease will expire in 24 hours. You will be logged out and need to reapply. If you wish to renew, please do so before expiry.\n\nBest regards,\nAlamait Team`
            });
        }
    }

    // Unpaid applications expiring in 24h
    const unpaidApps = await Application.find({
        status: 'approved',
        paymentStatus: 'unpaid',
        actionDate: { $lte: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
    }).populate('student');

    for (const app of unpaidApps) {
        if (app.student) {
            await sendEmail({
                to: app.email,
                subject: 'Your Application Will Expire Soon',
                text: `Dear ${app.firstName},\n\nYour application will expire in 24 hours due to non-payment. You will be logged out and need to reapply. If you wish to keep your spot, please pay before expiry.\n\nBest regards,\nAlamait Team`
            });
        }
    }
};

module.exports = {
    handleExpiredApplications,
    sendExpiryWarnings
}; 