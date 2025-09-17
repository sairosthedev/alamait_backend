const express = require('express');
const router = express.Router();
const { auth, checkAdminOrFinance } = require('../../middleware/auth');
const StudentStatusController = require('../../controllers/admin/studentStatusController');

/**
 * 🎯 STUDENT STATUS MANAGEMENT ROUTES
 * Handles student status updates and management
 */

/**
 * Update a specific student's status
 * PUT /api/admin/students/:studentId/status
 */
router.put('/:studentId/status', auth, checkAdminOrFinance, StudentStatusController.updateStudentStatus);

/**
 * Fix student status for a specific student (like Luba)
 * POST /api/admin/students/:studentId/fix-status
 */
router.post('/:studentId/fix-status', auth, checkAdminOrFinance, StudentStatusController.fixStudentStatus);

/**
 * Update all students' statuses (bulk operation)
 * POST /api/admin/students/status/bulk-update
 */
router.post('/status/bulk-update', auth, checkAdminOrFinance, StudentStatusController.bulkUpdateStudentStatuses);

/**
 * Handle expired students
 * POST /api/admin/students/status/handle-expired
 */
router.post('/status/handle-expired', auth, checkAdminOrFinance, StudentStatusController.handleExpiredStudents);

/**
 * Get student status summary
 * GET /api/admin/students/status/summary
 */
router.get('/status/summary', auth, checkAdminOrFinance, StudentStatusController.getStatusSummary);

module.exports = router;




