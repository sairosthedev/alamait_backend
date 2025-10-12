const User = require('../models/User');
const Application = require('../models/Application');
const Lease = require('../models/Lease');
const ExpiredStudent = require('../models/ExpiredStudent');

/**
 * 🎯 STUDENT STATUS MANAGER
 * Ensures student status is always correct based on lease dates and application status
 */
class StudentStatusManager {
    
    /**
     * Update student status based on lease and application data
     * @param {string} studentId - Student ID
     * @param {Object} options - Options for status update
     * @returns {Object} Status update result
     */
    static async updateStudentStatus(studentId, options = {}) {
        try {
            console.log(`🔄 Updating status for student: ${studentId}`);
            
            const student = await User.findById(studentId);
            if (!student) {
                throw new Error('Student not found');
            }
            
            // Get student's applications and leases
            const applications = await Application.find({ 
                $or: [
                    { student: studentId },
                    { email: student.email }
                ]
            });
            
            const leases = await Lease.find({ studentId: studentId });
            
            // Determine correct status
            const statusResult = await this.determineStudentStatus(student, applications, leases);
            
            // Update student status if it has changed
            if (student.status !== statusResult.status) {
                const oldStatus = student.status;
                student.status = statusResult.status;
                student.statusUpdatedAt = new Date();
                student.statusUpdateReason = statusResult.reason;
                
                await student.save();
                
                console.log(`✅ Student status updated: ${student.email}`);
                console.log(`   Old Status: ${oldStatus}`);
                console.log(`   New Status: ${statusResult.status}`);
                console.log(`   Reason: ${statusResult.reason}`);
                
                return {
                    success: true,
                    studentId: studentId,
                    studentEmail: student.email,
                    oldStatus: oldStatus,
                    newStatus: statusResult.status,
                    reason: statusResult.reason,
                    updated: true
                };
            } else {
                console.log(`ℹ️ Student status already correct: ${student.email} (${statusResult.status})`);
                return {
                    success: true,
                    studentId: studentId,
                    studentEmail: student.email,
                    status: statusResult.status,
                    reason: statusResult.reason,
                    updated: false
                };
            }
            
        } catch (error) {
            console.error(`❌ Error updating student status: ${error.message}`);
            return {
                success: false,
                studentId: studentId,
                error: error.message
            };
        }
    }
    
    /**
     * Determine the correct status for a student based on their data
     * @param {Object} student - Student object
     * @param {Array} applications - Student's applications
     * @param {Array} leases - Student's leases
     * @returns {Object} Status determination result
     */
    static async determineStudentStatus(student, applications, leases) {
        const now = new Date();
        
        // First, update any applications that should be expired based on end date
        for (const application of applications) {
            if (application.status === 'approved' && 
                application.endDate && 
                new Date(application.endDate) <= now) {
                console.log(`🔄 Updating expired application: ${application.applicationCode}`);
                application.status = 'expired';
                application.rejectionReason = 'Lease end date reached';
                application.actionDate = new Date();
                await application.save();
            }
        }
        
        // Check if student has any active applications (after updating expired ones)
        const activeApplication = applications.find(app => 
            app.status === 'approved' && 
            (!app.endDate || new Date(app.endDate) > now)
        );
        
        // Check if student has any active leases
        const activeLease = leases.find(lease => 
            new Date(lease.endDate) > now
        );
        
        // Check if application has valid lease period (use application endDate, not roomValidUntil)
        const applicationValid = activeApplication && 
            activeApplication.endDate && 
            new Date(activeApplication.endDate) > now;
        
        // Status determination logic
        if (activeLease && applicationValid) {
            return {
                status: 'active',
                reason: 'Active lease with valid application period'
            };
        } else if (applicationValid) {
            return {
                status: 'active',
                reason: 'Approved application with valid lease period'
            };
        } else if (activeApplication && !applicationValid) {
            return {
                status: 'expired',
                reason: 'Approved application but lease period expired'
            };
        } else if (leases.length > 0 && !activeLease) {
            return {
                status: 'expired',
                reason: 'All leases have expired'
            };
        } else if (applications.length > 0) {
            const latestApp = applications.sort((a, b) => new Date(b.applicationDate) - new Date(a.applicationDate))[0];
            return {
                status: latestApp.status === 'pending' ? 'pending' : 'inactive',
                reason: `Latest application status: ${latestApp.status}`
            };
        } else {
            return {
                status: 'inactive',
                reason: 'No applications or leases found'
            };
        }
    }
    
    /**
     * Update status for all students (bulk operation)
     * @param {Object} options - Options for bulk update
     * @returns {Object} Bulk update result
     */
    static async updateAllStudentStatuses(options = {}) {
        try {
            console.log('🔄 Starting bulk student status update...');
            
            const students = await User.find({ role: 'student' });
            const results = {
                total: students.length,
                updated: 0,
                unchanged: 0,
                errors: 0,
                details: []
            };
            
            for (const student of students) {
                try {
                    const result = await this.updateStudentStatus(student._id, options);
                    results.details.push(result);
                    
                    if (result.success) {
                        if (result.updated) {
                            results.updated++;
                        } else {
                            results.unchanged++;
                        }
                    } else {
                        results.errors++;
                    }
                } catch (error) {
                    console.error(`❌ Error updating student ${student.email}: ${error.message}`);
                    results.errors++;
                    results.details.push({
                        success: false,
                        studentId: student._id,
                        studentEmail: student.email,
                        error: error.message
                    });
                }
            }
            
            console.log(`✅ Bulk status update completed:`);
            console.log(`   Total Students: ${results.total}`);
            console.log(`   Updated: ${results.updated}`);
            console.log(`   Unchanged: ${results.unchanged}`);
            console.log(`   Errors: ${results.errors}`);
            
            return results;
            
        } catch (error) {
            console.error(`❌ Error in bulk status update: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Find and handle expired students
     * @param {Object} options - Options for expiry handling
     * @returns {Object} Expiry handling result
     */
    static async handleExpiredStudents(options = {}) {
        try {
            console.log('🔍 Finding expired students...');
            
            const now = new Date();
            
            // Find students with expired room validity or expired leases
            const expiredStudents = await User.find({
                role: 'student',
                $or: [
                    { roomValidUntil: { $lt: now } },
                    { status: 'active' } // Check all active students
                ]
            });
            
            const results = {
                total: expiredStudents.length,
                processed: 0,
                archived: 0,
                errors: 0,
                details: []
            };
            
            for (const student of expiredStudents) {
                try {
                    // Get student's applications and leases
                    const applications = await Application.find({ 
                        $or: [
                            { student: student._id },
                            { email: student.email }
                        ]
                    });
                    
                    const leases = await Lease.find({ studentId: student._id });
                    
                    // Check if student is actually expired
                    const statusResult = await this.determineStudentStatus(student, applications, leases);
                    
                    if (statusResult.status === 'expired') {
                        // Archive expired student
                        const archiveResult = await this.archiveExpiredStudent(student, applications, leases);
                        results.details.push(archiveResult);
                        
                        if (archiveResult.success) {
                            results.archived++;
                        } else {
                            results.errors++;
                        }
                    } else {
                        // Just update status
                        const statusResult = await this.updateStudentStatus(student._id);
                        results.details.push(statusResult);
                        
                        if (statusResult.success) {
                            results.processed++;
                        } else {
                            results.errors++;
                        }
                    }
                    
                } catch (error) {
                    console.error(`❌ Error processing student ${student.email}: ${error.message}`);
                    results.errors++;
                    results.details.push({
                        success: false,
                        studentId: student._id,
                        studentEmail: student.email,
                        error: error.message
                    });
                }
            }
            
            console.log(`✅ Expired student handling completed:`);
            console.log(`   Total Checked: ${results.total}`);
            console.log(`   Processed: ${results.processed}`);
            console.log(`   Archived: ${results.archived}`);
            console.log(`   Errors: ${results.errors}`);
            
            return results;
            
        } catch (error) {
            console.error(`❌ Error handling expired students: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Archive an expired student
     * @param {Object} student - Student object
     * @param {Array} applications - Student's applications
     * @param {Array} leases - Student's leases
     * @returns {Object} Archive result
     */
    static async archiveExpiredStudent(student, applications, leases) {
        try {
            console.log(`📦 Archiving expired student: ${student.email}`);
            
            // Get student's payments
            const Payment = require('../models/Payment');
            const payments = await Payment.find({ student: student._id });
            
            // Create expired student record
            const expiredStudentData = new ExpiredStudent({
                student: student.toObject(),
                application: applications.length > 0 ? applications[0].toObject() : null,
                previousApplicationCode: student.applicationCode || (applications[0] && applications[0].applicationCode),
                archivedAt: new Date(),
                reason: 'lease_expired',
                paymentHistory: payments.map(p => p.toObject()),
                leases: leases.map(l => l.toObject()),
                archivedBy: 'system',
                archivedByEmail: 'system@alamait.com'
            });
            
            await expiredStudentData.save();
            
            // Update applications to expired
            for (const application of applications) {
                if (application.status === 'approved') {
                    application.status = 'expired';
                    application.rejectionReason = 'Lease end date reached';
                    application.actionDate = new Date();
                    await application.save();
                }
            }
            
            // Handle room availability
            if (student.currentRoom && student.residence) {
                const { Residence } = require('../models/Residence');
                const residence = await Residence.findById(student.residence);
                if (residence) {
                    const room = residence.rooms.find(r => r.roomNumber === student.currentRoom);
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
            
            // Delete student from active users
            await User.findByIdAndDelete(student._id);
            
            console.log(`✅ Student archived successfully: ${student.email}`);
            
            return {
                success: true,
                studentId: student._id,
                studentEmail: student.email,
                action: 'archived',
                expiredStudentId: expiredStudentData._id
            };
            
        } catch (error) {
            console.error(`❌ Error archiving student: ${error.message}`);
            return {
                success: false,
                studentId: student._id,
                studentEmail: student.email,
                error: error.message
            };
        }
    }
    
    /**
     * Get student status summary
     * @returns {Object} Status summary
     */
    static async getStatusSummary() {
        try {
            const students = await User.find({ role: 'student' });
            
            const summary = {
                total: students.length,
                active: 0,
                pending: 0,
                inactive: 0,
                expired: 0,
                byStatus: {}
            };
            
            for (const student of students) {
                const status = student.status || 'unknown';
                summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
                
                switch (status) {
                    case 'active':
                        summary.active++;
                        break;
                    case 'pending':
                        summary.pending++;
                        break;
                    case 'inactive':
                        summary.inactive++;
                        break;
                    case 'expired':
                        summary.expired++;
                        break;
                }
            }
            
            return summary;
            
        } catch (error) {
            console.error(`❌ Error getting status summary: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = StudentStatusManager;
