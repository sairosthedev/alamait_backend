const StudentStatusManager = require('../../utils/studentStatusManager');
const { validationResult } = require('express-validator');

/**
 * 🎯 STUDENT STATUS CONTROLLER
 * Handles student status management and updates
 */
class StudentStatusController {
    
    /**
     * Update a specific student's status
     * PUT /api/admin/students/:studentId/status
     */
    static async updateStudentStatus(req, res) {
        try {
            const { studentId } = req.params;
            const { force } = req.query;
            
            console.log(`🔄 Updating status for student: ${studentId}`);
            
            const result = await StudentStatusManager.updateStudentStatus(studentId, {
                force: force === 'true'
            });
            
            if (result.success) {
                res.json({
                    success: true,
                    message: result.updated ? 'Student status updated successfully' : 'Student status already correct',
                    data: result
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Failed to update student status',
                    error: result.error
                });
            }
            
        } catch (error) {
            console.error('❌ Error updating student status:', error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: error.message
            });
        }
    }
    
    /**
     * Update all students' statuses (bulk operation)
     * POST /api/admin/students/status/bulk-update
     */
    static async bulkUpdateStudentStatuses(req, res) {
        try {
            console.log('🔄 Starting bulk student status update...');
            
            const result = await StudentStatusManager.updateAllStudentStatuses();
            
            res.json({
                success: true,
                message: 'Bulk status update completed',
                data: result
            });
            
        } catch (error) {
            console.error('❌ Error in bulk status update:', error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: error.message
            });
        }
    }
    
    /**
     * Handle expired students
     * POST /api/admin/students/status/handle-expired
     */
    static async handleExpiredStudents(req, res) {
        try {
            console.log('🔍 Handling expired students...');
            
            const result = await StudentStatusManager.handleExpiredStudents();
            
            res.json({
                success: true,
                message: 'Expired student handling completed',
                data: result
            });
            
        } catch (error) {
            console.error('❌ Error handling expired students:', error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: error.message
            });
        }
    }
    
    /**
     * Get student status summary
     * GET /api/admin/students/status/summary
     */
    static async getStatusSummary(req, res) {
        try {
            console.log('📊 Getting student status summary...');
            
            const summary = await StudentStatusManager.getStatusSummary();
            
            res.json({
                success: true,
                message: 'Status summary retrieved successfully',
                data: summary
            });
            
        } catch (error) {
            console.error('❌ Error getting status summary:', error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: error.message
            });
        }
    }
    
    /**
     * Fix student status for a specific student (like Luba)
     * POST /api/admin/students/:studentId/fix-status
     */
    static async fixStudentStatus(req, res) {
        try {
            const { studentId } = req.params;
            const { reason } = req.body;
            
            console.log(`🔧 Fixing status for student: ${studentId}`);
            console.log(`   Reason: ${reason || 'Manual status fix'}`);
            
            // First, update the student's status based on current data
            const updateResult = await StudentStatusManager.updateStudentStatus(studentId, {
                force: true,
                reason: reason || 'Manual status fix'
            });
            
            // If the student should be expired, handle the expiry
            if (updateResult.success && updateResult.newStatus === 'expired') {
                console.log(`📦 Student should be expired, handling expiry...`);
                
                const User = require('../../models/User');
                const Application = require('../../models/Application');
                const Lease = require('../../models/Lease');
                
                const student = await User.findById(studentId);
                if (student) {
                    const applications = await Application.find({ 
                        $or: [
                            { student: studentId },
                            { email: student.email }
                        ]
                    });
                    
                    const leases = await Lease.find({ studentId: studentId });
                    
                    const archiveResult = await StudentStatusManager.archiveExpiredStudent(student, applications, leases);
                    
                    res.json({
                        success: true,
                        message: 'Student status fixed and archived',
                        data: {
                            statusUpdate: updateResult,
                            archiveResult: archiveResult
                        }
                    });
                } else {
                    res.json({
                        success: true,
                        message: 'Student status fixed',
                        data: {
                            statusUpdate: updateResult,
                            note: 'Student not found in active users (may already be archived)'
                        }
                    });
                }
            } else {
                res.json({
                    success: true,
                    message: 'Student status fixed',
                    data: updateResult
                });
            }
            
        } catch (error) {
            console.error('❌ Error fixing student status:', error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: error.message
            });
        }
    }
}

module.exports = StudentStatusController;




