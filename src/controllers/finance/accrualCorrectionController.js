const AccrualCorrectionService = require('../../services/accrualCorrectionService');

/**
 * Controller for correcting accruals when students leave early
 */
class AccrualCorrectionController {
    
    /**
     * Correct accruals for a student who left early
     * POST /api/finance/accrual-correction/correct
     */
    static async correctAccrualsForStudent(req, res) {
        try {
            const { studentId, actualLeaseEndDate, reason, updateLeaseEndDate } = req.body;
            const adminUser = req.user;
            
            if (!studentId || !actualLeaseEndDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID and actual lease end date are required'
                });
            }
            
            // Validate date
            const leaseEndDate = new Date(actualLeaseEndDate);
            if (isNaN(leaseEndDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format for actual lease end date'
                });
            }
            
            console.log(`🔧 Correcting accruals for student ${studentId} - actual lease end: ${leaseEndDate}`);
            
            const result = await AccrualCorrectionService.correctAccrualsForEarlyLeaseEnd(
                studentId,
                leaseEndDate,
                adminUser,
                reason || 'Student left early - lease ended before expected',
                updateLeaseEndDate !== false // Default to true
            );
            
            if (result.success) {
                res.status(200).json({
                    success: true,
                    message: result.message,
                    data: result
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: result.error || 'Failed to correct accruals',
                    data: result
                });
            }
            
        } catch (error) {
            console.error('❌ Error in accrual correction controller:', error);
            res.status(500).json({
                success: false,
                message: 'Error correcting accruals',
                error: error.message
            });
        }
    }
    
    /**
     * Find all students with potential incorrect accruals
     * GET /api/finance/accrual-correction/find-issues
     */
    static async findIncorrectAccruals(req, res) {
        try {
            const { year, month } = req.query;
            
            const result = await AccrualCorrectionService.findStudentsWithIncorrectAccruals(
                year ? parseInt(year) : null,
                month ? parseInt(month) : null
            );
            
            if (result.success) {
                res.status(200).json({
                    success: true,
                    message: `Found ${result.count} students with potential incorrect accruals`,
                    data: result
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: result.error || 'Failed to find incorrect accruals',
                    data: result
                });
            }
            
        } catch (error) {
            console.error('❌ Error finding incorrect accruals:', error);
            res.status(500).json({
                success: false,
                message: 'Error finding incorrect accruals',
                error: error.message
            });
        }
    }
}

module.exports = AccrualCorrectionController;

