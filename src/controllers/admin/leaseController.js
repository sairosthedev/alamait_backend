const Lease = require('../../models/Lease');
const { Residence } = require('../../models/Residence');
const { generateSignedUrl, getKeyFromUrl } = require('../../config/s3');
const LeaseUpdateService = require('../../services/leaseUpdateService');
const { validationResult } = require('express-validator');

// GET /api/admin/leases - fetch all leases from all students
exports.getAllLeases = async (req, res) => {
  try {
    // Find all leases and populate residence name
    const leases = await Lease.find({});
    // Collect all unique residence ObjectIds
    const residenceIds = [...new Set(leases.map(lease => lease.residence.toString()))];
    
    // Fetch all residences at once
    const residences = await Residence.find({ _id: { $in: residenceIds } });
    
    // Create a map for quick lookup
    const residenceMap = {};
    residences.forEach(residence => {
      residenceMap[residence._id.toString()] = residence.name;
    });
    
    // Add residence names to leases
    const leasesWithResidenceNames = leases.map(lease => ({
      ...lease.toObject(),
      residenceName: residenceMap[lease.residence.toString()] || 'Unknown Residence'
    }));
    
    res.status(200).json({
      success: true,
      data: leasesWithResidenceNames
    });
  } catch (error) {
    console.error('Error fetching leases:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leases',
      error: error.message
    });
  }
};

// GET /api/admin/leases/student/:studentId - fetch leases for a specific student
exports.getLeasesByStudentId = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Find leases for the specific student
    const leases = await Lease.find({ studentId });
    
    // Collect all unique residence ObjectIds
    const residenceIds = [...new Set(leases.map(lease => lease.residence.toString()))];
    
    // Fetch all residences at once
    const residences = await Residence.find({ _id: { $in: residenceIds } });
    
    // Create a map for quick lookup
    const residenceMap = {};
    residences.forEach(residence => {
      residenceMap[residence._id.toString()] = residence.name;
    });
    
    // Add residence names to leases
    const leasesWithResidenceNames = leases.map(lease => ({
      ...lease.toObject(),
      residenceName: residenceMap[lease.residence.toString()] || 'Unknown Residence'
    }));
    
    res.status(200).json({
      success: true,
      data: leasesWithResidenceNames
    });
  } catch (error) {
    console.error('Error fetching leases for student:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leases for student',
      error: error.message
    });
  }
};

/**
 * Update student lease dates and automatically update debtor record
 * @route PUT /api/admin/students/:studentId/lease
 * @access Private (Admin only)
 */
exports.updateStudentLeaseDates = async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        
        const { studentId } = req.params;
        const { startDate, endDate } = req.body;
        const updatedBy = req.user._id;
        
        console.log(`🔄 Admin ${req.user.email} updating lease dates for student: ${studentId}`);
        console.log(`   New start date: ${startDate}`);
        console.log(`   New end date: ${endDate}`);
        
        // Validate lease updates
        const validation = LeaseUpdateService.validateLeaseUpdates({ startDate, endDate });
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid lease date updates',
                errors: validation.errors
            });
        }
        
        // Update lease dates
        const result = await LeaseUpdateService.updateStudentLeaseDates(
            studentId,
            { startDate, endDate },
            updatedBy
        );
        
        res.status(200).json({
            success: true,
            message: 'Student lease dates updated successfully',
            data: result
        });
        
    } catch (error) {
        console.error('❌ Error updating student lease dates:', error);
        
        res.status(500).json({
            success: false,
            message: 'Error updating student lease dates',
            error: error.message
        });
    }
};

/**
 * Get student lease information
 * @route GET /api/admin/students/:studentId/lease
 * @access Private (Admin only)
 */
exports.getStudentLeaseInfo = async (req, res) => {
    try {
        const { studentId } = req.params;
        
        console.log(`🔍 Admin ${req.user.email} getting lease info for student: ${studentId}`);
        
        const leaseInfo = await LeaseUpdateService.getStudentLeaseInfo(studentId);
        
        res.status(200).json({
            success: true,
            message: 'Student lease information retrieved successfully',
            data: leaseInfo
        });
        
    } catch (error) {
        console.error('❌ Error getting student lease info:', error);
        
        res.status(500).json({
            success: false,
            message: 'Error getting student lease information',
            error: error.message
        });
    }
};

/**
 * Bulk update lease dates for multiple students
 * @route PUT /api/admin/students/lease/bulk
 * @access Private (Admin only)
 */
exports.bulkUpdateLeaseDates = async (req, res) => {
    try {
        const { updates } = req.body; // Array of { studentId, startDate, endDate }
        const updatedBy = req.user._id;
        
        console.log(`🔄 Admin ${req.user.email} bulk updating lease dates for ${updates.length} students`);
        
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Updates array is required and cannot be empty'
            });
        }
        
        const results = [];
        const errors = [];
        
        // Process each update
        for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            const { studentId, startDate, endDate } = update;
            
            try {
                // Validate each update
                const validation = LeaseUpdateService.validateLeaseUpdates({ startDate, endDate });
                if (!validation.isValid) {
                    errors.push({
                        studentId,
                        error: 'Validation failed',
                        details: validation.errors
                    });
                    continue;
                }
                
                // Update lease dates
                const result = await LeaseUpdateService.updateStudentLeaseDates(
                    studentId,
                    { startDate, endDate },
                    updatedBy
                );
                
                results.push({
                    studentId,
                    success: true,
                    data: result
                });
                
            } catch (error) {
                console.error(`❌ Error updating lease for student ${studentId}:`, error);
                errors.push({
                    studentId,
                    error: error.message
                });
            }
        }
        
        res.status(200).json({
            success: true,
            message: `Bulk lease update completed. ${results.length} successful, ${errors.length} failed.`,
            data: {
                successful: results,
                failed: errors,
                summary: {
                    total: updates.length,
                    successful: results.length,
                    failed: errors.length
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Error in bulk lease update:', error);
        
        res.status(500).json({
            success: false,
            message: 'Error in bulk lease update',
            error: error.message
        });
    }
};

/**
 * Get lease update history for a student
 * @route GET /api/admin/students/:studentId/lease/history
 * @access Private (Admin only)
 */
exports.getLeaseUpdateHistory = async (req, res) => {
    try {
        const { studentId } = req.params;
        
        console.log(`🔍 Admin ${req.user.email} getting lease history for student: ${studentId}`);
        
        // This would require implementing audit log retrieval
        // For now, return a placeholder response
        res.status(200).json({
            success: true,
            message: 'Lease update history retrieved successfully',
            data: {
                studentId,
                history: [],
                message: 'Lease update history feature coming soon'
            }
        });
        
    } catch (error) {
        console.error('❌ Error getting lease update history:', error);
        
        res.status(500).json({
            success: false,
            message: 'Error getting lease update history',
            error: error.message
        });
    }
};