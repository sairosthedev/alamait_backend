const SecurityDepositReversalService = require('../../services/securityDepositReversalService');

class SecurityDepositController {
    /**
     * Reverse unpaid security deposit when student leaves
     * POST /api/finance/security-deposits/reverse
     */
    static async reverseUnpaidDeposit(req, res) {
        try {
            const { studentId, studentName, reason } = req.body;
            const adminUser = req.user;

            // Validate required fields
            if (!studentId || !studentName) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID and name are required'
                });
            }

            console.log(`🔄 Processing security deposit reversal request for ${studentName} (${studentId})`);

            // Check current deposit status first
            const depositStatus = await SecurityDepositReversalService.getSecurityDepositStatus(studentId);
            
            console.log('📊 Current deposit status:', depositStatus);

            if (depositStatus.status === 'paid') {
                return res.status(400).json({
                    success: false,
                    message: 'Security deposit has already been paid. No reversal needed.',
                    depositStatus
                });
            }

            if (depositStatus.status === 'no_lease_start') {
                return res.status(400).json({
                    success: false,
                    message: 'No lease start transaction found for this student.',
                    depositStatus
                });
            }

            if (depositStatus.status === 'no_deposit_liability') {
                return res.status(400).json({
                    success: false,
                    message: 'No security deposit liability found for this student.',
                    depositStatus
                });
            }

            // Perform the reversal
            const reversalResult = await SecurityDepositReversalService.reverseUnpaidSecurityDeposit(
                studentId,
                studentName,
                adminUser,
                reason || 'Student left without paying deposit'
            );

            if (reversalResult.success) {
                res.json({
                    success: true,
                    message: 'Security deposit reversal completed successfully',
                    data: {
                        transactionId: reversalResult.transactionId,
                        studentId: reversalResult.studentId,
                        studentName: reversalResult.studentName,
                        reversalAmount: reversalResult.depositAmount,
                        reason: reason || 'Student left without paying deposit',
                        entries: reversalResult.entries
                    }
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Security deposit reversal failed',
                    errors: reversalResult.errors
                });
            }

        } catch (error) {
            console.error('❌ Error in security deposit reversal controller:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during security deposit reversal',
                error: error.message
            });
        }
    }

    /**
     * Get security deposit status for a student
     * GET /api/finance/security-deposits/status/:studentId
     */
    static async getDepositStatus(req, res) {
        try {
            const { studentId } = req.params;

            if (!studentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID is required'
                });
            }

            const depositStatus = await SecurityDepositReversalService.getSecurityDepositStatus(studentId);

            res.json({
                success: true,
                data: depositStatus
            });

        } catch (error) {
            console.error('❌ Error getting security deposit status:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while getting deposit status',
                error: error.message
            });
        }
    }

    /**
     * Get all students (including expired ones) for security deposit management
     * GET /api/finance/security-deposits/students
     */
    static async getAllStudents(req, res) {
        try {
            console.log('🔍 Getting all students for security deposit management');

            const students = await SecurityDepositReversalService.getAllStudentsForDepositManagement();

            res.json({
                success: true,
                data: {
                    students,
                    summary: {
                        total: students.length,
                        active: students.filter(s => s.studentInfo && !s.studentInfo.isExpired).length,
                        expired: students.filter(s => s.studentInfo && s.studentInfo.isExpired).length,
                        canReverse: students.filter(s => s.depositStatus.canReverse).length,
                        unpaid: students.filter(s => s.depositStatus.status === 'unpaid').length,
                        paid: students.filter(s => s.depositStatus.status === 'paid').length
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error getting all students for deposit management:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while getting students',
                error: error.message
            });
        }
    }
}

module.exports = SecurityDepositController;